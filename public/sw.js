
// Basic Service Worker for PWA
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through for now
    event.respondWith(fetch(event.request));
});
