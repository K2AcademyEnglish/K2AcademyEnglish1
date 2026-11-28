/* ===================== 앱 설치 (홈 화면에 추가 → 주소창 없이 전체 화면) =====================
 * - 안드로이드 크롬·삼성 인터넷, PC 크롬·엣지: [📲 앱으로 설치] 누르면 바로 설치 창이 뜹니다.
 * - 아이폰·아이패드(사파리): 설치 창을 띄울 수 없어 '공유 → 홈 화면에 추가' 안내를 보여 줍니다.
 * - 카카오톡 등 앱 안의 브라우저: 설치가 안 되므로 외부 브라우저로 열도록 안내합니다.
 * - 이미 앱으로 실행 중이면 버튼을 숨깁니다.
 */
(function () {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInApp = isKakao || /NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|everytimeApp|DaumApps/i.test(ua);
  const isIOSSafari = isIOS && !isInApp && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Whale/i.test(ua);
  const isStandalone = () =>
    (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) ||
    window.navigator.standalone === true;
  const DISMISS_KEY = 'k2_install_dismiss';
  let deferred = null;           // 브라우저가 준 설치 창
  let installed = false;

  // 서비스 워커 등록 (설치 조건). 구글 스크립트 화면 안에서는 등록하지 않습니다.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && !/googleusercontent|script\.google/.test(location.host)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  function canOffer() {
    if (installed || isStandalone()) return false;
    return !!deferred || isIOS || isInApp;
  }
  function dismissed() {
    try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 7 * 864e5; } catch (e) { return false; }
  }
  function refresh() {
    const show = canOffer();
    document.querySelectorAll('.k2-install-btn').forEach(b => { b.hidden = !show; });
    document.querySelectorAll('.k2-install-bar').forEach(b => { b.hidden = !show || dismissed(); });
    document.documentElement.classList.toggle('k2-app', isStandalone());
  }

  function guide(html) {
    let ov = document.getElementById('k2InstallGuide');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'k2InstallGuide';
      ov.innerHTML = '<div class="k2ig-box"><div class="k2ig-body"></div><button type="button" class="k2ig-close">확인</button></div>';
      ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('k2ig-close')) ov.classList.remove('open'); });
      document.body.appendChild(ov);
    }
    ov.querySelector('.k2ig-body').innerHTML = html;
    ov.classList.add('open');
  }

  function install() {
    if (deferred) {
      const p = deferred; deferred = null;
      p.prompt();
      (p.userChoice || Promise.resolve({})).then(c => {
        if (c && c.outcome === 'accepted') installed = true;
        refresh();
      });
      return;
    }
    if (isKakao) {
      // 카카오톡 → 기본 브라우저(크롬/사파리)로 다시 열기
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
      return;
    }
    if (isInApp) {
      guide('<div class="k2ig-ico">🌐</div><h3>브라우저에서 열어 주세요</h3>' +
        '<p>지금은 앱 안의 브라우저라 설치할 수 없어요.<br>오른쪽 위(또는 아래) <b>⋮ / ···</b> 메뉴에서<br><b>' +
        (isIOS ? 'Safari로 열기' : '다른 브라우저로 열기(크롬)') + '</b>를 누른 뒤 다시 설치해 주세요.</p>');
      return;
    }
    if (isIOS) {
      guide('<div class="k2ig-ico">📲</div><h3>아이폰·아이패드 설치 방법</h3>' +
        '<ol><li>' + (isIOSSafari ? '화면 아래(아이패드는 위)' : '주소창 옆') + ' <b>공유 버튼 <span class="k2ig-share">⬆︎</span></b>을 누릅니다.</li>' +
        '<li>목록을 내려 <b>홈 화면에 추가</b>를 누릅니다.</li>' +
        '<li>오른쪽 위 <b>추가</b>를 누르면 끝!</li></ol>' +
        '<p>홈 화면의 <b>케이투영어</b> 아이콘으로 열면 주소창 없이 전체 화면으로 열려요.</p>');
      return;
    }
    guide('<div class="k2ig-ico">📲</div><h3>설치 방법</h3><p>브라우저 메뉴 <b>⋮</b>에서<br><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러 주세요.</p>');
  }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener('appinstalled', () => {
    installed = true; deferred = null; refresh();
    if (typeof showToast === 'function') showToast('앱이 설치되었어요! 홈 화면의 케이투영어 아이콘으로 열어 주세요.', 'success');
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.k2-install-btn');
    if (btn) { e.preventDefault(); install(); return; }
    const x = e.target.closest && e.target.closest('.k2-install-x');
    if (x) { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (er) {} refresh(); }
  });

  // 앱으로 실행 중일 때: 오래(6시간+) 백그라운드에 있다가 돌아오면, 풀이 중이 아닐 때만 새로 불러와 최신 버전을 씁니다.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (!isStandalone() || !hiddenAt || Date.now() - hiddenAt < 6 * 3600 * 1000) return;
    const visible = id => { const el = document.getElementById(id); return el && el.offsetParent !== null; };
    if (visible('startPage') || visible('studentMainPage')) location.reload();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();
  window.k2InstallRefresh = refresh;
})();
