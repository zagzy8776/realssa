import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export default function BrandLoader({ size = "full" }: { size?: "full" | "inline" }) {
  const [phase, setPhase] = useState(0); // 0: Blackout & Star rise, 1: R Entrance, 2: Drag Reveal, 3: Active Shine & Interactive Tilt
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Animation Sequencing Timings ──────────────────────────────────────────
  useEffect(() => {
    if (size === "inline") {
      setPhase(3); // Skip reveals for inline loading spinner
      return;
    }

    // Respect users who prefer reduced motion — skip straight to the final
    // resting state instead of running the 4.2s cinematic intro.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setPhase(3);
      return;
    }

    // Phase 0: Fades in background & Star (600ms)
    const timer1 = setTimeout(() => setPhase(1), 600);
    // Phase 1: Giant Gold R Entrance (~1100ms duration)
    const timer2 = setTimeout(() => setPhase(2), 1700);
    // Phase 2: Drag reveal EALSSA (~1400ms duration)
    const timer3 = setTimeout(() => setPhase(3), 3100);


    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [size]);

  // ── Unified Sensor Integration (Gyroscope & Mouse Move) ───────────────────
  useEffect(() => {
    if (phase < 3) return;

    let animFrame: number;

    const handleMouseMove = (e: MouseEvent) => {

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const tx = (e.clientX - cx) / cx; // Normalizes x to [-1, 1]
      const ty = (e.clientY - cy) / cy; // Normalizes y to [-1, 1]

      setTilt({ x: tx, y: ty });
    };

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      // Gamma is left-to-right tilt (-90 to 90), Beta is front-to-back tilt (-180 to 180)
      const gamma = e.gamma ? e.gamma / 45 : 0;
      const beta = e.beta ? e.beta / 45 : 0;

      // Clamp values between [-1, 1]
      const tx = Math.max(-1, Math.min(1, gamma));
      const ty = Math.max(-1, Math.min(1, beta));

      setTilt({ x: tx, y: ty });
    };

    window.addEventListener("mousemove", handleMouseMove);
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleDeviceOrientation);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
  }, [phase]);

  // ── Render Inline Loading Spinner ─────────────────────────────────────────
  if (size === "inline") {
    const letters = ["R", "E", "A", "L", "S", "S", "A"];
    return (
      <div className="flex items-center justify-center gap-0.5 py-6">
        {letters.map((letter, i) => (
          <span
            key={i}
            className="font-black text-2xl bg-gradient-to-b from-[#fcf6ba] via-[#fbbf24] to-[#aa771c] bg-clip-text text-transparent select-none"
            style={{
              animation: "realssaFade 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
              filter: "drop-shadow(0 0 10px rgba(251,191,36,0.5))",
              letterSpacing: "0.05em",
            }}
          >
            {letter}
          </span>
        ))}
      </div>
    );
  }

  // ── Render Full Splash Screen ─────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden select-none"

    >
      {/* ── Glass Reflection Sheen Overlay ── */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none z-20 mix-blend-overlay" />

      {/* ── Background: Halftone Star Grid ── */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none z-0 mask-radial-fade">
        <svg width="100%" height="100%">
          <defs>
            <radialGradient id="halftoneFade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="80%" stopColor="white" stopOpacity="0.2" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <pattern id="starGrid" width="48" height="48" patternUnits="userSpaceOnUse">
              {/* Star path shape */}
              <path d="M24 16L25 21L30 22L25 23L24 28L23 23L18 22L23 21Z" fill="#fbbf24" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#starGrid)" style={{ maskImage: "radial-gradient(circle at center, black 40%, transparent 95%)" }} />
        </svg>
      </div>

      {/* ── 3D Volumetric 4-Pointed Star ── */}
      <div
        className={cn(
          "absolute transition-all ease-out-back z-10 flex items-center justify-center pointer-events-none",
          phase === 0 ? "scale-0 opacity-0" : "scale-100 opacity-100",
          phase >= 3 ? "animate-ticking-pulse" : ""
        )}
        style={{
          transform: phase >= 3 ? `translate3d(${tilt.x * 20}px, ${tilt.y * 20}px, 0) rotate(${tilt.x * 10}deg)` : "",
          filter: "drop-shadow(0 0 35px rgba(251,191,36,0.45))",
          top: "33%",
          transitionDuration: "1000ms"
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          className="relative z-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.85)]"
        >
          <defs>
            <linearGradient id="goldLight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" /><stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="goldMedium" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="goldShadow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d97706" /><stop offset="100%" stopColor="#b38728" />
            </linearGradient>
            <linearGradient id="goldDark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#78350f" /><stop offset="100%" stopColor="#451a03" />
            </linearGradient>
          </defs>

          {/* Facet 1 (Top-Right, Light) */}
          <polygon points="12,12 12,2 14.5,9.5" fill="url(#goldLight)" />
          {/* Facet 2 (Top-Right, Medium) */}
          <polygon points="12,12 14.5,9.5 22,12" fill="url(#goldMedium)" />
          {/* Facet 3 (Bottom-Right, Shadow) */}
          <polygon points="12,12 22,12 14.5,14.5" fill="url(#goldShadow)" />
          {/* Facet 4 (Bottom-Right, Dark) */}
          <polygon points="12,12 14.5,14.5 12,22" fill="url(#goldDark)" />
          {/* Facet 5 (Bottom-Left, Light) */}
          <polygon points="12,12 12,22 9.5,14.5" fill="url(#goldLight)" />
          {/* Facet 6 (Bottom-Left, Medium) */}
          <polygon points="12,12 9.5,14.5 2,12" fill="url(#goldMedium)" />
          {/* Facet 7 (Top-Left, Shadow) */}
          <polygon points="12,12 2,12 9.5,9.5" fill="url(#goldShadow)" />
          {/* Facet 8 (Top-Left, Dark) */}
          <polygon points="12,12 9.5,9.5 12,2" fill="url(#goldDark)" />
        </svg>
      </div>

      {/* ── Logo & Title Layout Container ── */}
      <div
        className="flex flex-col items-center justify-center relative z-10 select-none mt-20"
        style={{
          perspective: "1000px",
          transform: phase >= 3 ? `rotateY(${tilt.x * 15}deg) rotateX(${-tilt.y * 15}deg) scale(1.02)` : "",
          transition: "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)"
        }}
      >
        {/* Brand Letters Reveal Box */}
        <div className="flex items-center justify-center relative">

          {/* Giant "R" Entrance and Position Shift */}
          <span
            className={cn(
              "font-black text-[72px] md:text-[98px] leading-none select-none text-transparent bg-clip-text transition-all cubic-bezier(0.25, 1, 0.5, 1)",
              phase === 0 ? "scale-0 opacity-0" : "scale-100 opacity-100",
              phase >= 2 ? "-translate-x-3" : "translate-x-0"
            )}
            style={{
              backgroundImage: "linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%)",
              textShadow: phase >= 3 ? `${-tilt.x * 12}px ${-tilt.y * 12}px 24px rgba(251,191,36,0.5)` : "0 0 40px rgba(251,191,36,0.6)",
              fontFamily: '"Inter", "Arial Black", sans-serif',
              transitionDuration: "1400ms"
            }}
          >
            R
          </span>

          {/* Draggable reveal container for "EALSSA" */}
          <div
            className="reveal-grid overflow-hidden transition-all ease-out-back text-left"
            style={{
              display: "grid",
              gridTemplateColumns: phase >= 2 ? "1fr" : "0fr",
              transitionDuration: "2000ms",
              transitionProperty: "grid-template-columns, opacity",
              opacity: phase >= 2 ? 1 : 0
            }}
          >
            <div className="overflow-hidden min-w-0">
              <span
                className={cn(
                  "font-black text-[72px] md:text-[98px] leading-none select-none text-transparent bg-clip-text tracking-wide whitespace-nowrap pl-1 block",
                  phase >= 3 ? "animate-shine-sweep" : ""
                )}
                style={{
                  backgroundImage: "linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%)",
                  backgroundSize: "200% auto",
                  backgroundPosition: phase >= 3 ? `${50 + tilt.x * 50}% center` : "-100% center",
                  textShadow: phase >= 3 ? `${-tilt.x * 12}px ${-tilt.y * 12}px 24px rgba(251,191,36,0.5)` : "0 0 40px rgba(251,191,36,0.4)",
                  fontFamily: '"Inter", "Arial Black", sans-serif',
                }}
              >
                EALSSA
              </span>
            </div>
          </div>

        </div>

        {/* Small Subtitle */}
        <p
          className={cn(
            "mt-3 text-white/30 text-xs tracking-[0.3em] uppercase font-bold transition-all duration-1000",
            phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )}
          style={{
            textShadow: "0 2px 4px rgba(0,0,0,0.8)"
          }}
        >
          News Intelligence
        </p>
      </div>

      {/* ── CSS Keyframe Injection ── */}
      <style>{`
        .ease-out-back {
          transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes shineSweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-shine-sweep {
          animation: shineSweep 1.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        @keyframes tickingPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(251,191,36,0.4)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 45px rgba(251,191,36,0.6)); }
        }
        .animate-ticking-pulse {
          animation: tickingPulse 4s ease-in-out infinite;
        }
        @keyframes realssaFade {
          0%, 100% { opacity: 0.15; transform: translateY(2px); }
          50% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
