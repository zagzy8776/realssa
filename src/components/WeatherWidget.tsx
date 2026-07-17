import React, { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, Loader2, CloudSun, CloudDrizzle, CloudLightning, Compass } from "lucide-react";

export default function WeatherWidget() {
  const [weather, setWeather] = useState<{ temp: string; condition: string; location: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async (lat?: number, lon?: number) => {
      try {
        const query = lat !== undefined && lon !== undefined ? `${lat},${lon}` : '';
        const res = await fetch(`https://wttr.in/${query}?format=j1`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const current = data.current_condition[0];
          const nearestArea = data.nearest_area?.[0];
          const city = nearestArea?.areaName?.[0]?.value || "";
          const country = nearestArea?.country?.[0]?.value || "";
          
          if (!city) throw new Error("Could not resolve location name");

          setWeather({
            temp: `${current.temp_C}°C`,
            condition: current.weatherDesc[0].value,
            location: country ? `${city}, ${country}` : city
          });
        } else {
          throw new Error("API responded with error");
        }
      } catch (err) {
        console.warn("Weather fetch failed, hiding widget:", err);
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeather(latitude, longitude);
        },
        (error) => {
          console.log("Geolocation error or denied, falling back to IP lookup:", error.message);
          fetchWeather();
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      fetchWeather();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/40 rounded-full border border-border/40 text-[10px] text-muted-foreground animate-pulse select-none">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span className="hidden sm:inline">Updating weather...</span>
      </div>
    );
  }

  if (!weather) return null;

  const cond = weather.condition.toLowerCase();
  
  // Choose the best icon and color dynamically
  let WeatherIcon = Sun;
  let iconColor = "text-amber-500 animate-spin-slow";
  
  if (cond.includes("rain") || cond.includes("shower") || cond.includes("drizzle")) {
    WeatherIcon = CloudRain;
    iconColor = "text-blue-400";
  } else if (cond.includes("thunder") || cond.includes("storm") || cond.includes("lightning")) {
    WeatherIcon = CloudLightning;
    iconColor = "text-yellow-400 animate-pulse";
  } else if (cond.includes("cloud") || cond.includes("overcast") || cond.includes("mist") || cond.includes("fog")) {
    if (cond.includes("partly") || cond.includes("scattered")) {
      WeatherIcon = CloudSun;
      iconColor = "text-sky-300";
    } else {
      WeatherIcon = Cloud;
      iconColor = "text-slate-400";
    }
  }

  return (
    <div 
      className="flex items-center gap-1.5 bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/20 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-border/50 shadow-sm transition-all duration-300 cursor-pointer select-none group"
      title={`${weather.condition} in ${weather.location}`}
    >
      <WeatherIcon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${iconColor}`} />
      
      {/* Show full location on desktop, compact on mobile */}
      <span className="hidden sm:inline-block text-[10px] md:text-xs font-semibold text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors">
        {weather.location.split(',')[0]}
      </span>
      
      <span className="text-[10px] md:text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
        {weather.temp}
      </span>
    </div>
  );
}

