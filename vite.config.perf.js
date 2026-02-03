// Performance budget configuration for Vite
export const performanceBudget = {
  // Bundle size limits (in KB)
  bundles: {
    'vendor-react': 150,
    'vendor-ui': 200,
    'vendor-utils': 100,
    'vendor-other': 150,
    total: 800, // Total bundle size limit
  },

  // Performance metrics targets
  metrics: {
    // Lighthouse scores (0-100)
    lighthouse: {
      performance: 90,
      accessibility: 90,
      'best-practices': 90,
      seo: 90,
    },

    // Core Web Vitals targets
    'largest-contentful-paint': 2500, // ms
    'first-input-delay': 100, // ms
    'cumulative-layout-shift': 0.1,

    // Loading times
    'first-contentful-paint': 1500, // ms
    'time-to-interactive': 2500, // ms
  },

  // Resource size limits
  resources: {
    images: {
      maxSize: 500, // KB per image
      formats: ['webp', 'avif'], // Preferred formats
    },
    fonts: {
      maxSize: 100, // KB total
      preload: true,
    },
  },
};

export default performanceBudget;
