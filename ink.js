/* ===================== 문제 화면 필기(펜) 기능 =====================
 * 태블릿·PC에서 문제(지문·질문·선택지) 위에 펜으로 쓸 수 있습니다.
 *  - [✏️ 펜] 버튼을 켜면: 손가락·마우스 드래그가 모두 필기가 됩니다. (단어 선택·사전은 잠김)
 *  - 전자펜(S펜·애플펜슬)은 버튼을 켜지 않아도 자동으로 필기가 됩니다. 손가락은 평소처럼 스크롤·단어 선택.
 *  - 짧게 톡 누르는 것은 필기가 아니라 '누르기'로 처리해서, 펜을 켠 채로도 답을 고를 수 있습니다.
 *  - 필기는 문항별로 기억했다가 오답을 다시 볼 때도 보여 줍니다.
 *    단, 기기 메모리에만 있으므로 새로고침하거나 창을 닫으면 지워집니다. (서버 저장 없음)
 */
(function () {
  'use strict';

  const MIN_WIDTH = 820;          // 이보다 좁은 화면(휴대폰)에서는 필기 기능을 끕니다
  const TAP_MOVE = 5;             // 이 거리(px)보다 적게 움직이면 필기가 아니라 '누르기'
  const ERASE_RADIUS = 12;
  const PEN_OPACITY = 0.9;        // 펜 진하기(1 = 완전 불투명). 글자 위에 써도 글자가 비쳐 보이도록 조금 낮춥니다.
  const HL_OPACITY = 0.45;        // 형광펜 진하기
  const pen = (color, name) => ({ color, name, width: 2.2, opacity: PEN_OPACITY, group: 'pen' });
  const hl = (color, name) => ({ color, name, width: 16, opacity: HL_OPACITY, group: 'hl' });
  const TOOLS = {
    black: pen('#111827', '검정'),
    red:   pen('#dc2626', '빨강'),
    blue:  pen('#2563eb', '파랑'),
    green: pen('#16a34a', '초록'),
    hl:         hl('#fde047', '노랑'),
    'hl-red':   hl('#f87171', '빨강'),
    'hl-blue':  hl('#60a5fa', '파랑'),
    'hl-green': hl('#4ade80', '초록'),
    'hl-gray':  hl('#9ca3af', '회색'),
    eraser: null
  };
  const PEN_TOOLS = ['black', 'red', 'blue', 'green'];
  const HL_TOOLS = ['hl', 'hl-red', 'hl-blue', 'hl-green', 'hl-gray'];
  const isHl = tool => !!(TOOLS[tool] && TOOLS[tool].group === 'hl');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const COL_SEL = '.online-box .op-left, .online-box .op-right';

  const S = {
    mode: false,        // 펜 버튼이 켜져 있는가
    stylusSeen: false,  // 전자펜이 한 번이라도 감지되었는가
    tool: 'black',
    penTool: 'black',   // 마지막으로 고른 펜 색
    hlTool: 'hl',       // 마지막으로 고른 형광펜 색
    open: '',           // 색 서랍이 열린 쪽: 'pen' | 'hl' | ''
    store: new Map(),   // key(학생|문항|좌우) → [{tool, pts:[[x,y],...]}]
    order: [],          // 되돌리기용: [{key, stroke}]
    cur: null,          // 지금 긋고 있는 획
    lastInkDown: 0,
    swallowClickUntil: 0,
    synth: false
  };

  const enabled = () => window.innerWidth >= MIN_WIDTH;
  const uid = () => { try { return (CURRENT_USER && CURRENT_USER.id) || 'guest'; } catch (e) { return 'guest'; } };

  /* ---------- 문항 찾기 / 저장 키 ---------- */
  function keyOf(col) {
    const box = col.closest('.online-box');
    if (!box) return null;
    const card = box.closest('.question-card[data-idx]') || box.querySelector('.question-card[data-idx]');
    let qid = '';
    try {
      const q = card && CURRENT_QUIZ_DATA[parseInt(card.getAttribute('data-idx'), 10)];
      qid = q ? String(q.qid || q.extId || '') : '';
    } catch (e) {}
    if (!qid) return null;
    return uid() + '|' + qid + '|' + (col.classList.contains('op-left') ? 'L' : 'R');
  }
  const colsOf = box => Array.from(box.querySelectorAll('.op-left, .op-right')).filter(c => c.closest('.online-box') === box);

  /* ---------- 그리기 ---------- */
  function layerOf(col) {
    let svg = null;
    for (const ch of col.children) { if (ch.classList && ch.classList.contains('ink-layer')) { svg = ch; break; } }
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'ink-layer');
      svg.setAttribute('aria-hidden', 'true');
      col.appendChild(svg);
    }
    return svg;
  }
  function pathData(pts) {
    if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l0.1 0`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i][0]} ${pts[i][1]}`;
    return d;
  }
  function makePath(stroke) {
    const t = TOOLS[stroke.tool] || TOOLS.black;
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', pathData(stroke.pts));
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', t.color);
    p.setAttribute('stroke-width', t.width);
    p.setAttribute('stroke-opacity', t.opacity);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    if (isHl(stroke.tool)) p.setAttribute('class', 'ink-hl');
    stroke.el = p;
    return p;
  }
  function redraw(col) {
    const key = keyOf(col);
    const svg = layerOf(col);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    (key && S.store.get(key) || []).forEach(st => svg.appendChild(makePath(st)));
    svg.dataset.key = key || '';
  }
  function pointIn(col, e) {
    const r = col.getBoundingClientRect();
    return [
      Math.round((e.clientX - r.left - col.clientLeft + col.scrollLeft) * 10) / 10,
      Math.round((e.clientY - r.top - col.clientTop + col.scrollTop) * 10) / 10
    ];
  }
  function removeStroke(key, stroke) {
    const list = S.store.get(key);
    if (list) {
      const i = list.indexOf(stroke);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) S.store.delete(key);
    }
    const j = S.order.findIndex(o => o.stroke === stroke);
    if (j >= 0) S.order.splice(j, 1);
    if (stroke.el && stroke.el.parentNode) stroke.el.parentNode.removeChild(stroke.el);
  }
  function eraseAt(col, key, pt) {
    const list = S.store.get(key);
    if (!list) return;
    list.slice().forEach(st => {
      const r = ERASE_RADIUS + (isHl(st.tool) ? 6 : 0);
      if (st.pts.some(p => Math.abs(p[0] - pt[0]) <= r && Math.abs(p[1] - pt[1]) <= r)) removeStroke(key, st);
    });
  }

  /* ---------- 펜 입력 ---------- */
  const isControl = el => !!(el && el.closest && el.closest('button, input, textarea, select, a, .ink-bar, .op-font-bar, .explanation-box'));

  function onDown(e) {
    if (!enabled() || S.cur) return;
    const isPen = e.pointerType === 'pen';
    if (!S.mode && !isPen) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const col = e.target.closest && e.target.closest(COL_SEL);
    if (!col || isControl(e.target)) return;
    const key = keyOf(col);
    if (!key) return;

    if (isPen && !S.stylusSeen) { S.stylusSeen = true; syncUI(); }
    e.preventDefault();
    S.lastInkDown = Date.now();
    const svg = layerOf(col);
    if (svg.dataset.key !== key) redraw(col);
    const pt = pointIn(col, e);
    S.cur = { col, key, svg, id: e.pointerId, start: [e.clientX, e.clientY], moved: false, tool: S.tool, stroke: null, type: e.pointerType };
    if (S.tool !== 'eraser') {
      S.cur.stroke = { tool: S.tool, pts: [pt] };
      svg.appendChild(makePath(S.cur.stroke));
    }
    try { col.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function onMove(e) {
    const c = S.cur;
    if (!c || e.pointerId !== c.id) return;
    e.preventDefault();
    if (!c.moved && Math.hypot(e.clientX - c.start[0], e.clientY - c.start[1]) >= TAP_MOVE) c.moved = true;
    const events = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    events.forEach(ev => {
      const pt = pointIn(c.col, ev);
      if (c.tool === 'eraser') { if (c.moved) eraseAt(c.col, c.key, pt); }
      else c.stroke.pts.push(pt);
    });
    if (c.stroke) c.stroke.el.setAttribute('d', pathData(c.stroke.pts));
  }

  function onUp(e) {
    const c = S.cur;
    if (!c || e.pointerId !== c.id) return;
    S.cur = null;
    try { c.col.releasePointerCapture(c.id); } catch (err) {}
    S.swallowClickUntil = Date.now() + 350;   // 필기 직후 따라오는 클릭은 무시

    if (e.type === 'pointercancel') {
      if (c.stroke && c.stroke.el.parentNode) c.stroke.el.parentNode.removeChild(c.stroke.el);
      return;
    }
    if (!c.moved) {
      // 톡 누르기: 필기는 버리고, 그 자리를 '클릭'한 것으로 처리 (답 고르기 등)
      if (c.stroke && c.stroke.el.parentNode) c.stroke.el.parentNode.removeChild(c.stroke.el);
      if (c.tool === 'eraser') eraseAt(c.col, c.key, pointIn(c.col, e));
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target && c.col.contains(target)) {
        S.synth = true;
        try { target.click(); } finally { S.synth = false; }
      }
      return;
    }
    if (c.stroke) {
      if (!S.store.has(c.key)) S.store.set(c.key, []);
      S.store.get(c.key).push(c.stroke);
      S.order.push({ key: c.key, stroke: c.stroke });
    }
  }

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointermove', onMove, { capture: true, passive: false });
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onUp, true);
  // 필기 중에는 화면 스크롤·글자 선택(→사전)이 시작되지 않도록 막습니다.
  document.addEventListener('touchstart', e => { if (S.cur || Date.now() - S.lastInkDown < 80) e.preventDefault(); }, { capture: true, passive: false });
  document.addEventListener('touchmove', e => { if (S.cur) e.preventDefault(); }, { capture: true, passive: false });
  document.addEventListener('selectstart', e => { if (S.cur) e.preventDefault(); }, true);
  document.addEventListener('click', e => {
    if (S.synth || Date.now() > S.swallowClickUntil) return;
    if (e.target.closest && e.target.closest(COL_SEL) && !isControl(e.target)) { e.preventDefault(); e.stopPropagation(); }
    S.swallowClickUntil = 0;
  }, true);

  /* ---------- 버튼 · 도구 막대 ---------- */
  // [펜 ▾] [형광펜 ▾]를 누르면 그 옆에 색 서랍이 열리고, 색을 고르면 닫힙니다.
  function barHTML() {
    const swatches = (group, tools) => `<span class="ink-pal" data-pal="${group}" hidden>` + tools.map(t =>
      `<button type="button" class="ink-btn ink-sw" data-ink="tool:${t}" title="${TOOLS[t].name} ${group === 'pen' ? '펜' : '형광펜'}" aria-label="${TOOLS[t].name}"><i class="${group === 'hl' ? 'ink-hl-dot' : ''}" style="background:${TOOLS[t].color}"></i></button>`
    ).join('') + '</span>';
    return '<button type="button" class="ink-btn ink-group" data-ink="group:pen" title="펜 (누르면 색 고르기)"><i data-dot="pen"></i>펜 <span class="ink-caret">▾</span></button>' +
      swatches('pen', PEN_TOOLS) +
      '<button type="button" class="ink-btn ink-group" data-ink="group:hl" title="형광펜 (누르면 색 고르기)"><i class="ink-hl-dot" data-dot="hl"></i>형광펜 <span class="ink-caret">▾</span></button>' +
      swatches('hl', HL_TOOLS) +
      '<button type="button" class="ink-btn" data-ink="tool:eraser" title="지우개 (획 단위로 지웁니다)">지우개</button>' +
      '<span class="ink-sep"></span>' +
      '<button type="button" class="ink-btn" data-ink="undo" title="방금 쓴 획 되돌리기">↶</button>' +
      '<button type="button" class="ink-btn" data-ink="clear" title="이 문항의 필기 모두 지우기">전체 지우기</button>' +
      '<span class="ink-hint">필기는 새로고침하거나 창을 닫으면 지워집니다.</span>';
  }

  function setupBox(box) {
    if (!box || box.dataset.inkReady === '1') return;
    const fontBar = box.querySelector('.op-font-bar');
    if (!fontBar) return;
    box.dataset.inkReady = '1';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'op-font-btn ink-toggle';
    toggle.dataset.ink = 'toggle';
    toggle.textContent = '✏️ 펜';
    toggle.title = '켜면 드래그가 필기가 됩니다. 끄면 단어 선택·사전을 쓸 수 있습니다.';
    const anchor = fontBar.querySelector('.op-font-title');
    fontBar.insertBefore(toggle, anchor || fontBar.firstChild);
    const sep = document.createElement('span');
    sep.className = 'ink-toggle-gap';
    fontBar.insertBefore(sep, anchor || null);

    const bar = document.createElement('div');
    bar.className = 'ink-bar';
    bar.innerHTML = barHTML();
    fontBar.parentNode.insertBefore(bar, fontBar.nextSibling);

    colsOf(box).forEach(redraw);   // 이전에 쓴 필기 복원
    syncUI();
  }

  function syncUI() {
    document.body.classList.toggle('ink-mode', S.mode);
    document.body.classList.toggle('ink-stylus', S.stylusSeen);
    document.querySelectorAll('.ink-toggle').forEach(b => {
      b.classList.toggle('active', S.mode);
      b.textContent = S.mode ? '✏️ 펜 켜짐' : '✏️ 펜';
    });
    document.querySelectorAll('.ink-bar [data-ink^="tool:"]').forEach(b => b.classList.toggle('active', b.dataset.ink === 'tool:' + S.tool));
    const group = TOOLS[S.tool] ? TOOLS[S.tool].group : '';
    document.querySelectorAll('.ink-bar [data-ink^="group:"]').forEach(b => {
      const g = b.dataset.ink.slice(6);
      b.classList.toggle('active', g === group);
      b.classList.toggle('open', g === S.open);
      b.setAttribute('aria-expanded', g === S.open ? 'true' : 'false');
    });
    document.querySelectorAll('.ink-bar [data-dot="pen"]').forEach(i => { i.style.background = TOOLS[S.penTool].color; });
    document.querySelectorAll('.ink-bar [data-dot="hl"]').forEach(i => { i.style.background = TOOLS[S.hlTool].color; });
    document.querySelectorAll('.ink-bar .ink-pal').forEach(p => { p.hidden = p.dataset.pal !== S.open; });
  }

  function clearBox(box) {
    colsOf(box).forEach(col => {
      const key = keyOf(col);
      if (key) { (S.store.get(key) || []).slice().forEach(st => removeStroke(key, st)); }
      redraw(col);
    });
  }
  function clearAll() {
    S.store.clear(); S.order.length = 0;
    document.querySelectorAll('.ink-layer').forEach(svg => { while (svg.firstChild) svg.removeChild(svg.firstChild); });
  }
  const boxHasInk = box => colsOf(box).some(col => { const k = keyOf(col); return !!(k && S.store.get(k) && S.store.get(k).length); });

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('[data-ink]');
    if (!btn) return;
    const act = btn.dataset.ink;
    const box = btn.closest('.online-box');
    if (act === 'toggle') { S.mode = !S.mode; syncUI(); return; }
    if (act.indexOf('group:') === 0) {
      // 펜/형광펜 버튼: 그 도구로 바꾸면서 색 서랍을 엽니다. 이미 쓰는 중이면 서랍만 열고 닫습니다.
      const g = act.slice(6);
      const cur = TOOLS[S.tool] ? TOOLS[S.tool].group : '';
      if (cur !== g) { S.tool = g === 'pen' ? S.penTool : S.hlTool; S.open = g; }
      else S.open = (S.open === g) ? '' : g;
      syncUI();
      return;
    }
    if (act.indexOf('tool:') === 0) {
      const t = act.slice(5);
      if (t !== 'eraser' && !TOOLS[t]) return;
      S.tool = t;
      if (TOOLS[t]) { if (TOOLS[t].group === 'pen') S.penTool = t; else S.hlTool = t; }
      S.open = '';   // 색을 골랐거나 지우개를 골랐으면 서랍을 닫습니다
      syncUI();
      return;
    }
    if (!box) return;
    if (act === 'undo') {
      const keys = colsOf(box).map(keyOf);
      for (let i = S.order.length - 1; i >= 0; i--) {
        if (keys.indexOf(S.order[i].key) !== -1) { removeStroke(S.order[i].key, S.order[i].stroke); break; }
      }
      return;
    }
    if (act === 'clear') {
      if (!boxHasInk(box)) return;
      showCustomConfirm('이 문항의 필기를 모두 지우시겠습니까?', () => clearBox(box));
    }
  });

  /* ---------- 문제 화면이 만들어질 때 자동으로 붙이기 ---------- */
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('.online-box')) setupBox(root);
    if (root.classList && root.classList.contains('op-font-bar')) setupBox(root.closest('.online-box'));
    if (root.querySelectorAll) root.querySelectorAll('.online-box').forEach(setupBox);
  }
  new MutationObserver(list => {
    list.forEach(m => {
      m.addedNodes.forEach(scan);
      // 온라인 보기는 내용이 나중에 채워지므로, 상자 안에 글자 크기 막대가 생기면 그때 붙입니다.
      if (m.target && m.target.nodeType === 1) {
        const box = m.target.closest && m.target.closest('.online-box');
        if (box && box.dataset.inkReady !== '1') setupBox(box);
      }
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') scan(document.body);
  else document.addEventListener('DOMContentLoaded', () => scan(document.body));

  /* ---------- 글자 크기를 바꾸면 줄바꿈이 달라져 필기가 어긋나므로, 확인 후 지웁니다 ---------- */
  if (typeof window.changeOnlineFont === 'function') {
    const original = window.changeOnlineFont;
    window.changeOnlineFont = function (card, box, action) {
      if (!S.store.size) return original(card, box, action);
      showCustomConfirm('글자 크기를 바꾸면 줄이 달라져서<br>지금까지 쓴 필기가 <b>모두 지워집니다.</b><br>계속하시겠습니까?', () => {
        clearAll();
        original(card, box, action);
      });
    };
  }

  /* ---------- 새로고침·창 닫기 경고 ---------- */
  window.addEventListener('beforeunload', e => {
    if (S.store.size) { e.preventDefault(); e.returnValue = '필기는 새로고침하거나 창을 닫으면 지워집니다.'; }
  });

  window.K2Ink = { state: S, clearAll: clearAll };
})();
