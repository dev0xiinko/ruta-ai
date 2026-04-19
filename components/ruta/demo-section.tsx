"use client";

import { Sparkles } from "lucide-react";
import { trustPoints } from "./content";
import { RouteBotPanel } from "./route-bot-panel";

const EXAMPLE_PROMPT = "How do I get from IT Park to Colon?";

export function DemoSection() {
  return (
    <section id="demo" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            Product walkthrough
          </p>
          <h2 className="section-heading mt-4">
            Ask the route question the way a real rider would.
          </h2>
          <p className="section-copy mt-5">
            The experience starts with a ready-to-send question and turns it into a direct,
            commuter-friendly answer instead of a generic route dump.
          </p>
        </div>

        <div className="mt-10">
          <RouteBotPanel />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.22)] lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Ready to try
            </p>
            <p className="mt-3 text-base font-semibold text-foreground">
              Press send to run the IT Park to Colon journey.
            </p>
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-background/60 p-4">
              <p className="text-sm leading-6 text-muted-foreground">{EXAMPLE_PROMPT}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Starts with a prefilled route prompt so the interaction feels immediate.
            </div>
          </div>

          {trustPoints.map((point) => (
            <div
              key={point.label}
              className="flex items-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-5 py-5 shadow-xl shadow-black/10"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15">
                <point.icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{point.label}</p>
                <p className="text-sm text-muted-foreground">{point.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
