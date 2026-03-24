
// Basic Service Worker for PWA
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
});

self.addEventListener('fetch', (event) => {
    // Only intercept GET requests and skip Yappy API to avoid body consumption issues
    if (event.request.method !== 'GET' || event.request.url.includes('/api/yappy')) {
        return;
    }
    
    event.respondWith(fetch(event.request));
});
