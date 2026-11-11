import { motion } from "framer-motion";

interface FearGreedGaugeProps {
  score: number;
  label?: string;
  size?: number;
  compact?: boolean;
}

export const sentimentLabel = (score: number) =>
  score < 25 ? "Extreme Fear" :
  score < 45 ? "Fear" :
  score < 55 ? "Neutral" :
  score < 75 ? "Greed" : "Extreme Greed";

const sentimentColor = (s: number) =>
  s < 25 ? "#ef4444" : s < 45 ? "#f97316" : s < 55 ? "#eab308" : s < 75 ? "#22c55e" : "#10b981";

/**
 * FearGreedGauge — the adrenaline dial. A live, animated market sentiment
 * meter (0 = extreme fear, 100 = extreme greed) computed from crypto
 * momentum + Naira movement. People watch numbers move — this one moves.
 */
const FearGreedGauge: React.FC<FearGreedGaugeProps> = ({ score, label, size = 150, compact = false }) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 50));
  const color = sentimentColor(clamped);
  const R = 40;
  const ARC = Math.PI * R; // semicircle length

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 100 62" width={size} height={size * 0.62} role="img" aria-label={`Fear and Greed ${clamped}`}>
        {/* background arc */}
        <path
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          stroke="#334155"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* gradient ticks */}
        {[0, 25, 45, 55, 75].map((t) => {
          const angle = Math.PI * (1 - t / 100);
          const x1 = 50 + Math.cos(angle) * 31;
          const y1 = 52 - Math.sin(angle) * 31;
          const x2 = 50 + Math.cos(angle) * 35;
          const y2 = 52 - Math.sin(angle) * 35;
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1.4" opacity={0.7} />;
        })}
        {/* value arc */}
        <motion.path
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={ARC}
          initial={{ strokeDashoffset: ARC }}
          animate={{ strokeDashoffset: ARC * (1 - clamped / 100) }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
          style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}
        />
        {/* needle */}
        <motion.line
          x1="50"
          y1="52"
          x2="50"
          y2="18"
          stroke="#e2e8f0"
          strokeWidth="2.4"
          strokeLinecap="round"
          style={{ originX: "50px", originY: "52px" }}
          initial={{ rotate: -90 }}
          animate={{ rotate: -90 + (clamped / 100) * 180 }}
          transition={{ type: "spring", stiffness: 55, damping: 14 }}
        />
        <circle cx="50" cy="52" r="4" fill="#e2e8f0" />
      </svg>
      <div className="flex flex-col items-center -mt-1">
        <span className="text-2xl font-black tabular-nums leading-none" style={{ color }}>
          {Math.round(clamped)}
        </span>
        {!compact && (
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
            {label || sentimentLabel(clamped)}
          </span>
        )}
        {compact && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Fear / Greed
          </span>
        )}
      </div>
    </div>
  );
};

export default FearGreedGauge;
