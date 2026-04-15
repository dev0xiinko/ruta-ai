"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

const RutaMapLibre = dynamic(
  () => import("./leaflet-map").then((mod) => mod.RutaMapLibre),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-secondary/30">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export function DynamicMap() {
  return <RutaMapLibre />;
}