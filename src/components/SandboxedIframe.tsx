import React from 'react';

interface SandboxedIframeProps {
  src: string;
  className?: string;
}

export function SandboxedIframe({ src, className = "" }: SandboxedIframeProps) {
  return (
    <div className={`absolute inset-0 w-full h-full min-h-full bg-black overflow-hidden ${className}`}>
      <iframe
        src={src}
        className="absolute inset-0 block w-full h-full min-h-full border-0"
        style={{ height: '100%', minHeight: '100%' }}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        // Many free embed providers blank or refuse when they see a strict third-party referrer.
        // no-referrer-when-downgrade is the most compatible default in 2026.
        referrerPolicy="no-referrer-when-downgrade"
        title="RealSSA Player"
      />
    </div>
  );
}
