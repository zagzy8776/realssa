const tickerItems = [
  "BREAKING: Afrobeats Star Reaches #1 Globally",
  "NEWS: New AI Model Revolutionizes Digital Art",
  "CULTURE: Nollywood Film Breaks Box Office Records",
  "WORLD: Major Entertainment Event Announced for 2026",
  "BREAKING: Major Entertainment News",
  "EXCLUSIVE: Industry Insights",
  "UPDATE: Latest Developments",
  "FEATURE: In-Depth Analysis",
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
