// Service Worker for Realssa News Aggregator
// Caches last 20 articles for offline reading

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
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - handle API requests and offline caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for API requests - let them go directly to network
  // The Vercel proxy will handle routing to the backend
  if (url.pathname.includes('/news-feed') || 
      url.pathname.includes('/api/') ||
      url.hostname.includes('railway.app')) {
    // Don't intercept API requests - let browser handle them normally
    return;
  }
  
  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request).then((networkResponse) => {
        // Only cache successful GET requests for static assets
        if (request.method === 'GET' && networkResponse.ok) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Return offline fallback for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
      // For other requests, just fail silently
      return new Response('Network error', { status: 408, statusText: 'Network error' });
    })
  );
});


// Handle external Railway API requests
async function handleExternalNewsApiRequest(request) {
  try {
    // Try to fetch from Railway API
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response for offline use
      const responseClone = networkResponse.clone();
      const data = await responseClone.json();
      
      // Store in IndexedDB for offline access
      await storeNewsData(data);
      
      return networkResponse;
    }
  } catch (error) {
    console.log('Railway API failed, trying cache:', error);
  }

  // Fallback to cached data
  const cachedData = await getCachedNewsData();
  if (cachedData) {
    return new Response(JSON.stringify(cachedData), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Return empty response if no cache available
  return new Response(JSON.stringify([]), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle news API requests with offline support
async function handleNewsApiRequest(request) {
  try {
    // Try to fetch from network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response for offline use
      const responseClone = networkResponse.clone();
      const data = await responseClone.json();
      
      // Store in IndexedDB for offline access
      await storeNewsData(data);
      
      return networkResponse;
    }
  } catch (error) {
    console.log('Network failed, trying cache:', error);
  }

  // Fallback to cached data
  const cachedData = await getCachedNewsData();
  if (cachedData) {
    return new Response(JSON.stringify(cachedData), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Return empty response if no cache available
  return new Response(JSON.stringify([]), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Store news data in IndexedDB
async function storeNewsData(data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['news'], 'readwrite');
    const store = tx.objectStore('news');
    
    // Clear old data if we exceed limit
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

// Get cached news data from IndexedDB
async function getCachedNewsData() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['news'], 'readonly');
    const store = tx.objectStore('news');
    
    // Get the most recent cached data
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

// Open IndexedDB
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

// Handle background sync for data updates
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
      await storeNewsData(data);
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle push notifications (optional future feature)
self.addEventListener('push', (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification('Realssa News', options)
    );
  }
});
