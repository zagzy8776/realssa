import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AdSlot from "./AdSlot";

/**
 * Clearly labeled advertising section — 300x250 or 728x90 or 320x50
 * depending on screen width. Uses the existing LazyAd component but
 * with explicit "Advertisement" label and proper spacing.
 */

const AdSection = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "200px" }
    );

    const el = document.getElementById("ad-section-anchor");
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="px-3 sm:px-4 py-6 max-w-screen-xl mx-auto" id="ad-section-anchor">
      <div className="flex items-center justify-between mb-3">
        <h2 className="nr-section-title">Advertisement</h2>
        <Link
          to="/ads"
          className="inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
        >
          Ad portal <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex items-center justify-center">
        <AdSlot
          format={isVisible ? "300x250" : "320x50"}
          className="w-full max-w-[300px] mx-auto"
        />
      </div>
    </section>
  );
};

export default AdSection;