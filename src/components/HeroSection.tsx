import { ArrowRight, PlayCircle, Radio, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { HlsPlayer } from "./HlsPlayer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Capacitor } from "@capacitor/core";
import { apiUrl } from "@/lib/api-base";
import { Network } from "@capacitor/network";

interface LiveChannel {
  id: string;
  name: string;
  source: string;
  // Fallbacks: HLS stream (safest for mobile) and YouTube embeds
  hlsUrl?: string;
  embedUrl: string;
}

const CHANNELS: LiveChannel[] = [
  {
    id: "channels-tv",
    name: "Channels TV",
    source: "Channels TV",
    embedUrl: "https://www.youtube.com/embed/W8nThq62Vb4?autoplay=0"
  },
  {
    id: "arise-news",
    name: "Arise News",
    source: "Arise News",
    embedUrl: "https://www.youtube.com/embed/x4wL-fWyhI0?autoplay=0"
  },
  {
    id: "tvc-news",
    name: "TVC News",
    source: "TVC News",
    embedUrl: "https://www.youtube.com/embed/Mv14aabg4mA?autoplay=0"
  },
  {
    id: "al-jazeera",
    name: "Al Jazeera",
    source: "Al Jazeera",
    embedUrl: "https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=0"
  }
];

const HeroSection = () => {
  const [activeChannel, setActiveChannel] = useState<LiveChannel>(CHANNELS[0]);
  const [liveStreamUrl, setLiveStreamUrl] = useState<string | null>(null);
  const [isLiveEventActive, setIsLiveEventActive] = useState(false);
  const [liveEventTitle, setLiveEventTitle] = useState("");
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Connection-aware autoplay states
  const [isCellular, setIsCellular] = useState(true); // Default to cellular-safe (no autoplay)
  const [userApprovedCellularPlay, setUserApprovedCellularPlay] = useState(false);

  // 1. Monitor network connection status (WiFi vs Cellular) in real time
  useEffect(() => {
    const initNetworkSensing = async () => {
      try {
        const status = await Network.getStatus();
        // If it reports 'wifi', treat as non-cellular (safely autoplay). Default to cellular-safe.
        setIsCellular(status.connectionType !== 'wifi');
      } catch (err) {
        console.warn("Capacitor Network plugin query failed, defaulting to cellular-safe behavior:", err);
        setIsCellular(true);
      }
    };

    initNetworkSensing();

    // Listen for real-time network status changes (WiFi to cellular mid-stream)
    let listenerPromise = Network.addListener('networkStatusChange', (status) => {
      const cellularNow = status.connectionType !== 'wifi';
      setIsCellular(cellularNow);
      if (cellularNow) {
        // Automatically stop autoplay when switched from WiFi to cellular mid-stream
        setUserApprovedCellularPlay(false);
      }
    });

    return () => {
      listenerPromise.then(l => l.remove()).catch(() => { });
    };
  }, []);

  // 2. Uptime/Live Event Detection: Query backend for active matches or high-priority events
  useEffect(() => {
    const checkLiveEvents = async () => {
      try {
        const res = await fetch(apiUrl('/api/streams/live'));
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const priorityStream = data[0]; // e.g. World Cup stream
            if (priorityStream.stream_url) {
              setLiveStreamUrl(priorityStream.stream_url);
              setIsLiveEventActive(true);
              setLiveEventTitle(priorityStream.match_title || "🔴 Live Broadcast");
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Live stream query failed, falling back to channels...", err);
      }

      // No active priority matches: recover last-selected channel or default
      try {
        const lastChannelId = localStorage.getItem("realssa_last_hero_channel");
        const found = CHANNELS.find(c => c.id === lastChannelId);
        if (found) {
          setActiveChannel(found);
        } else {
          setActiveChannel(CHANNELS[0]); // Default back to Channels TV
        }
      } catch (e) { }
    };

    checkLiveEvents();
  }, []);

  // Set timeout fallback for loading state
  useEffect(() => {
    setVideoLoaded(false);
    setVideoError(false);

    timerRef.current = setTimeout(() => {
      if (!videoLoaded) {
        setVideoError(true);
      }
    }, 8000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeChannel, liveStreamUrl]);

  const handleChannelSwitch = (channel: LiveChannel) => {
    setActiveChannel(channel);
    setIsLiveEventActive(false);
    setLiveStreamUrl(null);
    try {
      localStorage.setItem("realssa_last_hero_channel", channel.id);
    } catch (e) { }
  };

  const isNative = Capacitor.isNativePlatform();
  const shouldPlay = !isCellular || userApprovedCellularPlay;

  return (
    <section className="relative overflow-hidden w-full min-h-[640px] md:h-[90vh] flex flex-col items-center justify-center bg-black py-12 md:py-0">

      {/* 1. Background Video / HLS Stream Player */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <ErrorBoundary fallback={
          <div
            className="absolute inset-0 bg-cover bg-center opacity-85 transition-opacity duration-1000"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1600')` }}
          />
        }>
          {videoError ? (
            // Video failed/offline: fallback static premium background image
            <div
              className="absolute inset-0 bg-cover bg-center opacity-85 transition-opacity duration-1000"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1600')` }}
            />
          ) : !shouldPlay ? (
            // Cellular-safe mode: Show static preview image with play prompt to save data
            <div
              className="absolute inset-0 bg-cover bg-center opacity-70 transition-opacity duration-500"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1600')` }}
            />
          ) : isNative || isLiveEventActive || activeChannel.hlsUrl ? (
            // Mobile/WebView or HLS stream supported
            <div className="absolute inset-0 w-full h-full opacity-80">
              <HlsPlayer
                src={liveStreamUrl || activeChannel.hlsUrl || ""}
                autoPlay={true}
                controls={false}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            // Fallback YouTube Iframe for desktop web
            <iframe
              src={`${activeChannel.embedUrl}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1&playsinline=1`}
              title="Live News Background"
              allow="autoplay; encrypted-media"
              className="absolute top-1/2 left-1/2 w-[300vw] h-[300vh] md:w-[150vw] md:h-[150vh] -translate-x-1/2 -translate-y-1/2 object-cover opacity-85"
              style={{ border: 'none' }}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* 2. Glass Overlay to darken the video and make text readable */}
      <div className="absolute inset-0 bg-black/60 z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/25 z-10" />

      {/* Channel Switcher Overlay */}
      <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-2 items-center px-4 max-w-lg w-full">
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
          {isLiveEventActive && (
            <div className="px-3 py-1 bg-red-600/90 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow-lg shadow-red-900/30 animate-pulse">
              <Radio className="w-3 h-3" />
              <span>{liveEventTitle}</span>
            </div>
          )}
          <div className="flex gap-1.5 bg-black/50 backdrop-blur-md border border-white/15 p-1 rounded-full items-center max-w-full overflow-x-auto scrollbar-hide">
            {CHANNELS.map((chan) => {
              const isSelected = !isLiveEventActive && activeChannel.id === chan.id;
              return (
                <button
                  key={chan.id}
                  onClick={() => handleChannelSwitch(chan)}
                  className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${isSelected
                    ? "bg-amber-500 text-black shadow-md font-bold scale-105"
                    : "text-white/70 hover:text-white"
                    }`}
                >
                  {chan.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Saver Mode Warning / Tap to Watch on Cellular */}
        {isCellular && !userApprovedCellularPlay && !videoError && (
          <button
            onClick={() => setUserApprovedCellularPlay(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/95 hover:bg-amber-500 text-black rounded-full text-[11px] font-bold transition-all scale-100 hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Tap to Stream Live (Cellular Data)</span>
          </button>
        )}
      </div>

      {/* 3. The Glassmorphism Welcome Modal */}
      <div className="relative z-20 container mx-auto px-4 flex flex-col items-center text-center mt-28 sm:mt-32">
        <div className="animate-fade-in bg-black/50 backdrop-blur-lg border border-white/15 p-5 sm:p-8 md:p-10 rounded-3xl shadow-2xl max-w-3xl w-full">

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-2 md:mb-3 drop-shadow-lg">
            Welcome to <span className="text-gradient-gold">RealSSA</span>
          </h1>

          <h2 className="text-base sm:text-xl md:text-2xl text-white/90 font-medium mb-3 md:mb-5 drop-shadow-md">
            The Pulse of Africa & The World
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-white/80 mb-6 max-w-xl mx-auto leading-relaxed">
            Your premier, real-time news aggregator. Swipe through the latest breaking politics, trending sports highlights, tech startups, and viral culture straight from the source.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/nigerian-news" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 group">
                Start Reading
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link to="/videos" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-semibold transition-all duration-300 backdrop-blur-sm border border-white/20 flex items-center justify-center gap-2">
                <PlayCircle className="w-4 h-4" />
                Watch More Live TV
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Scroll Indicator */}
      <div className="hidden sm:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-bounce text-white/40 flex-col items-center">
        <span className="text-[10px] uppercase tracking-widest mb-1 font-medium">Scroll to explore</span>
        <ArrowRight className="w-4 h-4 rotate-90" />
      </div>

    </section>
  );
};

export default HeroSection;
