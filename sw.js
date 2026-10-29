const CACHE_NAME = "game-hub-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./game-hub-icon.svg",
  "./ui-kit/tokens.css",
  "./hub-v5.css",
  "./hub-core.js",
  "./featured-admin.js",
  "./hub-feedback.js",
  "./options.js",
  "./chat.js",
  "./hub-loader.js",
  "./pwa.js",
  "./whats-new.js",
  "./game-guide.js"
];
const APP_SCOPE = new URL(self.registration.scope);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("game-hub-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(url) {
  return /\.(?:css|js|mjs|json|svg|png|jpe?g|webp|gif|woff2?)$/i.test(url.pathname);
}

function offlinePage() {
  return new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Game unavailable offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101923;color:#e6edf3;font:16px system-ui}main{max-width:420px;padding:32px;text-align:center}a{color:#66c0f4}</style>' +
    '<main><h1>You’re offline</h1><p>This game has not been saved on this device yet. Open it once while online, then try again.</p><a href="./">Back to Game Hub</a></main>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== APP_SCOPE.origin || !url.href.startsWith(APP_SCOPE.href)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          } catch (error) {
            console.warn("Offline page cache failed", error);
          }
        }
        return response;
      } catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (url.pathname === APP_SCOPE.pathname || url.pathname === `${APP_SCOPE.pathname}index.html`) {
          return (await caches.match(new URL("./", APP_SCOPE).href)) || offlinePage();
        }
        return offlinePage();
      }
    })());
    return;
  }

  if (!isCacheableAsset(url)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        } catch (error) {
          console.warn("Offline asset cache failed", error);
        }
      }
      return response;
    } catch {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      throw new Error(`Offline asset unavailable: ${url.pathname}`);
    }
  })());
});
