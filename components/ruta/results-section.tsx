"use client";

import { Clock, Wallet, ArrowRightLeft, Star, ChevronRight, MapPin, Navigation } from "lucide-react";
import { MapCanvas } from "./map-canvas";

const bestRoute = {
  label: "Best Route",
  badge: "Recommended",
  from: "IT Park, Lahug",
  to: "Colon Street",
  jeepney: "Code 04B – Lahug / IT Park – Ayala",
  transfer: "Code 01A – Ayala – Colon",
  fare: "₱13–₱16",
  time: "25–35 min",
  transfers: 1,
  steps: [
    { icon: MapPin, text: "Start at IT Park jeepney stop near Cebu IT Tower" },
    { icon: Navigation, text: "Ride Code 04B jeepney toward Ayala Center (10–15 min)" },
    { icon: ArrowRightLeft, text: "Transfer at Ayala Bus Terminal" },
    { icon: Navigation, text: "Ride Code 01A jeepney toward Colon (10–15 min)" },
    { icon: MapPin, text: "Alight at Colon Street, near Carbon Market" },
  ],
};

const altRoute = {
  label: "Alternative",
  badge: "Direct Option",
  from: "IT Park, Lahug",
  to: "Colon Street",
  jeepney: "Code 06D – IT Park – SM City – Downtown",
  fare: "₱10–₱13",
  time: "35–50 min",
  transfers: 0,
  steps: [
    { icon: MapPin, text: "Take Code 06D jeepney from IT Park terminal" },
    { icon: Navigation, text: "Ride direct to Downtown Cebu (35–50 min, no transfers)" },
    { icon: MapPin, text: "Alight near Colon – Jones Ave. intersection" },
  ],
};

function StatChip({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
        accent ? "bg-accent/10 text-accent" : "bg-secondary text-foreground"
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}

function BestRouteCard({ route }: { route: typeof bestRoute }) {
  return (
    <div className="bg-card rounded-xl sm:rounded-2xl border border-primary/20 p-4 sm:p-6 shadow-md flex flex-col gap-3 sm:gap-5 lg:col-span-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div>
          <span className="inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 sm:px-3 py-1 sm:py-1.5 rounded-full mb-1 sm:mb-2.5 bg-primary/10 text-primary">
            {route.badge}
          </span>
          <h3 className="font-bold text-foreground text-base sm:text-lg">{route.label}</h3>
        </div>
        <Star className="w-4 sm:w-5 h-4 sm:h-5 text-primary flex-shrink-0 fill-primary" />
      </div>

      {/* Route lines */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <span className="inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-primary flex-shrink-0" />
          <span className="font-medium text-foreground">{route.jeepney}</span>
        </div>
        {route.transfer && (
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span className="inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-accent flex-shrink-0" />
            <span className="font-medium text-foreground">{route.transfer}</span>
          </div>
        )}
      </div>

      {/* Key stats - horizontal layout */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 py-2 sm:py-4 border-y border-border">
        <div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 sm:mb-1">Time</p>
          <p className="text-sm sm:text-base font-bold text-foreground">{route.time}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 sm:mb-1">Fare</p>
          <p className="text-sm sm:text-base font-bold text-accent">{route.fare}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 sm:mb-1">Transfers</p>
          <p className="text-sm sm:text-base font-bold text-foreground">{route.transfers}</p>
        </div>
      </div>

      {/* Step-by-step - expanded */}
      <div>
        <p className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
          Step-by-step directions
        </p>
        <ol className="space-y-2 sm:space-y-3">
          {route.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 sm:gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <div className="w-4 sm:w-5 h-4 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold flex-shrink-0 bg-primary text-primary-foreground">
                  {i + 1}
                </div>
                {i < route.steps.length - 1 && (
                  <div className="w-px h-5 sm:h-6 bg-border mt-0.5 sm:mt-1" />
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-0.5">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <button className="w-full flex items-center justify-center gap-2 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-1 sm:mt-2">
        View Full Route <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
      </button>
    </div>
  );
}

function CompactRouteCard({ route }: { route: typeof altRoute }) {
  return (
    <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 shadow-sm flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full mb-1 sm:mb-2 bg-accent/10 text-accent">
            {route.badge}
          </span>
          <h4 className="font-semibold text-foreground text-xs sm:text-sm">{route.label}</h4>
        </div>
      </div>

      {/* Route line */}
      <div className="flex items-center gap-2 text-[11px] sm:text-xs">
        <span className="inline-block w-2 h-2 rounded-full bg-accent flex-shrink-0" />
        <span className="font-medium text-foreground">{route.jeepney}</span>
      </div>

      {/* Compact stats */}
      <div className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Travel time</span>
          <span className="font-semibold text-foreground">{route.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fare</span>
          <span className="font-semibold text-accent">{route.fare}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Transfers</span>
          <span className="font-semibold text-foreground">{route.transfers}</span>
        </div>
      </div>

      {/* Simplified steps */}
      <div className="text-[10px] sm:text-[11px] space-y-0.5 sm:space-y-1">
        {route.steps.map((step, i) => (
          <div key={i} className="flex gap-2 text-muted-foreground">
            <span className="font-semibold flex-shrink-0">{i + 1}.</span>
            <span>{step.text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button className="w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
        View Route <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export function ResultsSection() {
  return (
    <section id="results" className="py-16 sm:py-20 px-4 sm:px-6 bg-secondary/15">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <p className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-widest mb-2 sm:mb-3">Clear answers</p>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-balance text-foreground mb-3 sm:mb-4">
            Every jeepney code decoded
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg text-balance max-w-2xl leading-relaxed">
            Codes like 17B, 13C, 04B, and 01A become instantly clear. Each route shows the exact code, where it goes, exact fares, arrival times, and simple directions.
          </p>
        </div>

        {/* Prompt chip */}
        <div className="flex justify-center mb-8 sm:mb-10 px-2">
          <div className="inline-flex items-center gap-2 sm:gap-3 bg-card border border-border rounded-lg sm:rounded-2xl px-3 sm:px-6 py-2 sm:py-3 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0">Question</span>
            <span className="text-xs sm:text-sm font-medium text-foreground line-clamp-2">
              How do I get from IT Park to Colon?
            </span>
          </div>
        </div>

        {/* Main layout: 2-column hierarchy */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left column: Featured Best Route (larger, primary focus) */}
          <div className="lg:col-span-2">
            <BestRouteCard route={bestRoute} />
          </div>

          {/* Right column: Secondary stack */}
          <div className="flex flex-col gap-6">
            {/* Alternative route - compact */}
            <CompactRouteCard route={altRoute} />

            {/* Mini map / route legend card */}
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-border shadow-md bg-card flex-1 min-h-56 sm:min-h-64">
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: "#00000000",
                  backgroundImage: `
                    linear-gradient(to right, #e2e8f055 1px, transparent 1px),
                    linear-gradient(to bottom, #e2e8f055 1px, transparent 1px)
                  `,
                  backgroundSize: "44px 44px",
                }}
                aria-hidden="true"
              />
              <MapCanvas />

              {/* Route legend overlay */}
              <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 bg-card/90 backdrop-blur-sm rounded-lg sm:rounded-xl border border-border p-2 sm:p-2.5 shadow-sm space-y-1 sm:space-y-1.5">
                <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Legend</p>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 rounded-full bg-primary" />
                  <span className="text-[10px] sm:text-[11px] text-foreground">04B – Lahug</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 rounded-full bg-accent" />
                  <span className="text-[10px] sm:text-[11px] text-foreground">01A – Colon</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 rounded-full" style={{ background: "#6366f1" }} />
                  <span className="text-[10px] sm:text-[11px] text-foreground">06D – Downtown</span>
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 bg-card/90 backdrop-blur-sm rounded-lg border border-border px-2 sm:px-2.5 py-1 sm:py-1.5 shadow-sm">
                <p className="text-xs sm:text-xs font-semibold text-foreground">IT Park → Colon</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground">2 routes found · Cebu City</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
