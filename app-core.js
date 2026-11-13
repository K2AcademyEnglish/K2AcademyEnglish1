/* ===================== 전역 상태 ===================== */
let CONFUSING_WORDS_DB = [];
let CURRENT_USER = null; // ★ 객체로 변경 {id, name, role, ...}
let CURRENT_ASSIGNMENT_ID = '';
let CURRENT_FILTERS = null;
let CURRENT_SESSION = '';
let CURRENT_SLIDE_IDX = 0;
let VOCAB_CACHE = null;
let MANAGED_STUDENTS = []; // ★ 담당 학생 목록 저장용
let CURRENT_QUIZ_DATA = [];
let ASGN_CACHE = {};
let SELECTED_MULTI_STUDENTS = []; // [추가] 중복출제용 학생 리스트

const selState = {
    'm1': { years: new Set(), months: new Set(), details: new Set() },
    'm2': { years: new Set(), months: new Set(), details: new Set() },
    'm3': { years: new Set(), months: new Set(), details: new Set() },
    'h1': { years: new Set(), months: new Set(), details: new Set() },
    'h2': { years: new Set(), months: new Set(), details: new Set() },
    'h3': { years: new Set(), months: new Set(), details: new Set() },
    'common': { types: new Set(), difficulties: new Set() }
};

/* ===================== 패널/탭 제어 ===================== */
function showPanel(id){
  if (id !== 'adminMakerPage') document.body.classList.remove('admin-create-mode');
  const nextPanel = document.getElementById(id);
  const pageChanged = nextPanel && !nextPanel.classList.contains('active');
  // 1. 화면 패널들의 ID 명단
  const panels = [
    'startPage', 'studentMainPage', 'selectPage', 'quizPage', 'wrongPage', 'vocabPage', 
    'assignmentPage', 'adminMakerPage', 'weeklyMakerPage', 'qbankPage'
  ];
  
  // 2. 명단에 있는 모든 패널을 일단 숨깁니다.
  panels.forEach(pid => {
    const el = document.getElementById(pid);
    if(el) el.classList.remove('active');
  });

  // 3. 선택된 패널만 보여줍니다.
  const p = document.getElementById(id);
  if(p) p.classList.add('active');
  if (pageChanged) {
    window.scrollTo(0, 0);
    const header = document.getElementById('globalHeader');
    if (header) header.classList.remove('hide-on-scroll');
  }

  // 4. 부가 기능: 다른 탭으로 갈 때 우측 하단 단어장 버튼(FAB) 숨기기
  setVocabFabVisible(false);

  // 5. 퀴즈나 오답노트가 아니면 드로어(팝업) 닫기
  if (!(id === 'quizPage' || id === 'wrongPage')) {
    closeVocabDrawer();
    closeQuestionMap();
  }
}

function setTopTab(active){
  const a=(id,on)=>{ const el=document.getElementById(id); if(!el) return; el.classList.toggle('active', on); };
  a('topTabQuiz', active==='quiz');
  a('topTabWrong', active==='wrong');
  a('topTabVocab', active==='vocab');
}
function showHeader(){
  const el = document.getElementById('globalHeader');
  if (el) el.style.display = 'block';
}
function showFooter(){
  const el = document.getElementById('globalFooter');
  if (el) el.style.display = 'flex';
}
function hideFooter(){
  const el = document.getElementById('globalFooter');
  if (el) el.style.display = 'none';
}

function refreshHeaderAuth(){
  const logged = (CURRENT_USER && CURRENT_USER.id);
  const isManager = (CURRENT_USER && CURRENT_USER.role === 'manager');

  const mainTabs = document.getElementById('mainTabs');
  const studentGroup = document.getElementById('studentTabGroup');
  const adminGroup = document.getElementById('adminTabGroup');
  
  // 기본 정보 처리
  const inp = document.getElementById('headerUsername');
  const btnLogin = document.getElementById('btnHeaderLogin');
  const badge = document.getElementById('userBadge');
  const btnLogout = document.getElementById('btnGoStart');

  if (inp) inp.style.display = logged ? 'none' : 'inline-block';
  if (btnLogin) btnLogin.style.display = logged ? 'none' : 'inline-block';
  if (badge) {
    badge.style.display = logged ? 'inline-flex' : 'none';
    if(logged) badge.textContent = `${CURRENT_USER.name} ${isManager ? '관리자' : '학생'}`;
  }
  if (btnLogout) btnLogout.style.display = logged ? 'inline-block' : 'none';

  // [중요] 탭 그룹 노출 제어
  if (mainTabs) {
    mainTabs.style.display = logged ? 'flex' : 'none';
    if (studentGroup) studentGroup.style.display = (logged && !isManager) ? 'flex' : 'none';
    if (adminGroup) adminGroup.style.display = (logged && isManager) ? 'flex' : 'none';
  }
  // 알림·포인트(notice-points.js)에 로그인 상태가 바뀌었음을 알림
  if (window.NP) NP.onAuthChange();
}

function goStart(){
  const btnMap = document.getElementById('btnShowMap');
  if(btnMap) btnMap.style.display = 'none';
  const btnVocab = document.getElementById('btnOpenVocab');
  if(btnVocab) btnVocab.style.display = 'none';
  
  // [추가] 로그아웃 시 상단 메인 탭 메뉴 숨김 초기화
  const mainTabs = document.getElementById('mainTabs');
  if(mainTabs) mainTabs.style.display = 'none';

  CURRENT_USER = null;
  CURRENT_FILTERS = null;
  CURRENT_SESSION = '';

      // [신규] 전역 메모리(학습 및 관리자 캐시) 완벽 초기화
      CURRENT_QUIZ_DATA = [];
      ASGN_CACHE = {};
      WRONG_STATS = [];
      if(typeof WRONG_SELECTED !== 'undefined') WRONG_SELECTED.clear();
      VOCAB_CACHE = null;
      MANAGED_STUDENTS = [];
      INVENTORY_DATA = [];
      ADMIN_HISTORY_CACHE = [];
      if(typeof MAKER_CART !== 'undefined') MAKER_CART.clear();
      SELECTED_MULTI_STUDENTS = [];

      // [신규] 로그인 입력창 텍스트 지우기
      const idInput = document.getElementById('userIdInput');
      if(idInput) idInput.value = '';
      const headerIdInput = document.getElementById('headerUsername');
      if(headerIdInput) headerIdInput.value = '';

  // ★ [추가] 로그아웃 시 History API 해시 초기화
  localStorage.removeItem('k2_session');
      
   if(window.history && window.history.pushState) {
      window.history.pushState(null, '', window.location.pathname);
  }

  showHeader();
  hideFooter();
  setTopTab('quiz');
  showPanel('startPage');
  // 미니 단어장 입력칸·목록·사전 창 초기화
  if (typeof vocabResetMiniDrawer === 'function') vocabResetMiniDrawer();

  syncLoginUI();
}

/* ✅ 상단 탭 이동(어디서든) */
function routeTo(mode, isPopState = false){
  if(!CURRENT_USER) return;
  CURRENT_ASSIGNMENT_ID = '';
  CURRENT_SESSION = '';
  hideFooter();
  
  if (!isPopState && window.history && window.history.pushState) {
      window.history.pushState({ page: mode }, '', '#' + mode);
  }
  
  // ★ 모든 상단 탭에서 파란색(active)을 먼저 싹 지워줌
  document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));

  if(mode === 'quiz') {
    const tab = document.getElementById('topTabQuiz');
    if(tab) tab.classList.add('active');
    showPanel('selectPage');
    loadStudentFilters();
  } 
  else if(mode === 'wrong') {
    const tab = document.getElementById('topTabWrong');
    if(tab) tab.classList.add('active');
    showPanel('wrongPage');
    loadWrongStats();
  } 
  else if(mode === 'vocab') {
    const tab = document.getElementById('topTabVocab');
    if(tab) tab.classList.add('active');
    showPanel('vocabPage');
    vocabLoadWordList();
  } 
  else if(mode === 'assignment') {
    const tab = document.getElementById('topTabAssignment');
    if(tab) tab.classList.add('active');
    showPanel('assignmentPage');
    loadMyAssignments();
  }
  // --- 관리자용 모드 ---
  else if(mode === 'admin-create') {
    const tab = document.getElementById('topTabAdminCreate');
    if(tab) tab.classList.add('active');
    showPanel('adminMakerPage');
    switchAdminTab('create'); 
  }
  else if(mode === 'admin-history') {
    const tab = document.getElementById('topTabAdminHistory');
    if(tab) tab.classList.add('active');
    showPanel('adminMakerPage');
    switchAdminTab('history');
  }
  else if(mode === 'weekly') {
    const tab = document.getElementById('topTabAdminWeekly');
    if(tab) tab.classList.add('active');
    showPanel('weeklyMakerPage');
  }
  else if(mode === 'admin-vocab') {
    const tab = document.getElementById('topTabAdminVocab');
    if(tab) tab.classList.add('active');
    showPanel('vocabPage');
    initAdminVocabMode();
  }
  else if(mode === 'admin-qbank') {
    const tab = document.getElementById('topTabAdminQbank');
    if(tab) tab.classList.add('active');
    showPanel('qbankPage');
    initQbankPage();
  }
}

/* ✅ 관리자 패널 내부 뷰 전환 (수정된 버전) */
function switchAdminTab(mode) {
    document.body.classList.toggle('admin-create-mode', mode === 'create');
    const sidebar = document.getElementById('adminFilterArea');
    const makerHeader = document.querySelector('.maker-header');
    const footer = document.getElementById('createFooter');
    const invSection = document.getElementById('inventorySection');
    const historySection = document.getElementById('adminHistoryView');
    const makerContent = document.querySelector('.maker-content');

    // 상단 탭 엘리먼트 (오류 방지를 위해 직접 참조)
    const tabCreate = document.getElementById('topTabAdminCreate');
    const tabHistory = document.getElementById('topTabAdminHistory');

    if (mode === 'create') {
        // [새 과제 출제 모드]
        if(sidebar) sidebar.style.display = 'block';
        if(makerHeader) makerHeader.style.display = 'flex';
        if(footer) footer.style.display = 'flex';
        if(invSection) invSection.style.display = 'flex';
        if(historySection) historySection.style.display = 'none';
        if(makerContent) {
            makerContent.style.display = 'flex';
            makerContent.style.width = ''; // 기본값 복구
        }
        
        // 탭 스타일 변경
        if(tabCreate) tabCreate.classList.add('active');
        if(tabHistory) tabHistory.classList.remove('active');
        
        renderInventoryTable();
    } else {
        // [배부 기록 모드]
        if(sidebar) sidebar.style.display = 'none';
        if(makerHeader) makerHeader.style.display = 'none';
        if(footer) footer.style.display = 'none';
        if(invSection) invSection.style.display = 'none';
        
        if(historySection) {
            historySection.style.setProperty('display', 'flex', 'important');
        }
        if(makerContent) {
            makerContent.style.display = 'flex';
            makerContent.style.width = '100%'; // 사이드바가 없으므로 넓게 확장
        }

        // 탭 스타일 변경
        if(tabCreate) tabCreate.classList.remove('active');
        if(tabHistory) tabHistory.classList.add('active');
        
        // 저장된 배부 기록을 즉시 보여주고, 최신 기록은 뒤에서 받아 바뀐 경우에만 다시 그립니다.
        loadAdminHistory();
    }
}

/* ===================== 시작 동작 ===================== */
let SOURCE_FILTERS_CACHE = null; // 필터 메타데이터 캐시
let LOGIN_PENDING = false; // 더블클릭/Enter 중복 로그인 요청 방지

// 로그인 유지 시간: 마지막으로 화면을 누른 뒤 30분. (새로고침해도 이 시간 안이면 로그인 유지)
const SESSION_MS = 30 * 60 * 1000;
// '이 기기에서 로그인 유지'를 고르면 7일 (개인 휴대폰용. 쓰는 동안 계속 늘어납니다)
const KEEP_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const sessionSpan = session => (session && session.keep ? KEEP_SESSION_MS : SESSION_MS);
// QR(#omr=…)로 들어왔을 때 로그인 뒤 열 과제
let PENDING_QR = null;
function takePendingQr() { const q = PENDING_QR; PENDING_QR = null; return q; }
let _sessionTouchedAt = 0;
// 화면을 쓰는 동안에는 유지 시간을 계속 늘립니다. (저장은 1분에 한 번만)
function touchSession() {
  if (!CURRENT_USER || !CURRENT_USER.id) return;
  const now = Date.now();
  if (now - _sessionTouchedAt < 60000) return;
  _sessionTouchedAt = now;
  try {
    const session = JSON.parse(localStorage.getItem('k2_session') || 'null');
    if (!session || !session.user || session.user.id !== CURRENT_USER.id) return;
    session.expiry = now + sessionSpan(session);
    localStorage.setItem('k2_session', JSON.stringify(session));
  } catch (e) {}
}

// ID 칸에서 Enter 한 번으로 로그인.
// 한글 입력 중에는 Enter가 '글자 조합 끝내기'로 먼저 쓰여 keydown이 무시되거나 두 번 오는 경우가 있어,
// 조합 중이 아닌 keydown 또는 keyup 중 먼저 오는 쪽으로 한 번만 로그인합니다.
function bindEnterLogin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('enterkeyhint', 'go');   // 휴대폰 키보드의 Enter 키를 '이동'으로 표시
  el.setAttribute('autocomplete', 'off');
  let firedAt = 0;
  const fire = () => {
    if (Date.now() - firedAt < 600) return;
    firedAt = Date.now();
    startQuizEntry();
  };
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.isComposing || e.keyCode === 229) return;   // 조합 중: keyup에서 처리
    fire();
  });
  el.addEventListener('keyup', e => {
    if (e.key === 'Enter' || e.keyCode === 13) fire();
  });
}

function startQuizEntry(){
  if (LOGIN_PENDING) return;
  const idInp = document.getElementById('headerUsername').value || document.getElementById('userIdInput').value;
  const inputId = idInp.trim();
  if(!inputId){ showCustomAlert('ID를 입력하십시오.'); return; }

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
    loadEl.querySelector('.loading-text').innerHTML = '로그인 중...';
    loadEl.classList.add('active');
  }

  if(hasGsRun()){
    LOGIN_PENDING = true;
    const onLoginFail = err => {
        LOGIN_PENDING = false;
        if(loadEl) loadEl.classList.remove('active');
        showCustomAlert('서버 오류: ' + err);
    };
    const onLoginResult = res => {
        LOGIN_PENDING = false;
        // 관리자 계정: 비밀번호 입력 창을 띄운 뒤 비밀번호와 함께 다시 로그인 요청
        if (res && (res.needPassword || res.passwordError)) {
           if(loadEl) loadEl.classList.remove('active');
           if (!window.NP) { showCustomAlert('화면 파일(notice-points.js)이 아직 올라가지 않았습니다.'); return; }
           NP.askPassword(!!res.firstTime, res.error || '').then(pw => {
               if (pw == null) return; // 취소
               if(loadEl) loadEl.classList.add('active');
               LOGIN_PENDING = true;
               google.script.run.withSuccessHandler(onLoginResult).withFailureHandler(onLoginFail)
                 .doLogin(inputId, true, pw);
           });
           return;
        }
        if(!res.success) {
           if(loadEl) loadEl.classList.remove('active');
           showCustomAlert('로그인 실패: ' + (res.error || '알 수 없는 오류'));
           return;
        }
        const { managedStudents, passwordCreated, ...user } = res;
        if (passwordCreated) showToast('관리자 비밀번호가 등록되었습니다.', 'success');
        CURRENT_USER = user;
        const keepChk = document.getElementById('keepLoginChk');
        const keep = !!(keepChk && keepChk.checked);
        try { localStorage.setItem('k2_keep_login', keep ? '1' : ''); } catch (e) {}
        localStorage.setItem('k2_session', JSON.stringify({
                user: user,
                keep: keep,
                expiry: Date.now() + (keep ? KEEP_SESSION_MS : SESSION_MS)
            }));
            
            syncLoginUI();
        document.getElementById('mainTabs').style.display = 'flex';

        if(user.role === 'manager') {
            const openManager = list => {
                // 이전 로그인 요청이 로그아웃/계정 전환 뒤 화면을 덮지 않도록 확인
                if (CURRENT_USER !== user) return;
                MANAGED_STUDENTS = Array.isArray(list) ? list : [];
                initAdminPage();
                if(loadEl) loadEl.classList.remove('active');
                routeTo('admin-create');
            };
            if (Array.isArray(managedStudents)) {
                openManager(managedStudents);
            } else {
                // GS를 먼저 교체하지 않은 환경도 기존 API로 동작
                google.script.run.withSuccessHandler(openManager)
                  .withFailureHandler(err => {
                      if(loadEl) loadEl.classList.remove('active');
                      showCustomAlert('학생 목록 로드 실패: ' + err);
                  }).getManagedStudents(user.id);
            }
        } else {
            if(loadEl) loadEl.classList.remove('active');
            const qr = takePendingQr();
            if (qr && typeof openAssignmentByQr === 'function') openAssignmentByQr(qr);
            else showPanel('studentMainPage');
        }
        prefetchAfterLogin(user);
    };
    google.script.run.withSuccessHandler(onLoginResult).withFailureHandler(onLoginFail)
      .doLogin(inputId, true);
  }
}

// [수정된 관리자 페이지 초기화 함수 - 불필요한 초기 블로킹 통신 제거]
function initAdminPage() {
    // 1. 학생 선택 드롭다운 즉시 채우기
    const selectEl = document.getElementById('targetStudentSelect');
    const weeklySelect = document.getElementById('weeklyStudentSelect');
    const optionsHtml = '<option value="">학생 선택</option>' + 
            MANAGED_STUDENTS.map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(s.name)} (${escapeHTML(s.id)})</option>`).join('');
    
    if(selectEl) selectEl.innerHTML = optionsHtml;
    if(weeklySelect) weeklySelect.innerHTML = optionsHtml;
    // 다른 관리자로 다시 로그인한 경우 이전 주간평가 화면을 비웁니다.
    if (typeof resetWeeklyView === 'function') resetWeeklyView();

    // 필터는 실제 사용 시 renderWkDefaultChips()에서 조회합니다.
    // 로그인 시에는 문제 인덱스나 필터 데이터를 읽지 않습니다.
}

/* ===================== 이벤트 바인딩 ===================== */
function buildGradeTemplate(containerId, groupPrefix, pYear, pMonth, pDetail, tabFnName, isWeeklyMode) {
  const container = document.getElementById(containerId);
  if(!container) return;
  const grades = [
    { id: 'm1', name: '중1' }, { id: 'm2', name: '중2' }, { id: 'm3', name: '중3' },
    { id: 'h1', name: '고1' }, { id: 'h2', name: '고2' }, { id: 'h3', name: '고3' }
  ];
  let html = '<div class="grade-tabs"';
  if(containerId === 'weeklyFilterContainer') html += ' id="weeklyGradeTabs"';
  if(containerId === 'studentFilterContainer') html += ' style="overflow-x:auto; white-space:nowrap; padding-bottom:4px;"';
  html += '>';
  grades.forEach((g, i) => html += `<div class="grade-tab ${i===0?'active':''}" onclick="${tabFnName}('${g.id}')">${g.name}</div>`);
  html += '</div>';
  
  const gridStyle = isWeeklyMode ? ' style="grid-template-columns:repeat(3,1fr); gap:4px;"' : '';
  grades.forEach((g, i) => {
    html += `<div id="${groupPrefix}${g.id}" class="grade-panel ${i===0?'active':''}">
               <div class="sub-label">${g.name} 년도</div><div id="${pYear}_${g.id}" class="chip-grid"${gridStyle}></div>
               <div class="sub-label">${g.name} 월/교재</div><div id="${pMonth}_${g.id}" class="chip-grid"${gridStyle}></div>`;
    if (pDetail) html += `<div class="sub-label">${g.name} 세부항목</div><div id="${pDetail}_${g.id}" class="chip-grid"${gridStyle}></div>`;
    html += `</div>`;
  });
  container.innerHTML = html;
}

/* ===================== 이벤트 바인딩 ===================== */
function initUI(){
  // [신규] 중복 HTML 동적 생성
  buildGradeTemplate('studentFilterContainer', 'gp_', 'yearChips', 'monthChips', 'detailChips', 'switchGradeTab', false);
  buildGradeTemplate('adminInvFilterContainer', 'inv_gp_', 'invYearChips', 'invMonthChips', 'invDetailChips', 'switchInvGradeTab', false);
  buildGradeTemplate('weeklyFilterContainer', 'wk_gp_', 'wkYearChips', 'wkMonthChips', null, 'switchWkGradeTab', true);

  // ✅ 요소가 없어도 죽지 않게 안전 바인딩 헬퍼
  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };

  // 1. 핵심 버튼 기능 연결
  on('btnStart', 'click', startQuizEntry);
  bindEnterLogin('userIdInput');
  
  on('btnHeaderLogin', 'click', startQuizEntry);
  bindEnterLogin('headerUsername');
  on('btnGoStart', 'click', () => { swrClearAll(); goStart(); });

  // 2. 상단 탭 연결
  on('topTabQuiz',  'click', ()=>routeTo('quiz'));
  on('topTabWrong', 'click', ()=>routeTo('wrong'));
  on('topTabVocab', 'click', ()=>routeTo('vocab'));
  on('topTabAssignment', 'click', ()=>routeTo('assignment'));

  // 3. 문제 풀기 화면 기능
  on('btnStartWithOptions', 'click', startQuizWithOptions);
  
  // ▼▼▼ [선생님께서 말씀하신 다음/이전 버튼 연결 부분] ▼▼▼
  on('btnPrevQ', 'click', prevSlide);
  on('btnNextQ', 'click', nextSlide); // 이 코드가 실행되어야 버튼이 작동합니다.
  on('btnGradeAll', 'click', gradeAll);

  // 4. 문제 목록(맵) 기능
on('btnShowMap', 'click', () => {
    const d = document.getElementById('questionMapDrawer');
    if (d && d.classList.contains('open')) {
      closeQuestionMap(); // 이미 열려 있으면 닫기
    } else {
      openQuestionMap();  // 닫혀 있으면 열기
    }
  });
  on('btnCloseMap', 'click', closeQuestionMap);

  // 5. 단어장 관련 기능

  // 6. 단어장 팝업(Drawer) 기능
  on('btnOpenVocab', 'click', toggleVocabDrawer); // 상단 '단어' 버튼: 미니 단어장 열기/닫기
  on('btnVocabDrawerClose', 'click', closeVocabDrawer);
  on('drawerOverlay', 'click', () => {
    closeVocabDrawer();
    closeQuestionMap();
    closeNavDrawer();
  });
  on('btnDrawerDict', 'click', () => {
    const el = document.getElementById('drawerWord');
    openDictionary(el ? el.value : '');
  });
  on('btnDrawerDictClose', 'click', closeDrawerDict);
  on('drawerWord', 'input', (e) => drawerCheckDuplicateInput(e.target));
  on('drawerWord', 'keydown', (e) => { if (e.key === 'Enter') { const m = document.getElementById('drawerMeaning'); if (m) m.focus(); } });
  on('drawerMeaning', 'keydown', (e) => { if (e.key === 'Enter') drawerSaveWord(); });
  on('btnDrawerSave', 'click', drawerSaveWord);


  // 7. 상단바 스크롤 자동 숨김 기능
  const header = document.getElementById('globalHeader');
  if (header) {
    let _lastScrollY = window.scrollY || 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY || 0;
      const diff = y - _lastScrollY;
      if (Math.abs(diff) < 8) return;
      if (diff > 0 && y > 80) header.classList.add('hide-on-scroll');
      else header.classList.remove('hide-on-scroll');
      _lastScrollY = y;
    }, { passive: true });
  }

  // 주간평가: 배부 버튼 / 학생 바꾸면 이전 표를 비우고 바로 새로 불러오기
  const finalWkSubmit = document.getElementById('btnSubmitWeeklyFinal');
  if (finalWkSubmit) finalWkSubmit.onclick = submitWeeklyFinal;
  const wkSelect = document.getElementById('weeklyStudentSelect');
  if (wkSelect) wkSelect.addEventListener('change', () => loadWeeklyStudentData());

  // 주간평가 메뉴 진입 시 데이터 자동 맵핑 트리거 바인딩
  const weeklyTabMenu = document.getElementById('topTabAdminWeekly');
  if (weeklyTabMenu) {
      weeklyTabMenu.addEventListener('click', function() {
          document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          showPanel('weeklyMakerPage');
          hideFooter();
          
          // 드롭다운 및 테이블 초기화 안내 상태 동기화
          const selectEl = document.getElementById('weeklyStudentSelect');
          if(selectEl && selectEl.value === "" && typeof resetWeeklyView === 'function') resetWeeklyView();
      });
  }

// 과제지 QR(#omr=…)로 들어온 경우: 기한이 지났으면 첫 화면으로, 아니면 로그인 뒤 그 과제 OMR을 엽니다.
  const qrInfo = typeof parseQrHash === 'function' ? parseQrHash(window.location.hash) : null;
  if (qrInfo) {
    if (window.history && window.history.replaceState) window.history.replaceState({ page: 'main' }, '', window.location.pathname + window.location.search);
    if (qrInfo.expired) setTimeout(() => showToast('QR 기한(1주일)이 지났습니다. 첫 화면으로 이동했습니다. 과제는 [과제] 목록에서 열어 주세요.', 'error'), 300);
    else PENDING_QR = qrInfo;
  }
  // 로그인 유지 체크는 지난번 선택을 기억합니다.
  try { const kc = document.getElementById('keepLoginChk'); if (kc) kc.checked = localStorage.getItem('k2_keep_login') === '1'; } catch (e) {}

// [신규] 앱 초기화 시 자동 로그인(Auto-Login) 낚아채기
  const savedSessionStr = localStorage.getItem('k2_session');
  let autoLoginSuccess = false;
  
  if (savedSessionStr) {
      try {
          const session = JSON.parse(savedSessionStr);
          // 관리자는 비밀번호 인증(token)이 있는 세션만 복구합니다.
          const sessionOk = session.user && (session.user.role !== 'manager' || !!session.user.token);
          if (sessionOk && Date.now() < session.expiry) {
              // 유지 시간이 지나지 않았다면 타이머를 다시 연장하고 계정 복구
              session.expiry = Date.now() + sessionSpan(session);
              localStorage.setItem('k2_session', JSON.stringify(session));
              
              CURRENT_USER = session.user;
              syncLoginUI();
              const mainTabs = document.getElementById('mainTabs');
              if (mainTabs) mainTabs.style.display = 'flex';
              
              // 새로고침 시 주소(#vocab, #assignment 등)에 맞는 화면으로 복원
              restorePageFromHash(CURRENT_USER);
              prefetchAfterLogin(CURRENT_USER);
              autoLoginSuccess = true;
          } else {
              localStorage.removeItem('k2_session'); // 유지 시간 초과 시 파기
          }
      } catch(e) {}
  }

  // 세션이 없거나 만료된 경우에만 로그인 화면으로 쫓아냄
  if (!autoLoginSuccess) {
      goStart();
      if (PENDING_QR) setTimeout(() => showToast('로그인하면 QR의 과제 OMR이 바로 열립니다.', 'info'), 300);
  }

  bindInventoryEvents();

  // 사용 중에는 로그인 유지 시간을 연장
  ['click', 'keydown', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, touchSession, { passive: true, capture: true }));

  on('btnMobileMenu', 'click', openNavDrawer);
  on('btnCloseNav', 'click', closeNavDrawer);

  // ★ [추가] 모바일 뒤로가기 제스처(popstate) 감지 및 라우팅 복원
  window.addEventListener('popstate', function(event) {
    if (!CURRENT_USER) return; 
    
    // 브라우저 뒤로가기 시 상태를 읽고 화면 복원
    if (event.state && event.state.page) {
        if (event.state.page === 'main') {
            showPanel('studentMainPage');
            document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
            hideFooter();
        } else {
            routeTo(event.state.page, true); // true = isPopState 플래그 전달 (중복 기록 방지)
        }
    } else {
        // state가 없는 경우 (초기 진입 화면)
        if (CURRENT_USER.role === 'manager') {
            routeTo('admin-create', true);
        } else {
            showPanel('studentMainPage');
            document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
            hideFooter();
        }
    }
  });
} // <--- initUI 함수 끝

// [수정] 앱 초기화 로직: 초기 진입 시 불필요한 getConfusingWordsFromSheet 호출 제거 (지연 로딩 적용)
function initApp() {
    if(typeof google !== 'undefined' && google.script && google.script.url) {
        google.script.url.getLocation(function(location) {
            if (location.parameters && location.parameters.report) {
                // [공유 모드] 로그인 창 및 헤더를 숨기고 곧바로 리포트만 렌더링
                document.getElementById('globalHeader').style.display = 'none';
                document.getElementById('startPage').classList.remove('active');
                const reportId = location.parameters.report[0];
                openWeeklyReport(reportId, true); 
            } else {
                // [일반 모드] 정상적인 로그인 화면 표시
                initUI(); 
            }
        });
    } else {
        initUI();
    }
}

// DOMContentLoaded가 이미 지난 경우까지 커버
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}



/* ===================== 로그인 직후 미리 받기 =====================
 * 사용자가 메뉴를 누르기 전에 자주 여는 화면의 데이터를 뒤에서 받아 둡니다.
 * 요청이 끝나기 전에 메뉴를 눌러도 같은 요청을 공유하므로 두 번 보내지 않습니다.
 */
let VOCAB_PREFETCH = null;
function prefetchAfterLogin(user) {
  if (!user || !user.id || !hasGsRun()) return;
  // 화면 전환·로딩과 겹치지 않도록 조금 뒤에 시작
  setTimeout(() => {
    if (CURRENT_USER !== user) return;
    if (user.role === 'manager') {
      swrPrefetch('adminHistory:3m', user.id, 'getAllAssignmentsForAdmin', ['', false]);
      // 문항 목록을 미리 확인/저장해 두면 첫 '불러오기'에서 학생 통계만 기다리면 됩니다.
      if (typeof loadQuestionMeta === 'function') loadQuestionMeta().catch(() => {});
      return;
    }
    swrPrefetch('myAssignments', user.id, 'getAllMyAssignments', [user]);
    swrPrefetch('sourceFilters', 'global', 'getSourceFiltersAndTypes', []);
    // 단어장은 낙관적 수정과 충돌하지 않도록 메모리(VOCAB_CACHE)가 비어 있을 때만 채웁니다.
    if (!VOCAB_CACHE && !VOCAB_PREFETCH) {
      VOCAB_PREFETCH = new Promise(resolve => {
        google.script.run.withSuccessHandler(data => {
          if (CURRENT_USER === user && !VOCAB_CACHE && Array.isArray(data)) VOCAB_CACHE = data;
          resolve();
        }).withFailureHandler(() => resolve()).getVocabulary(user);
      }).then(() => { VOCAB_PREFETCH = null; });
    }
  }, 300);
}


/* ===================== 새로고침 시 주소에 맞는 화면 복원 =====================
 * 주소 끝의 #표시(예: #vocab)가 그 사용자 역할에서 열 수 있는 화면이면 그 화면을,
 * 아니면 첫 화면(학생: 메인 메뉴 / 관리자: 과제출제)을 엽니다.
 * 문제 풀이·OMR 화면은 주소가 따로 없으므로 그 화면을 열었던 목록(예: 과제 목록)으로 돌아갑니다.
 */
const STUDENT_PAGES = ['quiz', 'wrong', 'vocab', 'assignment'];
const ADMIN_PAGES = ['admin-create', 'admin-history', 'weekly', 'admin-vocab', 'admin-qbank'];

function restorePageFromHash(user) {
  const mode = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
  const goTo = (page) => {
    // 새로고침 후 뒤로가기가 자연스럽도록 현재 기록을 교체(새 기록을 쌓지 않음)
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ page: page }, '', '#' + page);
    }
    routeTo(page, true);
  };

  if (user.role === 'manager') {
    takePendingQr();   // QR 과제는 학생 계정에서만 엽니다
    // 관리자 화면은 담당 학생 목록이 필요하므로 받는 동안 로딩 표시
    const loadEl = document.getElementById('loadingOverlay');
    if (loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '관리자 화면을 여는 중...';
      loadEl.classList.add('active');
    }
    google.script.run.withSuccessHandler(list => {
      if (CURRENT_USER !== user) return;
      if (loadEl) loadEl.classList.remove('active');
      MANAGED_STUDENTS = list || [];
      initAdminPage();
      goTo(ADMIN_PAGES.includes(mode) ? mode : 'admin-create');
    }).withFailureHandler(err => {
      if (loadEl) loadEl.classList.remove('active');
      showCustomAlert('학생 목록 로드 실패: ' + err);
      goTo(ADMIN_PAGES.includes(mode) ? mode : 'admin-create');
    }).getManagedStudents(user.id);
    return;
  }

  const qr = takePendingQr();
  if (qr && typeof openAssignmentByQr === 'function') { openAssignmentByQr(qr); return; }
  if (STUDENT_PAGES.includes(mode)) {
    goTo(mode);
  } else {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ page: 'main' }, '', window.location.pathname + window.location.search);
    }
    showPanel('studentMainPage');
    document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
    hideFooter();
  }
}
