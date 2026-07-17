importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Service Worker for RealSSA News — offline caching & push notifications
// Push notifications are integrated via OneSignal SDK

const CACHE_NAME = 'realssa-v3';
const DATA_CACHE_NAME = 'realssa-data-v3';
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
  
  const url = new URL(event.request.url);
  const isAllowed = url.origin === self.location.origin;
  
  if (!isAllowed) {
    // For external URLs, let the browser handle it naturally without service worker interference
    return;
  }

  // IMPORTANT FIX: Use Network-First strategy for HTML requests (like index.html)
  // This ensures the browser always gets the latest HTML containing the correct, newest JS bundle links.
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // If offline, fallback to the cached index.html
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For all other assets (JS, CSS, images), use Cache-First strategy
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


// Push events are handled by the OneSignalSDK.sw.js imported at the top of this file

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
