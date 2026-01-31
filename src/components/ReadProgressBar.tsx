import { useEffect, useState } from 'react';

interface ReadProgressBarProps {
  articleId?: string;
  className?: string;
}

const ReadProgressBar = ({ articleId, className = '' }: ReadProgressBarProps) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      setScrollProgress(Math.min(scrolled, 100));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial calculation
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className={`fixed top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800 z-50 ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-primary to-purple-600 transition-all duration-100 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  );
};

export default ReadProgressBar;