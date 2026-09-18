/* Service worker — tout est mis en cache au premier chargement,
   l'application fonctionne ensuite intégralement hors ligne. */
const CACHE = 'deux-sessions-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './fonts.css',
  './app.js',
  './contenu.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/fraunces-400-600-700-latin-ext.woff2',
  './fonts/fraunces-400-600-700-latin.woff2',
  './fonts/ibm-plex-mono-400-latin-ext.woff2',
  './fonts/ibm-plex-mono-400-latin.woff2',
  './fonts/ibm-plex-mono-500-latin-ext.woff2',
  './fonts/ibm-plex-mono-500-latin.woff2',
  './fonts/karla-400-500-700-latin-ext.woff2',
  './fonts/karla-400-500-700-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache d'abord, réseau en arrière-plan : affichage immédiat hors ligne,
   et la version suivante est prise au lancement d'après. Une navigation
   vers une URL inconnue et injoignable retombe sur la page de l'app. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return hit || net;
    })
  );
});
