// 離線快取：改版時把版本號加一
const V = 'shiguang-v46';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/foods.js', 'js/py.js', 'js/parser.js', 'js/app.js', 'data/tfda.json', 'data/brands.json', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url), same = u.origin === location.origin;
  // 共用庫、條碼查詢這類會變的資料不經過快取；字型和 Firebase 程式庫（網址帶版本號、不會變）才快取（以前被快取住，別人新增的食物永遠抓不到新的）
  if (!same && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) && !u.href.startsWith('https://www.gstatic.com/firebasejs/')) return;
  // 自己的檔案：先連網拿新的，沒網路才用快取；字型：有快取就用快取
  e.respondWith(same
    ? fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    : caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; })));
});
