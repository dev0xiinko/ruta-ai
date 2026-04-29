"use client";

import { useState } from "react";
import { Bot, Loader2, Send, User } from "lucide-react";
import type { RutaBotResponse } from "@/lib/ruta/bot-response";
import { submitRouteQuery } from "@/lib/ruta/api-client";

const EXAMPLE_PROMPT = "How do I get from IT Park to Colon?";

const analyzingSteps = [
  "Recognizing origin and destination",
  "Matching available route codes",
  "Checking the seeded Supabase route data",
  "Preparing a commuter-friendly answer",
];

type RouteBotPanelProps = {
  immersive?: boolean;
};

export function RouteBotPanel({ immersive = false }: RouteBotPanelProps) {
  const [draft, setDraft] = useState(EXAMPLE_PROMPT);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [result, setResult] = useState<RutaBotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (query: string) => {
    if (!query.trim()) return;
    setSubmittedQuery(query);
    setPhase("analyzing");
    setAnalyzeStep(0);
    setError(null);
    setResult(null);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setAnalyzeStep(step);
    }, 650);

    try {
      const data = await submitRouteQuery(query);
      setResult(data);
      setAnalyzeStep(analyzingSteps.length - 1);
      setPhase("done");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not answer the route question."
      );
      setPhase("done");
    } finally {
      clearInterval(interval);
    }
  };

  const handleSubmit = async () => {
    if (!draft.trim() || phase === "analyzing") return;
    await runSimulation(draft);
  };

  const shellClassName = immersive
    ? "relative flex h-full min-h-0 flex-col overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,26,0.98),rgba(10,14,22,0.98))] shadow-none"
    : "relative flex h-[min(100vh-7rem,48rem)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,26,0.98),rgba(10,14,22,0.98))] shadow-[0_28px_120px_rgba(0,0,0,0.4)]";

  const mobileShellClassName = immersive
    ? "rounded-none border-x-0 border-b-0"
    : "rounded-[2rem]";

  const headerClassName = immersive
    ? "grid grid-cols-[auto_1fr_auto] items-center border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-4 backdrop-blur-md sm:px-5"
    : "flex items-center justify-between border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-4 backdrop-blur-md sm:px-5";

  return (
    <div className={`relative ${immersive ? "h-full" : ""}`}>
      <div className="pointer-events-none absolute inset-x-[12%] top-0 h-24 rounded-full bg-primary/10 blur-3xl" />

      <div className={`${shellClassName} ${mobileShellClassName}`}>
        <div className={headerClassName}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
            <Bot className="h-5 w-5 text-primary" />
          </div>

          <div className={immersive ? "text-center" : "ml-3"}>
            <p className="font-semibold uppercase tracking-[0.18em] text-foreground">
              RUTA BOT
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Dedicated commuter chat
            </p>
          </div>

          {immersive ? (
            <>
              <div className="h-10 w-10 sm:hidden" aria-hidden />
              <div className="hidden h-10 w-10 sm:block" aria-hidden />
            </>
          ) : (
            <div className="hidden h-10 w-10 sm:block" aria-hidden />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <div className="space-y-4 pr-1">
            <div className="flex gap-3">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[calc(100%-3rem)] rounded-[1.25rem] rounded-tl-sm bg-secondary px-4 py-3 text-sm leading-6 text-foreground sm:max-w-sm">
                Hi! Tell me where you are starting and where you need to go, and I will guide you step by step.
              </div>
            </div>

            {(phase !== "idle" || submittedQuery) && (
              <div className="flex justify-end gap-3">
                <div className="max-w-[calc(100%-3rem)] rounded-[1.25rem] rounded-tr-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 sm:max-w-sm">
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
                <div className="max-w-[calc(100%-3rem)] rounded-[1.25rem] rounded-tl-sm border border-white/10 bg-secondary px-4 py-3 sm:max-w-md">
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

            {phase === "done" && result && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="max-w-[calc(100%-3rem)] rounded-[1.25rem] rounded-tl-sm border border-white/10 bg-secondary px-4 py-3 text-sm leading-6 text-foreground sm:max-w-md">
                    <p className="font-semibold text-foreground">{result.greeting}</p>
                    <p className="mt-2 text-muted-foreground">{result.answer}</p>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-primary/20 bg-white/5 p-4 shadow-lg shadow-primary/6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                        {result.mode === "route_code" ? "Route lookup" : "Route guide"}
                      </span>
                      <h3 className="mt-3 text-lg font-semibold text-foreground">
                        {result.title}
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                      {result.matches.length} match{result.matches.length === 1 ? "" : "es"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-primary/20 bg-primary/10 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      Guide Summary
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {result.lead}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {result.summary}
                    </p>
                  </div>

                  {result.primaryMatch && (
                    <div className="mt-4 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                        Best Jeep To Check
                      </p>
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-bold tracking-[0.18em] text-black shadow-lg shadow-emerald-500/20">
                            {result.primaryMatch.code}
                          </div>
                          <p className="mt-3 text-base font-semibold text-foreground">
                            {result.primaryMatch.route_name || "Route name not available"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {result.primaryMatch.origin || "Unknown origin"} to{" "}
                            {result.primaryMatch.destination || "Unknown destination"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.lookFor && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-background/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        What to look for
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {result.lookFor}
                      </p>
                    </div>
                  )}

                  {(result.keyLandmarks.length > 0 || result.roadClues.length > 0) && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {result.keyLandmarks.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Key landmarks
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.keyLandmarks.map((landmark) => (
                              <span
                                key={landmark}
                                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                              >
                                {landmark}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.roadClues.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Also passes through
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.roadClues.map((road) => (
                              <span
                                key={road}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground"
                              >
                                {road}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      Rider guide
                    </p>
                    <ol className="mt-3 space-y-2">
                      {result.commuterSteps.map((step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {index + 1}
                          </span>
                          <span className="text-sm leading-6 text-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {result.tripSteps.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-background/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Trip guide
                      </p>
                      <div className="mt-3 space-y-3">
                        {result.tripSteps.map((step) => (
                          <div
                            key={step.title}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4"
                          >
                            <p className="text-sm font-semibold text-foreground">
                              {step.title}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {step.instruction}
                            </p>
                            {step.landmarks.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {step.landmarks.map((landmark) => (
                                  <span
                                    key={`${step.title}-${landmark}`}
                                    className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                                  >
                                    {landmark}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {result.tip && (
                      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                          Tip
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {result.tip}
                        </p>
                      </div>
                    )}

                    {result.confidence && (
                      <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Confidence
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {result.confidence}
                        </p>
                        {result.mode === "not_found" ? null : (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Double-check the signboard before boarding, especially if the route wording looks different on the ground.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {result.sections.length > 0 && (
                    <div className="mt-4 space-y-4 text-sm">
                      {result.sections.map((section) => (
                        <div key={section.title}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            {section.title}
                          </p>
                          <div className="mt-2 space-y-2">
                            {section.items.map((item) => (
                              <p key={item} className="font-medium text-foreground">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.matches.length > 0 && (
                    <div className="mt-4 space-y-3 border-y border-white/10 py-4">
                      {result.matches.slice(result.primaryMatch ? 1 : 0).map((match) => (
                        <div
                          key={match.code}
                          className="rounded-2xl border border-white/10 bg-background/40 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold tracking-[0.18em] text-black">
                                {match.code}
                              </div>
                              <p className="mt-2 text-sm font-semibold text-foreground">
                                {match.route_name || "Route name not available"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {match.origin || "Unknown origin"} to{" "}
                            {match.destination || "Unknown destination"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.suggestions.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Try next
                      </p>
                      <ol className="mt-3 space-y-2">
                        {result.suggestions.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {index + 1}
                            </span>
                            <span className="text-sm leading-6 text-muted-foreground">
                              {step}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "done" && error && (
              <div className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[calc(100%-3rem)] rounded-[1.25rem] rounded-tl-sm border border-red-500/20 bg-secondary px-4 py-3 text-sm leading-6 text-foreground sm:max-w-md">
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-background/85 px-3 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="flex items-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
              placeholder="Try: How do I get from IT Park to Colon?"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              onClick={handleSubmit}
              disabled={phase === "analyzing" || !draft.trim()}
              aria-label="Send"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
