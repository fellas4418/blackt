const CACHE_NAME = 'trigger-voca-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './study.html',
    './style.css',
    './app.js',
    './wordData.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 1. 설치 단계: 리소스 캐싱
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // 즉시 설치 대기 상태를 넘기고 활성화
});

// 2. 활성화 단계: 구버전 캐시 정리 (에러 원인이었던 unregister 제거 완료)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // 이전 버전 캐시 삭제
                    }
                })
            );
        })
    );
    self.clients.claim(); // 서비스 워커가 즉시 클라이언트 제어권을 갖도록 설정
});

// 3. 페치 단계: 오프라인 지원 (캐시 먼저 확인 후 네트워크 요청)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            // 캐시에 있으면 캐시 반환, 없으면 네트워크 요청
            return response || fetch(e.request);
        }).catch(() => {
            // 오프라인 상태에서 HTML 페이지를 요청하다 실패한 경우 대비 방어 코드
            if (e.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});