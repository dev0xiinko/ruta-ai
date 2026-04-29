"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RutaBotResponse, RutaFeedbackVerdict } from "@/lib/ruta/bot-response";
import {
  submitRouteFeedback,
  submitRouteQuery,
} from "@/lib/ruta/api-client";

const EXAMPLE_QUERIES = [
  "IT Park to Robinsons Galleria",
  "Does 17B pass Cebu Doc?",
  "JY to ACT",
  "USC TC to USC Main",
];

type SimulationEntry = {
  id: string;
  query: string;
  status: "loading" | "done" | "error";
  result: RutaBotResponse | null;
  error: string | null;
  feedbackVerdict: RutaFeedbackVerdict | null;
  feedbackNotes: string;
  feedbackStatus: "idle" | "submitting" | "saved" | "error";
  feedbackError: string | null;
};

function createEntry(query: string): SimulationEntry {
  return {
    id: crypto.randomUUID(),
    query,
    status: "loading",
    result: null,
    error: null,
    feedbackVerdict: null,
    feedbackNotes: "",
    feedbackStatus: "idle",
    feedbackError: null,
  };
}

export function RouteSimulationPanel() {
  const [draft, setDraft] = useState(EXAMPLE_QUERIES[0]);
  const [entries, setEntries] = useState<SimulationEntry[]>([]);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const storageKey = "ruta-simulation-session-id";
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      setSessionId(existing);
      return;
    }
    const nextId = crypto.randomUUID();
    window.localStorage.setItem(storageKey, nextId);
    setSessionId(nextId);
  }, []);

  const patchEntry = (
    entryId: string,
    updater: (entry: SimulationEntry) => SimulationEntry
  ) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? updater(entry) : entry))
    );
  };

  const submitQuery = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const entry = createEntry(trimmed);
    setEntries((current) => [entry, ...current]);

    try {
      const data = await submitRouteQuery(trimmed);
      patchEntry(entry.id, (current) => ({
        ...current,
        status: "done",
        result: data,
      }));
      setDraft("");
    } catch (error) {
      patchEntry(entry.id, (current) => ({
        ...current,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Could not answer this route prompt.",
      }));
    }
  };

  const submitFeedback = async (entry: SimulationEntry) => {
    if (!entry.feedbackVerdict) return;

    patchEntry(entry.id, (current) => ({
      ...current,
      feedbackStatus: "submitting",
      feedbackError: null,
    }));

    try {
      await submitRouteFeedback({
        sessionId,
        pageContext: "simulation",
        query: entry.query,
        verdict: entry.feedbackVerdict,
        notes: entry.feedbackNotes,
        response: entry.result,
      });

      patchEntry(entry.id, (current) => ({
        ...current,
        feedbackStatus: "saved",
      }));
    } catch (error) {
      patchEntry(entry.id, (current) => ({
        ...current,
        feedbackStatus: "error",
        feedbackError:
          error instanceof Error ? error.message : "Could not save feedback.",
      }));
    }
  };

  return (
    <div className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-[16%] top-0 h-32 rounded-full bg-primary/10 blur-3xl" />

      <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[24rem_1fr]">
        <aside className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(14,18,26,0.98),rgba(10,14,22,0.98))] lg:border-b-0 lg:border-r">
          <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Simulation Lab
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Ask real commuter prompts, review the answer, and mark whether the result feels useful.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-secondary/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Try a prompt
              </p>

              <div className="mt-3 space-y-3">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask like a Cebu commuter..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitQuery(draft);
                    }
                  }}
                  className="h-12 rounded-2xl border-white/10 bg-background/60"
                />

                <Button
                  onClick={() => void submitQuery(draft)}
                  className="h-11 w-full rounded-2xl"
                >
                  <Send className="h-4 w-4" />
                  Run simulation
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setDraft(example)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  What gets logged
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>The raw question you tested</li>
                  <li>The current response payload from the route engine</li>
                  <li>Whether you marked it good or needs work</li>
                  <li>Your notes for what felt wrong or right</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-[linear-gradient(180deg,rgba(12,16,24,0.98),rgba(8,11,18,0.98))]">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 pb-12 sm:p-6">
            {entries.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10">
                  <MessageSquarePlus className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  Start a route simulation
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This page is for QA. Ask a real route question, review what the site answered, then save feedback so we can improve the engine and the data.
                </p>
              </div>
            ) : null}

            {entries.map((entry) => {
              const statusTone =
                entry.feedbackVerdict === "good"
                  ? "border-emerald-500/30"
                  : entry.feedbackVerdict === "bad"
                  ? "border-amber-500/30"
                  : "border-white/10";

              return (
                <article
                  key={entry.id}
                  className={`rounded-[2rem] border bg-white/5 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] ${statusTone}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                        Prompt tested
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-foreground">
                        {entry.query}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {entry.status === "loading" ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Running
                        </span>
                      ) : null}

                      {entry.feedbackStatus === "saved" ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Feedback saved
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-background/40 p-4">
                    {entry.status === "loading" ? (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Checking the live route engine result...
                      </div>
                    ) : null}

                    {entry.status === "error" ? (
                      <div className="flex items-start gap-3 text-sm">
                        <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-300" />
                        <div>
                          <p className="font-semibold text-foreground">The simulation failed</p>
                          <p className="mt-1 leading-6 text-muted-foreground">
                            {entry.error || "Could not get a result from the route engine."}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {entry.status === "done" && entry.result ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Bot answer
                          </p>
                          <p className="mt-2 text-sm leading-7 text-foreground">
                            {entry.result.answer}
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Mode
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {entry.result.mode.replace(/_/g, " ")}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Confidence
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {entry.result.confidence}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Best match
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {entry.result.primaryMatch?.code || "No primary code"}
                            </p>
                          </div>
                        </div>

                        {entry.result.keyLandmarks.length > 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Landmarks shown
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {entry.result.keyLandmarks.map((landmark) => (
                                <span
                                  key={landmark}
                                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                >
                                  {landmark}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-secondary/40 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Was this result good?
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant={entry.feedbackVerdict === "good" ? "default" : "outline"}
                        className="rounded-2xl"
                        onClick={() =>
                          patchEntry(entry.id, (current) => ({
                            ...current,
                            feedbackVerdict: "good",
                            feedbackStatus:
                              current.feedbackStatus === "saved" ? "saved" : "idle",
                            feedbackError: null,
                          }))
                        }
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Good answer
                      </Button>

                      <Button
                        type="button"
                        variant={entry.feedbackVerdict === "bad" ? "destructive" : "outline"}
                        className="rounded-2xl"
                        onClick={() =>
                          patchEntry(entry.id, (current) => ({
                            ...current,
                            feedbackVerdict: "bad",
                            feedbackStatus:
                              current.feedbackStatus === "saved" ? "saved" : "idle",
                            feedbackError: null,
                          }))
                        }
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Needs work
                      </Button>
                    </div>

                    <div className="mt-4">
                      <Textarea
                        value={entry.feedbackNotes}
                        onChange={(event) =>
                          patchEntry(entry.id, (current) => ({
                            ...current,
                            feedbackNotes: event.target.value,
                            feedbackStatus:
                              current.feedbackStatus === "saved" ? "saved" : "idle",
                          }))
                        }
                        placeholder="What felt wrong, confusing, or especially helpful?"
                        className="min-h-24 rounded-2xl border-white/10 bg-background/50"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => void submitFeedback(entry)}
                        disabled={
                          !entry.feedbackVerdict ||
                          entry.feedbackStatus === "submitting" ||
                          entry.feedbackStatus === "saved"
                        }
                        className="rounded-2xl"
                      >
                        {entry.feedbackStatus === "submitting" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                        Save feedback
                      </Button>

                      {entry.feedbackError ? (
                        <p className="text-sm text-destructive">{entry.feedbackError}</p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
