/* Boss Tetris — Service Worker
   若之後更新 index.html / manifest.json 等內容，
   請把下面 CACHE_VERSION 的數字 +1，才會強制所有裝置抓新版本。 */
const CACHE_VERSION = "v1";
const CACHE_NAME = "boss-tetris-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    // App 本身的檔案：network-first，抓得到就更新快取，抓不到就用快取（離線可用）
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
  } else {
    // 外部素材（圖片／音樂，通常來自 GitHub 等其他網域）：cache-first，
    // 抓過一次之後離線也能顯示，網址若失效則直接放行讓瀏覽器自然失敗。
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
  }
});
