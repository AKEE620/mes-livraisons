/* =====================================================================
   MES LIVRAISONS — Service worker (fonctionnement hors ligne)
   À chaque nouvelle version de index.html, augmentez VERSION ci-dessous :
   les téléphones verront « Nouvelle version disponible ».
   ===================================================================== */
const VERSION = 'livraisons-v1.1.1';
const COQUILLE = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(COQUILLE.map(u => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Les appels à Supabase (données, connexion) ne passent jamais par le cache
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/') || url.pathname.includes('/auth/')) return;

  // Page de l'appli : réseau d'abord (mises à jour), cache si hors ligne
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copie = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copie)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }

  // Bibliothèques (CDN) et fichiers de l'appli : cache d'abord
  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(enCache => enCache || fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
      return r;
    })));
  }
});

// LOT 2 — Toucher une notification de rappel ouvre l'appli sur la commande
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const cmd = e.notification.data && e.notification.data.cmd;
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(liste => {
    for (const c of liste) { if ('focus' in c) { c.postMessage({ type:'ouvrir', cmd }); return c.focus(); } }
    return self.clients.openWindow('./' + (cmd ? '?cmd=' + encodeURIComponent(cmd) : ''));
  }));
});
