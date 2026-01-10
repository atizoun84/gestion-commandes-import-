const CACHE_NAME = 'b-one-smart-v1';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'style.css',
  'pwa-setup.js',
  'manifest.json',
  'logoapp.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css'
];

// Installation du Service Worker et mise en cache des ressources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Mise en cache des ressources');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Stratégie de cache : Network First (on privilégie le réseau, sinon le cache)
// Idéal pour votre application qui utilise du localStorage
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Nettoyage ancien cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});
