const CACHE_NAME = 'aquasense-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/user.html',
    '/admin.html',
    '/about.html',
    '/profile.html',
    '/settings.html',
    '/404.html',
    '/css/style.css',
    '/js/firebase-config.js',
    '/js/water-intelligence.js',
    '/manifest.json'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip Firebase API calls — always fetch from network
    if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((response) => {
                // Cache successful responses
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});
