import { MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-lg font-bold text-foreground">RUTA</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
            Making jeepney commuting in Cebu City faster, easier, and more confident.
          </p>
        </div>
        <div className="border-t border-border pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-[11px] sm:text-xs text-muted-foreground text-center sm:text-left">
          <p>&copy; {new Date().getFullYear()} RUTA. All rights reserved.</p>
          <p>Built for Cebu commuters.</p>
        </div>
      </div>
    </footer>
  );
}
