"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WaitlistModal } from "./waitlist-modal";

export function Navbar() {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        
        {/* FULL WIDTH CONTAINER */}
        <div className="flex w-full items-center justify-between px-6 py-4 lg:px-10">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/ruta-icon.svg"
              alt="RUTA"
              width={44}
              height={44}
              className="h-11 w-11 transition-transform duration-300 hover:scale-110"
            />
            <span className="text-2xl font-semibold tracking-tight">
              RUTA
            </span>
          </div>

          
        </div>
      </header>

      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
      />
    </>
  );
}