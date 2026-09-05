import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-base';

type NotificationItem = {
  id?: string | number;
  title?: string;
  message?: string;
  read?: boolean;
  isRead?: boolean;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
};

const EMPTY: NotificationItem[] = [];

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/notifications'), { credentials: 'include' });
      if (!response.ok) throw new Error(`Notifications request failed: ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refresh().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (active) refresh().catch(() => undefined);
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const unreadCount = notifications.filter(item => item.read === false || item.isRead === false).length;

  return { notifications, unreadCount, loading, refresh };
};
