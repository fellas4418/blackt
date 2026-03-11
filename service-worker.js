const CACHE_NAME = 'trigger-voca-v1';
const urlsToCache = [
    './',
    './index.html',
    './study.html',
    './style.css',
    './app.js',
    './wordData.js'
];

// 1. 앱이 처음 켜질 때 필요한 파일들을 폰에 저장(캐싱)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// 2. 인터넷이 끊겼을 때 서버 대신 폰에 저장된 파일을 꺼내줌
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // 폰에 저장된 캐시에서 꺼냄
                }
                return fetch(event.request); // 캐시에 없으면 인터넷에서 가져옴
            })
    );
});