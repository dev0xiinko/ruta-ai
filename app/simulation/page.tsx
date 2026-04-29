import { Navbar } from "@/components/ruta/navbar";
import { RouteSimulationPanel } from "@/components/ruta/route-simulation-panel";

export default function SimulationPage() {
  return (
    <main className="h-dvh overflow-hidden bg-background">
      <Navbar />

      <section className="fixed inset-x-0 bottom-0 top-16 min-h-0">
        <RouteSimulationPanel />
      </section>
    </main>
  );
}
