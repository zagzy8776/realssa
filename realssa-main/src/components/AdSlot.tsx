import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdSlotProps {
  slot?: string;
  format?: string;
  className?: string;
}

/**
 * Consent-aware, lazy-loaded display ad.
 *
 * It renders nothing unless VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT are set.
 * Reader Mode is intentionally excluded from ad placement. The component is
 * Prebid-compatible: a wrapper can listen for the "realssa:adslot" event and
 * run a header-bidding auction before the GPT slot is requested.
 */
const AdSlot = ({ slot, format = "auto", className }: AdSlotProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);

  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  const adSlot = slot || (import.meta.env.VITE_ADSENSE_SLOT as string | undefined);

  useEffect(() => {
    if (!client || !adSlot || !containerRef.current) return;

    // Strict by default: EU/UK traffic must opt in before any ad request.
    // Set VITE_ADS_REQUIRE_CONSENT=0 only for markets where implied consent
    // is lawful and the site's privacy policy says so.
    const requireConsent = import.meta.env.VITE_ADS_REQUIRE_CONSENT !== "0";
    const consent = window.localStorage.getItem("realssa_consent");
    if (requireConsent && consent !== "granted") return;

    const loadScript = () => {
      const id = "realssa-adsense";
      if (document.getElementById(id)) return;

      const script = document.createElement("script");
      script.id = id;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(script);
    };

    const pushAd = () => {
      if (pushedRef.current) return;
      pushedRef.current = true;
      loadScript();

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch (error) {
        console.warn("Ad slot failed to initialize", error);
      }
    };

    const sentinel = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          window.dispatchEvent(new CustomEvent("realssa:adslot", { detail: { slot: adSlot } }));
          pushAd();
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [client, adSlot]);

  if (!client || !adSlot) return null;

  return (
    <div ref={containerRef} className={className} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSlot;
