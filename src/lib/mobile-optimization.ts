// Mobile-first optimization utilities
export const mobileOptimization = {
  // Touch-friendly spacing
  spacing: {
    xs: '8px',
    sm: '12px', 
    md: '16px',
    lg: '24px',
    xl: '32px'
  },

  // Typography optimization for mobile
  typography: {
    base: {
      fontSize: '16px',
      lineHeight: '1.5',
      letterSpacing: '0.01em'
    },
    heading: {
      fontSize: '24px',
      lineHeight: '1.2',
      letterSpacing: '-0.02em'
    },
    small: {
      fontSize: '14px',
      lineHeight: '1.4',
      letterSpacing: '0.02em'
    }
  },

  // Touch target optimization
  touch: {
    minSize: '44px',
    buttonPadding: '12px 16px',
    iconSize: '24px'
  },

  // Mobile-specific styles
  mobileStyles: {
    container: {
      padding: '16px',
      maxWidth: '100%'
    },
    card: {
      borderRadius: '12px',
      padding: '16px',
      margin: '8px'
    },
    button: {
      borderRadius: '12px',
      padding: '14px 16px',
      fontSize: '16px',
      fontWeight: '600'
    }
  },

  // Responsive breakpoints
  breakpoints: {
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px',
    large: '1280px'
  },

  // Mobile-first grid system
  grid: {
    columns: {
      1: '100%',
      2: 'calc(50% - 8px)',
      3: 'calc(33.33% - 11px)',
      4: 'calc(25% - 12px)'
    },
    gap: {
      xs: '8px',
      sm: '12px',
      md: '16px',
      lg: '24px'
    }
  }
};

// Utility function to generate mobile-first CSS classes
export const generateMobileClasses = (styles: Record<string, string>) => {
  return Object.entries(styles).map(([key, value]) => 
    `${key}-${value.replace(/\s+/g, '-').toLowerCase()}`
  ).join(' ');
};

// Mobile-first responsive helper
export const responsive = (mobile: string, tablet?: string, desktop?: string) => {
  let classes = mobile;
  if (tablet) classes += ` md:${tablet}`;
  if (desktop) classes += ` lg:${desktop}`;
  return classes;
};

// Touch-friendly button generator
export const createTouchButton = (variant: 'primary' | 'secondary' | 'ghost' = 'primary') => {
  const baseClasses = `
    min-h-[44px] 
    min-w-[44px] 
    px-4 
    py-2 
    text-base 
    rounded-xl 
    font-medium 
    transition-all 
    duration-200 
    focus:outline-none 
    focus:ring-2 
    focus:ring-offset-2
  `;

  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
    ghost: 'bg-transparent hover:bg-muted focus:ring-muted-foreground'
  };

  return `${baseClasses} ${variantClasses[variant]}`;
};

// Mobile card styles
export const mobileCard = `
  bg-card 
  rounded-xl 
  border 
  border-border 
  shadow-sm 
  overflow-hidden 
  transition-all 
  duration-200 
  hover:shadow-lg 
  hover:-translate-y-1
  touch-action: manipulation
`;

// Mobile input styles
export const mobileInput = `
  w-full 
  min-h-[44px] 
  px-4 
  py-3 
  text-base 
  rounded-xl 
  border 
  border-border 
  bg-background 
  focus:outline-none 
  focus:ring-2 
  focus:ring-primary 
  focus:border-transparent
  touch-action: manipulation
`;

// Mobile typography classes
export const mobileTypography = {
  h1: 'text-2xl md:text-3xl lg:text-4xl font-bold leading-tight',
  h2: 'text-xl md:text-2xl lg:text-3xl font-bold leading-tight',
  h3: 'text-lg md:text-xl lg:text-2xl font-semibold',
  body: 'text-base md:text-lg leading-relaxed',
  small: 'text-sm md:text-base leading-relaxed',
  caption: 'text-xs md:text-sm leading-relaxed text-muted-foreground'
};

// Mobile layout helpers
export const mobileLayout = {
  container: 'px-4 md:px-6 lg:px-8',
  grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6',
  flex: 'flex flex-col sm:flex-row gap-4',
  center: 'flex flex-col items-center justify-center'
};

// Performance optimization for mobile
export const mobilePerformance = {
  // Lazy loading threshold
  lazyThreshold: 0.1,
  
  // Image optimization
  imageSizes: {
    mobile: '100vw',
    tablet: '50vw', 
    desktop: '33vw',
    large: '25vw'
  },

  // CSS optimizations
  cssOptimizations: {
    willChange: 'transform, opacity',
    transform3d: 'translate3d(0, 0, 0)',
    backfaceVisibility: 'hidden'
  }
};