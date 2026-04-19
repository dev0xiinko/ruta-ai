import { Footer } from "@/components/ruta/footer";
import { Navbar } from "@/components/ruta/navbar";
import { RouteBotPanel } from "@/components/ruta/route-bot-panel";

export default function BotPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              RUTA Bot
            </p>
            <h1 className="section-heading mt-4">
              Ask the bot for a route guide.
            </h1>
            <p className="section-copy mt-5">
              Type a jeep code, a landmark, or a simple from-to trip. The bot will
              highlight the best jeep to check first, explain why, and guide you in
              plain commuter-friendly steps.
            </p>
          </div>

          <div className="mt-10">
            <RouteBotPanel />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
