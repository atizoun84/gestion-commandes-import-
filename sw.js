// 
const CACHE_NAME = 'v1_atizoun_cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/produits.html',
  '/panier.html',
  '/paiement.html',
  '/comptabilite.html',
  '/configuration.html',
  '/maintenance.html',
  '/firebase-config.js',
  '/logoapp.png',
  '/manifest.json'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Stratégie de récupération (Cache First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
