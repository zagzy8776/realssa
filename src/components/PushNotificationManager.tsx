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

function syncCategoryTags(OneSignal: any) {
  try {
    const raw = localStorage.getItem('realssa_category_prefs');
    const prefs: string[] = raw ? JSON.parse(raw) : [];
    const ALL_CATS = ['sports','nigeria','ghana','kenya','south-africa','crypto','tech','business','culture','entertainment'];
    const tags: Record<string, string> = { has_prefs: prefs.length > 0 ? '1' : '0' };
    ALL_CATS.forEach(cat => { tags[`cat_${cat}`] = prefs.includes(cat) ? '1' : '0'; });
    OneSignal.User.addTags(tags);
  } catch (e) {
    console.warn('Failed to sync category tags', e);
  }
}

// Check if browser supports push at all
const browserSupportsPush = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator;

const PushNotificationManager = ({ iconOnly = false }: PushNotificationManagerProps) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsSupported(true);
      OneSignalNative.Notifications.hasPermission()
        .then(has => setIsSubscribed(has))
        .catch(() => {});
      return;
    }

    // Web: mark supported immediately if browser supports Notification API
    // so the bell icon always shows — don't wait for OneSignal SDK
    if (browserSupportsPush()) {
      setIsSupported(true);
      // Reflect current native permission state right away
      if (Notification.permission === 'granted') setIsSubscribed(true);
    }

    // Then try to sync with OneSignal if it loads
    let retries = 0;
    const tryOneSignal = () => {
      const OS = (window as any).OneSignal;
      if (OS?.User?.PushSubscription) {
        const optedIn = OS.User.PushSubscription.optedIn || false;
        setIsSubscribed(optedIn);
        if (optedIn) syncCategoryTags(OS);

        const onChange = (e: any) => {
          if (e?.current) setIsSubscribed(e.current.optedIn);
        };
        OS.User.PushSubscription.addEventListener('change', onChange);
        return () => OS.User.PushSubscription.removeEventListener('change', onChange);
      }
      retries++;
      if (retries < 20) setTimeout(tryOneSignal, 500);
    };
    const cleanup = tryOneSignal();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  const subscribeToPush = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const ok = await OneSignalNative.Notifications.requestPermission(true);
        if (ok) {
          setIsSubscribed(true);
          toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
        } else {
          toast({ title: 'Permission Denied', description: 'Enable notifications in your phone settings.', variant: 'destructive' });
        }
        return;
      }

      // Try OneSignal first
      const OS = (window as any).OneSignal;
      if (OS?.User?.PushSubscription) {
        await OS.User.PushSubscription.optIn();
        syncCategoryTags(OS);
        setIsSubscribed(true);
        toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
        return;
      }

      // Fallback: native browser Notification API
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setIsSubscribed(true);
        toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
      } else {
        toast({ title: 'Permission Denied', description: 'Allow notifications in your browser settings.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      toast({ title: 'Failed', description: 'Could not enable notifications.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        toast({ title: 'Manage in Settings', description: 'Turn off notifications in Android Settings.', variant: 'destructive' });
        return;
      }
      const OS = (window as any).OneSignal;
      if (OS?.User?.PushSubscription) {
        await OS.User.PushSubscription.optOut();
        setIsSubscribed(false);
        toast({ title: 'Notifications Disabled', description: 'You will no longer receive alerts.' });
      } else {
        // Can't programmatically revoke native permission — guide user
        toast({ title: 'To disable', description: 'Click the lock icon in your browser address bar and turn off notifications.' });
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Button
        variant="ghost"
        size={iconOnly ? 'icon' : 'sm'}
        onClick={() => toast({ title: 'Not Supported', description: 'Install this site as a PWA (Add to Home Screen) to enable alerts.' })}
        className={iconOnly ? 'text-muted-foreground/50 rounded-full w-9 h-9' : 'text-muted-foreground/50'}
        title="Notifications not supported"
      >
        {iconOnly ? <BellOff className="w-5 h-5" /> : <><BellOff className="w-4 h-4 mr-2" />Alerts Off</>}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isSubscribed ? (
        <Button
          variant="ghost"
          size={iconOnly ? 'icon' : 'sm'}
          onClick={unsubscribeFromPush}
          disabled={isLoading}
          className={iconOnly ? 'text-green-500 hover:text-green-600 rounded-full w-9 h-9' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
          title="Disable Notifications"
        >
          {iconOnly
            ? <BellRing className="w-5 h-5 animate-pulse" />
            : <><BellRing className="w-4 h-4 mr-2 animate-pulse" />{isLoading ? 'Disabling...' : 'Notifications On'}</>}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size={iconOnly ? 'icon' : 'sm'}
          onClick={subscribeToPush}
          disabled={isLoading}
          className={iconOnly ? 'text-muted-foreground hover:text-primary rounded-full w-9 h-9' : 'text-muted-foreground hover:text-primary hover:bg-muted'}
          title="Enable Notifications"
        >
          {iconOnly
            ? <Bell className="w-5 h-5" />
            : <><Bell className="w-4 h-4 mr-2" />{isLoading ? 'Enabling...' : 'Get Alerts'}</>}
        </Button>
      )}
    </div>
  );
};

export default PushNotificationManager;
