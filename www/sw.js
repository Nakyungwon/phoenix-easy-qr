// PWA 서비스 워커. 앱 화면 파일만 캐시해서 신호가 없어도 앱이 열리고 저장된 QR이 뜨게 한다.
// 휘닉스 요청(/px/)은 항상 네트워크로 보낸다. 화면 파일은 네트워크 우선이라 배포하면 바로 새 버전이 받아진다.
const CACHE = 'phoenix-easy-qr-v1';
const SHELL = ['./', 'index.html', 'season.js', 'vault.js', 'wallpaper.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// 화면 파일은 네트워크를 먼저 시도하고, 실패하면(오프라인) 캐시를 쓴다.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/px/')) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
