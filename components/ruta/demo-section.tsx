"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, Bot, User, Star, ChevronRight, MapPin } from "lucide-react";

const EXAMPLE_PROMPT = "How do I get from IT Park to Colon?";

const ANALYZING_STEPS = [
  "Found origin: IT Park, Lahug",
  "Found destination: Colon Street",
  "Searching routes...",
  "Found 2 routes",
  "Calculating fares and times...",
  "Ready!",
];

const bestRoute = {
  label: "Best Route",
  badge: "Recommended",
  jeepney: "Code 04B – Lahug / IT Park – Ayala",
  transfer: "Code 01A – Ayala – Colon",
  fare: "₱13–₱16",
  time: "25–35 min",
  transfers: 1,
  steps: [
    { text: "Start at IT Park jeepney stop near Cebu IT Tower" },
    { text: "Ride Code 04B jeepney toward Ayala Center (10–15 min)" },
    { text: "Transfer at Ayala Bus Terminal" },
    { text: "Ride Code 01A jeepney toward Colon (10–15 min)" },
    { text: "Alight at Colon Street, near Carbon Market" },
  ],
};

const altRoute = {
  label: "Alternative",
  badge: "Direct Route",
  jeepney: "Code 06D – IT Park – SM City – Downtown",
  fare: "₱10–₱13",
  time: "35–50 min",
  transfers: 0,
  steps: [
    { text: "Take Code 06D jeepney from IT Park terminal" },
    { text: "Ride direct to Downtown Cebu (35–50 min, no transfers)" },
    { text: "Alight near Colon – Jones Ave. intersection" },
  ],
};

export function DemoSection() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "typing" | "analyzing" | "done">("idle");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Auto-type and auto-submit the example prompt on mount
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let charIdx = 0;
    setPhase("typing");

    const typeNext = () => {
      charIdx++;
      setInput(EXAMPLE_PROMPT.slice(0, charIdx));
      if (charIdx < EXAMPLE_PROMPT.length) {
        timeout = setTimeout(typeNext, 170);
      } else {
        // Auto-submit after typing
        setPhase("idle");
        timeout = setTimeout(() => {
          handleSubmitAuto(EXAMPLE_PROMPT);
        }, 800);
      }
    };


// Auto-type the example prompt on mount
    timeout = setTimeout(typeNext, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmitAuto = (query: string) => {
    if (!query.trim()) return;
    setSubmitted(false);
    setPhase("analyzing");
    setAnalyzeStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setAnalyzeStep(step);
      if (step >= ANALYZING_STEPS.length - 1) {
        clearInterval(interval);
        setTimeout(() => {
          setPhase("done");
          setSubmitted(true);
        }, 700);
      }
    }, 700);
  };

  const handleSubmit = () => {
    if (!input.trim() || phase === "analyzing") return;
    handleSubmitAuto(input);
  };

  return (
    <section id="demo" className="py-16 sm:py-20 px-4 sm:px-6 bg-secondary/25">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-widest mb-2 sm:mb-3">See it in action</p>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-balance text-foreground mb-3 sm:mb-4">
            Decode routes by code
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg text-balance max-w-lg mx-auto leading-relaxed">
            Ask about getting somewhere in Cebu. RUTA instantly shows you the jeepney codes and routes that work.
          </p>
        </div>

        {/* Chat window */}
        <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xl overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-secondary/50">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-foreground truncate">RUTA Route Guide</p>
              <p className="text-xs text-muted-foreground">Real routes, real fares</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-muted-foreground hidden sm:inline">Ready</span>
            </div>
          </div>

          {/* Messages area */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4 min-h-56 bg-background/50">
            {/* System welcome */}
            <div className="flex gap-2 sm:gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-secondary rounded-lg sm:rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-foreground max-w-xs leading-relaxed">
                Where are you going? I&apos;ll help you find the best jeepney route.
              </div>
            </div>

            {/* User message bubble */}
            {(phase !== "idle" || submitted) && input && (
              <div className="flex gap-2 sm:gap-3 justify-end">
                <div
                  className="rounded-lg sm:rounded-2xl rounded-tr-sm px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm max-w-xs text-primary-foreground font-medium break-words"
                  style={{ background: "var(--primary)" }}
                >
                  {input}
                </div>
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Analyzing */}
            {phase === "analyzing" && (
              <div className="flex gap-2 sm:gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-secondary rounded-lg sm:rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 space-y-1 sm:space-y-1.5 max-w-xs">
                  {ANALYZING_STEPS.slice(0, analyzeStep + 1).map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i === analyzeStep && analyzeStep < ANALYZING_STEPS.length - 1 ? (
                        <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
                      ) : (
                        <span className="w-3 h-3 flex-shrink-0 text-accent text-xs">✓</span>
                      )}
                      <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results display */}
            {phase === "done" && submitted && (
              <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-[11px] sm:text-xs text-muted-foreground bg-secondary rounded-lg sm:rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3">
                  Found 2 routes: Code 04B + 01A with transfer, or direct Code 06D. Check below:
                </div>
              </div>
            )}
          </div>

          {/* Results cards section */}
          {phase === "done" && submitted && (
            <div className="px-4 sm:px-6 py-4 sm:py-6 border-t border-border bg-background/30 space-y-3 sm:space-y-4">
              {/* Best Route Card */}
              <div className="bg-card rounded-xl sm:rounded-2xl border border-primary/20 p-3 sm:p-5 shadow-sm flex flex-col gap-3 sm:gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div>
                    <span className="inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 sm:px-3 py-1 rounded-full mb-1 sm:mb-2 bg-primary/10 text-primary">
                      {bestRoute.badge}
                    </span>
                    <h3 className="font-bold text-foreground text-sm sm:text-base">{bestRoute.label}</h3>
                  </div>
                  <Star className="w-4 h-4 text-primary flex-shrink-0 fill-primary" />
                </div>

                {/* Route lines */}
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <span className="font-medium text-foreground">{bestRoute.jeepney}</span>
                  </div>
                  {bestRoute.transfer && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="inline-block w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      <span className="font-medium text-foreground">{bestRoute.transfer}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 py-2 sm:py-3 border-y border-border">
                  <div>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Time</p>
                    <p className="text-xs sm:text-sm font-bold text-foreground">{bestRoute.time}</p>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Fare</p>
                    <p className="text-xs sm:text-sm font-bold text-accent">{bestRoute.fare}</p>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Transfers</p>
                    <p className="text-xs sm:text-sm font-bold text-foreground">{bestRoute.transfers}</p>
                  </div>
                </div>

                {/* Steps */}
                <div>
                  <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Directions</p>
                  <ol className="space-y-1.5 sm:space-y-2">
                    {bestRoute.steps.slice(0, 3).map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="flex flex-col items-center pt-0.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] font-bold flex-shrink-0 bg-primary text-primary-foreground">
                            {i + 1}
                          </div>
                          {i < 2 && <div className="w-px h-3 bg-border mt-0.5" />}
                        </div>
                        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed pt-0.5">{step.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  View Full Route <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Alternative Route Card - Compact */}
              <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 shadow-sm flex flex-col gap-2 sm:gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full mb-1 sm:mb-1.5 bg-accent/10 text-accent">
                      {altRoute.badge}
                    </span>
                    <h4 className="font-semibold text-foreground text-xs sm:text-sm">{altRoute.label}</h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="font-medium text-foreground">{altRoute.jeepney}</span>
                </div>

                <div className="space-y-1 sm:space-y-1.5 text-[11px] sm:text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Travel time</span>
                    <span className="font-semibold text-foreground">{altRoute.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fare</span>
                    <span className="font-semibold text-accent">{altRoute.fare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transfers</span>
                    <span className="font-semibold text-foreground">{altRoute.transfers}</span>
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
                  View Route <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-border bg-background/50">
            <div className="flex items-center gap-2 bg-secondary rounded-lg sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 border border-border/50">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="e.g., IT Park to Colon..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
              />
              <button
                onClick={handleSubmit}
                disabled={phase === "analyzing" || !input.trim()}
                aria-label="Send"
                className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-primary-foreground" />
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground text-center mt-2 sm:mt-3">
              Try:{" "}
              <button
                className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
                onClick={() => setInput(EXAMPLE_PROMPT)}
              >
                {EXAMPLE_PROMPT}
              </button>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
