import React, { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, Loader2, CloudSun, CloudLightning, Droplets, Wind, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWeather } from "@/hooks/useWeather";

interface WeatherWidgetProps {
  variant?: "inline" | "glass";
}

export default function WeatherWidget({ variant = "inline" }: WeatherWidgetProps) {
  const { weather, loading } = useWeather();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  if (loading && !weather) {
    if (variant === "glass") {
      return (
        <div className="w-full h-48 rounded-[2rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 shadow-lg">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-xs text-white/55 font-medium">Syncing weather...</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/40 rounded-full border border-border/40 text-[10px] text-muted-foreground animate-pulse select-none">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span className="hidden sm:inline">Updating weather...</span>
      </div>
    );
  }

  // Soft fallback so drawer weather never disappears entirely
  if (!weather) {
    if (variant === "glass") {
      return (
        <div className="w-full p-5 rounded-[2rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2 text-center">
          <Cloud className="w-8 h-8 text-white/40" />
          <p className="text-sm font-semibold text-white/70">Weather unavailable</p>
          <p className="text-[10px] text-white/45 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Will retry next time you open the menu
          </p>
        </div>
      );
    }
    return null;
  }

  const cond = weather.condition.toLowerCase();

  const isNight = time.getHours() >= 19 || time.getHours() < 6;
  const isRainy = cond.includes("rain") || cond.includes("shower") || cond.includes("drizzle") || cond.includes("thunder");
  const isCloudy = cond.includes("cloud") || cond.includes("overcast") || cond.includes("mist") || cond.includes("fog");
  const isSunny = !isRainy && !isCloudy && !isNight;

  let WeatherIcon = Sun;
  let iconColor = "text-amber-500 animate-spin-slow";

  if (isRainy) {
    WeatherIcon = CloudRain;
    iconColor = "text-blue-400";
  } else if (cond.includes("thunder") || cond.includes("storm") || cond.includes("lightning")) {
    WeatherIcon = CloudLightning;
    iconColor = "text-yellow-400 animate-pulse";
  } else if (isCloudy) {
    if (cond.includes("partly") || cond.includes("scattered")) {
      WeatherIcon = CloudSun;
      iconColor = "text-sky-300";
    } else {
      WeatherIcon = Cloud;
      iconColor = "text-slate-400";
    }
  }

  let cardThemeBg = "from-white/10 to-white/5 border-white/20 text-white";
  let glowColor = "rgba(255,255,255,0.05)";

  if (isRainy) {
    cardThemeBg = "from-slate-700/25 via-sky-950/20 to-slate-950/50 border-sky-500/20 text-sky-200";
    glowColor = "rgba(14,165,233,0.1)";
  } else if (isNight) {
    cardThemeBg = "from-indigo-950/30 via-purple-950/15 to-black/60 border-purple-500/10 text-indigo-200";
    glowColor = "rgba(168,85,247,0.08)";
  } else if (isSunny) {
    cardThemeBg = "from-sky-400/20 via-amber-500/10 to-slate-900/40 border-amber-500/20 text-amber-200";
    glowColor = "rgba(245,158,11,0.1)";
  } else if (isCloudy) {
    cardThemeBg = "from-slate-500/15 via-slate-600/10 to-slate-900/40 border-slate-400/25 text-slate-200";
    glowColor = "rgba(148,163,184,0.08)";
  }

  const rainDroplets = [
    { top: "12%", left: "8%", size: "6px" },
    { top: "25%", left: "85%", size: "8px" },
    { top: "60%", left: "12%", size: "5px" },
    { top: "78%", left: "82%", size: "7px" },
    { top: "42%", left: "74%", size: "9px" },
    { top: "85%", left: "28%", size: "6px" },
    { top: "18%", left: "55%", size: "5px" },
  ];

  if (variant === "glass") {
    return (
      <div
        className={cn(
          "w-full p-6 rounded-[2.2rem] bg-gradient-to-br border backdrop-blur-xl relative overflow-hidden transition-all duration-500 flex flex-col items-center text-center shadow-2xl",
          cardThemeBg
        )}
        style={{
          boxShadow: `0 20px 40px -15px ${glowColor}, inset 0 1px 2px rgba(255,255,255,0.15)`,
        }}
      >
        {isSunny && (
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        )}
        {isNight && (
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        )}

        {isRainy &&
          rainDroplets.map((d, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/10 pointer-events-none opacity-80 backdrop-blur-[1px]"
              style={{
                top: d.top,
                left: d.left,
                width: d.size,
                height: d.size,
                boxShadow:
                  "inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
              }}
            />
          ))}

        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold text-white tracking-wide truncate max-w-[200px]">
            {weather.location.split(",")[0]}
          </h2>
          <p className="text-[10px] font-semibold text-white/60 tracking-wider">
            {formatDate(time)} • {formatTime(time)}
          </p>
        </div>

        <div className="my-5 relative flex items-center justify-center">
          <div className="absolute w-12 h-12 bg-white/5 rounded-full blur-xl scale-125" />
          <WeatherIcon
            className={cn(
              "w-14 h-14 relative z-10 filter drop-shadow-[0_8px_16px_rgba(255,255,255,0.15)]",
              iconColor
            )}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-4xl font-extrabold tracking-tight text-white select-none">
            {weather.temp}
          </span>
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/70">
            {weather.condition}
          </span>
        </div>

        <div className="w-full mt-5 pt-3.5 border-t border-white/10 flex items-center justify-around text-white/60 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-sky-400" />
            <span>{weather.humidity} humidity</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-teal-400" />
            <span>{weather.windSpeed} wind</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/20 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-border/50 shadow-sm transition-all duration-300 cursor-pointer select-none group"
      title={`${weather.condition} in ${weather.location}`}
    >
      <WeatherIcon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${iconColor}`} />

      <span className="hidden sm:inline-block text-[10px] md:text-xs font-semibold text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors">
        {weather.location.split(",")[0]}
      </span>

      <span className="text-[10px] md:text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
        {weather.temp}
      </span>
    </div>
  );
}
