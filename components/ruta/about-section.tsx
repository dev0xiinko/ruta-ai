"use client";

import { DynamicMap } from "./dynamic-map";
import { processSteps } from "./content";

export function AboutSection() {
  return (
    <section id="about" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            How it works
          </p>
          <h2 className="section-heading mt-4">
            Understanding Cebu&apos;s jeepney codes
          </h2>
          <p className="section-copy mt-5">
            RUTA decodes Cebu&apos;s jeepney route system so you instantly know where
            codes like 17B, 17C, 17D, 04B, and 01A actually go. Real route logic,
            clearer guidance, and commuter-friendly direction all in one flow.
          </p>
        </div>

        <div className="relative mt-12 sm:mt-14">
          <div className="pointer-events-none absolute inset-x-[8%] -top-8 h-24 rounded-full bg-primary/12 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-[18%] bottom-0 h-28 rounded-full bg-[color:rgb(130_104_255_/_0.14)] blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(7,12,24,0.98),rgba(5,8,18,0.98))] p-3 shadow-[0_28px_120px_rgba(0,0,0,0.45)] sm:p-4">
            <div className="overflow-hidden rounded-[1.7rem] border border-white/6 bg-[#050814]">
              <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(8,15,30,0.92),rgba(8,15,30,0.74))] px-5 py-4 sm:px-7 sm:py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">
                  Route preview
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">
                      17-series direct corridor
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400 sm:text-base">
                      IT Park to Colon is better explained as a direct 17B, 17C, or 17D ride,
                      not an Ayala transfer chain.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-[14rem]">
                    <div className="rounded-2xl border border-white/6 bg-white/5 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        Jeepney
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">17B / 17C / 17D</p>
                    </div>
                    <div className="rounded-2xl border border-white/6 bg-white/5 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        Trip type
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">Direct</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="h-[420px] sm:h-[520px] lg:h-[620px]">
                  <DynamicMap />
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#050814] to-transparent" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {processSteps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
