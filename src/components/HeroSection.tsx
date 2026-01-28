import { ArrowRight } from "lucide-react";
import CategoryBadge from "./CategoryBadge";
import heroConcert from "@/assets/hero-concert.jpg";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroConcert}
          alt="Afrobeats artist performing"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="max-w-3xl animate-fade-in">
          <CategoryBadge category="breaking" className="mb-4" />
          
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight mb-6">
            Latest Entertainment News
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl">
            Afrobeats heavyweight teams up with global superstar for chart-topping hit – exclusive details and behind-the-scenes insights
          </p>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8">
            <span className="font-medium text-foreground">By EntertainmentGHC Staff</span>
            <span className="hidden sm:inline">•</span>
            <span>January 25, 2026 | 10:30 AM GMT</span>
          </div>
          
          <a
            href="#"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-full hover:shadow-glow transition-all duration-300 hover:scale-105 group"
          >
            Read Full Story
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;