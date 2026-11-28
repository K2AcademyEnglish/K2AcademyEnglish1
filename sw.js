/* 케이투학원 영어 - 앱 설치용 서비스 워커
 * 화면 파일을 저장(캐시)해 두지 않습니다. 항상 서버의 최신 파일을 받으므로
 * 지금처럼 ?v= 값만 바꿔 올리면 앱에서도 바로 반영됩니다.
 * 인터넷이 끊겼을 때만 '연결을 확인해 주세요' 안내 화면을 보여 줍니다.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>케이투학원 영어</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;background:#f3f4f6;color:#111827;text-align:center}
.b{padding:28px 24px;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);max-width:320px}
button{margin-top:16px;padding:10px 20px;border:0;border-radius:10px;background:#2b6cb0;color:#fff;font-size:15px;font-weight:700}</style></head>
<body><div class="b"><div style="font-size:40px">📶</div><h2>인터넷 연결을 확인해 주세요</h2>
<p style="color:#6b7280;font-size:14px">연결되면 다시 시도를 눌러 주세요.</p>
<button onclick="location.reload()">다시 시도</button></div></body></html>`;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode !== 'navigate') return;          // 화면 이동만 다룸 (서버 요청·이미지 등은 손대지 않음)
  e.respondWith(fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
