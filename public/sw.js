
// Basic Service Worker for PWA
self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('Service Worker activated');
});

self.addEventListener('fetch', (event) => {
    // Only intercept GET requests and skip /api/ requests
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request).catch((err) => {
            if (event.request.mode === 'navigate') {
                return fetch('/');
            }
            return Promise.reject(err);
        })
    );
});
