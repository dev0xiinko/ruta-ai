"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setEmail("");
    setError("");
    setIsLoading(false);
    setIsSubmitted(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          source: "website",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join waitlist");
      }

      // ✅ now shows "check your email" instead of "you're in"
      setIsSubmitted(true);

      setTimeout(() => {
        handleClose();
      }, 3000);
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute right-6 top-6 text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>

          {/* FORM STATE */}
          {!isSubmitted ? (
            <>
              <h2 className="mb-2 text-xl font-semibold">
                Join the RUTA waitlist 🚍
              </h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Be the first to experience AI-powered commuting in Cebu.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Input */}
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    ref={inputRef}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-500">
                    {error}
                  </p>
                )}

                {/* Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-full py-3"
                >
                  {isLoading ? "Joining..." : "Join Waitlist"}
                </Button>
              </form>
            </>
          ) : (
            /* ✅ EMAIL CONFIRMATION STATE */
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <Check className="text-green-500" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Check your email 📩
              </h3>
              <p className="text-sm text-muted-foreground">
                We sent you a confirmation link. Please confirm your email to join the RUTA waitlist.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}