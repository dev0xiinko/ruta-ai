"use client";

import { AlertCircle, ArrowRightLeft, CircleDollarSign, Route } from "lucide-react";

const confusionPoints = [
  {
    icon: Route,
    title: "Route codes feel cryptic",
    description:
      "Most riders see labels like 17B, 17C, or 04B without a clear explanation of where those routes actually pass.",
  },
  {
    icon: ArrowRightLeft,
    title: "Transfers are easy to overcomplicate",
    description:
      "People often assume they need to switch rides when a direct jeepney route already exists for the trip.",
  },
  {
    icon: CircleDollarSign,
    title: "Fare expectations are inconsistent",
    description:
      "Minimum fares differ between traditional and modern units, and riders rarely know what range to expect before boarding.",
  },
];

const rutaFixes = [
  "Translate jeepney codes into recognizable places and corridors.",
  "Surface the direct route first before suggesting any transfer.",
  "Show practical fare guidance instead of pretending to know an exact fixed price.",
  "Explain where to board and where to watch for your stop.",
];

export function ResultsSection() {
  return (
    <section id="results" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-full">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            Why riders get confused
          </p>
          <h2 className="section-heading mt-4">
            Commuting in Cebu is not hard because people cannot ride. It is hard because the
            answers are usually unclear.
          </h2>
          <p className="section-copy mt-5">
            Riders are forced to decode route labels, guess whether a transfer is needed, and make
            fare assumptions on the fly. RUTA is meant to turn that uncertainty into one readable
            answer.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {confusionPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/15"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                <point.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">{point.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[2rem] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                <AlertCircle className="h-3.5 w-3.5" />
                What RUTA changes
              </p>
              <h3 className="mt-4 font-display text-3xl font-bold text-foreground">
                One route answer should replace five commute guesses.
              </h3>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Instead of making the rider piece together route codes, transfer logic, and fare
                expectations, RUTA should provide a direct interpretation of the trip in one place.
              </p>
            </div>

            <div className="grid gap-3">
              {rutaFixes.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.4rem] border border-white/10 bg-background/45 px-4 py-4 text-sm leading-6 text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
