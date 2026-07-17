import { useLocation, useNavigate } from "react-router-dom";
import { Home, Trophy, Zap, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home",   icon: Home,    path: "/" },
  { label: "Reels",  icon: Zap,     path: "/reels" },
  { label: "Sports", icon: Trophy,  path: "/sports" },
  { label: "Video",  icon: Radio,   path: "/videos" },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on admin pages and Reels (Reels has its own nav)
  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/reels")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/70 supports-[backdrop-filter]:bg-background/40 backdrop-blur-xl border-t border-border/50 md:hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16">
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
                "relative flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-medium transition-all duration-300 ease-out",
                "active:scale-90 active:opacity-70",
                isActive
                  ? "text-primary translate-y-[-2px]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={label}
            >
              <Icon
                size={24}
                className={cn(
                  "transition-all duration-300",
                  isActive && "drop-shadow-[0_4px_8px_hsl(var(--primary)/0.5)] scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={cn("transition-opacity duration-300", isActive ? "opacity-100 font-bold" : "opacity-80")}>{label}</span>
              
              {/* Active Dot Indicator */}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
