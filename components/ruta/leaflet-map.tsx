"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { LngLatBoundsLike, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type TrafficLevel = "light" | "moderate" | "heavy";
type LngLat = [number, number];

const ORIGIN = {
  name: "ACT Cyber Tower 1",
  lat: 10.3039,
  lng: 123.8948,
};

const DESTINATION = {
  name: "Cebu IT Park",
  lat: 10.3316,
  lng: 123.9060,
};

const corridorWaypoints: LngLat[] = [
  [123.8948, 10.3039], // ACT Cyber Tower 1
  [123.8962, 10.3048], // Fuente / Osmeña
  [123.8984, 10.3077], // Capitol
  [123.9023, 10.3161], // Escario
  [123.9048, 10.3210], // Gorordo
  [123.9050, 10.3278], // JY Square area
  [123.9054, 10.3292], // Salinas
  [123.9056, 10.3302], // Geonzon
  [123.9060, 10.3316], // IT Park
];

const routeStops = [
  { name: "ACT Cyber Tower 1", type: "Origin", lat: 10.3039, lng: 123.8948 },
  { name: "Fuente Osmeña", type: "Major stop", lat: 10.3048, lng: 123.8962 },
  { name: "Cebu Provincial Capitol", type: "Major stop", lat: 10.3077, lng: 123.8984 },
  { name: "Escario", type: "Major stop", lat: 10.3161, lng: 123.9023 },
  { name: "Gorordo", type: "Major stop", lat: 10.3210, lng: 123.9048 },
  { name: "JY Square / Lahug", type: "Major stop", lat: 10.3278, lng: 123.9050 },
  { name: "Salinas Drive", type: "Major stop", lat: 10.3292, lng: 123.9054 },
  { name: "Cebu IT Park", type: "Destination", lat: 10.3316, lng: 123.9060 },
];

const trafficSegments: Array<{
  name: string;
  lat: number;
  lng: number;
  level: TrafficLevel;
}> = [
  { name: "Fuente Osmeña", lat: 10.3048, lng: 123.8962, level: "heavy" },
  { name: "Capitol corridor", lat: 10.3077, lng: 123.8984, level: "moderate" },
  { name: "Escario corridor", lat: 10.3161, lng: 123.9023, level: "moderate" },
  { name: "IT Park entry", lat: 10.3316, lng: 123.9060, level: "moderate" },
];

function trafficColor(level: TrafficLevel) {
  if (level === "light") return "#22c55e";
  if (level === "moderate") return "#f59e0b";
  return "#ef4444";
}

function decodePolyline(str: string, precision = 5): LngLat[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: LngLat[] = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

function buildBounds(coords: LngLat[]): LngLatBoundsLike {
  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function RutaMapLibre() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<LngLat[]>(corridorWaypoints);
  const [isMobile, setIsMobile] = useState(false);

  const bounds = useMemo(() => buildBounds(corridorWaypoints), []);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 640);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSnappedCorridor() {
      try {
        const coordinates = corridorWaypoints
          .map(([lng, lat]) => `${lng},${lat}`)
          .join(";");

        const url =
          `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
          `?overview=full&geometries=polyline&steps=false`;

        const res = await fetch(url);
        const data = await res.json();

        const encoded = data?.routes?.[0]?.geometry;
        if (!encoded) return;

        const decoded = decodePolyline(encoded);

        if (active && decoded.length > 1) {
          setRouteGeometry(decoded);
        }
      } catch (error) {
        console.error("Failed to load snapped 17B corridor:", error);
      }
    }

    loadSnappedCorridor();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          cartoDark: {
            type: "raster",
            tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "cartoDark",
          },
        ],
      },
      center: [123.9005, 10.317],
      zoom: 13,
      attributionControl: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      map.fitBounds(bounds, {
        padding: isMobile ? 20 : 56,
        duration: 0,
      });

      map.addSource("route-17b", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: routeGeometry,
          },
          properties: {},
        },
      });

      map.addLayer({
        id: "route-17b-outline",
        type: "line",
        source: "route-17b",
        paint: {
          "line-color": "rgba(255,255,255,0.14)",
          "line-width": isMobile ? 8 : 11,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      map.addLayer({
        id: "route-17b-glow",
        type: "line",
        source: "route-17b",
        paint: {
          "line-color": "#8b5cf6",
          "line-width": isMobile ? 6 : 8,
          "line-opacity": 0.22,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      map.addLayer({
        id: "route-17b-main",
        type: "line",
        source: "route-17b",
        paint: {
          "line-color": "#a78bfa",
          "line-width": isMobile ? 3.5 : 5,
          "line-opacity": 0.96,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      map.addSource("stops", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: routeStops.map((stop) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [stop.lng, stop.lat],
            },
            properties: {
              name: stop.name,
              type: stop.type,
            },
          })),
        },
      });

      map.addLayer({
        id: "stops-circles",
        type: "circle",
        source: "stops",
        paint: {
          "circle-radius": isMobile ? 4 : 5,
          "circle-color": "#a78bfa",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0f172a",
        },
      });

      map.addSource("traffic", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: trafficSegments.map((item) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [item.lng, item.lat],
            },
            properties: {
              name: item.name,
              level: item.level,
              color: trafficColor(item.level),
            },
          })),
        },
      });

      map.addLayer({
        id: "traffic-circles",
        type: "circle",
        source: "traffic",
        paint: {
          "circle-radius": isMobile ? 6 : 8,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.32,
          "circle-stroke-width": 2,
          "circle-stroke-color": ["get", "color"],
        },
      });

      const originEl = document.createElement("div");
      originEl.className =
        "h-4 w-4 sm:h-5 sm:w-5 rounded-full border-[3px] border-white bg-amber-500 shadow-[0_10px_24px_rgba(2,6,23,0.45)]";

      const destinationEl = document.createElement("div");
      destinationEl.className =
        "h-4 w-4 sm:h-5 sm:w-5 rounded-full border-[3px] border-white bg-teal-500 shadow-[0_10px_24px_rgba(2,6,23,0.45)]";

      new maplibregl.Marker({ element: originEl })
        .setLngLat([ORIGIN.lng, ORIGIN.lat])
        .addTo(map);

      new maplibregl.Marker({ element: destinationEl })
        .setLngLat([DESTINATION.lng, DESTINATION.lat])
        .addTo(map);

      const clickPopup = (
        layerId: "stops-circles" | "traffic-circles",
        formatter: (props: Record<string, unknown>) => string
      ) => {
        map.on("click", layerId, (e) => {
          const feature = e.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;

          const [lng, lat] = feature.geometry.coordinates as [number, number];
          new maplibregl.Popup({ offset: 12 })
            .setLngLat([lng, lat])
            .setHTML(formatter((feature.properties ?? {}) as Record<string, unknown>))
            .addTo(map);
        });

        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      };

      clickPopup(
        "stops-circles",
        (props) => `
          <div style="min-width:140px">
            <div style="font-weight:600;color:#0f172a">${String(props.name ?? "")}</div>
            <div style="font-size:12px;color:#64748b">${String(props.type ?? "")}</div>
          </div>
        `
      );

      clickPopup(
        "traffic-circles",
        (props) => `
          <div style="min-width:140px">
            <div style="font-weight:600;color:#0f172a">${String(props.name ?? "")}</div>
            <div style="font-size:12px;color:#64748b">${String(props.level ?? "")} traffic</div>
          </div>
        `
      );
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bounds, routeGeometry, isMobile]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("route-17b") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: routeGeometry,
      },
      properties: {},
    });

    map.fitBounds(buildBounds(routeGeometry), {
      padding: isMobile ? 20 : 56,
      duration: 500,
    });
  }, [routeGeometry, isMobile]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="relative h-full min-h-[260px] w-full overflow-hidden rounded-[20px] bg-slate-950 sm:min-h-[420px] sm:rounded-[28px] lg:min-h-[520px]">
      <div ref={containerRef} className="h-full w-full" />

      {/* lighter mobile overlay, stronger desktop overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: isMobile
            ? `
              linear-gradient(to top, rgba(2,6,23,0.55), rgba(2,6,23,0.08) 35%, rgba(2,6,23,0.10)),
              linear-gradient(to right, rgba(2,6,23,0.32), rgba(2,6,23,0) 12%, rgba(2,6,23,0) 88%, rgba(2,6,23,0.32))
            `
            : `
              linear-gradient(to right, rgba(2,6,23,0.92), rgba(2,6,23,0) 10%, rgba(2,6,23,0) 90%, rgba(2,6,23,0.92)),
              linear-gradient(to bottom, rgba(2,6,23,0.45), rgba(2,6,23,0) 12%, rgba(2,6,23,0) 88%, rgba(2,6,23,0.72))
            `,
        }}
      />

      {/* desktop card */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 hidden w-[320px] rounded-3xl border border-white/10 bg-slate-950/78 p-5 text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl md:block">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
          Route Preview
        </p>
        <h3 className="text-lg font-semibold tracking-tight text-white">
          ACT Cyber Tower 1 → IT Park
        </h3>
        <p className="mt-1 text-sm text-slate-400">17B corridor reference</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Jeepney</p>
            <p className="mt-1 text-sm font-semibold text-white">17B</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Trip Type</p>
            <p className="mt-1 text-sm font-semibold text-white">Direct</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Fare</p>
            <p className="mt-1 text-sm font-semibold text-white">₱13–₱18</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">ETA</p>
            <p className="mt-1 text-sm font-semibold text-white">20–30 min</p>
          </div>
        </div>
      </div>

      {/* mobile compact top chip */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 md:hidden">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-slate-950/82 px-3 py-2 text-[11px] text-slate-200 shadow-[0_18px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <span className="font-semibold text-blue-300">17B</span>
          <span className="truncate">ACT Cyber Tower 1 → IT Park</span>
        </div>
      </div>

      {/* mobile bottom card */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 md:hidden">
        <div className="rounded-2xl border border-white/10 bg-slate-950/82 p-3 text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.20em] text-blue-300">
                Route Preview
              </p>
              <h3 className="mt-1 truncate text-sm font-semibold text-white">
                ACT Cyber Tower 1 → IT Park
              </h3>
              <p className="mt-1 text-xs text-slate-400">17B · Direct</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-slate-400">ETA</p>
              <p className="text-sm font-semibold text-white">20–30 min</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] text-slate-400">Fare</p>
              <p className="text-xs font-semibold text-white">₱13–₱18</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] text-slate-400">Traffic</p>
              <p className="text-xs font-semibold text-white">Moderate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}