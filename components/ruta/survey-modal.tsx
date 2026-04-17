"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SURVEY_LINK = "https://forms.gle/qA5fwjYBKraD8ez57";

export function SurveyModal({ isOpen, onClose }: SurveyModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Close survey modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20">
            <Image
              src="/ruta-logo.png"
              alt="RUTA"
              width={48}
              height={48}
              className="h-6 w-6 rounded-md object-contain"
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Cebu Commuter Survey
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              Help make RUTA free for everyone
            </h2>
          </div>
        </div>

        <p className="mb-3 text-sm leading-6 text-white/75">
          We’re collecting real commuter feedback to support our proposal to the
          Cebu City Government and make RUTA publicly accessible.
        </p>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">
            Quick survey · 2–3 minutes
          </p>
          <p className="mt-1 text-sm text-white/65">
            Your response helps us understand commute time, cost, route
            confusion, and why Cebu needs a smarter commuting tool.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="h-11 flex-1 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300"
          >
            <a href={SURVEY_LINK} target="_blank" rel="noopener noreferrer">
              Take the Survey
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}