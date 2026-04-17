"use client";

import { useEffect, useState } from "react";
import { routeCodes } from "./content";

export function AnimatedCodes() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % routeCodes.length);
        setIsTransitioning(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block min-w-[6.5rem] transition-all duration-300 sm:min-w-[8rem] ${
        isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      <span className="font-display text-[4.25rem] font-bold leading-none tracking-[-0.07em] text-[rgb(31,214,214)] drop-shadow-[0_0_22px_rgba(31,214,214,0.22)] sm:text-[5.8rem] lg:text-[6.6rem]">
        {routeCodes[currentIndex]}
      </span>
    </span>
  );
}
