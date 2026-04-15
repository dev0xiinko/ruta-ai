"use client";

import { useEffect, useState } from "react";

const JEEPNEY_CODES = ["17B", "13C", "04C", "01A", "06D", "11K", "03B"];

export function AnimatedCodes() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % JEEPNEY_CODES.length);
        setIsTransitioning(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block min-w-20 transition-all duration-300 ${
        isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      <span className="font-mono text-7xl sm:text-7xl md:text-7xl lg:text-7xl font-bold bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
        {JEEPNEY_CODES[currentIndex]}
      </span>
    </span>
  );
}
