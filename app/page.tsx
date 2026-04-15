import { HeroSection } from "@/components/ruta/hero-section";
import { AboutSection } from "@/components/ruta/about-section";
import { DemoSection } from "@/components/ruta/demo-section";
import { ResultsSection } from "@/components/ruta/results-section";
import { Footer } from "@/components/ruta/footer";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <AboutSection />
      <DemoSection />
      <ResultsSection />
      <Footer />
    </main>
  );
}
