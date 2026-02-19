import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

// Firebase configuration - check env vars first, fallback to hardcoded for testing
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBFc-_uR8Ivp9a1RZrbnu9CuEGuZVlWLbA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "realssa-news.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "realssa-news",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "realssa-news.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "530170821780",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:530170821780:web:d56dd3f571d32a99b7c881",
};

// Debug logging
console.log('Firebase Config (keys only):', {
  apiKey: firebaseConfig.apiKey ? '✓ set' : '✗ missing',
  authDomain: firebaseConfig.authDomain ? '✓ set' : '✗ missing',
  projectId: firebaseConfig.projectId ? '✓ set' : '✗ missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? '✓ set' : '✗ missing',
  appId: firebaseConfig.appId ? '✓ set' : '✗ missing',
});

// Validate config
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.error('Missing Firebase config keys:', missingKeys);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Firebase Cloud Messaging
let messaging: Messaging | null = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  messaging = getMessaging(app);
}

// Get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  if (!messaging) return null;
  
  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    const currentToken = await getToken(messaging, { vapidKey });
    
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
    return null;
  }
};

// Type for Firebase message payload
interface FirebaseMessagePayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
    click_action?: string;
  };
  data?: {
    [key: string]: string;
  };
  from?: string;
  collapseKey?: string;
  messageId?: string;
}

// Handle foreground messages
export const onMessageListener = (callback: (payload: FirebaseMessagePayload) => void) => {

  if (!messaging) return () => {};
  
  return onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    callback(payload);
  });
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Subscribe to topic
export const subscribeToTopic = async (token: string, topic: string): Promise<boolean> => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://realssa-production.up.railway.app';
    const response = await fetch(`${apiUrl}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: token,
        subscription: { endpoint: token },
        topics: [topic],
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return false;
  }
};

export { app, messaging };
