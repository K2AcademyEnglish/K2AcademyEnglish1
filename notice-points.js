/* ===================== 알림(공지) · 포인트 · 교환권 =====================
 * 이 파일 하나가 아래 화면을 모두 담당합니다.
 *  - 관리자 비밀번호 입력 창
 *  - 상단 🔔 종 아이콘과 알림함
 *  - 학생: 내 포인트, 교환권 신청
 *  - 관리자: 교환 신청 승인, 포인트 적립/차감, 공지 보내기, 보낸 공지
 * 서버 쪽 코드는 Code.gs 맨 아래 "5) 관리자 비밀번호 · 알림 · 포인트 · 교환권" 부분입니다.
 */
(function () {
  'use strict';

  // 자주 쓰는 값: 필요하면 여기만 고치면 됩니다.
  const QUICK_AMOUNTS = [5, 10, 20, 50, 100];
  const QUICK_REASONS = ['출석', '숙제 완료', '단어시험 통과', '수업 태도 우수', '과제 만점'];
  const DEFAULT_NOTICE_DAYS = 7;
  const REFRESH_MS = 3 * 60 * 1000; // 3분마다 새 알림 확인

  const S = {
    userKey: '', home: null, admin: null, scope: 'mine', tab: '',
    myPoints: null, sent: null, timer: null,
    sel: new Set(), nsel: new Set(),
    form: { amount: '', reason: '' },
    notice: { target: 'managed', title: '', body: '', important: false, days: DEFAULT_NOTICE_DAYS },
    popupShown: new Set()
  };

  /* ---------- 공통 도구 ---------- */
  const esc = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const nl2br = v => esc(v).replace(/\n/g, '<br>');
  const $ = id => document.getElementById(id);
  const me = () => (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.id) ? CURRENT_USER : null;
  const isManager = () => { const u = me(); return !!u && u.role === 'manager'; };
  const auth = () => { const u = me(); return { id: u ? u.id : '', token: u ? (u.token || '') : '' }; };
  const fmtTime = t => { const m = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/.exec(String(t || '')); return m ? `${m[2]}/${m[3]} ${m[4]}:${m[5]}` : esc(t || ''); };
  const fmtPt = n => (n > 0 ? '+' : '') + Number(n || 0).toLocaleString() + 'pt';
  const num = n => Number(n || 0).toLocaleString();
  const toast = (msg, type) => { if (typeof showToast === 'function') showToast(esc(msg), type || 'info'); };
  const alertMsg = msg => { if (typeof showCustomAlert === 'function') showCustomAlert(esc(msg)); else alert(msg); };
  const loadingHTML = text => `<div class="np-empty">⏳ ${esc(text || '불러오는 중...')}</div>`;

  function call(fn, args) {
    return gsCall(fn, args).catch(err => {
      let m = String(err && err.message ? err.message : err).replace(/^Error:\s*/, '');
      if (typeof isMissingServerFunction === 'function' && isMissingServerFunction(m)) {
        m = '구글 스크립트(Code.gs)가 아직 새 버전으로 배포되지 않았습니다.';
      }
      throw new Error(m);
    });
  }
  // 버튼을 누른 뒤 서버 응답을 기다리는 동안 중복 클릭을 막습니다.
  function busy(btn, promise) {
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '처리 중...'; }
    const done = () => { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; } };
    return promise.then(v => { done(); return v; }, e => { done(); alertMsg(e.message || String(e)); throw e; });
  }

  /* ---------- 작은 입력 창(비밀번호 / 반려 사유) ---------- */
  function dialog(opts) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'popup-overlay dark';
      overlay.innerHTML = `
        <div class="popup-box confirm np-dialog">
          <div class="np-dialog-title">${esc(opts.title)}</div>
          ${opts.desc ? `<div class="np-dialog-desc">${nl2br(opts.desc)}</div>` : ''}
          ${opts.error ? `<div class="np-dialog-error">${esc(opts.error)}</div>` : ''}
          ${opts.fields.map((f, i) => `<input class="np-input" data-i="${i}" type="${f.type || 'text'}" placeholder="${esc(f.placeholder || '')}" maxlength="${f.max || 100}" autocomplete="${f.type === 'password' ? 'current-password' : 'off'}">`).join('')}
          <div class="np-dialog-error" data-role="err" style="display:none;"></div>
          <div class="popup-btn-group" style="margin-top:14px;">
            <button type="button" class="popup-btn no" data-role="no">취소</button>
            <button type="button" class="popup-btn yes" data-role="yes">${esc(opts.okText || '확인')}</button>
          </div>
        </div>`;
      const inputs = Array.from(overlay.querySelectorAll('input'));
      const errEl = overlay.querySelector('[data-role="err"]');
      const close = val => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); resolve(val); };
      const submit = () => {
        const values = inputs.map(i => i.value);
        const problem = opts.validate ? opts.validate(values) : '';
        if (problem) { errEl.textContent = problem; errEl.style.display = 'block'; return; }
        close(values);
      };
      overlay.querySelector('[data-role="no"]').onclick = () => close(null);
      overlay.querySelector('[data-role="yes"]').onclick = submit;
      inputs.forEach((inp, i) => inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        if (i < inputs.length - 1) inputs[i + 1].focus(); else submit();
      }));
      document.body.appendChild(overlay);
      if (inputs[0]) setTimeout(() => inputs[0].focus(), 50);
    });
  }

  // 관리자 로그인 때 app-core.js에서 호출합니다. 취소하면 null.
  function askPassword(firstTime, errorMsg) {
    if (firstTime) {
      return dialog({
        title: '🔐 관리자 비밀번호 만들기',
        desc: '처음 로그인하셨습니다.\n앞으로 사용할 비밀번호를 정해 주십시오. (4자 이상)',
        error: errorMsg,
        okText: '등록',
        fields: [{ type: 'password', placeholder: '새 비밀번호' }, { type: 'password', placeholder: '한 번 더 입력' }],
        validate: v => {
          if (v[0].length < 4) return '비밀번호는 4자 이상이어야 합니다.';
          if (v[0] !== v[1]) return '두 칸의 비밀번호가 서로 다릅니다.';
          return '';
        }
      }).then(v => v ? v[0] : null);
    }
    return dialog({
      title: '🔐 관리자 비밀번호',
      desc: '관리자 계정입니다. 비밀번호를 입력하십시오.',
      error: errorMsg,
      okText: '로그인',
      fields: [{ type: 'password', placeholder: '비밀번호' }],
      validate: v => v[0] ? '' : '비밀번호를 입력하십시오.'
    }).then(v => v ? v[0] : null);
  }

  /* ---------- 종 아이콘 / 홈 카드 ---------- */
  function setBadge(n) {
    const b = $('bellBadge');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.style.display = n > 0 ? 'inline-block' : 'none';
    const tabBadge = $('npAdminTabBadge');
    if (tabBadge) { tabBadge.textContent = String(n); tabBadge.style.display = (n > 0 && isManager()) ? 'inline-block' : 'none'; }
  }

  function renderHomeCard() {
    const el = $('npHomeCard');
    if (!el) return;
    const u = me();
    if (!u || isManager()) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = 'block';
    const h = S.home;
    if (!h) { el.innerHTML = `<div class="np-home-points"><span class="np-home-label">⭐ 내 포인트</span><span class="np-home-value">…</span></div>`; return; }
    const p = h.points;
    const latest = h.notices.find(n => !n.read) || h.notices[0];
    el.innerHTML = `
      <div class="np-home-points">
        <div>
          <span class="np-home-label">⭐ 내 포인트</span>
          <span class="np-home-value">${num(p.balance)}<small>pt</small></span>
          ${p.pending ? `<span class="np-home-pending">교환 신청 중 ${num(p.pending)}pt</span>` : ''}
        </div>
        <button type="button" class="np-btn np-btn-gold" data-np="open:points">교환권 신청 · 내역</button>
      </div>
      ${latest ? `<button type="button" class="np-home-notice ${latest.read ? '' : 'unread'}" data-np="open:notices">
          <span>${latest.important ? '📌' : '📢'}</span>
          <span class="np-home-notice-title">${esc(latest.title)}</span>
          ${h.unread ? `<span class="np-new">새 알림 ${h.unread}</span>` : ''}
        </button>` : ''}`;
  }

  /* ---------- 데이터 새로고침 ---------- */
  function refresh() {
    const u = me();
    if (!u || typeof hasGsRun !== 'function' || !hasGsRun()) return Promise.resolve();
    const key = S.userKey;
    if (isManager()) {
      if (!u.token) return Promise.resolve();
      return call('adminGetPoints', [auth(), S.scope]).then(data => {
        if (key !== S.userKey) return;
        S.admin = data; S.scope = data.scope;
        setBadge(data.pendingRequests.length);
        if (isOpen() && S.tab === 'requests') render();
      });
    }
    return call('getStudentHome', [u.id]).then(data => {
      if (key !== S.userKey) return;
      S.home = data;
      setBadge(data.unread);
      renderHomeCard();
      if (isOpen() && S.tab === 'notices') render();
      showImportantPopup();
    });
  }

  // 로그인/로그아웃/새로고침 때 app-core.js의 refreshHeaderAuth()가 호출합니다.
  function onAuthChange() {
    const u = me();
    const bell = $('btnBell');
    if (bell) bell.style.display = u ? 'inline-flex' : 'none';
    const key = u ? (u.id + '|' + u.role) : '';
    if (key === S.userKey) return;

    S.userKey = key;
    S.home = null; S.admin = null; S.myPoints = null; S.sent = null; S.perf = null; S.scope = 'mine';
    S.sel.clear(); S.nsel.clear(); S.popupShown.clear();
    S.form = { amount: '', reason: '' };
    S.notice = { target: 'managed', title: '', body: '', important: false, days: DEFAULT_NOTICE_DAYS };
    closeModal();
    setBadge(0);
    renderHomeCard();
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    if (u) {
      setTimeout(() => { refresh().catch(() => {}); }, 400);
      S.timer = setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, REFRESH_MS);
    }
  }

  // 아직 읽지 않은 '중요' 공지는 로그인하면 한 번 크게 띄웁니다.
  function showImportantPopup() {
    if (!S.home || isOpen()) return;
    const list = S.home.notices.filter(n => n.important && !n.read && !S.popupShown.has(n.id));
    if (!list.length) return;
    list.forEach(n => S.popupShown.add(n.id));
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay dark';
    overlay.innerHTML = `
      <div class="popup-box np-important">
        <div class="np-important-head">📌 중요 공지</div>
        <div class="np-important-body">
          ${list.map(n => `<div class="np-important-item"><b>${esc(n.title)}</b><div>${nl2br(n.body)}</div><small>${esc(n.author)} · ${fmtTime(n.time)}</small></div>`).join('')}
        </div>
        <button type="button" class="popup-btn yes full">확인했습니다</button>
      </div>`;
    overlay.querySelector('button').onclick = () => {
      overlay.parentNode.removeChild(overlay);
      markRead(list.map(n => n.id));
    };
    document.body.appendChild(overlay);
  }

  function markRead(ids) {
    const u = me();
    if (!u || !ids.length || !S.home) return;
    S.home.notices.forEach(n => { if (ids.indexOf(n.id) !== -1) n.read = true; });
    S.home.unread = S.home.notices.filter(n => !n.read).length;
    setBadge(S.home.unread);
    renderHomeCard();
    call('markNoticesRead', [u.id, ids]).catch(() => {});
  }

  /* ---------- 큰 창(모달) ---------- */
  function isOpen() { const o = $('npOverlay'); return !!o && o.classList.contains('active'); }

  function ensureOverlay() {
    let o = $('npOverlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'npOverlay';
    o.className = 'np-overlay';
    o.innerHTML = `
      <div class="np-modal" role="dialog" aria-modal="true">
        <div class="np-modal-head">
          <div class="np-modal-title" id="npTitle"></div>
          <button type="button" class="np-close" data-np="close" aria-label="닫기">&times;</button>
        </div>
        <div class="np-tabs" id="npTabs"></div>
        <div class="np-modal-body" id="npBody"></div>
      </div>`;
    o.addEventListener('click', e => { if (e.target === o) closeModal(); });
    o.addEventListener('click', onClick);
    o.addEventListener('change', onChange);
    o.addEventListener('input', onInput);
    document.body.appendChild(o);
    return o;
  }

  function openModal(tab) {
    const u = me();
    if (!u) return;
    if (isManager() && !u.token) {
      alertMsg('관리자 인증 정보가 없습니다. 로그아웃 후 다시 로그인해 주십시오.');
      return;
    }
    const o = ensureOverlay();
    o.classList.add('active');
    const valid = isManager() ? ['requests', 'points', 'send', 'sent', 'perf'] : ['notices', 'points'];
    S.tab = valid.indexOf(tab) !== -1 ? tab : valid[0];
    render();
    loadTab();
  }
  function closeModal() { const o = $('npOverlay'); if (o) o.classList.remove('active'); }

  function switchTab(tab) { S.tab = tab; render(); loadTab(); }

  // 탭을 열 때마다 최신 데이터를 다시 받습니다.
  function loadTab() {
    const key = S.userKey, tab = S.tab;
    const after = () => { if (key === S.userKey && isOpen() && S.tab === tab) render(); };
    const fail = e => { const b = $('npBody'); if (b && key === S.userKey && S.tab === tab) b.innerHTML = `<div class="np-empty np-error">${esc(e.message || e)}</div>`; };
    if (isManager()) {
      if (tab === 'perf') {
        call('adminGetPerf', [auth()]).then(d => { if (key === S.userKey) S.perf = d; after(); }).catch(fail);
        return;
      }
      if (tab === 'sent') {
        call('adminListNotices', [auth()]).then(list => { if (key === S.userKey) S.sent = list; after(); }).catch(fail);
      } else {
        call('adminGetPoints', [auth(), S.scope]).then(data => {
          if (key !== S.userKey) return;
          S.admin = data; S.scope = data.scope; setBadge(data.pendingRequests.length);
          // 입력 중인 칸이 있으면 화면을 다시 그리지 않습니다(커서가 튀는 것 방지).
          const typing = document.activeElement && $('npBody') && $('npBody').contains(document.activeElement)
            && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
          if (!typing) { syncForms(); after(); }
        }).catch(fail);
      }
      return;
    }
    if (tab === 'points') {
      call('getMyPoints', [me().id]).then(data => {
        if (key !== S.userKey) return;
        S.myPoints = data;
        if (S.home) { S.home.points = data.points; renderHomeCard(); }
        after();
      }).catch(fail);
    } else {
      refresh().catch(fail);
    }
  }

  function render() {
    const mgr = isManager();
    const pendingCount = (S.admin && S.admin.pendingRequests.length) || 0;
    const tabs = mgr
      ? [['requests', '🎟️ 교환 신청' + (pendingCount ? ` <span class="np-count">${pendingCount}</span>` : '')], ['points', '⭐ 포인트 지급'], ['send', '📢 공지 보내기'], ['sent', '📋 보낸 공지'], ['perf', '⏱ 속도']]
      : [['notices', '🔔 알림' + (S.home && S.home.unread ? ` <span class="np-count">${S.home.unread}</span>` : '')], ['points', '⭐ 내 포인트']];
    $('npTitle').textContent = mgr ? '공지 · 포인트 관리' : '알림 · 포인트';
    $('npTabs').innerHTML = tabs.map(t => `<button type="button" class="np-tab ${S.tab === t[0] ? 'on' : ''}" data-np="tab:${t[0]}">${t[1]}</button>`).join('');
    const body = $('npBody');
    const views = mgr
      ? { requests: viewRequests, points: viewAdminPoints, send: viewSend, sent: viewSent, perf: viewPerf }
      : { notices: viewNotices, points: viewMyPoints };
    body.innerHTML = views[S.tab]();
    if (document.querySelector('#npOverlay .np-stepper')) stepTickets(0);
    if (!mgr && S.tab === 'notices' && S.home) {
      const unread = S.home.notices.filter(n => !n.read).map(n => n.id);
      if (unread.length) markRead(unread);
    }
  }

  /* ---------- 학생 화면 ---------- */
  function viewNotices() {
    if (!S.home) return loadingHTML();
    if (!S.home.notices.length) return `<div class="np-empty">아직 받은 알림이 없습니다.</div>`;
    return `<div class="np-list">` + S.home.notices.map(n => `
      <div class="np-item ${n.read ? '' : 'unread'} ${n.important ? 'important' : ''}">
        <div class="np-item-head">
          <span class="np-tag np-tag-${n.kind === '공지' ? 'notice' : (n.kind === '포인트' ? 'point' : 'personal')}">${esc(n.kind === '개인' ? '개인 알림' : n.kind)}</span>
          ${n.important ? '<span class="np-tag np-tag-important">중요</span>' : ''}
          <b>${esc(n.title)}</b>
          ${n.read ? '' : '<span class="np-new">NEW</span>'}
        </div>
        ${n.body ? `<div class="np-item-body">${nl2br(n.body)}</div>` : ''}
        <div class="np-item-meta">${esc(n.author)} · ${fmtTime(n.time)}</div>
      </div>`).join('') + `</div>`;
  }

  function viewMyPoints() {
    const d = S.myPoints;
    if (!d) return loadingHTML();
    const p = d.points, unit = p.unit || 100;
    const available = Math.max(0, p.balance - p.pending);
    const maxTickets = Math.floor(available / unit);
    const pendingReqs = d.requests.filter(r => r.status === '대기');
    const doneReqs = d.requests.filter(r => r.status !== '대기').slice(0, 5);
    const maxPick = Math.min(maxTickets, 50);
    S.tickets = Math.min(Math.max(1, S.tickets || 1), Math.max(1, maxPick));
    return `
      <div class="np-balance">
        <div class="np-balance-label">내 포인트</div>
        <div class="np-balance-value">${num(p.balance)}<small>pt</small></div>
        ${p.pending ? `<div class="np-balance-sub">교환 신청 중 ${num(p.pending)}pt · 신청 가능 ${num(available)}pt</div>` : ''}
      </div>

      <div class="np-section">
        <div class="np-section-title">🎟️ 교환권 신청</div>
        <div class="np-hint">교환권 1장 = ${num(unit)}pt. 선생님이 승인하면 포인트가 차감되고, 교환권으로 간식을 바꿀 수 있습니다.</div>
        ${maxTickets > 0 ? `
          <div class="np-row np-stepper-row">
            <div class="np-stepper" data-max="${maxPick}" data-unit="${unit}">
              <button type="button" class="np-step" data-np="tk:-1" aria-label="한 장 줄이기">−</button>
              <div class="np-step-val"><b id="npTicketCount">${S.tickets}</b>장<small id="npTicketPt">${num(S.tickets * unit)}pt</small></div>
              <button type="button" class="np-step" data-np="tk:1" aria-label="한 장 늘리기">＋</button>
            </div>
            <button type="button" class="np-btn np-btn-gold" data-np="exchange">신청하기</button>
          </div>
          <div class="np-hint">최대 ${maxPick}장까지 신청할 수 있습니다.</div>` : `<div class="np-empty np-empty-small">신청하려면 ${num(unit)}pt 이상이 필요합니다. (${num(unit - available)}pt 더 모으면 신청할 수 있습니다.)</div>`}
        ${pendingReqs.map(r => `
          <div class="np-item">
            <div class="np-item-head"><span class="np-tag np-tag-wait">승인 대기</span><b>교환권 ${Math.round(r.points / unit)}장 (${num(r.points)}pt)</b></div>
            <div class="np-item-meta">${fmtTime(r.time)} 신청 <button type="button" class="np-link" data-np="cancelreq:${esc(r.id)}">신청 취소</button></div>
          </div>`).join('')}
        ${doneReqs.map(r => `
          <div class="np-item np-item-dim">
            <div class="np-item-head"><span class="np-tag np-tag-${r.status === '승인' ? 'ok' : 'no'}">${esc(r.status)}</span><b>교환권 ${Math.round(r.points / unit)}장 (${num(r.points)}pt)</b></div>
            <div class="np-item-meta">${fmtTime(r.doneTime || r.time)}${r.memo ? ' · ' + esc(r.memo) : ''}</div>
          </div>`).join('')}
      </div>

      <div class="np-section">
        <div class="np-section-title">📒 포인트 내역</div>
        ${d.history.length ? `<table class="np-table"><tbody>` + d.history.map(h => `
          <tr class="${h.cancelled ? 'np-cancelled' : ''}">
            <td class="np-td-time">${fmtTime(h.time)}</td>
            <td>${esc(h.reason)}${h.cancelled ? ' <span class="np-tag np-tag-no">취소됨</span>' : ''}</td>
            <td class="np-td-num ${h.delta >= 0 ? 'np-plus' : 'np-minus'}">${fmtPt(h.delta)}</td>
            <td class="np-td-num np-td-bal">${num(h.balance)}</td>
          </tr>`).join('') + `</tbody></table>` : `<div class="np-empty np-empty-small">아직 내역이 없습니다.</div>`}
      </div>`;
  }

  /* ---------- 관리자: 교환 신청 ---------- */
  function scopeToggle() {
    const a = S.admin;
    if (!a || !a.hasMine) return '';
    return `<div class="np-scope">
      <button type="button" class="np-chip ${S.scope === 'mine' ? 'on' : ''}" data-np="scope:mine">내 담당 학생</button>
      <button type="button" class="np-chip ${S.scope === 'all' ? 'on' : ''}" data-np="scope:all">전체 학생</button>
    </div>`;
  }

  function viewRequests() {
    const a = S.admin;
    if (!a) return loadingHTML();
    const unit = a.unit || 100;
    return scopeToggle() + `
      <div class="np-section">
        <div class="np-section-title">승인 대기 ${a.pendingRequests.length}건</div>
        ${a.pendingRequests.length ? a.pendingRequests.map(r => `
          <div class="np-item ${r.balance < r.points ? 'np-item-warn' : ''}">
            <div class="np-item-head"><b>${esc(r.studentName)}</b><span class="np-muted">(${esc(r.studentId)})</span>
              <span class="np-req-amount">교환권 ${Math.round(r.points / unit)}장 · ${num(r.points)}pt</span></div>
            <div class="np-item-meta">${fmtTime(r.time)} 신청 · 현재 잔액 ${num(r.balance)}pt${r.balance < r.points ? ' · <b class="np-minus">잔액 부족</b>' : ''}</div>
            <div class="np-row np-row-right">
              <button type="button" class="np-btn np-btn-ghost" data-np="reject:${esc(r.id)}">반려</button>
              <button type="button" class="np-btn np-btn-primary" data-np="approve:${esc(r.id)}">승인 (${num(r.points)}pt 차감)</button>
            </div>
          </div>`).join('') : `<div class="np-empty np-empty-small">대기 중인 교환 신청이 없습니다.</div>`}
      </div>
      ${a.doneRequests.length ? `<div class="np-section">
        <div class="np-section-title">최근 처리 내역</div>
        <table class="np-table"><tbody>` + a.doneRequests.map(r => `
          <tr><td class="np-td-time">${fmtTime(r.doneTime || r.time)}</td>
            <td>${esc(r.studentName)} · 교환권 ${Math.round(r.points / unit)}장${r.memo ? ' · ' + esc(r.memo) : ''}</td>
            <td><span class="np-tag np-tag-${r.status === '승인' ? 'ok' : 'no'}">${esc(r.status)}</span></td>
            <td class="np-muted">${esc(r.actor)}</td></tr>`).join('') + `</tbody></table></div>` : ''}`;
  }

  /* ---------- 관리자: 포인트 지급 ---------- */
  function studentChecklist(selSet, kind) {
    const a = S.admin;
    return `
      <div class="np-row">
        <input type="search" class="np-input" placeholder="이름 또는 ID 검색" data-filter="${kind}">
        <button type="button" class="np-btn np-btn-ghost" data-np="selall:${kind}">전체 선택/해제</button>
      </div>
      <div class="np-students" data-list="${kind}">
        ${a.students.length ? a.students.map(s => `
          <label class="np-student" data-key="${esc((s.name + ' ' + s.id).toLowerCase())}">
            <input type="checkbox" data-sel="${kind}" value="${esc(s.id)}" ${selSet.has(s.id) ? 'checked' : ''}>
            <span class="np-student-name">${esc(s.name)}</span>
            <span class="np-student-pt">${num(s.balance)}pt${s.pending ? ` <small>(신청 중 ${num(s.pending)})</small>` : ''}</span>
          </label>`).join('') : `<div class="np-empty np-empty-small">학생이 없습니다.</div>`}
      </div>
      <div class="np-hint" data-selcount="${kind}">${selSet.size}명 선택됨</div>`;
  }

  function viewAdminPoints() {
    const a = S.admin;
    if (!a) return loadingHTML();
    return scopeToggle() + `
      <div class="np-section" id="npPointForm">
        <div class="np-section-title">1. 학생 선택</div>
        ${studentChecklist(S.sel, 'pt')}
        <div class="np-section-title" style="margin-top:14px;">2. 포인트와 사유</div>
        <div class="np-chips">${QUICK_AMOUNTS.map(v => `<button type="button" class="np-chip" data-np="amount:${v}">${v}</button>`).join('')}</div>
        <div class="np-row">
          <input id="npAmount" type="number" min="1" step="1" inputmode="numeric" class="np-input np-input-amount" placeholder="포인트" value="${esc(S.form.amount)}">
          <input id="npReason" type="text" maxlength="100" class="np-input" placeholder="사유 (예: 숙제 완료)" value="${esc(S.form.reason)}">
        </div>
        <div class="np-chips">${QUICK_REASONS.map(v => `<button type="button" class="np-chip" data-np="reason:${esc(v)}">${esc(v)}</button>`).join('')}</div>
        <div class="np-row np-row-right">
          <button type="button" class="np-btn np-btn-danger" data-np="adjust:-1">− 차감</button>
          <button type="button" class="np-btn np-btn-primary" data-np="adjust:1">＋ 적립</button>
        </div>
      </div>
      <div class="np-section">
        <div class="np-section-title">최근 내역</div>
        ${a.ledger.length ? `<div class="np-table-wrap"><table class="np-table"><tbody>` + a.ledger.map(h => `
          <tr class="${h.cancelled ? 'np-cancelled' : ''}">
            <td class="np-td-time">${fmtTime(h.time)}</td>
            <td><b>${esc(h.studentName)}</b> · ${esc(h.reason)} <span class="np-muted">(${esc(h.actor)})</span></td>
            <td class="np-td-num ${h.delta >= 0 ? 'np-plus' : 'np-minus'}">${fmtPt(h.delta)}</td>
            <td class="np-td-num">${h.cancelled ? '<span class="np-tag np-tag-no">취소됨</span>' : (h.kind === '취소' ? '' : `<button type="button" class="np-link" data-np="cancelentry:${esc(h.id)}">취소</button>`)}</td>
          </tr>`).join('') + `</tbody></table></div>` : `<div class="np-empty np-empty-small">아직 내역이 없습니다.</div>`}
      </div>`;
  }

  /* ---------- 관리자: 공지 보내기 / 보낸 공지 ---------- */
  function viewSend() {
    const a = S.admin;
    if (!a) return loadingHTML();
    const n = S.notice;
    if (n.target === 'managed' && !a.hasMine) n.target = 'all';
    const radio = (v, label) => `<label class="np-radio"><input type="radio" name="npTarget" value="${v}" ${n.target === v ? 'checked' : ''}> ${label}</label>`;
    return `
      <div class="np-section" id="npNoticeForm">
        <div class="np-section-title">받는 사람</div>
        <div class="np-radios">
          ${a.hasMine ? radio('managed', '내 담당 학생 전체') : ''}
          ${radio('all', '학원 전체 학생')}
          ${radio('ids', '학생 선택 (개인 알림)')}
        </div>
        <div id="npTargetPick" style="${n.target === 'ids' ? '' : 'display:none;'}">
          ${scopeToggle()}
          ${studentChecklist(S.nsel, 'nt')}
        </div>
        <div class="np-section-title" style="margin-top:14px;">내용</div>
        <input id="npNoticeTitle" type="text" maxlength="100" class="np-input np-input-block" placeholder="제목" value="${esc(n.title)}">
        <textarea id="npNoticeBody" maxlength="2000" rows="6" class="np-input np-input-block" placeholder="내용을 입력하십시오">${esc(n.body)}</textarea>
        <div class="np-row np-row-wrap">
          <label class="np-radio"><input id="npNoticeImportant" type="checkbox" ${n.important ? 'checked' : ''}> 📌 중요 (로그인하면 팝업으로 띄움)</label>
          <label class="np-radio">게시 기간 <input id="npNoticeDays" type="number" min="1" max="365" step="1" class="np-input np-input-days" value="${esc(n.days)}"> 일 뒤 자동으로 내려감</label>
        </div>
        <div class="np-row np-row-right">
          <button type="button" class="np-btn np-btn-primary" data-np="sendnotice">보내기</button>
        </div>
      </div>`;
  }

  function viewSent() {
    if (!S.sent) return loadingHTML();
    if (!S.sent.length) return `<div class="np-empty">보낸 공지가 없습니다.</div>`;
    return `<div class="np-list">` + S.sent.map(n => `
      <div class="np-item ${n.expired ? 'np-item-dim' : ''}">
        <div class="np-item-head">
          <span class="np-tag np-tag-${n.kind === '공지' ? 'notice' : 'personal'}">${esc(n.kind === '개인' ? '개인 알림' : '공지')}</span>
          ${n.important ? '<span class="np-tag np-tag-important">중요</span>' : ''}
          ${n.expired ? '<span class="np-tag np-tag-no">게시 종료</span>' : ''}
          <b>${esc(n.title)}</b>
        </div>
        ${n.body ? `<div class="np-item-body">${nl2br(n.body)}</div>` : ''}
        <div class="np-item-meta">
          ${esc(n.author)} · ${fmtTime(n.time)} · 받는 사람: ${esc(n.targetLabel)} · ${n.expired ? '' : esc(n.expiry) + '까지 게시'}
        </div>
        <div class="np-item-meta">
          <b>읽음 ${n.readCount} / ${n.targetCount}명</b>
          ${n.unreadNames.length ? `<details class="np-details"><summary>안 읽은 학생 보기</summary>${esc(n.unreadNames.join(', '))}</details>` : ''}
          <button type="button" class="np-link np-link-danger" data-np="delnotice:${esc(n.id)}">삭제</button>
        </div>
      </div>`).join('') + `</div>`;
  }

  /* ---------- 관리자: 속도 기록 ---------- */
  const PERF_NAMES = {
    doLogin: '로그인', getStudentHome: '학생 홈 (알림·포인트)', getAllMyAssignments: '과제 목록',
    loadRetryData: '과제 OMR 열기', logAttempt: '답안 저장', getQuestionsByQids: '문항 본문 불러오기',
    getAssignmentResult: '과제 결과 (관리자)', getVocabulary: '단어장', getWrongStats: '오답 통계', getWrongNote: '오답노트',
    getQuestionsByFilter: '문제 뽑기', getSourceFiltersAndTypes: '문제 범위 목록', markNoticesRead: '알림 읽음 표시',
    getMyPoints: '내 포인트', getAllAssignmentsForAdmin: '배부 기록 (관리자)', getAdminQuestionInventory: '문제 목록 (관리자)',
    getManagedStudents: '담당 학생 목록', getRecentAssignmentsForStudent: '최근 과제 (관리자)', loadWeeklyStudentBundle: '주간평가 (관리자)',
    getWeeklyReportData: '주간 리포트', updateMasterIndex: '문제 목록 인덱스 갱신', createAssignment: '과제 출제', createBulkAssignments: '과제 일괄 출제',
    adminGetPoints: '포인트 관리', adminAdjustPoints: '포인트 지급', adminSendNotice: '공지 보내기', adminListNotices: '보낸 공지'
  };
  const perfName = f => PERF_NAMES[f] ? `${esc(PERF_NAMES[f])} <span class="np-muted">${esc(f)}</span>` : esc(f);
  const sec = ms => (Number(ms || 0) / 1000).toFixed(1) + '초';
  const perfColor = ms => ms >= 5000 ? 'np-minus' : (ms >= 2500 ? 'np-warn' : 'np-plus');
  function viewPerf() {
    const d = S.perf;
    if (!d) return loadingHTML();
    const head = `
      <div class="np-hint">최근 6시간 동안 서버가 각 기능을 처리한 시간입니다. (최근 400건까지)<br>
      학생 기기 ↔ 구글 서버 사이의 기본 연결 시간(보통 1~2초)은 포함되지 않습니다. 개선 전후를 비교할 때 쓰십시오.</div>
      <div class="np-row np-row-right">
        <button type="button" class="np-btn np-btn-ghost" data-np="perfclear">기록 지우기</button>
        <button type="button" class="np-btn np-btn-primary" data-np="perfreload">새로고침</button>
      </div>`;
    if (!d.total) return head + `<div class="np-empty np-empty-small">아직 기록이 없습니다. 학생들이 사용하면 쌓입니다.</div>`;
    return head + `
      <div class="np-section">
        <div class="np-section-title">기능별 평균 (${d.total}건)</div>
        <div class="np-table-wrap"><table class="np-table">
          <thead><tr><td><b>기능</b></td><td class="np-td-num"><b>횟수</b></td><td class="np-td-num"><b>평균</b></td><td class="np-td-num"><b>중간</b></td><td class="np-td-num"><b>최대</b></td><td class="np-td-num"><b>실패</b></td></tr></thead>
          <tbody>${d.summary.map(r => `<tr>
            <td>${perfName(r.func)}</td><td class="np-td-num">${r.count}</td>
            <td class="np-td-num ${perfColor(r.avg)}">${sec(r.avg)}</td><td class="np-td-num">${sec(r.median)}</td>
            <td class="np-td-num ${perfColor(r.max)}">${sec(r.max)}</td><td class="np-td-num ${r.fails ? 'np-minus' : ''}">${r.fails}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="np-section">
        <div class="np-section-title">최근 기록</div>
        <div class="np-table-wrap"><table class="np-table"><tbody>${d.recent.map(r => `<tr>
          <td class="np-td-time">${esc(r.time)}</td><td>${perfName(r.func)}${r.ok ? '' : ' <span class="np-tag np-tag-no">실패</span>'}</td>
          <td class="np-td-num ${perfColor(r.ms)}">${sec(r.ms)}</td></tr>`).join('')}</tbody></table></div>
      </div>`;
  }

  /* ---------- 입력값 기억 (화면을 다시 그려도 지워지지 않도록) ---------- */
  function syncForms() {
    if ($('npAmount')) S.form.amount = $('npAmount').value;
    if ($('npReason')) S.form.reason = $('npReason').value;
    if ($('npNoticeTitle')) S.notice.title = $('npNoticeTitle').value;
    if ($('npNoticeBody')) S.notice.body = $('npNoticeBody').value;
    if ($('npNoticeImportant')) S.notice.important = $('npNoticeImportant').checked;
    if ($('npNoticeDays')) S.notice.days = $('npNoticeDays').value;
  }
  function updateSelCount(kind) {
    const set = kind === 'pt' ? S.sel : S.nsel;
    const el = document.querySelector(`[data-selcount="${kind}"]`);
    if (el) el.textContent = set.size + '명 선택됨';
  }

  function onInput(e) {
    const t = e.target;
    if (t.dataset && t.dataset.filter) {
      const q = t.value.trim().toLowerCase();
      document.querySelectorAll(`[data-list="${t.dataset.filter}"] .np-student`).forEach(row => {
        row.style.display = (!q || row.dataset.key.indexOf(q) !== -1) ? '' : 'none';
      });
      return;
    }
    syncForms();
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset && t.dataset.sel) {
      const set = t.dataset.sel === 'pt' ? S.sel : S.nsel;
      if (t.checked) set.add(t.value); else set.delete(t.value);
      updateSelCount(t.dataset.sel);
      return;
    }
    if (t.name === 'npTarget') {
      syncForms();
      S.notice.target = t.value;
      const pick = $('npTargetPick');
      if (pick) pick.style.display = t.value === 'ids' ? '' : 'none';
      return;
    }
    syncForms();
  }

  /* ---------- 버튼 동작 ---------- */
  function onClick(e) {
    const btn = e.target.closest('[data-np]');
    if (!btn) return;
    const raw = btn.dataset.np;
    const cut = raw.indexOf(':');
    const act = cut < 0 ? raw : raw.slice(0, cut);
    const arg = cut < 0 ? '' : raw.slice(cut + 1);
    const actions = {
      close: closeModal,
      tab: () => { syncForms(); switchTab(arg); },
      scope: () => { syncForms(); S.scope = arg; S.admin = null; S.sel.clear(); S.nsel.clear(); render(); loadTab(); },
      selall: () => toggleAll(arg),
      amount: () => { const el = $('npAmount'); if (el) { el.value = arg; syncForms(); } },
      reason: () => { const el = $('npReason'); if (el) { el.value = arg; syncForms(); } },
      adjust: () => adjustPoints(Number(arg), btn),
      cancelentry: () => cancelEntry(arg),
      approve: () => resolveExchange(arg, true, btn),
      reject: () => resolveExchange(arg, false, btn),
      sendnotice: () => sendNotice(btn),
      delnotice: () => deleteNotice(arg),
      exchange: () => requestExchange(btn),
      tk: () => stepTickets(Number(arg)),
      cancelreq: () => cancelRequest(arg),
      perfreload: () => { S.perf = null; render(); loadTab(); },
      perfclear: () => showCustomConfirm('속도 기록을 모두 지우시겠습니까?', () => {
        call('adminGetPerf', [auth(), true]).then(d => { S.perf = d; render(); }).catch(e => alertMsg(e.message));
      })
    };
    if (actions[act]) actions[act]();
  }

  function toggleAll(kind) {
    const set = kind === 'pt' ? S.sel : S.nsel;
    const boxes = Array.from(document.querySelectorAll(`[data-list="${kind}"] .np-student`))
      .filter(row => row.style.display !== 'none').map(row => row.querySelector('input'));
    const allOn = boxes.length && boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = !allOn; if (b.checked) set.add(b.value); else set.delete(b.value); });
    updateSelCount(kind);
  }

  const nameOf = id => { const s = S.admin && S.admin.students.find(x => x.id === id); return s ? s.name : id; };

  function adjustPoints(sign, btn) {
    syncForms();
    const amount = Math.floor(Number(S.form.amount));
    const reason = String(S.form.reason || '').trim();
    const ids = Array.from(S.sel);
    if (!ids.length) return alertMsg('학생을 선택하십시오.');
    if (!(amount >= 1)) return alertMsg('포인트를 1 이상의 숫자로 입력하십시오.');
    if (!reason) return alertMsg('사유를 입력하십시오.');
    const delta = sign * amount;
    const who = ids.length <= 5 ? ids.map(nameOf).join(', ') : `${nameOf(ids[0])} 외 ${ids.length - 1}명`;
    showCustomConfirm(`${esc(who)}<br><b>${fmtPt(delta)}</b> ${sign > 0 ? '적립' : '차감'}하시겠습니까?<br><small>사유: ${esc(reason)}</small>`, () => {
      busy(btn, call('adminAdjustPoints', [auth(), { studentIds: ids, delta: delta, reason: reason }])).then(res => {
        toast(`${res.count}명에게 ${fmtPt(delta)} ${sign > 0 ? '적립' : '차감'} 완료`, 'success');
        S.sel.clear();
        S.form = { amount: '', reason: '' };
        S.admin = null; render(); loadTab();
      }).catch(() => {});
    });
  }

  function cancelEntry(id) {
    const h = S.admin && S.admin.ledger.find(x => x.id === id);
    if (!h) return;
    showCustomConfirm(`${esc(h.studentName)} · ${esc(h.reason)} (${fmtPt(h.delta)})<br>이 내역을 취소하시겠습니까?`, () => {
      call('adminCancelPointEntry', [auth(), id]).then(() => {
        toast('취소했습니다.', 'success');
        syncForms(); S.admin = null; render(); loadTab();
      }).catch(e => alertMsg(e.message));
    });
  }

  function resolveExchange(id, approve, btn) {
    const r = S.admin && S.admin.pendingRequests.find(x => x.id === id);
    if (!r) return;
    const run = memo => busy(btn, call('adminResolveExchange', [auth(), id, approve, memo || ''])).then(() => {
      toast(approve ? `${r.studentName} 교환 승인 · ${num(r.points)}pt 차감` : '반려했습니다.', 'success');
      S.admin = null; render(); loadTab();
    }).catch(() => { S.admin = null; loadTab(); });
    if (approve) {
      showCustomConfirm(`<b>${esc(r.studentName)}</b> 학생의 교환 신청을 승인하시겠습니까?<br>${num(r.points)}pt가 바로 차감됩니다.`, () => run(''));
    } else {
      dialog({ title: '교환 신청 반려', desc: r.studentName + ' 학생에게 알림으로 전달됩니다.', okText: '반려',
               fields: [{ placeholder: '반려 사유 (선택)', max: 100 }] }).then(v => { if (v) run(v[0]); });
    }
  }

  function sendNotice(btn) {
    syncForms();
    const n = S.notice;
    const title = String(n.title || '').trim();
    const days = Math.floor(Number(n.days));
    const ids = Array.from(S.nsel);
    if (!title) return alertMsg('제목을 입력하십시오.');
    if (n.target === 'ids' && !ids.length) return alertMsg('받는 학생을 선택하십시오.');
    if (!(days >= 1 && days <= 365)) return alertMsg('게시 기간은 1~365일 사이로 입력하십시오.');
    const label = n.target === 'all' ? '학원 전체 학생' : (n.target === 'managed' ? '내 담당 학생 전체' : `선택한 학생 ${ids.length}명`);
    showCustomConfirm(`<b>${esc(label)}</b>에게 보내시겠습니까?<br><small>${days}일 동안 게시됩니다.</small>`, () => {
      busy(btn, call('adminSendNotice', [auth(), { targetType: n.target, targetIds: ids, title: title, body: n.body, important: n.important, days: days }])).then(() => {
        toast('공지를 보냈습니다.', 'success');
        S.notice = { target: n.target, title: '', body: '', important: false, days: DEFAULT_NOTICE_DAYS };
        S.nsel.clear(); S.sent = null;
        switchTab('sent');
      }).catch(() => {});
    });
  }

  function deleteNotice(id) {
    showCustomConfirm('이 공지를 삭제하시겠습니까?<br><small>학생 화면에서도 바로 사라집니다.</small>', () => {
      call('adminDeleteNotice', [auth(), id]).then(() => {
        toast('삭제했습니다.', 'success');
        S.sent = (S.sent || []).filter(n => n.id !== id);
        render();
      }).catch(e => alertMsg(e.message));
    });
  }

  // 교환권 장 수 +/− (1장 ~ 신청 가능한 최대 장 수)
  function stepTickets(d) {
    const box = document.querySelector('#npOverlay .np-stepper');
    if (!box) return;
    const max = Number(box.dataset.max) || 1, unit = Number(box.dataset.unit) || 100;
    S.tickets = Math.min(max, Math.max(1, (S.tickets || 1) + d));
    $('npTicketCount').textContent = S.tickets;
    $('npTicketPt').textContent = num(S.tickets * unit) + 'pt';
    box.querySelector('[data-np="tk:-1"]').disabled = S.tickets <= 1;
    box.querySelector('[data-np="tk:1"]').disabled = S.tickets >= max;
  }

  function requestExchange(btn) {
    const tickets = Number(S.tickets) || 0;
    const unit = (S.myPoints && S.myPoints.points.unit) || 100;
    if (!(tickets >= 1)) return;
    showCustomConfirm(`교환권 <b>${tickets}장</b> (${num(tickets * unit)}pt)을 신청하시겠습니까?<br><small>선생님이 승인하면 포인트가 차감됩니다.</small>`, () => {
      busy(btn, call('requestPointExchange', [me().id, tickets])).then(() => {
        S.tickets = 1;
        toast('신청했습니다. 선생님 승인을 기다려 주십시오.', 'success');
        loadTab();
      }).catch(() => {});
    });
  }

  function cancelRequest(id) {
    showCustomConfirm('교환 신청을 취소하시겠습니까?', () => {
      call('cancelPointExchange', [me().id, id]).then(() => { toast('신청을 취소했습니다.', 'success'); loadTab(); })
        .catch(e => { alertMsg(e.message); loadTab(); });
    });
  }

  /* ---------- 시작 ---------- */
  // 모달 밖(상단 종, 홈 카드, 메뉴)에 있는 버튼
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-np^="open"]');
    if (!btn || btn.closest('#npOverlay')) return;
    const arg = btn.dataset.np.split(':')[1] || '';
    openModal(arg);
  });
  // 다른 탭에 있다가 돌아오면 새 알림 확인
  document.addEventListener('visibilitychange', () => { if (!document.hidden && me()) refresh().catch(() => {}); });

  window.NP = { askPassword: askPassword, onAuthChange: onAuthChange, open: openModal, close: closeModal, refresh: refresh };
})();
