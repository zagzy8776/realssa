import { ReactNode } from 'react';

interface MobileTypographyProps {
  children: ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small' | 'caption';
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const MobileTypography = ({ 
  children, 
  variant = 'body', 
  className = '', 
  as: Component = 'p' 
}: MobileTypographyProps) => {
  const getTypographyClasses = () => {
    const baseClasses = 'leading-relaxed';
    
    const variantClasses = {
      h1: 'text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight',
      h2: 'text-xl md:text-2xl lg:text-3xl font-bold tracking-tight',
      h3: 'text-lg md:text-xl lg:text-2xl font-semibold',
      h4: 'text-base md:text-lg lg:text-xl font-medium',
      body: 'text-base md:text-lg leading-relaxed',
      small: 'text-sm md:text-base leading-relaxed',
      caption: 'text-xs md:text-sm leading-relaxed text-muted-foreground'
    };

    return `${baseClasses} ${variantClasses[variant]} ${className}`;
  };

  return (
    <Component className={getTypographyClasses()}>
      {children}
    </Component>
  );
};

export default MobileTypography;