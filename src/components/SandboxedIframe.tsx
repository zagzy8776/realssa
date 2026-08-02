import React from 'react';

interface SandboxedIframeProps {
  src: string;
  className?: string;
}

export function SandboxedIframe({ src, className = "" }: SandboxedIframeProps) {
  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-presentation"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="no-referrer"
        title="RealSSA Player"
      />
    </div>
  );
}
