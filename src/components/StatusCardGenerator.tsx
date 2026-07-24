import { useState } from "react";
import { Share2, Download, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StatusCardProps {
  title: string;
  excerpt?: string;
  category?: string;
  image?: string;
  articleUrl?: string;
}

export default function StatusCardGenerator({
  title,
  excerpt,
  category = "Breaking News",
  image,
  articleUrl = "https://realssanews.com.ng"
}: StatusCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `🚨 *${title}*\n\n${excerpt ? excerpt.slice(0, 140) + '…\n\n' : ''}Read full breakdown on RealSSA News 📰👇\n${articleUrl}`
  )}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${title} — ${articleUrl}`);
    setCopied(true);
    toast({ title: "Link Copied!", description: "Ready to paste on your WhatsApp Status or Instagram story." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-4 md:p-6 shadow-2xl space-y-4 max-w-sm mx-auto">
      {/* 9:16 Vertical Preview Container */}
      <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-amber-950 p-6 flex flex-col justify-between text-white shadow-2xl border border-amber-500/30">
        
        {/* Top Header Branding */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="RealSSA" className="w-8 h-8 rounded-full border border-amber-500" onError={e => e.currentTarget.style.display = 'none'} />
            <span className="font-extrabold text-sm tracking-wider uppercase text-amber-500">RealSSA News</span>
          </div>
          <span className="bg-amber-500/20 text-amber-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border border-amber-500/30">
            {category}
          </span>
        </div>

        {/* Hero Background Image (if available) */}
        {image && (
          <div className="absolute inset-0 z-0 opacity-25 mix-blend-overlay">
            <img src={image} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Center Headline & Quote */}
        <div className="my-auto space-y-4 z-10">
          <span className="inline-block text-amber-400 font-extrabold text-xs tracking-widest uppercase">
            ⚡ BREAKING UPDATE
          </span>
          <h3 className="text-xl md:text-2xl font-black font-display leading-snug drop-shadow-md">
            "{title}"
          </h3>
          {excerpt && (
            <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed border-l-2 border-amber-500 pl-3">
              {excerpt}
            </p>
          )}
        </div>

        {/* Bottom Footer Watermark & Link */}
        <div className="pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-gray-400 z-10">
          <span className="font-mono">realssanews.com.ng</span>
          <span className="text-amber-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Verified
          </span>
        </div>
      </div>

      {/* Share Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <a
          href={whatsappShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-3 px-3 rounded-xl transition-all shadow-md"
        >
          <Share2 className="w-4 h-4" /> Share Status
        </a>

        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-3 px-3 rounded-xl transition-all shadow-md"
        >
          {copied ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Status"}
        </button>
      </div>
    </div>
  );
}
