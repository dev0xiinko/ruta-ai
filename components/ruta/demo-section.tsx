"use client";

import { useState } from "react";
import { Bot, Loader2, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import { routeSummary, trustPoints } from "./content";

const EXAMPLE_PROMPT = routeSummary.prompt;

const analyzingSteps = [
  "Recognizing origin and destination",
  "Matching available route codes",
  "Checking whether a direct ride is available",
  "Preparing the clearest trip summary",
];

export function DemoSection() {
  const [draft, setDraft] = useState(EXAMPLE_PROMPT);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [analyzeStep, setAnalyzeStep] = useState(0);

  const runSimulation = (query: string) => {
    if (!query.trim()) return;

    setSubmittedQuery(query);
    setPhase("analyzing");
    setAnalyzeStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setAnalyzeStep(step);

      if (step >= analyzingSteps.length - 1) {
        clearInterval(interval);
        setTimeout(() => setPhase("done"), 500);
      }
    }, 650);
  };

  const handleSubmit = () => {
    if (!draft.trim() || phase === "analyzing") return;
    runSimulation(draft);
  };

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

        <div className="relative mt-10">
          <div className="pointer-events-none absolute inset-x-[12%] top-0 h-24 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex h-[min(100vh-7rem,48rem)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,26,0.98),rgba(10,14,22,0.98))] shadow-[0_28px_120px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">RUTA Route Guide</p>
                  <p className="text-sm text-muted-foreground">
                    Commuter-first route explanations
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Direct route detection
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-4 pr-1">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                <div className="max-w-sm rounded-[1.25rem] rounded-tl-sm bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
                  Where are you starting, and where do you need to go?
                </div>
              </div>

              {(phase !== "idle" || submittedQuery) && (
                <div className="flex justify-end gap-3">
                  <div className="max-w-sm rounded-[1.25rem] rounded-tr-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20">
                    {submittedQuery}
                  </div>
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}

              {phase === "analyzing" && (
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="max-w-md rounded-[1.25rem] rounded-tl-sm border border-white/10 bg-secondary px-4 py-3">
                    <div className="space-y-2">
                      {analyzingSteps.slice(0, analyzeStep + 1).map((step, index) => (
                        <div key={step} className="flex items-center gap-2">
                          {index === analyzeStep && analyzeStep < analyzingSteps.length - 1 ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            <span className="text-xs text-accent">✓</span>
                          )}
                          <span className="text-xs font-medium text-muted-foreground">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

                {phase === "done" && (
                  <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="max-w-md rounded-[1.25rem] rounded-tl-sm border border-white/10 bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
                      I found a direct jeep option from IT Park to Colon. The strongest match is
                      <span className="font-semibold text-primary"> 17B, 17C, or 17D</span>, and
                      no Ayala transfer is needed.
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-primary/20 bg-white/5 p-4 shadow-lg shadow-primary/6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                          {routeSummary.best.badge}
                        </span>
                        <h3 className="mt-3 text-lg font-semibold text-foreground">
                          {routeSummary.best.label}
                        </h3>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                        {routeSummary.best.confidence}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <p className="font-medium text-foreground">{routeSummary.best.jeepney}</p>
                      <p className="font-medium text-foreground">{routeSummary.best.transfer}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 border-y border-white/10 py-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Time
                        </p>
                        <p className="mt-1 font-semibold text-foreground">{routeSummary.best.time}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Fare
                        </p>
                        <p className="mt-1 font-semibold text-accent">{routeSummary.best.fare}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Transfers
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {routeSummary.best.transfers}
                        </p>
                      </div>
                    </div>

                    <ol className="mt-4 space-y-2">
                      {routeSummary.best.steps.map((step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {index + 1}
                          </span>
                          <span className="text-sm leading-6 text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-background/70 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
                  placeholder="Try: How do I get from IT Park to Colon?"
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={phase === "analyzing" || !draft.trim()}
                  aria-label="Send"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
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
