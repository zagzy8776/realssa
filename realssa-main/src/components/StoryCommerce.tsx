import { useEffect, useState } from "react";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { apiUrl } from "@/lib/api-base";

interface CommerceItem {
  title: string;
  url: string;
  merchant: string;
  price: string | null;
  image: string | null;
  category: string;
  tags: string[];
}

interface StoryCommerceProps {
  category?: string;
  query?: string;
  limit?: number;
  title?: string;
}

const StoryCommerce = ({
  category = "entertainment",
  query,
  limit = 4,
  title = "Shop the story",
}: StoryCommerceProps) => {
  const [items, setItems] = useState<CommerceItem[]>([]);
  const [disclosure, setDisclosure] = useState(
    "Paid links. RealSSA News may earn a commission from purchases."
  );

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const params = new URLSearchParams({ category, limit: String(limit) });
        if (query) params.set("q", query);

        const response = await fetch(apiUrl(`/api/shopping-links?${params.toString()}`), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data?.ok && Array.isArray(data.items)) setItems(data.items);
        if (data?.disclosure) setDisclosure(data.disclosure);
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.warn("Commerce links unavailable");
        }
      }
    };

    load();
    return () => controller.abort();
  }, [category, query, limit]);

  if (items.length === 0) return null;

  return (
    <section className="py-10 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-500">
              <ShoppingBag className="h-4 w-4" />
              {title}
            </div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{disclosure}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <a
              key={`${item.merchant}-${item.title}`}
              href={item.url}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-amber-500/50"
            >
              {item.image && (
                <div className="aspect-video overflow-hidden bg-muted">
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{item.merchant}</span>
                  {item.price && <span className="font-semibold text-amber-500">{item.price}</span>}
                </div>

                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-amber-500">
                  {item.title}
                </h3>

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                  View offer
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoryCommerce;
