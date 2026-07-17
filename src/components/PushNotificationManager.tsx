import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import OneSignalNative from 'onesignal-cordova-plugin';

interface PushNotificationManagerProps {
  iconOnly?: boolean;
}

const ONESIGNAL_APP_ID = "055b6596-a96c-48e2-8cda-ff4bb6d61009";

const PushNotificationManager = ({ iconOnly = false }: PushNotificationManagerProps) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsSupported(true);
      const checkNativeSubscription = async () => {
        try {
          const hasPermission = await OneSignalNative.Notifications.hasPermission();
          setIsSubscribed(hasPermission);
        } catch (e) {
          console.warn("Failed to check native push permission", e);
        }
      };
      checkNativeSubscription();
      
    } else {
      let cleanupFn: (() => void) | undefined;
      const setupOneSignal = () => {
        const OneSignal = (window as any).OneSignal;
        if (OneSignal && OneSignal.User) {
          setIsSupported(true);
          const optedIn = OneSignal.User.PushSubscription?.optedIn || false;
          setIsSubscribed(optedIn);

          const handleSubscriptionChange = (event: any) => {
            if (event && event.current) {
              setIsSubscribed(event.current.optedIn);
            }
          };

          OneSignal.User.PushSubscription?.addEventListener('change', handleSubscriptionChange);
          cleanupFn = () => {
            OneSignal.User.PushSubscription?.removeEventListener('change', handleSubscriptionChange);
          };
        }
      };

      const OneSignal = (window as any).OneSignal;
      if (OneSignal && OneSignal.User) {
        setupOneSignal();
      } else {
        let retryCount = 0;
        const interval = setInterval(() => {
          const currentOneSignal = (window as any).OneSignal;
          retryCount++;
          if (currentOneSignal && currentOneSignal.User) {
            setupOneSignal();
            clearInterval(interval);
          }
          if (retryCount > 30) clearInterval(interval);
        }, 500);

        return () => {
          clearInterval(interval);
          if (cleanupFn) cleanupFn();
        };
      }
      return () => {
        if (cleanupFn) cleanupFn();
      };
    }
  }, []);

  const subscribeToPush = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const success = await OneSignalNative.Notifications.requestPermission(true);
        if (success) {
          setIsSubscribed(true);
          toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
        } else {
          toast({ title: 'Permission Denied', description: 'Please enable notifications in your phone settings.', variant: 'destructive' });
        }
      } else {
        const OneSignal = (window as any).OneSignal;
        if (!OneSignal) throw new Error('OneSignal SDK not loaded.');
        await OneSignal.User.PushSubscription.optIn();
        setIsSubscribed(true);
        toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({ title: 'Subscription Failed', description: 'Could not enable notifications.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        toast({ title: 'Manage in Settings', description: 'To disable alerts, please turn them off in your Android Settings.', variant: 'destructive' });
      } else {
        const OneSignal = (window as any).OneSignal;
        if (!OneSignal) throw new Error('OneSignal SDK not loaded');
        await OneSignal.User.PushSubscription.optOut();
        setIsSubscribed(false);
        toast({ title: 'Notifications Disabled', description: 'You will no longer receive alerts.' });
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsupportedClick = () => {
    toast({
      title: 'Notifications Not Supported',
      description: 'Please install this site as a PWA (Add to Home Screen) to enable alerts.',
    });
  };

  if (!isSupported) {
    return (
      <Button variant="ghost" size={iconOnly ? "icon" : "sm"} onClick={handleUnsupportedClick} className={iconOnly ? "text-muted-foreground/50 rounded-full w-9 h-9 flex items-center justify-center" : "text-muted-foreground/50"} title="Notifications not supported">
        {iconOnly ? <BellOff className="w-5 h-5" /> : <><BellOff className="w-4 h-4 mr-2" />Alerts Off</>}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isSubscribed ? (
        <Button variant="ghost" size={iconOnly ? "icon" : "sm"} onClick={unsubscribeFromPush} disabled={isLoading} className={iconOnly ? "text-green-600 hover:text-green-700 rounded-full w-9 h-9 flex items-center justify-center" : "text-green-600 hover:text-green-700 hover:bg-green-50"} title="Disable Notifications">
          {iconOnly ? <BellRing className="w-5 h-5 animate-pulse" /> : <><BellRing className="w-4 h-4 mr-2 animate-pulse" />{isLoading ? 'Disabling...' : 'Notifications On'}</>}
        </Button>
      ) : (
        <Button variant="ghost" size={iconOnly ? "icon" : "sm"} onClick={subscribeToPush} disabled={isLoading} className={iconOnly ? "text-muted-foreground hover:text-primary rounded-full w-9 h-9 flex items-center justify-center" : "text-muted-foreground hover:text-primary hover:bg-muted"} title="Enable Notifications">
          {iconOnly ? <Bell className="w-5 h-5" /> : <><Bell className="w-4 h-4 mr-2" />{isLoading ? 'Enabling...' : 'Get Alerts'}</>}
        </Button>
      )}
    </div>
  );
};

export default PushNotificationManager;
