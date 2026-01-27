const tickerItems = [
  "BREAKING: Afrobeats Star Reaches #1 Globally",
  "NEWS: New AI Model Revolutionizes Digital Art",
  "CULTURE: Nollywood Film Breaks Box Office Records",
  "WORLD: Major Entertainment Event Announced for 2026",
  "AFROBEATS: Shatta Wale Announces Global Collaboration",
  "TECH: Ghanaian AI Startup Secures $10M Funding",
  "FASHION: Best Dressed List from Ghana Music Awards",
  "MOVIES: New Nollywood-Ghana Co-Production in Development",
];

const NewsTicker = () => {
  return (
    <div className="bg-primary text-primary-foreground py-2 overflow-hidden">
      <div className="animate-marquee whitespace-nowrap flex">
        {[...tickerItems, ...tickerItems].map((item, index) => (
          <span key={index} className="mx-8 text-sm font-medium">
            • {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export default NewsTicker;
