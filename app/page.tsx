import { HeroSection } from "@/components/ruta/hero-section";
import { AboutSection } from "@/components/ruta/about-section";
import { DemoSection } from "@/components/ruta/demo-section";
import { ResultsSection } from "@/components/ruta/results-section";
import { Footer } from "@/components/ruta/footer";
import { Navbar } from "@/components/ruta/navbar";
import { SurveyBanner } from "@/components/ruta/survey-banner";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <SurveyBanner />
      <HeroSection />
      <AboutSection />
      <DemoSection />
      <ResultsSection />
      <Footer />
    </main>
  );
}
