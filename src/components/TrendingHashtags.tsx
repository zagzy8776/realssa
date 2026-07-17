import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api-base";

interface HashTag { tag: string; count: number; }

export default function TrendingHashtags() {
  const [tags, setTags] = useState<HashTag[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(apiUrl("/api/hashtags/trending"))
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setTags(data) : [])
      .catch(() => {});
  }, []);

  if (tags.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto hide-scrollbar py-2">
      <div className="flex items-center gap-2 px-1 min-w-max">
        <span className="text-xs font-bold text-amber-500 uppercase tracking-widest flex-shrink-0 flex items-center gap-1">
          ?? Trending
        </span>
        {tags.map(({ tag }) => (
          <button
            key={tag}
            onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-all active:scale-95"
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}
