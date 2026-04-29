"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitWaitlistSignup } from "@/lib/ruta/api-client";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleClose = () => {
    setEmail("");
    setError("");
    setIsLoading(false);
    setIsSubmitted(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await submitWaitlistSignup({
        email,
        source: "website-modal",
      });

      setIsSubmitted(true);
      setTimeout(() => handleClose(), 2800);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,36,0.98),rgba(8,16,24,0.98))] shadow-2xl shadow-black/30">
          <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Launch updates
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground">
                Join the RUTA waitlist
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full border border-white/10 p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label="Close waitlist modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isSubmitted ? (
            <div className="px-6 py-6">
              <div className="rounded-[1.5rem">
                <div className="flex items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Get notified when RUTA launches
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Join the waitlist to receive launch updates and be notified as soon as
                      RUTA is available.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Email address</span>
                  <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-background/75 px-4 py-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input
                      ref={inputRef}
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </label>

                {error ? <p className="text-sm text-red-400">{error}</p> : null}

                <Button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="h-12 w-full rounded-full text-base shadow-lg shadow-primary/20"
                >
                  {isLoading ? "Joining..." : "Notify me at launch"}
                </Button>

                <p className="text-xs leading-5 text-muted-foreground">
                  You will receive a confirmation email so we can notify you when RUTA launches.
                </p>
              </form>
            </div>
          ) : (
            <div className="px-6 py-10">
              <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                  <Check className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">
                  Check your inbox
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  We sent a confirmation link to finish your RUTA waitlist signup.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
