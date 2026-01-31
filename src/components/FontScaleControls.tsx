import { useState, useEffect } from 'react';
import { fontScaler } from '@/utils/fontScaler';

const FontScaleControls = () => {
  const [scaleInfo, setScaleInfo] = useState(fontScaler.getAccessibilityInfo());

  useEffect(() => {
    const updateScaleInfo = () => {
      setScaleInfo(fontScaler.getAccessibilityInfo());
    };

    // Listen for changes
    const originalApplyScale = fontScaler.applyScale;
    fontScaler.applyScale = function() {
      originalApplyScale.call(this);
      updateScaleInfo();
    };

    updateScaleInfo();

    return () => {
      fontScaler.applyScale = originalApplyScale;
    };
  }, []);

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
      <span className="text-sm text-muted-foreground font-medium">Text Size:</span>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => fontScaler.decreaseScale()}
          disabled={scaleInfo.isMin}
          className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrease text size"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <div className="text-center min-w-[60px]">
          <span className="text-lg font-bold text-primary">{scaleInfo.percentage}%</span>
          <div className="text-xs text-muted-foreground">{scaleInfo.currentSize}px</div>
        </div>

        <button
          onClick={() => fontScaler.increaseScale()}
          disabled={scaleInfo.isMax}
          className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Increase text size"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => fontScaler.resetScale()}
        className="ml-2 px-3 py-1 text-sm border border-border rounded-md hover:bg-accent transition-colors"
        aria-label="Reset text size to default"
      >
        Reset
      </button>
    </div>
  );
};

export default FontScaleControls;