import { useState, useEffect } from "react";

const NewsTicker = () => {
  const [breakingNews, setBreakingNews] = useState<string>("");
  const [regularNews, setRegularNews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch latest news from backend API
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setIsLoading(true);

        // Fetch articles from backend API
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`);
        if (response.ok) {
          const articles = await response.json();

          // Get the latest article as breaking news
          if (articles.length > 0) {
            const latestArticle = articles[0];
            setBreakingNews(`BREAKING: ${latestArticle.title}`);

            // Set regular news items
            const newsItems = articles
              .slice(1, 8) // Get next 7 articles
              .map(article => {
                const category = article.category.charAt(0).toUpperCase() + article.category.slice(1);
                return `${category}: ${article.title}`;
              });
            setRegularNews(newsItems);
          }
        }
      } catch (error) {
        console.error("Error fetching news for ticker:", error);
        // Fallback to static items if API fails
        setBreakingNews("BREAKING: Major Entertainment News");
        setRegularNews([
          "NEWS: New AI Model Revolutionizes Digital Art",
          "CULTURE: Nollywood Film Breaks Box Office Records",
          "WORLD: Major Entertainment Event Announced for 2026",
          "EXCLUSIVE: Industry Insights",
          "UPDATE: Latest Developments",
          "FEATURE: In-Depth Analysis",
          "SPORTS: Local Team Wins Championship"
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchNews, 300000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-primary text-primary-foreground py-2 overflow-hidden">
        <div className="animate-pulse">
          <div className="whitespace-nowrap flex">
            <span className="mx-8 text-sm font-medium">• Loading latest news...</span>
          </div>
        </div>
      </div>
    );
  }

  // Combine breaking news with regular news
  const allNews = [breakingNews, ...regularNews];

  return (
    <div className="bg-primary text-primary-foreground py-2 overflow-hidden">
      <div className="animate-marquee whitespace-nowrap flex">
        {[...allNews, ...allNews].map((item, index) => (
          <span
            key={index}
            className="mx-8 text-sm font-medium"
            style={{
              color: item.startsWith("BREAKING") ? "#EF4444" : "currentColor"
            }}
          >
            • {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export default NewsTicker;
