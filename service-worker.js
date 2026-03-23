// 데이터나 코드를 수정해서 재배포할 때는 반드시 v1을 v2, v3로 올려주세요!
const CACHE_NAME = 'trigger-voca-v1'; 
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './study.html',
    './style.css',
    './app.js',
    './wordData.js',
    './manifest.json',
    './icon-192.png', // 추가됨
    './icon-512.png'  // 추가됨
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