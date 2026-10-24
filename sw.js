// Service worker: guarda la app en el aparato para que abra sin conexión.
// No guarda datos: esos van cifrados en IndexedDB. Las llamadas a Supabase nunca pasan por la caché.
const CACHE = 'diaclashom-0.9.0';
const ARCHIVOS = [
  './',
  'index.html',
  'estilos.css',
  'manifest.webmanifest',
  'vendor/supabase-2.117.2.js',
  'js/app.js',
  'js/datos.js',
  'js/cripto.js',
  'js/almacen.js',
  'js/nube.js',
  'js/config.js',
  'js/util.js',
  'js/diario.js',
  'js/notas.js',
  'js/calificar.js',
  'js/cierre.js',
  'js/exportar.js',
  'js/nombres.js',
  'js/ical.js',
  'js/agenda.js',
  'js/curso.js',
  'js/encargado.js',
  'datos/calendario-horarios-2026-2027.json',
  'vendor/xlsx-0.18.5.full.min.js',
  'datos/programacion-2026-2027.json',
  'iconos/icono-192.png',
  'iconos/logo.png',
  'iconos/logo-mini.png',
  'iconos/icono-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith('diaclashom-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para recibir mejoras) y, sin conexión, la copia guardada.
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== self.location.origin) return;
  ev.respondWith(
    fetch(ev.request)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
