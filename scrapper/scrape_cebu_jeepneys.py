#!/usr/bin/env python3
"""
Cebu jeepney route scraper -> JSON

What it does
- Scrapes a route index page
- Extracts route codes and route titles
- Optionally scrapes a more detailed page and tries to parse:
  - direction
  - roads
  - schools
  - malls / groceries
  - landmarks / terminals

Install
  pip install requests beautifulsoup4 lxml

Run
  python scrape_cebu_jeepneys.py

Output
  cebu_jeepney_routes.json
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RutaDatasetBot/1.0; +https://example.com)"
}

# Public pages discovered for Cebu jeepney route codes
INDEX_SOURCES = [
    "https://cebujeepneys.weebly.com/jeepney-routes.html",
    "https://ph.commutetour.com/travel/transport/jeep/cebu-city-jeep-route-code/",
]
WEEBLY_DETAIL_BASE = "https://cebujeepneys.weebly.com"

ROUTE_CODE_RE = re.compile(r"^(?:MI-\d{2}[A-Z]|\d{2}[A-Z]?|23D|62[BC])$", re.I)

SECTION_KEYS = {
    "Road:": "roads",
    "School:": "schools",
    "Mall / Grocery:": "malls_groceries",
    "Church:": "churches",
    "Gov't:": "government",
    "Hotel:": "hotels",
    "Health:": "health",
    "Terminal:": "terminals",
    "Info:": "info",
}

@dataclass
class RouteRecord:
    code: str
    label: Optional[str] = None
    route_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    source_urls: List[str] = field(default_factory=list)
    roads: List[str] = field(default_factory=list)
    schools: List[str] = field(default_factory=list)
    malls_groceries: List[str] = field(default_factory=list)
    churches: List[str] = field(default_factory=list)
    government: List[str] = field(default_factory=list)
    hotels: List[str] = field(default_factory=list)
    health: List[str] = field(default_factory=list)
    terminals: List[str] = field(default_factory=list)
    info: List[str] = field(default_factory=list)
    raw_sections: Dict[str, str] = field(default_factory=dict)

def fetch(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def normalize_code(text: str) -> str:
    text = text.replace("\u200b", "").replace("​", "")
    text = clean(text).upper()
    text = re.sub(r"[^A-Z0-9\-]", "", text)

    # Some pages emit partial variants like "23-"; keep the base code instead.
    if text.endswith("-"):
      text = text[:-1]

    return text

def dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for x in items:
        key = x.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(x.strip())
    return out

def strip_route_title_prefix(text: str, code: Optional[str] = None) -> str:
    text = clean(text)
    patterns = [
        r"^cebu jeepneys\s*-\s*route map for\s*[A-Z0-9\-]+\s*-\s*",
        r"^cebu jeepneys\s*-\s*",
        r"^route map for\s*[A-Z0-9\-]+\s*-\s*",
    ]
    if code:
        patterns.insert(0, rf"^{re.escape(code)}\s*[-:]\s*")

    for pattern in patterns:
        text = re.sub(pattern, "", text, flags=re.I)

    return clean(text)

def trim_route_endpoint(text: str) -> str:
    text = clean(text.strip(" .:-"))
    if not text:
        return text

    for separator in [" - ", ". ", " via "]:
        if separator in text:
            text = text.split(separator, 1)[0]
            break

    return clean(text.strip(" .:-"))

def split_route_phrase(text: str) -> tuple[Optional[str], Optional[str]]:
    text = strip_route_title_prefix(text)
    text = clean(text.strip(" .:-"))
    m = re.search(r"(.+?)\s+to\s+(.+)", text, re.I)
    if not m:
        return None, None

    origin = trim_route_endpoint(m.group(1))
    destination = trim_route_endpoint(m.group(2))
    if not origin or not destination:
        return None, None
    return origin, destination

def build_weebly_detail_url(code: str) -> str:
    return f"{WEEBLY_DETAIL_BASE}/{code.lower()}.html"

def parse_index_weebly(html: str, url: str) -> Dict[str, RouteRecord]:
    soup = BeautifulSoup(html, "lxml")
    routes: Dict[str, RouteRecord] = {}

    candidates: List[str] = []

    for el in soup.select(".wsite-button-inner"):
        text = normalize_code(el.get_text(" "))
        if text:
            candidates.append(text)

    for text in soup.stripped_strings:
        normalized = normalize_code(text)
        if normalized:
            candidates.append(normalized)

    for candidate in dedupe_keep_order(candidates):
        if not ROUTE_CODE_RE.fullmatch(candidate):
            continue
        routes.setdefault(
            candidate,
            RouteRecord(code=candidate, label=candidate, source_urls=[url]),
        )
    return routes

def enrich_from_weebly_detail(routes: Dict[str, RouteRecord]) -> Dict[str, RouteRecord]:
    for code, rec in routes.items():
        detail_url = build_weebly_detail_url(code)

        try:
            html = fetch(detail_url)
        except Exception:
            continue

        soup = BeautifulSoup(html, "lxml")
        if detail_url not in rec.source_urls:
            rec.source_urls.append(detail_url)

        title = clean(soup.title.get_text(" ")) if soup.title else ""
        meta_description = ""
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            meta_description = clean(str(meta["content"]))

        h2_texts = [clean(el.get_text(" ")) for el in soup.find_all("h2")]
        paragraph_texts = [
            clean(el.get_text(" "))
            for el in soup.select("div.paragraph")
            if clean(el.get_text(" "))
        ]

        if not rec.route_name:
            for text in [meta_description, title, *h2_texts, *paragraph_texts]:
                origin, destination = split_route_phrase(text)
                if origin and destination:
                    rec.origin = rec.origin or origin
                    rec.destination = rec.destination or destination
                    rec.route_name = f"{rec.origin} to {rec.destination}"
                    break

        if not rec.info:
            for text in paragraph_texts:
                if " - " not in text:
                    continue
                if text.lower().startswith("for convenient viewing"):
                    continue
                rec.info.append(text)
                break

        if not rec.roads:
            for text in paragraph_texts:
                if " - " not in text:
                    continue
                if text.lower().startswith("for convenient viewing"):
                    continue
                parts = dedupe_keep_order([x.strip(" .") for x in text.split(" - ") if x.strip()])
                if len(parts) >= 4:
                    rec.roads.extend(parts)
                    break

        rec.roads = dedupe_keep_order(rec.roads)
        rec.info = dedupe_keep_order(rec.info)

    return routes

def parse_index_commutetour(html: str, url: str) -> Dict[str, RouteRecord]:
    """
    Heuristic parser:
    - looks for headings like '## 10F Route Bulacao to Colon'
    - or text links like '10F - Bulacao - Colon'
    """
    soup = BeautifulSoup(html, "lxml")
    routes: Dict[str, RouteRecord] = {}

    body_text = soup.get_text("\n", strip=True)
    for line in body_text.splitlines():
        line = clean(line)
        m = re.match(r"^([A-Z0-9\-]+)\s*-\s*(.+?)\s*-\s*(.+)$", line, re.I)
        if m:
            code, origin, destination = m.groups()
            code = normalize_code(code)
            if ROUTE_CODE_RE.fullmatch(code):
                rec = routes.setdefault(code, RouteRecord(code=code))
                rec.origin = rec.origin or origin.strip()
                rec.destination = rec.destination or destination.strip()
                rec.route_name = rec.route_name or f"{origin.strip()} to {destination.strip()}"
                if url not in rec.source_urls:
                    rec.source_urls.append(url)

        m2 = re.match(r"^([A-Z0-9\-]+)\s+Route\s+(.+?)\s+to\s+(.+)$", line, re.I)
        if m2:
            code, origin, destination = m2.groups()
            code = normalize_code(code)
            if not ROUTE_CODE_RE.fullmatch(code):
                continue
            rec = routes.setdefault(code, RouteRecord(code=code))
            rec.origin = rec.origin or origin.strip()
            rec.destination = rec.destination or destination.strip()
            rec.route_name = rec.route_name or f"{origin.strip()} to {destination.strip()}"
            if url not in rec.source_urls:
                rec.source_urls.append(url)
    return routes

def enrich_from_commutetour_detail_text(html: str, routes: Dict[str, RouteRecord], url: str) -> Dict[str, RouteRecord]:
    """
    Text-based heuristic that scans blocks beginning with:
      '## 10F Route Bulacao to Colon'
    and captures known section labels after it.
    """
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text("\n", strip=True)
    lines = [clean(x) for x in text.splitlines() if clean(x)]

    current_code = None
    for i, line in enumerate(lines):
        m = re.match(r"^([A-Z0-9\-]+)\s+Route\s+(.+?)\s+to\s+(.+)$", line, re.I)
        if m:
            code, origin, destination = m.groups()
            current_code = normalize_code(code)
            if not ROUTE_CODE_RE.fullmatch(current_code):
                current_code = None
                continue
            rec = routes.setdefault(current_code, RouteRecord(code=current_code))
            rec.origin = rec.origin or origin
            rec.destination = rec.destination or destination
            rec.route_name = rec.route_name or f"{origin} to {destination}"
            if url not in rec.source_urls:
                rec.source_urls.append(url)
            continue

        if not current_code:
            continue

        for prefix, field_name in SECTION_KEYS.items():
            if line.startswith(prefix):
                value = line[len(prefix):].strip()
                rec = routes[current_code]
                rec.raw_sections[prefix.rstrip(":")] = value
                if field_name == "info":
                    rec.info.extend([value] if value else [])
                else:
                    parts = dedupe_keep_order([x.strip() for x in value.split(",") if x.strip()])
                    getattr(rec, field_name).extend(parts)

    # Final cleanup
    for rec in routes.values():
        for field_name in [
            "roads", "schools", "malls_groceries", "churches", "government",
            "hotels", "health", "terminals", "info"
        ]:
            setattr(rec, field_name, dedupe_keep_order(getattr(rec, field_name)))
    return routes

def main() -> None:
    routes: Dict[str, RouteRecord] = {}

    for src in INDEX_SOURCES:
        print(f"Fetching: {src}")
        html = fetch(src)
        if "weebly.com/jeepney-routes" in src:
            parsed = parse_index_weebly(html, src)
        else:
            parsed = parse_index_commutetour(html, src)
            routes = enrich_from_commutetour_detail_text(html, routes, src)

        for code, rec in parsed.items():
            existing = routes.get(code)
            if not existing:
                routes[code] = rec
            else:
                existing.label = existing.label or rec.label
                existing.route_name = existing.route_name or rec.route_name
                existing.origin = existing.origin or rec.origin
                existing.destination = existing.destination or rec.destination
                existing.source_urls = dedupe_keep_order(existing.source_urls + rec.source_urls)

        time.sleep(1)

    routes = enrich_from_weebly_detail(routes)

    output = {
        "dataset_name": "cebu_jeepney_routes",
        "generated_from": INDEX_SOURCES,
        "route_count": len(routes),
        "routes": [asdict(routes[k]) for k in sorted(routes.keys())],
    }

    with open("cebu_jeepney_routes.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Saved cebu_jeepney_routes.json with {len(routes)} routes")

if __name__ == "__main__":
    main()
