importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Service Worker for RealSSA News — offline caching & push notifications
// Cache v4 invalidates the previous browser bundle after the production API routing fix.
const CACHE_NAME = 'realssa-v4';
const DATA_CACHE_NAME = 'realssa-data-v4';
const MAX_CACHE_SIZE = 20;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // API requests must never be served from an old service-worker cache.
  if (event.request.url.includes('/api/')) return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer the newest HTML so deployments cannot leave users pinned to an old bundle.
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Same-origin static assets use stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse?.status === 200 && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => undefined);

      return cachedResponse || fetchPromise;
    }))
  );
});

// Push events are handled by OneSignalSDK.sw.js imported above.
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-news') event.waitUntil(syncNewsData());
});

async function syncNewsData() {
  try {
    const response = await fetch('/api/articles');
    if (response.ok) await storeNewsData(await response.json());
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function storeNewsData(data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['news'], 'readwrite');
    const store = tx.objectStore('news');
    const count = await store.count();
    if (count >= MAX_CACHE_SIZE) {
      const firstKey = await store.openKeyCursor();
      if (firstKey) store.delete(firstKey.key);
    }
    store.put({ data, timestamp: Date.now() });
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
    return await new Promise((resolve) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        resolve(cursor ? cursor.value.data : null);
      };
    });
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

console.log('Service Worker loaded - RealSSA News v4');
