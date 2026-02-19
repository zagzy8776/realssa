import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getFCMToken, requestNotificationPermission, onMessageListener } from '@/lib/firebase';

const PushNotificationManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if Firebase messaging is supported
    if ('serviceWorker' in navigator && 'Notification' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  useEffect(() => {
    // Listen for foreground messages
    const unsubscribe = onMessageListener((payload) => {
      console.log('Foreground message received:', payload);
      // Show toast notification for foreground messages
      toast({
        title: payload.notification?.title || 'New Notification',
        description: payload.notification?.body || 'You have a new message',
      });
    });

    return () => unsubscribe();
  }, [toast]);

  const checkSubscription = async () => {
    try {
      // Check if we have an FCM token stored
      const storedToken = localStorage.getItem('fcmToken');
      if (storedToken) {
        setFcmToken(storedToken);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const subscribeToPush = async () => {
    setIsLoading(true);
    try {
      // Request permission
      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted) {
        toast({
          title: 'Permission Denied',
          description: 'Please allow notifications in your browser settings.',
          variant: 'destructive',
        });
        return;
      }

      // Get FCM token from Firebase
      const token = await getFCMToken();
      if (!token) {
        throw new Error('Failed to get FCM token');
      }

      // Store token locally
      localStorage.setItem('fcmToken', token);
      setFcmToken(token);

      // Subscribe to breaking news topic
      const apiUrl = import.meta.env.VITE_API_URL || 'https://realssa-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: token,
          subscription: { endpoint: token },
          topics: ['breaking-news', 'general'],
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        toast({
          title: 'Notifications Enabled',
          description: 'You will receive breaking news alerts!',
        });
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: 'Subscription Failed',
        description: 'Could not enable notifications. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);
    try {
      if (fcmToken) {
        // Unsubscribe from server
        const apiUrl = import.meta.env.VITE_API_URL || 'https://realssa-production.up.railway.app';
        await fetch(`${apiUrl}/api/notifications/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription: { endpoint: fcmToken } }),
        });

        // Remove token from local storage
        localStorage.removeItem('fcmToken');
        setFcmToken(null);
        setIsSubscribed(false);

        toast({
          title: 'Notifications Disabled',
          description: 'You will no longer receive alerts.',
        });
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: 'Error',
        description: 'Could not disable notifications.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {isSubscribed ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={unsubscribeFromPush}
          disabled={isLoading}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <BellRing className="w-4 h-4 mr-2" />
          {isLoading ? 'Disabling...' : 'Notifications On'}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={subscribeToPush}
          disabled={isLoading}
          className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
        >
          <BellOff className="w-4 h-4 mr-2" />
          {isLoading ? 'Enabling...' : 'Get Alerts'}
        </Button>
      )}
    </div>
  );
};

export default PushNotificationManager;
