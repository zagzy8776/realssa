// Mobile-first responsive design utilities
export const mobileStyles = {
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px'
  },
  
  // Touch-friendly sizes
  touch: {
    minTapTarget: '44px', // Minimum touch target size (Apple HIG)
    buttonHeight: '48px', // Optimal button height
    spacing: '16px', // Standard spacing
    padding: '12px' // Standard padding
  },
  
  // Typography for mobile
  typography: {
    base: '16px',
    small: '14px',
    large: '18px',
    heading: '24px',
    subheading: '20px'
  },
  
  // Grid system
  grid: {
    columns: {
      1: '100%',
      2: 'calc(50% - 8px)',
      3: 'calc(33.33% - 11px)',
      4: 'calc(25% - 12px)'
    }
  }
};

// Mobile-first CSS classes generator
export const getMobileClasses = (baseClasses: string) => {
  return {
    // Mobile (base)
    mobile: baseClasses,
    // Tablet
    tablet: `${baseClasses} md:`,
    // Desktop
    desktop: `${baseClasses} lg:`
  };
};

// Touch-friendly button styles
export const touchButtonClasses = `
  min-h-[44px] 
  min-w-[44px] 
  px-4 
  py-2 
  text-base 
  rounded-lg 
  font-medium 
  transition-all 
  duration-200 
  focus:outline-none 
  focus:ring-2 
  focus:ring-offset-2 
  focus:ring-primary
`;

// Touch-friendly input styles
export const touchInputClasses = `
  w-full 
  min-h-[44px] 
  px-4 
  py-2 
  text-base 
  rounded-lg 
  border 
  border-border 
  bg-background 
  focus:outline-none 
  focus:ring-2 
  focus:ring-primary 
  focus:border-transparent
`;

// Mobile card styles
export const mobileCardClasses = `
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
`;

// Mobile spacing classes
export const mobileSpacing = {
  xs: 'p-2',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8'
};

// Mobile typography classes
export const mobileTypography = {
  h1: 'text-2xl md:text-3xl lg:text-4xl font-bold',
  h2: 'text-xl md:text-2xl lg:text-3xl font-bold',
  h3: 'text-lg md:text-xl lg:text-2xl font-semibold',
  body: 'text-sm md:text-base lg:text-lg',
  small: 'text-xs md:text-sm',
  large: 'text-base md:text-lg lg:text-xl'
};

// Mobile layout classes
export const mobileLayout = {
  container: 'px-4 md:px-6 lg:px-8',
  grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6',
  flex: 'flex flex-col sm:flex-row gap-4',
  center: 'flex flex-col items-center justify-center'
};