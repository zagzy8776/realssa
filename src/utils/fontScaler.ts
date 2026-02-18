// Font Scaler Utility for Realssa News Aggregator
// Provides accessibility font scaling for users with visual impairments

import { useState, useEffect } from 'react';

interface FontScaleSettings {
  baseSize: number;
  scaleLevel: number;
  minSize: number;
  maxSize: number;
}

class FontScaler {
  private settings: FontScaleSettings;
  private readonly STORAGE_KEY = 'realssa_font_scale';
  private readonly DEFAULT_SCALE = 1;
  private readonly MIN_SCALE = 0.8;
  private readonly MAX_SCALE = 1.5;
  private readonly STEP = 0.1;

  constructor() {
    this.settings = this.loadSettings();
    this.applyScale();
  }

  private loadSettings(): FontScaleSettings {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          baseSize: parsed.baseSize || 16,
          scaleLevel: parsed.scaleLevel || this.DEFAULT_SCALE,
          minSize: parsed.minSize || 12,
          maxSize: parsed.maxSize || 24
        };
      }
    } catch (error) {
      console.warn('Failed to load font scale settings:', error);
    }

    return {
      baseSize: 16,
      scaleLevel: this.DEFAULT_SCALE,
      minSize: 12,
      maxSize: 24
    };
  }

  private saveSettings() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save font scale settings:', error);
    }
  }

  public applyScale() {
    const root = document.documentElement;
    const fontSize = this.settings.baseSize * this.settings.scaleLevel;
    
    // Apply to root element
    root.style.fontSize = `${fontSize}px`;
    root.style.setProperty('--font-scale', this.settings.scaleLevel.toString());
    
    // Apply to body for system fonts
    document.body.style.fontSize = `${fontSize}px`;
  }

  public getScaleLevel(): number {
    return this.settings.scaleLevel;
  }

  public setScaleLevel(level: number): void {
    // Clamp the scale level
    const clampedLevel = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, level));
    
    this.settings.scaleLevel = clampedLevel;
    this.saveSettings();
    this.applyScale();
  }

  public increaseScale(): void {
    const newLevel = Math.min(this.settings.scaleLevel + this.STEP, this.MAX_SCALE);
    this.setScaleLevel(newLevel);
  }

  public decreaseScale(): void {
    const newLevel = Math.max(this.settings.scaleLevel - this.STEP, this.MIN_SCALE);
    this.setScaleLevel(newLevel);
  }

  public resetScale(): void {
    this.setScaleLevel(this.DEFAULT_SCALE);
  }

  public getScalePercentage(): number {
    return Math.round((this.settings.scaleLevel / this.DEFAULT_SCALE) * 100);
  }

  public isAtMinScale(): boolean {
    return this.settings.scaleLevel <= this.MIN_SCALE;
  }

  public isAtMaxScale(): boolean {
    return this.settings.scaleLevel >= this.MAX_SCALE;
  }

  public getAccessibilityInfo(): {
    currentSize: number;
    percentage: number;
    isMin: boolean;
    isMax: boolean;
  } {
    return {
      currentSize: this.settings.baseSize * this.settings.scaleLevel,
      percentage: this.getScalePercentage(),
      isMin: this.isAtMinScale(),
      isMax: this.isAtMaxScale()
    };
  }
}

// Create singleton instance
export const fontScaler = new FontScaler();

// Hook for using font scaler in components
export const useFontScaler = () => {
  const [scaleInfo, setScaleInfo] = useState(fontScaler.getAccessibilityInfo());

  useEffect(() => {
    const updateScaleInfo = () => {
      setScaleInfo(fontScaler.getAccessibilityInfo());
    };

    // Create a debounced update to prevent excessive re-renders
    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateScaleInfo, 100);
    };

    // Override the applyScale method to trigger updates
    const originalApplyScale = fontScaler.applyScale;
    fontScaler.applyScale = function() {
      originalApplyScale.call(this);
      debouncedUpdate();
    };

    updateScaleInfo();

    return () => {
      fontScaler.applyScale = originalApplyScale;
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    ...scaleInfo,
    increaseScale: fontScaler.increaseScale.bind(fontScaler),
    decreaseScale: fontScaler.decreaseScale.bind(fontScaler),
    resetScale: fontScaler.resetScale.bind(fontScaler),
    setScaleLevel: fontScaler.setScaleLevel.bind(fontScaler)
  };
};

// CSS-in-JS for font scaling
export const injectFontScalingStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --font-scale: 1;
    }
    
    body {
      font-size: calc(16px * var(--font-scale));
      line-height: calc(1.5 * var(--font-scale));
      transition: font-size 0.2s ease;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-size: calc(1rem * var(--font-scale));
      line-height: calc(1.2 * var(--font-scale));
    }
    
    p, span, div, article, section {
      font-size: calc(1rem * var(--font-scale));
      line-height: calc(1.6 * var(--font-scale));
    }
    
    .text-xs { font-size: calc(0.75rem * var(--font-scale)); }
    .text-sm { font-size: calc(0.875rem * var(--font-scale)); }
    .text-base { font-size: calc(1rem * var(--font-scale)); }
    .text-lg { font-size: calc(1.125rem * var(--font-scale)); }
    .text-xl { font-size: calc(1.25rem * var(--font-scale)); }
    .text-2xl { font-size: calc(1.5rem * var(--font-scale)); }
    .text-3xl { font-size: calc(1.875rem * var(--font-scale)); }
    .text-4xl { font-size: calc(2.25rem * var(--font-scale)); }
    .text-5xl { font-size: calc(3rem * var(--font-scale)); }
    .text-6xl { font-size: calc(3.75rem * var(--font-scale)); }
  `;
  document.head.appendChild(style);
};

// Initialize font scaling styles
injectFontScalingStyles();