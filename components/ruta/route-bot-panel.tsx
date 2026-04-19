"use client";

import { useMemo, useState } from "react";
import { Bot, Loader2, Send, ShieldCheck, User } from "lucide-react";

const EXAMPLE_PROMPT = "How do I get from IT Park to Colon?";
const MAX_DEVICE_QUESTIONS = 10;
const DEVICE_ID_KEY = "ruta_bot_device_id_v1";
const DEVICE_USAGE_KEY = "ruta_bot_device_usage_v1";

const analyzingSteps = [
  "Recognizing origin and destination",
  "Matching available route codes",
  "Checking the seeded Supabase route data",
  "Preparing a commuter-friendly answer",
];

type BotResponse = {
  query: string;
  mode: "route_code" | "trip_search" | "place_search" | "not_found";
  greeting: string;
  title: string;
  summary: string;
  lead: string;
  answer: string;
  reasoningLevel: "high" | "medium" | "low";
  reasoningLabel: string;
  instructionLevel: "direct" | "guided" | "shortlist";
  instructionLabel: string;
  confidenceNote: string;
  commuterSteps: string[];
  sections: Array<{
    title: string;
    items: string[];
  }>;
  suggestions: string[];
  map: {
    feasible: boolean;
    kind: "schematic" | "none";
    note: string;
    points: Array<{
      label: string;
      lat: number;
      lng: number;
      kind: "origin" | "destination" | "waypoint";
    }>;
  };
  primaryMatch: {
    code: string;
    route_name: string | null;
    origin: string | null;
    destination: string | null;
    qa_status: string;
    completeness_score: number;
  } | null;
  matches: Array<{
    code: string;
    route_name: string | null;
    origin: string | null;
    destination: string | null;
    qa_status: string;
    completeness_score: number;
  }>;
};

function generateDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `ruta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadDeviceUsage() {
  if (typeof window === "undefined") {
    return { deviceId: null as string | null, count: 0 };
  }

  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  const deviceId = existingDeviceId || generateDeviceId();

  if (!existingDeviceId) {
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  const rawCount = window.localStorage.getItem(DEVICE_USAGE_KEY);
  const count = rawCount ? Number(rawCount) : 0;

  return {
    deviceId,
    count: Number.isFinite(count) && count >= 0 ? count : 0,
  };
}

export function RouteBotPanel() {
  const initialUsage = useMemo(() => loadDeviceUsage(), []);
  const [draft, setDraft] = useState(EXAMPLE_PROMPT);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [result, setResult] = useState<BotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceId] = useState<string | null>(initialUsage.deviceId);
  const [questionCount, setQuestionCount] = useState(initialUsage.count);

  const remainingQuestions = useMemo(
    () => Math.max(0, MAX_DEVICE_QUESTIONS - questionCount),
    [questionCount]
  );

  const limitReached = remainingQuestions <= 0;

  const incrementDeviceUsage = () => {
    const nextCount = questionCount + 1;
    setQuestionCount(nextCount);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEVICE_USAGE_KEY, String(nextCount));
    }
  };

  const runSimulation = async (query: string) => {
    if (!query.trim() || limitReached) return;

    incrementDeviceUsage();
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
      const res = await fetch("/api/route-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceId ? { "x-ruta-device-id": deviceId } : {}),
        },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not answer the route question.");
      }

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
    if (!draft.trim() || phase === "analyzing" || limitReached) return;
    await runSimulation(draft);
  };

  return (
    <div className="relative">
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
            {remainingQuestions} of {MAX_DEVICE_QUESTIONS} questions left
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-4 pr-1">
            <div className="flex gap-3">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-sm rounded-[1.25rem] rounded-tl-sm bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
                Hi! Tell me where you are starting and where you need to go, and I will guide you step by step.
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

            {limitReached && (
              <div className="rounded-[1.25rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-foreground">
                You have reached the current limit of {MAX_DEVICE_QUESTIONS} questions on this device. For now, this bot remembers your browser and saves the count locally.
              </div>
            )}

            {phase === "done" && result && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="max-w-md rounded-[1.25rem] rounded-tl-sm border border-white/10 bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
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
                        Main Jeep To Check
                      </p>
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-bold tracking-[0.18em] text-black">
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
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {result.primaryMatch.qa_status.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Reasoning Level
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {result.reasoningLabel}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {result.confidenceNote}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Instruction Level
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {result.instructionLabel}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {result.instructionLevel === "direct"
                          ? "This looks like a likely one-ride answer from the current dataset."
                          : result.instructionLevel === "guided"
                            ? "This gives you the best route to check first, with rider clues to confirm on the ground."
                            : "This is a shortlist, not yet a final ride recommendation."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      Rider Instructions
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

                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                      Map Status
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {result.map.note}
                    </p>
                  </div>

                  {result.matches.length > 0 && (
                    <div className="mt-4 space-y-3 border-y border-white/10 py-4">
                      {result.matches.slice(result.primaryMatch ? 1 : 0).map((match) => (
                        <div
                          key={match.code}
                          className="rounded-2xl border border-white/10 bg-background/40 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {match.code}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {match.route_name || "Route name not available"}
                              </p>
                            </div>
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              {match.qa_status.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {match.origin || "Unknown origin"} to{" "}
                            {match.destination || "Unknown destination"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <ol className="mt-4 space-y-2">
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
              </div>
            )}

            {phase === "done" && error && (
              <div className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-md rounded-[1.25rem] rounded-tl-sm border border-red-500/20 bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-background/70 px-4 py-4 sm:px-5">
          <div className="mb-3 text-xs text-muted-foreground">
            Device limit for now: {questionCount} of {MAX_DEVICE_QUESTIONS} questions used on this browser.
          </div>
          <div className="flex items-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
              placeholder={
                limitReached
                  ? "Question limit reached on this device"
                  : "Try: How do I get from IT Park to Colon?"
              }
              disabled={limitReached}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              onClick={handleSubmit}
              disabled={phase === "analyzing" || !draft.trim() || limitReached}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
