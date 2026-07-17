import React, { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Article {
  id: string;
  title: string;
  author?: string;
  externalLink?: string;
  date?: string;
  image?: string;
  category?: string;
  excerpt?: string;
}

interface StoryGroup {
  headline: Article;
  sources: Article[];
  coverage_count: number;
  category?: string;
}

export default function StoryGroupCard({ group }: { group: StoryGroup }) {
  const [expanded, setExpanded] = useState(false);
  const { headline, sources, coverage_count } = group;

  const articleLink = headline.externalLink
    ? `/read?url=${encodeURIComponent(headline.externalLink)}&category=${encodeURIComponent(headline.category || "news")}&id=${encodeURIComponent(headline.id)}`
    : `/article/${headline.id}`;

  return (
    <article className="bg-card dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Hero image */}
      {headline.image && (
        <div className="relative aspect-video overflow-hidden">
          <img
            src={headline.image}
            alt={headline.title}
            loading="lazy"
            className="w-full h-full object-contain bg-slate-100 dark:bg-slate-800/50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <span className="inline-block px-2 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded uppercase tracking-wide">
              {headline.category || "News"}
            </span>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Headline */}
        <Link to={articleLink}>
          <h3 className="font-bold text-base leading-snug text-foreground hover:text-primary transition-colors line-clamp-3 mb-2">
            {headline.title}
          </h3>
        </Link>

        {/* Coverage bar */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all"
        >
          <span className="flex items-center gap-2">
            <span>??</span>
            <span>{coverage_count} {coverage_count === 1 ? "source" : "sources"} covering this</span>
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Expanded source list */}
        {expanded && sources.length > 0 && (
          <div className="mt-3 space-y-2">
            {sources.map(source => {
              const sourceLink = source.externalLink
                ? `/read?url=${encodeURIComponent(source.externalLink)}&category=${encodeURIComponent(source.category || "news")}&id=${encodeURIComponent(source.id)}`
                : `/article/${source.id}`;
              
              return (
              <Link
                key={source.id}
                to={sourceLink}
                className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
              >
                {source.image && (
                  <img 
                    src={source.image} 
                    alt="" 
                    className="w-12 h-12 object-cover rounded flex-shrink-0 bg-gray-200 dark:bg-gray-700" 
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary">{source.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{source.author || "Source"}</p>
                </div>
                <ExternalLink size={12} className="text-muted-foreground flex-shrink-0 mt-1" />
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
