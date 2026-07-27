import { useLocation, useNavigate } from "react-router-dom";
import { Home, Bookmark, TrendingUp, Download, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Bookmarks", icon: Bookmark, path: "/bookmarks" },
  { label: "Trending", icon: TrendingUp, path: "/trending" },
  { label: "Downloads", icon: Download, path: "/downloads" },
  { label: "Profile", icon: User, path: "/profile" },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on admin, in-app browser, and immersive reels (legacy)
  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/browser") ||
    location.pathname.startsWith("/reels")
  ) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 supports-[backdrop-filter]:bg-background/70 backdrop-blur-xl border-t border-border/50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map(({ label, icon: Icon, path }) => {
          const isActive =
            path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-semibold tracking-wide uppercase transition-all duration-200",
                "active:scale-95",
                isActive ? "text-amber-500" : "text-muted-foreground"
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={22}
                className={cn(
                  "transition-transform duration-200",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              <span className={cn(isActive ? "opacity-100" : "opacity-75")}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
