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
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="no-referrer"
        title="RealSSA Player"
        // Blocks popup ads: omitting allow-popups and allow-top-navigation prevents
        // ad scripts from opening new tabs or redirecting the parent window
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen"
      />
    </div>
  );
}
