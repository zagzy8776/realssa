import { ReactNode } from 'react';

interface MobileGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const MobileGrid = ({ 
  children, 
  columns = 1, 
  gap = 'md', 
  className = '' 
}: MobileGridProps) => {
  const getGridClasses = () => {
    const baseClasses = 'grid';
    
    // Mobile-first: 1 column
    let gridClasses = `${baseClasses} grid-cols-1`;
    
    // Tablet: 2 columns
    if (columns >= 2) {
      gridClasses += ' sm:grid-cols-2';
    }
    
    // Desktop: 3 columns
    if (columns >= 3) {
      gridClasses += ' lg:grid-cols-3';
    }
    
    // Large desktop: 4 columns
    if (columns >= 4) {
      gridClasses += ' xl:grid-cols-4';
    }
    
    // Gap classes
    const gapClasses = {
      xs: 'gap-2',
      sm: 'gap-3',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-8'
    };
    
    return `${gridClasses} ${gapClasses[gap]} ${className}`;
  };

  return (
    <div className={getGridClasses()}>
      {children}
    </div>
  );
};

export default MobileGrid;