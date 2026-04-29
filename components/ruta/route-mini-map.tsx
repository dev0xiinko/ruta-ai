"use client";

import type { RouteMapOverview } from "@/lib/ruta/contracts";

type RouteMiniMapProps = {
  map: RouteMapOverview;
};

function projectPoints(points: RouteMapOverview["points"]) {
  const padding = 20;
  const width = 100;
  const height = 100;

  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngSpan = Math.max(maxLng - minLng, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);

  return points.map((point) => {
    const x = padding + ((point.lng - minLng) / lngSpan) * (width - padding * 2);
    const y = height - padding - ((point.lat - minLat) / latSpan) * (height - padding * 2);
    return { ...point, x, y };
  });
}

function pointColor(kind: string) {
  if (kind === "origin") return "#22c55e";
  if (kind === "destination") return "#ef4444";
  return "#38bdf8";
}

export function RouteMiniMap({ map }: RouteMiniMapProps) {
  if (!map.feasible || map.points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-background/30 p-4">
        <p className="text-sm text-muted-foreground">{map.note}</p>
      </div>
    );
  }

  const points = projectPoints(map.points);
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-white/10 bg-background/30 p-4">
      <svg viewBox="0 0 100 100" className="h-48 w-full rounded-xl bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.04))]">
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#grid)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="rgba(167,139,250,0.9)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <g key={`${point.kind}-${point.label}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill={pointColor(point.kind)} stroke="white" strokeWidth="1" />
            <text
              x={point.x}
              y={point.y - 5}
              textAnchor="middle"
              fill="white"
              fontSize="4"
              style={{ paintOrder: "stroke", stroke: "rgba(15,23,42,0.8)", strokeWidth: 1.5 }}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{map.note}</p>
    </div>
  );
}
