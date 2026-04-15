"use client";

import {
  Navigation,
  GitBranch,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DynamicMap } from "./dynamic-map";
import { useEffect, useState } from "react";

const features = [
  {
    icon: Navigation,
    title: "Decode jeepney route codes",
  },
  {
    icon: GitBranch,
    title: "Find routes by code (17B, 13C, 04B)",
  },
  {
    icon: Clock,
    title: "Exact fares and arrival times",
  },
  {
    icon: MapPin,
    title: "Step-by-step directions",
  },
];

export function AboutSection() {
  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsDesktop(window.innerWidth >= 640);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const shouldShowMap = isDesktop || isMapExpanded;

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-background px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl sm:mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary sm:mb-4 sm:text-sm">
            How it works
          </p>

          <h2 className="mb-4 text-2xl font-bold text-balance text-foreground sm:mb-6 sm:text-4xl lg:text-5xl">
            Understanding Cebu&apos;s jeepney codes
          </h2>

          <p className="text-sm leading-relaxed text-muted-foreground sm:text-lg">
            RUTA decodes Cebu&apos;s jeepney route system so you instantly know
            where codes like 17B, 13C, 04B, and 01A actually go. Real data,
            real routes, real codes made simple.
          </p>
        </div>

        <div className="relative mb-12 -mx-4 px-4 sm:mb-16 sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between rounded-t-2xl border border-border bg-secondary/50 p-3 sm:hidden">
            <h3 className="text-sm font-semibold text-foreground">Route Map</h3>

            <button
              onClick={() => setIsMapExpanded((prev) => !prev)}
              className="rounded-lg p-1 transition-colors hover:bg-secondary"
              aria-label="Toggle map"
              type="button"
            >
              {isMapExpanded ? (
                <ChevronUp className="h-5 w-5 text-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>

          {shouldShowMap ? (
            <div
              className={[
                "relative overflow-hidden bg-card shadow-lg",
                isDesktop
                  ? "h-[420px] rounded-3xl lg:h-[540px]"
                  : isMapExpanded
                    ? "h-[380px] rounded-b-2xl"
                    : "h-0 overflow-hidden border-0",
              ].join(" ")}
            >
              <DynamicMap />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group flex items-start gap-2 rounded-lg p-3 transition-colors hover:bg-secondary/40 sm:gap-3 sm:p-4"
            >
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15 transition-colors group-hover:bg-primary/20">
                <f.icon className="h-3 w-3 text-primary" />
              </div>

              <p className="text-xs leading-snug font-medium text-foreground sm:text-sm">
                {f.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}