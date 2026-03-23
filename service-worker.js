const CACHE_NAME = 'trigger-voca-v3'; // 버전업 (강제 갱신용)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/study.html',
    '/style.css',
    '/app.js',
    '/wordData.js',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => console.error('캐시 설치 에러:', err))
    );
});

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
    self.clients.claim();
});

// 핵심 수정: 네트워크 우선 (Network-First) 전략
self.addEventListener('fetch', (e) => {
    // 크롬 확장프로그램 등 외부 요청으로 인한 에러 방지
    if (!e.request.url.startsWith('http')) return;

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // 네트워크 요청 성공 시 캐시 업데이트 후 화면 표시
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // 오프라인 상태거나 서버 접속 실패 시 캐시에서 파일 제공
                return caches.match(e.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    
                    // 캐시에도 없다면 기본 화면으로 강제 이동
                    if (e.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});