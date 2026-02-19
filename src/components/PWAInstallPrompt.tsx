import { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Type for PWA install prompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if PWA is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if user already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleManualInstall = () => {
    // Show instructions for manual installation
    alert(
      'To install RealSSA:\n\n' +
      '1. Tap the share button in your browser\n' +
      '2. Select "Add to Home Screen"\n' +
      '3. Tap "Add" to confirm\n\n' +
      'The app will appear on your home screen!'
    );
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-[#1A1A2E] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 z-50 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1A1A2E] dark:text-white">Install RealSSA App</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Get the full app experience</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={handleInstallClick}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
        >
          <Download className="w-4 h-4 mr-2" />
          Install App
        </Button>
        <Button
          variant="outline"
          onClick={handleManualInstall}
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
        >
          Manual Install
        </Button>
      </div>
      
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
        Works offline • No app store needed • Free forever
      </div>
    </div>
  );
};

export default PWAInstallPrompt;