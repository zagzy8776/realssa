import React from 'react';

const FeedWatermark = () => {
  return (
    <div className="fixed inset-0 bg-[#211D26] -z-10 pointer-events-none overflow-hidden select-none">
      {/* Top-Left Watermark */}
      <div
        className="absolute -top-6 -left-10 font-serif font-bold text-[85px] text-[#2A2530] leading-none select-none"
        style={{ fontFamily: "'Fraunces', 'Source Serif 4', Georgia, serif" }}
      >
        RealSSA
      </div>
      {/* Bottom-Right Watermark */}
      <div
        className="absolute -bottom-6 -right-10 font-serif font-bold text-[85px] text-[#2A2530] leading-none select-none"
        style={{ fontFamily: "'Fraunces', 'Source Serif 4', Georgia, serif" }}
      >
        RealSSA
      </div>
    </div>
  );
};

export default FeedWatermark;
