import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface HlsPlayerProps {
  src: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
}

export function HlsPlayer({ src, autoPlay = true, controls = true, className = "" }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    setStreamError(null);
  }, [src]);

  if (streamError) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center bg-black w-full h-full min-h-[200px] text-zinc-400 gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping mb-1" />
        <p className="text-sm font-bold text-zinc-200">Playback Error</p>
        <p className="text-xs max-w-xs">{streamError}</p>
        <p className="text-[10px] opacity-60">Try selecting another link/server from the list.</p>
      </div>
    );
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls;

    if (Hls.isSupported()) {
      hls = new Hls({
        capLevelToPlayerSize: true,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferLength: 30,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(e => console.error("Auto-play prevented", e));
        }
      });

      // Catch async runtime errors in HLS and trigger state update
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error("Fatal HLS error encountered:", data.type);
          hls.destroy();
          setStreamError(`Fatal HLS stream error: ${data.type}`);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        if (autoPlay) {
          video.play().catch(e => console.error("Auto-play prevented", e));
        }
      });
      video.onerror = () => {
        setStreamError("Native HLS stream loading failed");
      };
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, autoPlay]);

  return (
    <video
      ref={videoRef}
      className={`w-full h-full bg-black ${className}`}
      controls={controls}
      playsInline
      crossOrigin="anonymous"
    />
  );
}
