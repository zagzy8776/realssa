import React from "react";

const LETTERS = ["R", "E", "A", "L", "S", "S", "A"];

export default function BrandLoader({ size = "full" }: { size?: "full" | "inline" }) {
  if (size === "inline") {
    return (
      <div className="flex items-center justify-center gap-0.5 py-6">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            className="font-black text-2xl text-amber-400"
            style={{
              animation: "realssaFade 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
              textShadow: "0 0 24px rgba(251,191,36,0.9)",
              letterSpacing: "0.05em",
            }}
          >
            {letter}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ backgroundColor: '#0f0f0f' }}>
      <div className="flex items-end gap-1">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            className="font-black text-[72px] md:text-[96px] leading-none text-amber-400 select-none"
            style={{
              animation: "realssaFade 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.14}s`,
              textShadow: "0 0 40px rgba(251,191,36,1), 0 0 80px rgba(251,191,36,0.5)",
              fontFamily: '"Inter", "Arial Black", sans-serif',
            }}
          >
            {letter}
          </span>
        ))}
      </div>
      <p
        className="mt-4 text-white/40 text-sm tracking-[0.3em] uppercase font-semibold"
        style={{ animation: "realssaFade 1.4s ease-in-out infinite", animationDelay: "0.9s" }}
      >
        News
      </p>
      <style>{`
        @keyframes realssaFade {
          0%, 100% { opacity: 0.1; transform: translateY(4px); }
          50% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
