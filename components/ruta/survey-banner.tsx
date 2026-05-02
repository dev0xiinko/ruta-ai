"use client";

import { ExternalLink, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const SURVEY_LINK = "https://forms.gle/qA5fwjYBKraD8ez57";
const subscribe = () => () => {};

export function SurveyBanner() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [visible, setVisible] = useState(true);

  if (!mounted || !visible) return null;

  return (
    <div className="fixed inset-x-0 top-20 z-40 w-full bg-cyan-400 text-black">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-sm font-medium">
          <p className="hidden sm:block">
            Help improve commuting in Cebu - answer our 2-3 min survey
          </p>
          <p className="sm:hidden">Take our survey</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="h-8 rounded-lg bg-black text-white hover:bg-neutral-800"
          >
            <a href={SURVEY_LINK} target="_blank" rel="noopener noreferrer">
              Answer
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>

          <button
            onClick={() => setVisible(false)}
            className="rounded-md p-1 hover:bg-black/10"
            aria-label="Close survey banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
