"use client";

import { MapPin, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { WaitlistModal } from "./waitlist-modal";
import { AnimatedCodes } from "./animated-codes";

function FloatingRouteChips() {
  const chips = [
    { label: "01A", className: "left-[8%] top-[22%] animate-[float_7s_ease-in-out_infinite]" },
    { label: "04B", className: "right-[12%] top-[18%] animate-[float_8s_ease-in-out_infinite]" },
    { label: "17B", className: "left-[16%] bottom-[24%] animate-[float_9s_ease-in-out_infinite]" },
    { label: "12L", className: "right-[18%] bottom-[20%] animate-[float_6.5s_ease-in-out_infinite]" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={`absolute ${chip.className} rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground shadow-lg backdrop-blur-md`}
        >
          {chip.label}
        </div>
      ))}
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(20,184,166,0.10),transparent_24%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--background)),hsl(var(--secondary)/0.35))]" />

      {/* soft grid */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* animated spotlight */}
      <div className="absolute left-1/2 top-[14%] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="absolute right-[8%] top-[28%] h-[18rem] w-[18rem] rounded-full bg-accent/10 blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
      <div className="absolute left-[10%] bottom-[12%] h-[16rem] w-[16rem] rounded-full bg-primary/8 blur-3xl animate-[pulse_9s_ease-in-out_infinite]" />

      {/* route-line style strokes */}
      <svg
        className="absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M120 680C260 590 300 500 420 470C560 435 620 560 760 520C910 478 950 310 1110 280C1190 264 1260 278 1320 320"
          stroke="url(#routeBlue)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="10 12"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-220"
            dur="10s"
            repeatCount="indefinite"
          />
        </path>

        <path
          d="M180 300C340 340 420 260 560 290C700 322 800 430 930 420C1080 408 1140 330 1280 220"
          stroke="url(#routeTeal)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="8 14"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="180"
            dur="12s"
            repeatCount="indefinite"
          />
        </path>

        <circle cx="420" cy="470" r="6" fill="rgba(59,130,246,0.8)">
          <animate attributeName="r" values="6;8;6" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="930" cy="420" r="6" fill="rgba(20,184,166,0.75)">
          <animate attributeName="r" values="6;8;6" dur="5s" repeatCount="indefinite" />
        </circle>

        <defs>
          <linearGradient id="routeBlue" x1="120" y1="680" x2="1320" y2="320" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(59,130,246,0.15)" />
            <stop offset="0.45" stopColor="rgba(59,130,246,0.85)" />
            <stop offset="1" stopColor="rgba(59,130,246,0.15)" />
          </linearGradient>
          <linearGradient id="routeTeal" x1="180" y1="300" x2="1280" y2="220" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(20,184,166,0.15)" />
            <stop offset="0.45" stopColor="rgba(20,184,166,0.8)" />
            <stop offset="1" stopColor="rgba(20,184,166,0.15)" />
          </linearGradient>
        </defs>
      </svg>

      {/* fade bottom */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

export function HeroSection() {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  return (
    <section className="relative overflow-hidden bg-background">
      <AnimatedBackground />
      <FloatingRouteChips />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 pb-12 pt-24 text-center sm:px-6 sm:pb-20 sm:pt-32">
        {/* headline */}
        <h1 className="mt-6 max-w-5xl text-balance text-4xl font-bold tracking-tight text-foreground sm:mt-8 sm:text-6xl lg:text-7xl xl:text-[5.25rem] xl:leading-[0.95]">
          <span className="block">What does</span>
          <span className="my-2 block">
            <AnimatedCodes />
          </span>
          <span className="block">even mean?</span>
        </h1>

        {/* subheading */}
        <p className="mt-5 max-w-2xl px-2 text-base leading-7 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
          RUTA helps people understand Cebu jeepney routes — decoding route codes,
          showing where they pass, and suggesting what to ride with smarter, traffic-aware guidance.
        </p>

        {/* CTA */}
        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 px-2 sm:mt-10 sm:w-auto sm:flex-row">
          <Button
            onClick={() => setIsWaitlistOpen(true)}
            size="lg"
            className="h-12 w-full rounded-xl bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 sm:w-auto"
          >
            Join Waitlist
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* value strip */}
        <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 px-2 sm:mt-14 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            AI decodes jeepney route codes
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            Suggests what to ride
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            Traffic-aware route suggestions
          </div>
        </div>
      </div>

      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
      />

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </section>
  );
}