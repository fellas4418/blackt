const CACHE_NAME = 'trigger-voca-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './study.html',
    './style.css',
    './app.js',
    './wordData.js',
    './manifest.json'
];

// 설치 단계: 리소스 캐싱
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 활성화 단계: 구버전 캐시 정리
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 페치 단계: 네트워크가 안 될 때 캐시된 파일 제공
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});