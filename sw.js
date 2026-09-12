/* Boss Tetris — Service Worker
   若之後更新 index.html / manifest.json 等內容，
   請把下面 SW_VERSION 的數字 +1：
   1) 「更新到最新版本」按鈕會直接讀取這個數字來判斷新舊版本
   2) activate 時也會依照這個數字產生的 CACHE_NAME 清掉舊版快取
   千萬不要拿掉這行常數定義或改成非數字，頁面端是用正規表示式解析這個數字。 */
const SW_VERSION = 1;
const CACHE_NAME = "boss-tetris-v" + SW_VERSION;

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
        // 只刪除「屬於這個 App 自己、版本號不同」的舊快取（boss-tetris-v* 以外或版本較舊的），
        // 完全不會碰 IndexedDB／localStorage 等使用者存檔資料，那些是不同的儲存機制。
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 讓頁面可以主動詢問「目前這個 Service Worker 是第幾版」，
// 以及（保留用）在需要時手動要求它 skipWaiting。
// 這是「更新到最新版本」按鈕用來可靠判斷版本的依據之一。
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING" || (data && data.type === "SKIP_WAITING")) {
    self.skipWaiting();
    return;
  }
  if (data && data.type === "GET_VERSION") {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ version: SW_VERSION });
  }
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
