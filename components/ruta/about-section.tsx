"use client";

import { Navigation, GitBranch, Clock, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { DynamicMap } from "./dynamic-map";
import { useState } from "react";

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

  return (
    <section id="about" className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="mb-12 sm:mb-16 max-w-2xl">
          <p className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-widest mb-3 sm:mb-4">How it works</p>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 text-balance">
            Understanding Cebu&apos;s jeepney codes
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg leading-relaxed">
            RUTA decodes Cebu&apos;s jeepney route system so you instantly know where codes like 17B, 13C, 04B, and 01A actually go. Real data, real routes, real codes made simple.
          </p>
        </div>

        {/* Immersive map container - full width, no borders */}
        <div className="relative mb-12 sm:mb-16 -mx-4 sm:-mx-6 px-4 sm:px-6">
          {/* Mobile map toggle button */}
          <div className="sm:hidden flex justify-between items-center bg-secondary/50 border border-border rounded-t-2xl p-3 mb-0">
            <h3 className="text-sm font-semibold text-foreground">Route Map</h3>
            <button
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="p-1 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Toggle map"
            >
              {isMapExpanded ? (
                <ChevronUp className="w-5 h-5 text-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-foreground" />
              )}
            </button>
          </div>

          {/* Main map - truly full-width */}
          {(typeof window !== 'undefined' ? isMapExpanded || window.innerWidth >= 768 : true) ? (
            <div className={`relative overflow-hidden bg-card shadow-lg ${isMapExpanded ? 'h-64 sm:h-96 lg:h-[540px] rounded-b-2xl sm:rounded-3xl' : 'h-96 lg:h-[540px] rounded-3xl'}`}>
              <DynamicMap />

              {/* Floating route preview card - positioned top-left */}
              <div className="absolute top-4 sm:top-8 left-4 sm:left-8 z-20 w-72 sm:w-80">
              <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xl hover:shadow-2xl transition-shadow text-left">
                {/* Header */}
                <div className="mb-3 sm:mb-4">
                  <p className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wide mb-1.5 sm:mb-2">Route Code</p>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-0.5">
                    Code 04B Route
                  </h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Lahug area destination
                  </p>
                </div>

                {/* Info grid */}
                <div className="space-y-2 sm:space-y-2.5 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200/50">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Code</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">04B</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Color</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">Yellow</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Fare</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">₱11–₱15</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Est. Time</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">20–30 min</p>
                    </div>
                  </div>
                </div>

                {/* Route legend */}
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Details</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary flex-shrink-0"></div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Main route (Code 04B)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0"></div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Key stops</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          ) : null}
        </div>

        {/* Minimal feature row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group flex items-start gap-2 sm:gap-3 rounded-lg p-3 sm:p-4 transition-colors hover:bg-secondary/40"
            >
              <div className="flex-shrink-0 w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center mt-0.5 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
                {f.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
