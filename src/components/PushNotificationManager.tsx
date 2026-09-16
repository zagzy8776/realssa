import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import OneSignalNative from 'onesignal-cordova-plugin';

interface PushNotificationManagerProps {
  iconOnly?: boolean;
}

const ONESIGNAL_APP_ID = '055b6596-a96c-48e2-8cda-ff4bb6d61009';

function syncCategoryTags(OneSignal: any) {
  try {
    const raw = localStorage.getItem('realssa_category_prefs');
    const prefs: string[] = raw ? JSON.parse(raw) : [];
    const allCategories = ['sports', 'nigeria', 'ghana', 'kenya', 'south-africa', 'crypto', 'tech', 'business', 'culture', 'entertainment'];
    const tags: Record<string, string> = { has_prefs: prefs.length > 0 ? '1' : '0' };
    allCategories.forEach(category => {
      tags[`cat_${category}`] = prefs.includes(category) ? '1' : '0';
    });
    OneSignal.User.addTags(tags);
  } catch (error) {
    console.warn('[OneSignal] Failed to sync category tags:', error);
  }
}

const browserSupportsPush = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator;

function waitForWebOneSignal(): Promise<any> {
  return new Promise((resolve, reject) => {
    const existing = (window as any).OneSignal;
    if (existing?.User?.PushSubscription) {
      resolve(existing);
      return;
    }

    const deferred = (window as any).OneSignalDeferred;
    if (!deferred) {
      reject(new Error('OneSignal web SDK is not initialized'));
      return;
    }

    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('OneSignal web SDK timed out'));
      }
    }, 10000);

    deferred.push((OneSignal: any) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(OneSignal);
    });
  });
}

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

    if (!browserSupportsPush()) return;
    setIsSupported(true);

    let cleanup: (() => void) | undefined;
    let disposed = false;

    waitForWebOneSignal()
      .then((OneSignal: any) => {
        if (disposed) return;
        const subscription = OneSignal.User?.PushSubscription;
        const optedIn = Boolean(subscription?.optedIn);
        setIsSubscribed(optedIn);
        if (optedIn) syncCategoryTags(OneSignal);

        const onChange = (event: any) => {
          if (typeof event?.current?.optedIn === 'boolean') {
            setIsSubscribed(event.current.optedIn);
          }
        };

        subscription?.addEventListener?.('change', onChange);
        cleanup = () => subscription?.removeEventListener?.('change', onChange);
      })
      .catch(() => {
        // The button remains available because browser support was detected.
        if (Notification.permission === 'granted') setIsSubscribed(true);
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const subscribeToPush = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        OneSignalNative.initialize(ONESIGNAL_APP_ID);
        const ok = await OneSignalNative.Notifications.requestPermission(true);
        if (ok) {
          setIsSubscribed(true);
          toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
        } else {
          toast({ title: 'Permission Denied', description: 'Enable notifications in your phone settings.', variant: 'destructive' });
        }
        return;
      }

      const OneSignal = await waitForWebOneSignal();

      // Ask through OneSignal first so the browser permission and the
      // OneSignal subscription are both updated. This avoids the old false
      // positive where Notification.requestPermission() succeeded but the
      // device never became a OneSignal subscriber.
      if (Notification.permission !== 'granted') {
        await OneSignal.Notifications.requestPermission();
      }

      if (Notification.permission !== 'granted') {
        toast({ title: 'Permission Denied', description: 'Allow notifications for RealSSA News in your browser settings.', variant: 'destructive' });
        return;
      }

      await OneSignal.User.PushSubscription.optIn();
      syncCategoryTags(OneSignal);
      setIsSubscribed(true);
      toast({ title: 'Notifications Enabled', description: 'You will receive breaking news alerts!' });
    } catch (error) {
      console.error('[OneSignal] Subscribe error:', error);
      toast({ title: 'Failed', description: 'Could not enable notifications. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        toast({ title: 'Manage in Settings', description: 'Turn off notifications in your phone settings.' });
        return;
      }

      const OneSignal = await waitForWebOneSignal();
      await OneSignal.User.PushSubscription.optOut();
      setIsSubscribed(false);
      toast({ title: 'Notifications Disabled', description: 'You will no longer receive alerts.' });
    } catch (error) {
      console.error('[OneSignal] Unsubscribe error:', error);
      toast({ title: 'Failed', description: 'Could not disable notifications right now.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Button
        variant="ghost"
        size={iconOnly ? 'icon' : 'sm'}
        onClick={() => toast({ title: 'Not Supported', description: 'This browser does not support web notifications.' })}
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
            ? <BellRing className="w-5 h-5" />
            : <><BellRing className="w-4 h-4 mr-2" />{isLoading ? 'Disabling...' : 'Notifications On'}</>}
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
