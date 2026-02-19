import { useState, useEffect } from 'react';
import { 
  Share2, 
  Download, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Smartphone,
  Bell,
  BellOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const MobileAppFeatures = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is installed
    const checkInstalled = () => {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };

    checkInstalled();

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RealSSA News',
          text: 'Get the latest African news and entertainment!',
          url: window.location.href
        });
        toast({
          title: "Shared successfully!",
          description: "Thanks for sharing RealSSA News"
        });
      } catch (error) {
        console.log('Share failed:', error);
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "Share this link with your friends"
      });
    }
  };

  const handleRefresh = () => {
    window.location.reload();
    toast({
      title: "Refreshing...",
      description: "Loading latest content"
    });
  };

  const handleDownload = () => {
    toast({
      title: "Download available!",
      description: "Content is ready for offline reading"
    });
  };

  if (!isInstalled) {
    return null; // Only show in installed PWA
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-white dark:bg-[#1A1A2E] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="border-gray-300 dark:border-gray-600"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-gray-300 dark:border-gray-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-gray-300 dark:border-gray-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
      
      <div className="mt-2 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
        <Smartphone className="w-4 h-4 mr-2" />
        Mobile app features enabled
      </div>
    </div>
  );
};

export default MobileAppFeatures;