import { Navbar } from "@/components/ruta/navbar";
import { RouteBotPanel } from "@/components/ruta/route-bot-panel";

export default function BotPage() {
  return (
    <main className="h-dvh overflow-hidden bg-background">
      <Navbar />

      <section className="fixed inset-x-0 bottom-0 top-16 min-h-0">
        <div className="h-full">
          <RouteBotPanel immersive />
        </div>
      </section>
    </main>
  );
}
