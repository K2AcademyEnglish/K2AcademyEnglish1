/* ===================== 미니게임: 오늘의 타로 =====================
 * 학생 홈의 "🔮 오늘의 타로" 버튼으로 엽니다. 포인트를 써서 카드 1장을 뽑습니다.
 * - 카드 결정과 포인트 차감은 서버(Code.gs drawTarot)가 합니다. 이 파일은 그림과 해석 문구만 가지고 있습니다.
 * - 카드 수(22)·행운의 색 수(10)·행운 아이템 수(12)를 바꾸면 Code.gs의 TAROT_*_COUNT도 같이 바꿔야 합니다.
 * - 해석 문구는 모두 새로 쓴 것이며, 재미로 보는 운세입니다.
 */
(function () {
  'use strict';

  const TOPICS = {
    today:  { label: '오늘의 운세', icon: '🍀' },
    study:  { label: '학업·시험운', icon: '📚' },
    friend: { label: '친구운',     icon: '🤝' },
    love:   { label: '연애운',     icon: '💕' },
    money:  { label: '용돈운',     icon: '💰' }
  };

  // 메이저 아르카나 22장: [번호, 이름, 영어 이름, 그림, 키워드, {주제별 해석}]
  const CARDS = [
    ['0', '바보', 'The Fool', '🎒', '새로운 시작',
      { today: '가벼운 마음으로 처음 해 보는 일에 도전하기 좋은 날이에요. 실수해도 괜찮아요!',
        study: '어렵게 느껴지던 단원도 첫 페이지부터 가볍게 시작해 보세요. 시작이 반이에요.',
        friend: '새 친구에게 먼저 말을 걸어 보세요. 생각보다 쉽게 친해질 수 있어요.',
        love: '설레는 마음이 생길 수 있는 날이에요. 너무 서두르지 말고 지금을 즐겨요.',
        money: '충동구매를 조심하세요. 사고 싶은 게 생기면 하루만 더 생각해 봐요.' }],
    ['I', '마법사', 'The Magician', '🪄', '재능과 실행력',
      { today: '마음먹은 일을 바로 실행에 옮기면 잘 풀리는 날이에요.',
        study: '알고 있는 걸 직접 문제에 적용해 보세요. 오늘은 응용력이 빛나요.',
        friend: '내 아이디어가 친구들 사이에서 인기를 얻을 수 있어요.',
        love: '자연스러운 대화 속에서 내 매력이 잘 드러나는 날이에요.',
        money: '작은 계획을 세우면 용돈 관리가 훨씬 쉬워져요. 이번 주 예산을 정해 볼까요?' }],
    ['II', '여사제', 'The High Priestess', '🌙', '직감과 차분함',
      { today: '조용히 생각을 정리하기 좋은 날이에요. 내 직감을 믿어 보세요.',
        study: '혼자 집중하는 시간이 효과가 커요. 조용한 곳에서 개념을 정리해 봐요.',
        friend: '친구의 이야기를 끝까지 들어 주면 더 가까워질 수 있어요.',
        love: '마음을 다 드러내기보다 천천히 알아가는 게 좋아요.',
        money: '꼭 필요한 것과 갖고 싶은 것을 나눠 적어 보세요. 답이 보여요.' }],
    ['III', '여황제', 'The Empress', '🌸', '풍요와 여유',
      { today: '주변에 좋은 일이 많이 생기는 넉넉한 하루예요.',
        study: '꾸준히 해 온 공부가 열매를 맺기 시작해요. 지금 페이스를 유지해요.',
        friend: '친구들과 함께 있을 때 웃을 일이 많은 날이에요.',
        love: '따뜻한 말 한마디가 좋은 인상을 남겨요.',
        money: '용돈이 조금 남는 날이에요. 저금통에 넣어 두면 나중에 큰 힘이 돼요.' }],
    ['IV', '황제', 'The Emperor', '👑', '계획과 책임감',
      { today: '계획표대로 움직이면 하루가 알차게 끝나요.',
        study: '공부 계획을 시간 단위로 세워 보세요. 오늘은 계획이 잘 지켜져요.',
        friend: '모둠 활동에서 리더 역할을 맡으면 잘 해낼 수 있어요.',
        love: '믿음직한 모습이 상대에게 좋은 인상을 줘요.',
        money: '용돈 기입장을 써 보기 좋은 날이에요. 어디에 썼는지 적어 봐요.' }],
    ['V', '교황', 'The Hierophant', '📜', '배움과 조언',
      { today: '선생님이나 부모님의 조언이 큰 도움이 되는 날이에요.',
        study: '모르는 건 바로 질문하세요. 오늘 들은 설명이 오래 기억에 남아요.',
        friend: '친구에게 좋은 조언을 해 줄 수 있어요. 진심이 잘 전해져요.',
        love: '서두르기보다 예의 바르고 다정한 태도가 가장 큰 매력이에요.',
        money: '어른에게 용돈 관리 팁을 물어보면 쓸모 있는 답을 얻을 수 있어요.' }],
    ['VI', '연인', 'The Lovers', '💞', '선택과 조화',
      { today: '고민되는 선택이 있다면 내 마음이 진짜 원하는 쪽을 골라요.',
        study: '두 과목 중 하나만 고르기 어렵다면, 오늘은 더 약한 과목부터!',
        friend: '친구와 마음이 잘 통하는 날이에요. 함께 공부하면 효과 두 배!',
        love: '마음이 잘 맞는 사람과 이야기가 술술 풀리는 날이에요.',
        money: '친구와 나눠 쓰면 더 즐거운 날이에요. 다만 빌려주는 건 신중하게!' }],
    ['VII', '전차', 'The Chariot', '🏇', '추진력과 승리',
      { today: '앞만 보고 달리면 목표에 도착하는 날이에요. 망설이지 마세요!',
        study: '시험 대비에 속도가 붙어요. 오늘 목표량을 조금 더 높여 봐요.',
        friend: '친구들과 함께하는 경쟁이 좋은 자극이 돼요.',
        love: '용기를 내면 좋은 흐름이 이어져요. 단, 상대의 속도도 존중해요.',
        money: '목표 금액을 정하고 모으기 시작하기 딱 좋은 날이에요.' }],
    ['VIII', '힘', 'Strength', '🦁', '끈기와 용기',
      { today: '힘든 일이 있어도 차분하게 버티면 결국 해낼 수 있어요.',
        study: '어려운 문제에서 포기하지 마세요. 한 번 더 보면 실마리가 보여요.',
        friend: '부드럽게 말하는 게 이기는 날이에요. 다툼이 있다면 먼저 화해해 봐요.',
        love: '꾸밈없는 진짜 내 모습이 가장 멋져 보이는 날이에요.',
        money: '사고 싶은 걸 참아낸 만큼 나중에 더 큰 기쁨이 와요.' }],
    ['IX', '은둔자', 'The Hermit', '🏮', '성찰과 집중',
      { today: '혼자만의 시간이 에너지를 채워 주는 날이에요.',
        study: '오답 노트를 정리하기 딱 좋은 날이에요. 틀린 이유를 하나씩 적어 봐요.',
        friend: '오늘은 무리하게 어울리기보다 나만의 시간을 가져도 괜찮아요.',
        love: '내가 어떤 사람에게 끌리는지 차분히 생각해 보는 날이에요.',
        money: '지난주에 쓴 돈을 돌아보면 아낄 곳이 보여요.' }],
    ['X', '운명의 수레바퀴', 'Wheel of Fortune', '🎡', '행운과 변화',
      { today: '뜻밖의 좋은 소식이 찾아올 수 있는 날이에요!',
        study: '찍은 문제도 맞는 운이 있지만… 진짜 실력이 운을 부른다는 걸 잊지 마세요!',
        friend: '오랜만에 연락이 닿는 친구가 있을 수 있어요.',
        love: '우연한 만남이나 대화가 즐거운 추억이 될 수 있어요.',
        money: '작은 행운이 있는 날! 그래도 들어온 용돈은 계획대로 써요.' }],
    ['XI', '정의', 'Justice', '⚖️', '균형과 공정함',
      { today: '한 만큼 돌아오는 날이에요. 성실함이 보상받아요.',
        study: '공부한 만큼 점수로 이어지는 날이에요. 복습이 정답!',
        friend: '양쪽 이야기를 다 들어 주면 갈등이 풀려요.',
        love: '솔직하고 공정한 태도가 신뢰를 쌓아요.',
        money: '빌린 건 꼭 갚고, 약속한 건 지켜요. 신용도 재산이에요.' }],
    ['XII', '매달린 사람', 'The Hanged Man', '🙃', '관점 바꾸기',
      { today: '잘 안 풀리는 일은 다른 방향에서 바라보면 답이 보여요.',
        study: '막힌 문제는 잠깐 쉬었다가 다른 풀이로 접근해 봐요.',
        friend: '친구 입장에서 생각해 보면 오해가 풀려요.',
        love: '조급해하지 말고 잠시 기다리는 것도 좋은 선택이에요.',
        money: '지금 참으면 나중에 더 좋은 걸 살 수 있어요.' }],
    ['XIII', '변화', 'Death', '🦋', '끝과 새 출발',
      { today: '나쁜 습관 하나를 끝내고 새로 시작하기 좋은 날이에요.',
        study: '안 맞던 공부법을 과감히 바꿔 보세요. 새 방법이 잘 맞을 수 있어요.',
        friend: '새로운 친구 관계가 시작될 수 있어요.',
        love: '지난 일은 털어 버리고 새로운 마음으로 시작해요.',
        money: '안 쓰는 물건을 정리하면 진짜 필요한 게 보여요.' }],
    ['XIV', '절제', 'Temperance', '🫗', '조화와 균형',
      { today: '공부와 휴식의 균형을 맞추면 기분 좋은 하루가 돼요.',
        study: '50분 공부, 10분 휴식! 리듬을 지키면 집중력이 올라가요.',
        friend: '여러 친구들 사이에서 다리 역할을 잘 해낼 수 있어요.',
        love: '천천히, 부드럽게. 적당한 거리가 오히려 좋아요.',
        money: '쓰는 돈과 모으는 돈을 반반 나눠 보세요.' }],
    ['XV', '유혹', 'The Devil', '😈', '유혹 조심',
      { today: '"5분만 더…" 휴대폰의 유혹을 조심하세요!',
        study: '공부할 때는 휴대폰을 멀리 두세요. 오늘은 그게 가장 큰 비법이에요.',
        friend: '친구 따라 하기 싫은 일을 억지로 하지 않아도 괜찮아요.',
        love: '남의 시선보다 내 마음이 편한 쪽을 선택해요.',
        money: '게임 아이템, 간식… 작은 지출이 쌓이기 쉬운 날이에요.' }],
    ['XVI', '탑', 'The Tower', '🗼', '깜짝 변화',
      { today: '예상 밖의 일이 생겨도 당황하지 마세요. 다시 쌓으면 돼요.',
        study: '계획이 흔들려도 괜찮아요. 오늘은 오답 3개만 다시 풀어 봐요.',
        friend: '작은 오해가 생길 수 있어요. 바로 솔직하게 이야기하면 풀려요.',
        love: '갑작스러운 일에 흔들리지 말고 내 페이스를 지켜요.',
        money: '갑자기 돈 쓸 일이 생길 수 있어요. 비상금을 조금 남겨 두세요.' }],
    ['XVII', '별', 'The Star', '⭐', '희망과 꿈',
      { today: '희망이 가득한 날이에요. 꿈을 노트에 적어 보세요.',
        study: '목표 점수를 적어 책상에 붙여 두세요. 오늘의 노력이 그 별에 가까워져요.',
        friend: '친구에게 응원의 말을 건네면 나에게도 좋은 기운이 돌아와요.',
        love: '반짝이는 설렘이 있는 날이에요. 마음을 소중히 간직해요.',
        money: '꼭 갖고 싶은 것을 위해 저금을 시작하기 좋은 날이에요.' }],
    ['XVIII', '달', 'The Moon', '🌕', '불안 다스리기',
      { today: '괜히 불안한 마음이 들 수 있어요. 확실한 것부터 하나씩!',
        study: '헷갈리는 개념은 교과서를 다시 확인해요. 추측보다 확인이 먼저!',
        friend: '소문보다 친구에게 직접 물어보는 게 정확해요.',
        love: '상대의 마음을 너무 추측하지 말고 편하게 대해요.',
        money: '"싸다"는 말에 혹하지 말고 꼭 필요한지 따져 봐요.' }],
    ['XIX', '태양', 'The Sun', '☀️', '성공과 기쁨',
      { today: '오늘은 최고의 날! 웃음이 끊이지 않을 거예요.',
        study: '자신감이 가득한 날이에요. 어려운 문제에도 도전해 보세요!',
        friend: '밝은 에너지로 친구들을 웃게 만들 수 있어요.',
        love: '밝은 미소가 가장 큰 매력이 되는 날이에요.',
        money: '기분 좋은 일이 생겨요. 작은 선물로 고마운 사람에게 마음을 전해 봐요.' }],
    ['XX', '심판', 'Judgement', '📯', '다시 일어서기',
      { today: '지난 실수를 만회할 기회가 오는 날이에요.',
        study: '예전에 틀렸던 문제를 다시 풀어 보세요. 이번엔 맞힐 수 있어요!',
        friend: '사이가 멀어졌던 친구와 다시 가까워질 수 있어요.',
        love: '솔직한 마음을 돌아보기 좋은 날이에요.',
        money: '지난번에 아쉬웠던 소비를 떠올리면 다음엔 더 잘할 수 있어요.' }],
    ['XXI', '세계', 'The World', '🌍', '완성과 성취',
      { today: '하나를 끝까지 해내는 날이에요. 스스로를 칭찬해 주세요!',
        study: '한 단원을 마무리하기 좋은 날이에요. 끝까지 하면 큰 성취감이 와요.',
        friend: '친구들과 함께 무언가를 완성하면 최고의 추억이 돼요.',
        love: '마음이 편안하고 꽉 찬 하루예요.',
        money: '모으던 목표에 한 걸음 더 다가가는 날이에요.' }]
  ];

  const COLORS = [['빨강', '#ef4444'], ['주황', '#f97316'], ['노랑', '#eab308'], ['초록', '#22c55e'], ['하늘색', '#38bdf8'],
                  ['파랑', '#2563eb'], ['보라', '#8b5cf6'], ['분홍', '#ec4899'], ['흰색', '#e5e7eb'], ['민트', '#2dd4bf']];
  const ITEMS = ['형광펜', '포스트잇', '샤프', '지우개', '단어장', '물병', '이어폰', '손목시계', '초콜릿', '책갈피', '연습장', '손거울'];

  /* ---------- 도구 ---------- */
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const me = () => (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.id) ? CURRENT_USER : null;
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(esc(m), t || 'info'); };
  const call = (fn, args) => gsCall(fn, args).catch(err => {
    let m = String(err && err.message ? err.message : err).replace(/^Error:\s*/, '');
    if (typeof isMissingServerFunction === 'function' && isMissingServerFunction(m)) m = '구글 스크립트(Code.gs)가 아직 새 버전으로 배포되지 않았습니다.';
    throw new Error(m);
  });

  const S = { status: null, topic: 'today', busy: false };

  /* ---------- 화면 ---------- */
  function ensureOverlay() {
    let o = document.getElementById('tarotOverlay');
    if (o) return o;
    injectCss();
    o = document.createElement('div');
    o.id = 'tarotOverlay';
    o.className = 'tr-overlay';
    o.innerHTML = '<div class="tr-box" role="dialog" aria-modal="true"></div>';
    o.addEventListener('click', e => {
      if (e.target === o) close();
      const b = e.target.closest('[data-tr]');
      if (!b) return;
      const [act, arg] = b.dataset.tr.split(':');
      if (act === 'close') close();
      else if (act === 'topic') { S.topic = arg; render(); }
      else if (act === 'pick') pick(Number(arg), b);
      else if (act === 'again') { S.result = null; render(); }
      else if (act === 'show') { S.result = S.status.today[Number(arg)]; render(); }
    });
    document.body.appendChild(o);
    return o;
  }
  function close() { const o = document.getElementById('tarotOverlay'); if (o) o.classList.remove('active'); }

  function open() {
    if (!me() || me().role === 'manager') return;
    const o = ensureOverlay();
    o.classList.add('active');
    S.result = null; S.status = null;
    box().innerHTML = '<div class="tr-loading">🔮 카드를 섞는 중…</div>';
    call('getTarotStatus', [me().id]).then(st => {
      S.status = st;
      if (st.topics.indexOf(S.topic) === -1) S.topic = st.topics[0];
      if (!st.left && st.today.length) S.result = st.today[st.today.length - 1];
      render();
    }).catch(e => { box().innerHTML = `<div class="tr-loading">😢 ${esc(e.message)}</div><div class="tr-foot"><button class="tr-btn" data-tr="close">닫기</button></div>`; });
  }
  const box = () => document.querySelector('#tarotOverlay .tr-box');

  // 카드 그림: img/tarot/00.jpg ~ 21.jpg (가로 600 × 세로 803). 그림 파일이 없거나 못 불러오면 이모지 카드로 대신 보여 줍니다.
  const CARD_IMG_DIR = 'img/tarot/';
  const cardImgUrl = i => CARD_IMG_DIR + String(i).padStart(2, '0') + '.jpg';
  // 네트워크가 잠깐 끊기거나 느려서 그림을 못 불러온 경우, 바로 이모지로 바꾸지 않고 몇 번 더 시도합니다.
  const IMG_RETRY = 3;
  const okUrl = {}; // 카드 번호 → 실제로 불러와진 주소 (다시 그릴 때 캐시를 그대로 씀)
  const retryUrl = (i, n) => cardImgUrl(i) + '?r=' + n + '_' + Date.now();
  window.__trImgErr = function (img) {
    const n = (+img.dataset.retry || 0) + 1;
    if (n > IMG_RETRY) { img.parentNode.classList.add('noimg'); return; }
    img.dataset.retry = n;
    setTimeout(() => { if (img.isConnected) img.src = retryUrl(img.dataset.i, n); }, 500 * n);
  };
  window.__trImgOk = function (img) {
    okUrl[img.dataset.i] = img.getAttribute('src');
    img.parentNode.classList.remove('noimg');
    img.parentNode.classList.add('loaded');
  };
  // 결과를 보여 주기 전에 뽑힌 카드 그림을 미리 받아 둡니다. (최대 maxMs까지만 기다림)
  function preloadCard(i, maxMs) {
    const load = new Promise(res => {
      let n = 0;
      const tryOnce = url => {
        const im = new Image();
        im.onload = () => { okUrl[i] = url; res(true); };
        im.onerror = () => { if (++n > IMG_RETRY) res(false); else setTimeout(() => tryOnce(retryUrl(i, n)), 500 * n); };
        im.src = url;
      };
      tryOnce(okUrl[i] || cardImgUrl(i));
    });
    return Promise.race([load, new Promise(res => setTimeout(() => res(false), maxMs))]);
  }
  function cardFace(i, big) {
    const c = CARDS[i];
    return `<div class="tr-cardimg ${big ? 'big' : ''}">
        <img src="${okUrl[i] || cardImgUrl(i)}" data-i="${i}" alt="${esc(c[1])} 카드" loading="eager" decoding="async" onload="window.__trImgOk(this)" onerror="window.__trImgErr(this)">
        <div class="tr-face">
          <div class="tr-num">${esc(c[0])}</div>
          <div class="tr-art">${c[3]}</div>
          <div class="tr-name">${esc(c[1])}</div>
          <div class="tr-en">${esc(c[2])}</div>
        </div>
      </div>`;
  }

  function render() {
    const st = S.status;
    if (!st) return;
    const head = `<div class="tr-head"><div><b>🔮 오늘의 타로</b><small>한 번 ${st.cost}pt · 하루 ${st.daily}번</small></div>
        <div class="tr-pt">내 포인트 <b>${Number(st.points.balance - st.points.pending).toLocaleString()}</b>pt</div>
        <button class="tr-x" data-tr="close" aria-label="닫기">×</button></div>`;
    if (S.result) { box().innerHTML = head + resultHtml(S.result); return; }
    if (!st.on) { box().innerHTML = head + '<div class="tr-loading">지금은 타로를 볼 수 없어요.</div>'; return; }
    if (!st.left) {
      box().innerHTML = head + `<div class="tr-loading">오늘은 이미 타로를 봤어요. 내일 다시 만나요! 🌙</div>
        <div class="tr-foot">${st.today.map((t, i) => `<button class="tr-btn" data-tr="show:${i}">오늘 뽑은 카드 보기</button>`).join('')}<button class="tr-btn" data-tr="close">닫기</button></div>`;
      return;
    }
    const enough = (st.points.balance - st.points.pending) >= st.cost;
    box().innerHTML = head + `
      <div class="tr-step">① 어떤 운세를 볼까요?</div>
      <div class="tr-topics">${st.topics.map(k => `<button class="tr-chip ${S.topic === k ? 'on' : ''}" data-tr="topic:${k}">${TOPICS[k].icon} ${TOPICS[k].label}</button>`).join('')}</div>
      <div class="tr-step">② 마음이 가는 카드를 한 장 골라 주세요</div>
      <div class="tr-deck">${[0, 1, 2, 3, 4].map(i => `<button class="tr-card" data-tr="pick:${i}" ${enough ? '' : 'disabled'} style="--r:${(i - 2) * 6}deg"><div class="tr-back"><span>✦</span></div></button>`).join('')}</div>
      ${enough ? '' : `<div class="tr-warn">포인트가 부족해요. (${st.cost}pt 필요)</div>`}
      <div class="tr-note">재미로 보는 운세예요 · 결과는 메시지만 있고 포인트는 돌려받지 않아요</div>`;
  }

  function resultHtml(r) {
    const c = CARDS[r.card] || CARDS[0];
    const t = TOPICS[r.topic] || TOPICS.today;
    const col = COLORS[r.color] || COLORS[0];
    return `<div class="tr-result">
        <div class="tr-flip">${cardFace(r.card, true)}</div>
        <div class="tr-read">
          <div class="tr-topic-tag">${t.icon} ${esc(t.label)}</div>
          <h3>${esc(c[1])} <small>${esc(c[2])}</small></h3>
          <div class="tr-key">키워드 · ${esc(c[4])}</div>
          <p>${esc(c[5][r.topic] || c[5].today)}</p>
          <div class="tr-lucky">
            <div><span>행운의 색</span><b><i style="background:${col[1]}"></i>${esc(col[0])}</b></div>
            <div><span>행운의 숫자</span><b>${Number(r.number) || 7}</b></div>
            <div><span>행운 아이템</span><b>${esc(ITEMS[r.item] || ITEMS[0])}</b></div>
          </div>
        </div>
      </div>
      <div class="tr-note">재미로 보는 운세예요. 오늘도 화이팅! 💪</div>
      <div class="tr-foot"><button class="tr-btn primary" data-tr="close">확인</button></div>`;
  }

  function pick(i, btn) {
    if (S.busy) return;
    const st = S.status, t = TOPICS[S.topic];
    const go = () => {
      S.busy = true;
      box().querySelectorAll('.tr-card').forEach(b => { b.disabled = true; if (b !== btn) b.classList.add('fade'); });
      btn.classList.add('chosen');
      const wait = new Promise(res => setTimeout(res, 900)); // 카드가 떠오르는 연출 시간
      Promise.all([call('drawTarot', [me().id, S.topic]), wait])
        .then(([res]) => preloadCard(res.result.card, 4000).then(() => res))
        .then(res => {
        S.busy = false;
        st.points = res.points; st.left = res.left; st.today.push(res.result);
        S.result = res.result;
        render();
        if (window.NP && typeof NP.refresh === 'function') NP.refresh().catch(() => {});
      }).catch(e => {
        S.busy = false;
        toast(e.message, 'error');
        render();
      });
    };
    const msg = `${st.cost}pt를 써서 <b>${esc(t.icon + ' ' + t.label)}</b> 카드를 뽑을까요?`;
    if (typeof showCustomConfirm === 'function') showCustomConfirm(msg, go); else if (confirm(msg.replace(/<[^>]+>/g, ''))) go();
  }

  function injectCss() {
    if (document.getElementById('tarotCss')) return;
    const css = document.createElement('style');
    css.id = 'tarotCss';
    css.textContent = `
      .tr-overlay { position: fixed; inset: 0; z-index: 12000; background: rgba(15,10,40,.62); display: none; align-items: center; justify-content: center; padding: 14px; }
      .tr-overlay.active { display: flex; }
      #tarotOverlay .tr-box { width: min(560px, 100%); max-height: calc(100vh - 28px); overflow-y: auto; background: linear-gradient(180deg,#1e1b4b 0%,#312e81 100%); color: #eef2ff; border-radius: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.45); padding: 16px 18px 18px; font-family: 'Noto Sans KR','Malgun Gothic',sans-serif; }
      /* 사이트 공통 버튼 스타일(가로 100%·큰 안쪽 여백)이 타로 창에 들어오지 않게 초기화 */
      #tarotOverlay.tr-overlay .tr-box.tr-box button { width: auto !important; min-width: 0 !important; height: auto; margin: 0 !important; font-family: inherit; box-shadow: none; flex: 0 0 auto; font-size: 14px !important; line-height: 1.2 !important; }
      #tarotOverlay.tr-overlay .tr-box .tr-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      #tarotOverlay.tr-overlay .tr-box .tr-head > div:first-child { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
      #tarotOverlay.tr-overlay .tr-box .tr-head b { white-space: nowrap; }
      #tarotOverlay.tr-overlay .tr-box .tr-head b { font-size: 19px; }
      #tarotOverlay.tr-overlay .tr-box .tr-head small { font-size: 12px; color: #c7d2fe; }
      #tarotOverlay.tr-overlay .tr-box .tr-pt { font-size: 13px; background: rgba(255,255,255,.1); border-radius: 999px; padding: 4px 10px; white-space: nowrap; }
      #tarotOverlay.tr-overlay .tr-box .tr-pt b { color: #fde68a; font-size: 15px; }
      #tarotOverlay.tr-overlay .tr-box .tr-x { background: none !important; border: none !important; color: #c7d2fe !important; font-size: 26px !important; line-height: 1; cursor: pointer; padding: 0 4px !important; }
      #tarotOverlay.tr-overlay .tr-box .tr-step { font-size: 14px; font-weight: 700; color: #e0e7ff; margin: 12px 0 8px; }
      #tarotOverlay.tr-overlay .tr-box .tr-topics { display: flex; flex-wrap: wrap; gap: 6px; }
      #tarotOverlay.tr-overlay .tr-box .tr-chip { border: 1px solid rgba(199,210,254,.45) !important; background: rgba(255,255,255,.06) !important; color: #e0e7ff !important; border-radius: 999px !important; padding: 7px 12px !important; font-size: 14px !important; font-weight: 700; cursor: pointer; }
      #tarotOverlay.tr-overlay .tr-box .tr-chip.on { background: #fde68a !important; color: #312e81 !important; border-color: #fde68a !important; }
      #tarotOverlay.tr-overlay .tr-box .tr-deck { display: flex; justify-content: center; gap: 8px; padding: 18px 0 8px; }
      #tarotOverlay.tr-overlay .tr-box.tr-box .tr-card { width: 64px !important; height: 104px !important; padding: 0 !important; border: none !important; background: none !important; border-radius: 10px; cursor: pointer; transform: rotate(var(--r)); transition: transform .25s, opacity .3s; }
      #tarotOverlay.tr-overlay .tr-box .tr-card:not(:disabled):hover { transform: rotate(var(--r)) translateY(-10px); }
      #tarotOverlay.tr-overlay .tr-box .tr-card:disabled { cursor: default; }
      #tarotOverlay.tr-overlay .tr-box .tr-card.fade { opacity: .25; }
      #tarotOverlay.tr-overlay .tr-box .tr-card.chosen { transform: translateY(-18px) scale(1.12); animation: trGlow 1s ease-in-out infinite alternate; }
      @keyframes trGlow { from { filter: drop-shadow(0 0 4px #fde68a); } to { filter: drop-shadow(0 0 16px #fde68a); } }
      #tarotOverlay.tr-overlay .tr-box .tr-back { width: 100%; height: 100%; border-radius: 10px; border: 2px solid #fde68a; background: repeating-linear-gradient(45deg,#4338ca 0 8px,#3730a3 8px 16px); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(0,0,0,.35); }
      #tarotOverlay.tr-overlay .tr-box .tr-back span { font-size: 26px; color: #fde68a; }
      #tarotOverlay.tr-overlay .tr-box .tr-warn { text-align: center; color: #fecaca; font-size: 13px; margin-top: 4px; }
      #tarotOverlay.tr-overlay .tr-box .tr-note { text-align: center; font-size: 11.5px; color: #a5b4fc; margin-top: 12px; }
      #tarotOverlay.tr-overlay .tr-box .tr-loading { text-align: center; padding: 36px 8px; font-size: 15px; color: #e0e7ff; }
      #tarotOverlay.tr-overlay .tr-box .tr-foot { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
      #tarotOverlay.tr-overlay .tr-box .tr-btn { border: 1px solid #a5b4fc !important; background: transparent !important; color: #e0e7ff !important; border-radius: 10px !important; padding: 9px 18px !important; font-weight: 700; font-size: 14px !important; cursor: pointer; }
      #tarotOverlay.tr-overlay .tr-box .tr-btn.primary { background: #fde68a !important; color: #312e81 !important; border-color: #fde68a !important; min-width: 140px !important; }
      #tarotOverlay.tr-overlay .tr-box .tr-result { display: flex; gap: 16px; align-items: flex-start; margin-top: 6px; }
      #tarotOverlay.tr-overlay .tr-box .tr-flip { flex-shrink: 0; animation: trFlip .7s ease-out; }
      @keyframes trFlip { from { transform: rotateY(90deg) scale(.9); opacity: 0; } to { transform: none; opacity: 1; } }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg { position: relative; width: 150px; aspect-ratio: 600 / 803; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 24px rgba(0,0,0,.45); background: rgba(255,255,255,.08); }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg img { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .35s; }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg.loaded img { opacity: 1; }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg .tr-face { display: none; position: absolute; inset: 0; width: auto; height: auto; }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg.noimg { box-shadow: none; background: none; }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg.noimg img { display: none; }
      #tarotOverlay.tr-overlay .tr-box .tr-cardimg.noimg .tr-face { display: flex; }
      #tarotOverlay.tr-overlay .tr-box .tr-face { width: 120px; height: 196px; border-radius: 12px; background: linear-gradient(180deg,#fffbeb,#fde68a); color: #312e81; border: 3px solid #f59e0b; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 8px 6px; box-sizing: border-box; box-shadow: 0 10px 24px rgba(0,0,0,.4); }
      #tarotOverlay.tr-overlay .tr-box .tr-num { font-family: Georgia, serif; font-weight: 700; font-size: 15px; }
      #tarotOverlay.tr-overlay .tr-box .tr-art { font-size: 54px; line-height: 1; }
      #tarotOverlay.tr-overlay .tr-box .tr-name { font-weight: 900; font-size: 15px; }
      #tarotOverlay.tr-overlay .tr-box .tr-en { font-family: Georgia, serif; font-size: 10px; letter-spacing: .5px; opacity: .8; }
      #tarotOverlay.tr-overlay .tr-box .tr-read { flex: 1; min-width: 0; }
      #tarotOverlay.tr-overlay .tr-box .tr-topic-tag { display: inline-block; background: rgba(253,230,138,.18); color: #fde68a; border-radius: 999px; padding: 2px 10px; font-size: 12.5px; font-weight: 700; }
      #tarotOverlay.tr-overlay .tr-box .tr-read h3 { margin: 6px 0 2px; font-size: 20px; color: #fff !important; }
      #tarotOverlay.tr-overlay .tr-box .tr-read h3 small { font-size: 12px; color: #a5b4fc; font-weight: 400; }
      #tarotOverlay.tr-overlay .tr-box .tr-key { font-size: 12.5px; color: #c7d2fe; }
      #tarotOverlay.tr-overlay .tr-box .tr-read p { font-size: 15px; line-height: 1.6; margin: 8px 0 10px; color: #fff !important; }
      #tarotOverlay.tr-overlay .tr-box .tr-lucky { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }
      #tarotOverlay.tr-overlay .tr-box .tr-lucky div { background: rgba(255,255,255,.08); border-radius: 10px; padding: 6px; text-align: center; }
      #tarotOverlay.tr-overlay .tr-box .tr-lucky span { display: block; font-size: 11px; color: #a5b4fc; }
      #tarotOverlay.tr-overlay .tr-box .tr-lucky b { font-size: 14px; display: inline-flex; align-items: center; gap: 4px; }
      #tarotOverlay.tr-overlay .tr-box .tr-lucky i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,.6); }
      @media (max-width: 480px) {
        #tarotOverlay.tr-overlay .tr-box .tr-result { flex-direction: column; align-items: center; text-align: center; }
        #tarotOverlay.tr-overlay .tr-box.tr-box .tr-card { width: 54px !important; height: 88px !important; }
      }
      .np-tarot-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 8px; padding: 10px; border: none; border-radius: 12px; cursor: pointer;
        background: linear-gradient(90deg,#312e81,#6d28d9); color: #fff; font-weight: 800; font-size: 15px; box-shadow: 0 4px 12px rgba(76,29,149,.25); }
      .np-tarot-btn small { font-weight: 600; opacity: .85; font-size: 12px; }
    `;
    document.head.appendChild(css);
  }

  // 학생 홈 카드의 "🔮 오늘의 타로" 버튼 (notice-points.js가 그립니다)
  document.addEventListener('click', e => { if (e.target.closest('[data-tarot-open]')) open(); });

  window.K2Tarot = { open: open, close: close, _cards: CARDS, _colors: COLORS, _items: ITEMS };
  // 홈 카드 버튼 스타일이 첫 화면부터 적용되도록 미리 넣어 둡니다.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCss); else injectCss();
})();
