// Service Worker for Realssa News Aggregator
// Handles push notifications and offline caching

const CACHE_NAME = 'realssa-v1';
const DATA_CACHE_NAME = 'realssa-data-v1';
const MAX_CACHE_SIZE = 20;

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html'
      ]);
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request).then((fetchResponse) => {
        // Don't cache non-successful responses
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }
        
        // Cache successful responses
        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return fetchResponse;
      });
    })
  );
});

// Handle push notifications from FCM
self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      notification: {
        title: 'RealSSA News',
        body: event.data ? event.data.text() : 'New update available'
      }
    };
  }
  
  const title = payload.notification?.title || 'RealSSA News';
  const options = {
    body: payload.notification?.body || 'New update available',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.category || 'news',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open Article',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.ico'
      }
    ],
    data: {
      url: payload.data?.url || '/',
      newsId: payload.data?.newsId
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// Background sync for data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-news') {
    event.waitUntil(syncNewsData());
  }
});

async function syncNewsData() {
  try {
    const response = await fetch('/api/articles');
    if (response.ok) {
      const data = await response.json();
      // Store in IndexedDB
      await storeNewsData(data);
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers
async function storeNewsData(data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['news'], 'readwrite');
    const store = tx.objectStore('news');
    
    // Limit cache size
    const count = await store.count();
    if (count >= MAX_CACHE_SIZE) {
      const firstKey = await store.openKeyCursor();
      if (firstKey) {
        store.delete(firstKey.key);
      }
    }
    
    // Store new data
    const timestamp = Date.now();
    store.put({ data, timestamp });
    
    return tx.complete;
  } catch (error) {
    console.error('Failed to store news data:', error);
  }
}

async function getCachedNewsData() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['news'], 'readonly');
    const store = tx.objectStore('news');
    
    const request = store.openCursor(null, 'prev');
    const result = await new Promise((resolve) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          resolve(cursor.value.data);
        } else {
          resolve(null);
        }
      };
    });
    
    return result;
  } catch (error) {
    console.error('Failed to get cached news data:', error);
    return null;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('realssa-offline', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('news')) {
        db.createObjectStore('news', { keyPath: 'timestamp' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
  });
}

console.log('Service Worker loaded - RealSSA News');
