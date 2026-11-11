import { cn } from "@/lib/utils";

interface SponsoredLabelProps {
  label?: string;
  className?: string;
}

/**
 * Visible disclosure for paid placements. Never render a sponsored card
 * without this label (FTC / ASA / Google News policy).
 */
const SponsoredLabel = ({ label = "Sponsored", className }: SponsoredLabelProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600",
      className
    )}
  >
    {label}
  </span>
);

export default SponsoredLabel;
