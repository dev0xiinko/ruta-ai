"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaitlistModal } from "./waitlist-modal";

const navItems = [
  { label: "How it works", href: "#about" },
  { label: "Demo", href: "#demo" },
  { label: "Routes", href: "#results" },
  { label: "Bot", href: "/bot" },
  { label: "Debug", href: "/debug" },
];

export function Navbar() {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setIsMenuOpen(false);
  const resolveHref = (href: string) => {
    if (!href.startsWith("#")) return href;
    return pathname === "/" ? href : `/${href}`;
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" onClick={closeMenu}>
            <Image
              src="/ruta-icon.svg"
              alt="RUTA"
              width={42}
              height={42}
              className="h-10 w-10 sm:h-11 sm:w-11"
            />
            <div>
              <span className="block font-display text-lg font-bold tracking-[0.18em] text-foreground">
                RUTA
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={resolveHref(item.href)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-foreground transition-colors hover:bg-white/10 md:hidden"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMenuOpen ? (
          <div className="border-t border-white/10 bg-background/92 px-4 py-4 backdrop-blur-xl md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={resolveHref(item.href)}
                  onClick={closeMenu}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}

              <Button
                onClick={() => {
                  closeMenu();
                  setIsWaitlistOpen(true);
                }}
                className="mt-2 h-11 rounded-2xl"
              >
                Join waitlist
              </Button>
            </nav>
          </div>
        ) : null}
      </header>

      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
      />
    </>
  );
}
