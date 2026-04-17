import Link from "next/link";

const footerLinks = [
  { label: "How it works", href: "#about" },
  { label: "Demo", href: "#demo" },
  { label: "Routes", href: "#results" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 py-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="font-display text-2xl font-bold tracking-[0.18em] text-foreground">
            RUTA
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            A clearer way to understand Cebu jeepney routes, transfer logic, and what to ride next.
          </p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between lg:min-w-[24rem]">
          <div className="flex flex-wrap gap-4">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link
            href="/waitlist/confirmed?status=success"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Waitlist status page
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-7xl items-center justify-between px-1 text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} RUTA. All rights reserved.</p>
        <p>Cebu commuting, decoded with care.</p>
      </div>
    </footer>
  );
}
