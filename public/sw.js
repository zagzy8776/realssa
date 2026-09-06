// Register the message listener during initial worker evaluation.
// This also gives the app a safe way to activate an updated worker.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Service Worker for RealSSA News — offline caching & push notifications
const CACHE_NAME = 'realssa-v6';
const MAX_CACHE_SIZE = 20;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // A service worker should never proxy cross-origin traffic. This is
  // especially important for Vercel preview/SSO resources and third-party SDKs.
  if (url.origin !== self.location.origin) return;

  // Never intercept API requests. They must always reach the live backend.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rss/')) return;

  // Navigation requests: network-first, then cached HTML, then a valid offline response.
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, response.clone()))
                .catch((error) => console.warn('SW HTML cache update failed:', error))
            );
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match('/index.html');
          return cached || new Response(
            '<!doctype html><html><body><h1>RealSSA News</h1><p>You are offline. Please try again.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate. Never return an
  // unresolved/rejected promise as the FetchEvent response.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const networkResponse = await fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            event.waitUntil(
              cache.put(event.request, response.clone())
                .catch((error) => console.warn('SW asset cache update failed:', error))
            );
          }
          return response;
        })
        .catch(() => null);

      return cachedResponse || networkResponse || Response.error();
    }).catch(() => Response.error())
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
      const firstKey = await new Promise((resolve, reject) => {
        const request = store.openKeyCursor();
        request.onsuccess = () => resolve(request.result?.key ?? null);
        request.onerror = () => reject(request.error);
      });
      if (firstKey !== null) store.delete(firstKey);
    }
    store.put({ data, timestamp: Date.now() });
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
      request.onerror = () => resolve(null);
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

console.log('Service Worker loaded - RealSSA News v6');
