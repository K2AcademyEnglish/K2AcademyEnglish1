/* ===================== 단어장 ===================== */
// 메인 단어장과 드로어가 같은 VOCAB_CACHE(app-core.js)를 공유합니다.
function vocabList(){ return Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : []; }
let VOCAB_TYPO = {};
let VOCAB_TYPO_READY = false;

function vocabInitTypoOnce(){
  if(VOCAB_TYPO_READY) return;
  if(!hasGsRun()) return;
  google.script.run.withSuccessHandler(function(data){
    VOCAB_TYPO = data || {};
    VOCAB_TYPO_READY = true;
  }).getTypoCorrections();
}
function vocabCorrectTypo(word){
  const lower = String(word||'').toLowerCase();
  return VOCAB_TYPO[lower] || word;
}
let ADMIN_TARGET_VOCAB_USER = null;

function getActiveVocabUser() {
  if (CURRENT_USER && CURRENT_USER.role === 'manager' && ADMIN_TARGET_VOCAB_USER) {
    return ADMIN_TARGET_VOCAB_USER;
  }
  return CURRENT_USER;
}

function initAdminVocabMode() {
  const bar = document.getElementById('adminVocabBar');
  const addSec = document.getElementById('vocabAddWordSection');
  
  if (CURRENT_USER && CURRENT_USER.role === 'manager') {
    if (bar) bar.style.display = 'flex';
    // 관리자도 단어를 직접 추가/수정할 수 있도록 단어 추가 섹션 노출
    if (addSec) addSec.style.display = 'block';
    
    // 관리 학생 드롭다운 채우기
    const sel = document.getElementById('adminVocabStudentSelect');
    if (sel && MANAGED_STUDENTS.length > 0 && sel.children.length <= 1) {
      sel.innerHTML = '<option value="">학생 선택</option>' + 
        MANAGED_STUDENTS.map(s => `<option value="${escapeAttr(s.id)}" data-name="${escapeAttr(s.name)}">${escapeHTML(s.name)} (${escapeHTML(s.id)})</option>`).join('');
    }
    
    // 만약 선택된 학생이 없다면 빈 상태 유지
    if (!ADMIN_TARGET_VOCAB_USER) {
      document.getElementById('wordList').innerHTML = '<div style="padding:40px; text-align:center; color:#6b7280;">조회할 학생을 선택해 주십시오.</div>';
      document.getElementById('vocabStats').style.display = 'none';
      return;
    }
    // 이미 고른 학생이 있으면 그 학생 단어장을 다시 표시 (불러온 데이터 재사용)
    vocabLoadWordList();
  } else {
    if (bar) bar.style.display = 'none';
    if (addSec) addSec.style.display = 'block';
    vocabLoadWordList();
  }
}

function onAdminVocabStudentChange(id) {
  if (!id) {
    ADMIN_TARGET_VOCAB_USER = null;
    document.getElementById('wordList').innerHTML = '<div style="padding:40px; text-align:center; color:#6b7280;">조회할 학생을 선택해 주십시오.</div>';
    document.getElementById('vocabStats').style.display = 'none';
    return;
  }
  const sel = document.getElementById('adminVocabStudentSelect');
  const opt = sel.options[sel.selectedIndex];
  const name = opt.getAttribute('data-name');
  
  ADMIN_TARGET_VOCAB_USER = { id: id, name: name };
  VOCAB_CACHE = null; // 캐시 초기화 후 새로 로드
  vocabLoadWordList(true);
}

// 학생 본인 또는 관리자가 선택한 학생의 단어장을 불러오는 통합 함수
function vocabLoadWordList(forceReload){
  const targetUser = getActiveVocabUser();
  if(!targetUser) return;
  vocabInitTypoOnce();
  // 시험 도중 다른 화면에 갔다 오거나 학생을 바꾸면 목록 화면으로 복귀
  const studyBox = document.getElementById('vocabStudy');
  if (studyBox && studyBox.style.display !== 'none' && typeof _vtShowStudy === 'function') { _vtShowStudy(false); studyBox.innerHTML = ''; }

  // 1. 이미 불러온 데이터(캐시)가 있으면 재요청 없이 바로 렌더링
  if(!forceReload && VOCAB_CACHE) {
      const statsEl = document.getElementById('vocabStats');
      const addSecEl = document.getElementById('vocabAddWordSection');
      if(statsEl) statsEl.style.display = 'block';
      if(addSecEl) addSecEl.style.display = 'block';

      renderVocabTableFromData(VOCAB_CACHE);
      vocabUpdateStats();
      return;
  }

  // 2. 로그인 직후 미리 받기가 진행 중이면 그 결과를 기다립니다(중복 요청 방지)
  if(!forceReload && typeof VOCAB_PREFETCH !== 'undefined' && VOCAB_PREFETCH && targetUser === CURRENT_USER) {
    const box = document.getElementById('wordList');
    if (box) box.innerHTML = inlineLoadingHTML('단어장을 펼치는 중...');
    VOCAB_PREFETCH.then(() => { if (getActiveVocabUser() === targetUser) vocabLoadWordList(); });
    return;
  }

  // 3. 서버에서 단어 목록 로드 (화면 전체를 막지 않고 목록 자리에만 로딩 표시)
  if(!hasGsRun()){ showCustomAlert('서버 연결에 문제가 있습니다.'); return; }

  const loadEl = null;
  const listBox = document.getElementById('wordList');
  if (listBox) { listBox.style.display = 'block'; listBox.innerHTML = inlineLoadingHTML('단어장을 펼치는 중...'); }

  const statsEl = document.getElementById('vocabStats');
  const addSecEl = document.getElementById('vocabAddWordSection');
  if(statsEl) statsEl.style.display = 'block';
  if(addSecEl) addSecEl.style.display = 'block';

  vocabUpdateStats();

  google.script.run.withSuccessHandler(function(data) {
    if(loadEl) loadEl.classList.remove('active');
    if (getActiveVocabUser() !== targetUser) return; // 그 사이 학생 변경/로그아웃
    VOCAB_CACHE = data; 
    renderVocabTableFromData(data);
  }).withFailureHandler(err => {
    if(loadEl) loadEl.classList.remove('active');
    showCustomAlert('단어장 불러오기 오류: ' + err);
  }).getVocabulary(targetUser);
}

let _vocabNewWordTimer = null;


/* ===================== 단어 수정/저장 기능 ===================== */





function vocabUpdateStats(){
  const targetUser = getActiveVocabUser();
  if(!targetUser) return;

  // 브라우저 환경 표준 KST 날짜 계산 (Utilities 참조 오류 제거)
  const now = new Date();
  const kstDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

  google.script.run.withSuccessHandler(function(logData) {
    const arr = Array.isArray(logData) ? logData : [];
    const todayAdded = arr.filter(d => d.action === 'add' && d.date === kstDateStr).length;
    const todayMemorized = arr.filter(d => d.action === 'memorize' && d.date === kstDateStr).length;

    const todayQuiz = parseInt(sessionStorage.getItem('vocab_todayQuiz') || '0', 10);
    const todayCorrect = parseInt(sessionStorage.getItem('vocab_todayCorrect') || '0', 10);

    const addEl = document.getElementById('todayAdded');
    const memoEl = document.getElementById('todayMemorized');
    const qEl = document.getElementById('todayQuiz');
    const cEl = document.getElementById('todayCorrect');

    if(addEl) addEl.innerText = todayAdded;
    if(memoEl) memoEl.innerText = todayMemorized;
    if(qEl) qEl.innerText = todayQuiz;
    if(cEl) cEl.innerText = todayCorrect;
  }).getDailyLogs(targetUser, kstDateStr); // 오늘 기록만 받아 전송량을 줄입니다
}
  
function vocabUpdateQuizStats(correct, total){
  const todayQuiz = parseInt(sessionStorage.getItem('vocab_todayQuiz') || '0', 10) + total;
  const todayCorrect = parseInt(sessionStorage.getItem('vocab_todayCorrect') || '0', 10) + correct;
  sessionStorage.setItem('vocab_todayQuiz', String(todayQuiz));
  sessionStorage.setItem('vocab_todayCorrect', String(todayCorrect));

  document.getElementById('todayQuiz').innerText = todayQuiz;
  document.getElementById('todayCorrect').innerText = todayCorrect;
}
function vocabSearchNaverDict(){
  const word = document.getElementById('newWord').value.trim();
  if (!word) { showCustomAlert('검색할 단어를 입력하십시오!'); return; }
  const iframe = document.getElementById('dictFrame');
  const container = document.getElementById('dictContainer');
  const searchUrl = 'https://en.dict.naver.com/#/search?query=' + encodeURIComponent(word);
  iframe.src = searchUrl;
  container.style.display = 'block';
}

function setVocabFabVisible(visible){
  const fab = document.getElementById('btnVocabDrawerFab');
  if (fab) fab.style.display = visible ? 'block' : 'none';
}

function openNavDrawer() {
  const d = document.getElementById('navDrawer'); // 아까 만든 aside 태그 찾기
  const o = document.getElementById('drawerOverlay'); // 검은 배경 찾기
  if(d) d.classList.add('open'); // 'open' 클래스를 붙여서 화면에 보이게 함
  if(o) o.style.display = 'block'; // 배경을 어둡게 처리
}

/* [신규 추가] 좌측 메뉴바 닫기 함수 */
function closeNavDrawer() {
  const d = document.getElementById('navDrawer');
  const o = document.getElementById('drawerOverlay');
  if(d) d.classList.remove('open'); // 'open' 클래스를 떼서 숨김
  if(o) o.style.display = 'none'; // 배경 어두운 것 제거
}

// opts: { word, resultEl, onPick(word) } — 단어장 펼침 영역처럼 입력칸 없이 호출할 때 사용
function fetchDatamuse(type, isMain, opts) {
  opts = opts || {};
  const inputId = isMain ? 'newWord' : 'drawerDictWord';
  const resultId = isMain ? 'datamuseResultMain' : 'datamuseResult';
  
  const inputEl = document.getElementById(inputId);
  const word = (opts.word != null ? String(opts.word) : (inputEl ? inputEl.value : '')).trim();
  const resultBox = opts.resultEl || document.getElementById(resultId);
  if (!resultBox) return;
  if (!word) {
    resultBox.innerHTML = '<span style="color:#dc2626;">단어를 먼저 입력하십시오.</span>';
    return;
  }

  resultBox.innerHTML = '검색 중...';

  // [수정] 1순위: 자체 DB 기반 연관어(혼동어휘) 탐색
  if (type === 'trg') {
    const lowerWord = word.toLowerCase();
    let foundGroup = null;
    
  // 혼동어휘 DB가 아직 로드되지 않았다면 최초 1회 로드 후 재실행
    if ((!CONFUSING_WORDS_DB || CONFUSING_WORDS_DB.length === 0) && hasGsRun()) {
      google.script.run.withSuccessHandler(data => {
        CONFUSING_WORDS_DB = data || [];
        fetchDatamuse(type, isMain, opts);
      }).getConfusingWordsFromSheet();
      return;
    }
    if (typeof CONFUSING_WORDS_DB !== 'undefined' && Array.isArray(CONFUSING_WORDS_DB)) {
      foundGroup = CONFUSING_WORDS_DB.find(group => group.some(w => w.toLowerCase() === lowerWord));
    }
    
    if (foundGroup) {
      resultBox.innerHTML = '';
      // 본인 단어를 제외한 짝꿍 단어들만 추출
      const displayData = foundGroup.filter(w => w.toLowerCase() !== lowerWord);
      
      displayData.forEach(w => {
        const chip = document.createElement('span');
        chip.textContent = w;
        chip.style.cssText = 'background:#f3f4f6; padding:6px 12px; border-radius:8px; cursor:pointer; border:1px solid #2b6cb0; font-weight:bold; color:#2b6cb0;';
        
        chip.onmouseover = function() { this.style.background = '#e5e7eb'; };
        chip.onmouseout = function() { this.style.background = '#f3f4f6'; };
        chip.onclick = function() {
          if (opts.onPick) { opts.onPick(w, chip); return; }
          document.getElementById(inputId).value = w;
          if (isMain) vocabSearchNaverDict();
          else drawerSearchDict(w);
          resultBox.innerHTML = ''; 
        };
        resultBox.appendChild(chip);
      });
      return; // 자체 DB에서 결과를 찾은 경우 API 호출 우회 및 종료
    }
  }

  // [수정] 2순위: 자체 DB에 없거나 type이 다른 경우 외부 API 우회 (Fallback)
  let endpoints = [];
  if (type === 'syn') {
      endpoints.push('https://api.datamuse.com/words?rel_syn=' + encodeURIComponent(word) + '&max=15');
  } else if (type === 'ant') {
      endpoints.push('https://api.datamuse.com/words?rel_ant=' + encodeURIComponent(word) + '&max=15');
  } else if (type === 'trg') {
      const rootLen = Math.max(3, word.length - 2);
      const rootSp = word.substring(0, rootLen) + '*';
      endpoints.push('https://api.datamuse.com/words?sp=' + encodeURIComponent(rootSp) + '&max=15');
      endpoints.push('https://api.datamuse.com/words?rel_cns=' + encodeURIComponent(word) + '&max=15');
      endpoints.push('https://api.datamuse.com/words?sl=' + encodeURIComponent(word) + '&max=15');
  }

  Promise.all(endpoints.map(url => fetch(url).then(res => res.json())))
    .then(results => {
      resultBox.innerHTML = '';
      
      let combined = [];
      results.forEach(arr => {
          if(arr && arr.length) combined = combined.concat(arr);
      });
      
      const uniqueWords = new Set();
      const finalData = [];
      const lowerWord = word.toLowerCase();

      combined.forEach(item => {
          const w = item.word.toLowerCase();
          if (w !== lowerWord && !w.includes(' ') && !uniqueWords.has(w)) {
              uniqueWords.add(w);
              finalData.push(item);
          }
      });

      finalData.sort((a, b) => (b.score || 0) - (a.score || 0));
      const displayData = finalData.slice(0, 15);

      if (displayData.length === 0) {
        resultBox.innerHTML = '결과 없음';
        return;
      }
      
      displayData.forEach(item => {
        const chip = document.createElement('span');
        chip.textContent = item.word;
        chip.style.cssText = 'background:#f3f4f6; padding:6px 12px; border-radius:8px; cursor:pointer; border:1px solid #d1d5db; font-weight:bold; color:#1f2937;';
        
        chip.onmouseover = function() { this.style.background = '#e5e7eb'; };
        chip.onmouseout = function() { this.style.background = '#f3f4f6'; };

        chip.onclick = function() {
          if (opts.onPick) { opts.onPick(item.word, chip); return; }
          document.getElementById(inputId).value = item.word;
          if (isMain) {
            vocabSearchNaverDict(); 
          } else {
            drawerSearchDict(item.word); 
          }
          resultBox.innerHTML = ''; 
        };
        
        resultBox.appendChild(chip);
      });
    })
    .catch(err => {
      resultBox.innerHTML = '<span style="color:#dc2626;">API 호출 오류</span>';
    });
}

let _drawerNewWordTimer = null;
function drawerCheckDuplicateInput(el) {
    clearTimeout(_drawerNewWordTimer);
    const statusBox = document.getElementById('drawerWordStatus');
    if (!statusBox) return;

    _drawerNewWordTimer = setTimeout(() => {
        const rawQuery = el.value.trim().toLowerCase();
        if (!rawQuery) {
            statusBox.innerText = '';
            return;
        }

        const query = String(vocabCorrectTypo(rawQuery)).toLowerCase();
        const cacheToUse = vocabList();
        const duplicate = cacheToUse.find(item => String(item.word || '').toLowerCase() === query);

        if (duplicate) {
            statusBox.innerHTML = `💡 이미 등록된 단어 (뜻: <b>${escapeHTML(duplicate.meaning)}</b>)`;
            statusBox.style.color = '#d97706';
        } else {
            statusBox.innerHTML = '<span style="color:#6b7280;">추천 뜻을 불러오는 중...</span>';
            if (hasGsRun()) {
                google.script.run
                    .withSuccessHandler(function(translated) {
                        if (translated && document.getElementById('drawerWord').value.trim().toLowerCase() === rawQuery) {
                            const meanings = translated.split(',').map(s => s.trim()).filter(Boolean);
                            let html = '<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">' + 
                                       '<span style="color:#2b6cb0; font-weight:bold; margin-right:4px;">추천: </span>';
                            
                            meanings.forEach(m => {
                                const safeM = m.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                html += `<button type="button" style="padding:4px 8px; font-size:12px; background:#eff6ff; color:#2b6cb0; border:1px solid #2b6cb0; border-radius:6px; cursor:pointer;" ` +
                                        `onclick="const inp = document.getElementById('drawerMeaning'); let val = inp.value.trim(); ` +
                                        `if(val) { if(!val.includes('${safeM}')) inp.value = val + ', ' + '${safeM}'; } else { inp.value = '${safeM}'; } ` +
                                        `this.style.background='#dbeafe';">` +
                                        escapeHTML(m) + `</button>`;
                            });
                            html += '</div>';
                            statusBox.innerHTML = html;
                        } else {
                            statusBox.innerText = '';
                        }
                    })
                    .withFailureHandler(function(err) {
                        statusBox.innerText = '';
                    })
                    .getWordTranslation(query);
            } else {
                statusBox.innerText = '';
            }
        }
    }, 300);
}



/* =====================================================================
 * 미니 단어장 (문제 풀이 중) — 오른쪽 고정 패널(PC) / 아래 시트(휴대폰)
 * - 지문 단어 더블클릭/길게 누르기 → 단어 카드(추천 뜻 → 저장)
 * - 저장은 화면에 즉시 반영하고 서버 저장은 뒤에서 순서대로 처리
 * - '이번에 저장한 단어'는 학생별로 이 탭(sessionStorage)에 보관
 * ===================================================================== */
let VOCAB_SAVE_CHAIN = Promise.resolve();
const MINI_DICT_URL = 'https://en.dict.naver.com/#/search?query=';
const MEANING_SUGGEST_CACHE = new Map();

function _miniWordsKey() { return 'k2_mini_words:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function getMiniWords() {
  try { return JSON.parse(sessionStorage.getItem(_miniWordsKey()) || '[]'); } catch (e) { return []; }
}
function setMiniWords(list) {
  try { sessionStorage.setItem(_miniWordsKey(), JSON.stringify(list.slice(0, 200))); } catch (e) {}
}
function rememberMiniWord(word, meaning) {
  const list = getMiniWords().filter(x => x.word !== word);
  list.unshift({ word: word, meaning: meaning, ts: Date.now() });
  setMiniWords(list);
  renderMiniWordList();
}

// 서버 순서 보장 저장 (실패 시 안내)
function _queueVocabServer(funcName, args, failMsg) {
  VOCAB_SAVE_CHAIN = VOCAB_SAVE_CHAIN
    .then(() => gsCall(funcName, args))
    .then(res => { if (typeof res === 'string' && res.indexOf('오류') === 0) throw res; })
    .catch(err => { showToast((failMsg || '단어 저장 실패') + ': ' + escapeHTML(String(err)), 'error'); });
}

/**
 * 단어 빠른 저장 (미니 단어장·단어 카드 공통)
 * 반환: { ok, status:'new'|'merged'|'exists', word, meaning, msg }
 * 서버(addWordToFormAndSheet)가 중복 단어의 뜻 합치기를 직접 처리하므로 항상 같은 함수로 보냅니다.
 */
function vocabQuickSave(rawWord, rawMeaning) {
  if (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER) {
    return { ok: false, msg: '단어를 추가할 학생을 먼저 선택해 주십시오.' };
  }
  const user = getActiveVocabUser(); // 학생 본인 또는 관리자가 고른 학생
  if (!user || !user.id) return { ok: false, msg: '로그인이 필요합니다.' };
  const word = String(vocabCorrectTypo(String(rawWord || '').trim()) || '').trim().toLowerCase();
  const inputMeanings = String(rawMeaning || '').split(',').map(m => m.trim()).filter(Boolean);
  if (!word || !inputMeanings.length) return { ok: false, msg: '단어와 뜻을 모두 입력해 주십시오.' };

  let merged = inputMeanings.join(', '), status = 'new';
  if (Array.isArray(VOCAB_CACHE)) {
    const dup = VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === word);
    if (dup) {
      const existing = String(dup.meaning || '').split(',').map(m => m.trim()).filter(Boolean);
      const lowerSet = new Set(existing.map(m => m.toLowerCase()));
      const added = inputMeanings.filter(m => !lowerSet.has(m.toLowerCase()));
      if (!added.length) {
        if (user === CURRENT_USER) rememberMiniWord(word, dup.meaning);
        return { ok: true, status: 'exists', word: word, meaning: dup.meaning };
      }
      merged = existing.concat(added).join(', ');
      dup.meaning = merged;
      status = 'merged';
    } else {
      VOCAB_CACHE.push({ number: VOCAB_CACHE.length + 1, word: word, meaning: merged, memorized: false });
    }
  }
  if (user === CURRENT_USER) rememberMiniWord(word, merged);
  _queueVocabServer('addWordToFormAndSheet', [user, word, inputMeanings.join(', ')], '단어 저장 실패');
  if (status === 'new') { const el = document.getElementById('todayAdded'); if (el) el.textContent = (parseInt(el.textContent, 10) || 0) + 1; }
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: { word: word } }));
  return { ok: true, status: status, word: word, meaning: merged };
}

// 이번에 저장한 단어 수정 (단어·뜻 전체 교체)
function vocabQuickEdit(oldWord, newWordRaw, newMeaningRaw) {
  const user = getActiveVocabUser();
  const newWord = String(newWordRaw || '').trim().toLowerCase();
  const newMeaning = String(newMeaningRaw || '').split(',').map(m => m.trim()).filter(Boolean).join(', ');
  if (!user || !newWord || !newMeaning) return false;
  if (Array.isArray(VOCAB_CACHE)) {
    const item = VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === oldWord);
    if (item) { item.word = newWord; item.meaning = newMeaning; }
  }
  if (user === CURRENT_USER) {
    setMiniWords(getMiniWords().map(x => x.word === oldWord ? { word: newWord, meaning: newMeaning, ts: x.ts } : x));
    renderMiniWordList();
  }
  _queueVocabServer('editWord', [user, oldWord, newWord, newMeaning], '단어 수정 실패');
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: { word: newWord } }));
  return true;
}

// 단어 삭제 (선생님 단어장조회 전용). 화면에서 먼저 지우고, 서버 저장이 실패하면 목록을 다시 불러옵니다.
function vocabDeleteWord(word) {
  const user = getActiveVocabUser();
  if (!user || !(CURRENT_USER && CURRENT_USER.role === 'manager')) return;
  const lower = String(word || '').toLowerCase();
  if (Array.isArray(VOCAB_CACHE)) {
    const idx = VOCAB_CACHE.findIndex(x => String(x.word || '').toLowerCase() === lower);
    if (idx >= 0) {
      const removedNo = Number(VOCAB_CACHE[idx].number) || 0;
      VOCAB_CACHE.splice(idx, 1);
      // 시트 행 번호와 맞도록 뒤 단어의 번호를 하나씩 당김
      if (removedNo) VOCAB_CACHE.forEach(x => { if (Number(x.number) > removedNo) x.number = Number(x.number) - 1; });
    }
  }
  if (VP.open === lower) VP.open = null;
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: {} }));
  VOCAB_SAVE_CHAIN = VOCAB_SAVE_CHAIN
    .then(() => gsCall('deleteWord', [user, word]))
    .then(res => {
      if (res && res.error) throw res.error;
      showToast('단어를 삭제했습니다.', 'info');
    })
    .catch(err => {
      const msg = isMissingServerFunction(err) ? '서버(Code.gs)를 새 버전으로 배포해야 삭제할 수 있습니다.' : escapeHTML(String(err && err.message || err));
      showToast('단어 삭제 실패: ' + msg, 'error');
      vocabLoadWordList(true); // 실제 단어장 상태로 되돌림
    });
}

function renderMiniWordList() {
  const box = document.getElementById('drawerSessionList');
  const cnt = document.getElementById('drawerSessionCount');
  if (!box) return;
  const list = getMiniWords();
  if (cnt) cnt.textContent = list.length;
  if (!list.length) {
    box.innerHTML = '<div class="drawer-muted">아직 저장한 단어가 없습니다.</div>';
    return;
  }
  box.innerHTML = list.map(x => `
    <div class="vd-item" data-word="${escapeHTML(x.word).replace(/"/g, '&quot;')}">
      <div class="vd-item-main"><b>${escapeHTML(x.word)}</b><span>${escapeHTML(x.meaning)}</span></div>
      <button type="button" class="vd-btn vd-btn-mini" data-act="edit">수정</button>
    </div>`).join('');
}

function _onMiniListClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const item = btn.closest('.vd-item');
  const word = item ? item.dataset.word : '';
  if (!item) return;
  if (btn.dataset.act === 'edit') {
    const cur = getMiniWords().find(x => x.word === word) || { word: word, meaning: '' };
    item.classList.add('editing');
    item.innerHTML = `
      <div class="vd-edit">
        <input type="text" class="vd-edit-word" value="${escapeHTML(cur.word).replace(/"/g, '&quot;')}">
        <input type="text" class="vd-edit-meaning" value="${escapeHTML(cur.meaning).replace(/"/g, '&quot;')}">
        <div class="vd-edit-actions">
          <button type="button" class="vd-btn vd-btn-ghost" data-act="cancel">취소</button>
          <button type="button" class="vd-btn vd-btn-primary" data-act="save">저장</button>
        </div>
      </div>`;
  } else if (btn.dataset.act === 'cancel') {
    renderMiniWordList();
  } else if (btn.dataset.act === 'save') {
    const w = item.querySelector('.vd-edit-word').value;
    const m = item.querySelector('.vd-edit-meaning').value;
    if (!vocabQuickEdit(word, w, m)) showToast('단어와 뜻을 모두 입력해 주십시오.', 'error');
    else showToast('단어를 수정했습니다.', 'info');
  }
}

// 단어장 원본(중복 확인용)이 없으면 뒤에서 한 번 받아 둡니다.
function drawerEnsureLoaded() {
  if (!CURRENT_USER || Array.isArray(VOCAB_CACHE)) return;
  if (typeof VOCAB_PREFETCH !== 'undefined' && VOCAB_PREFETCH) return;
  const user = CURRENT_USER;
  gsCall('getVocabulary', [user]).then(data => {
    if (CURRENT_USER === user && !Array.isArray(VOCAB_CACHE) && Array.isArray(data)) VOCAB_CACHE = data;
  }).catch(() => {});
}

function isVocabDrawerOpen() {
  const d = document.getElementById('vocabDrawer');
  return !!(d && d.classList.contains('open'));
}
function openVocabDrawer() {
  const d = document.getElementById('vocabDrawer');
  if (!d) return;
  d.classList.add('open');
  document.body.classList.add('vocab-dock-open');
  renderMiniWordList();
  drawerEnsureLoaded();
  vocabInitTypoOnce();
}
function closeVocabDrawer() {
  const d = document.getElementById('vocabDrawer');
  if (d) d.classList.remove('open');
  document.body.classList.remove('vocab-dock-open');
  closeDrawerDict();
}
function toggleVocabDrawer() { isVocabDrawerOpen() ? closeVocabDrawer() : openVocabDrawer(); }

// 사전: PC는 미니 단어장 안에서, 휴대폰은 새 탭으로 크게 엽니다.
function openDictionary(word) {
  const w = String(word || '').trim();
  if (!w) { showToast('사전에서 찾을 단어를 입력하십시오.', 'info'); return; }
  const url = MINI_DICT_URL + encodeURIComponent(w);
  const quizActive = document.getElementById('quizPage') && document.getElementById('quizPage').classList.contains('active');
  if (window.innerWidth < 821 || !quizActive) { window.open(url, '_blank', 'noopener'); return; }
  if (!isVocabDrawerOpen()) openVocabDrawer();
  const wrap = document.getElementById('drawerDictWrap');
  const frame = document.getElementById('drawerDictFrame');
  const title = document.getElementById('drawerDictTitle');
  if (title) title.textContent = '네이버 사전: ' + w;
  if (frame) frame.src = url;
  if (wrap) wrap.style.display = 'block';
}
function closeDrawerDict() {
  const wrap = document.getElementById('drawerDictWrap');
  const frame = document.getElementById('drawerDictFrame');
  if (wrap) wrap.style.display = 'none';
  if (frame && frame.src && frame.src !== 'about:blank') frame.src = 'about:blank';
}
// 기존 호출부 호환 (fetchDatamuse 등)
function drawerSearchDict(word) {
  const wEl = document.getElementById('drawerWord');
  if (wEl && word) wEl.value = String(word).trim();
  openDictionary(word);
}

// 미니 단어장 '저장' 버튼
function drawerSaveWord() {
  const wEl = document.getElementById('drawerWord');
  const mEl = document.getElementById('drawerMeaning');
  const st = document.getElementById('drawerSaveStatus');
  const r = vocabQuickSave(wEl ? wEl.value : '', mEl ? mEl.value : '');
  if (!r.ok) { if (st) st.textContent = r.msg; return; }
  if (st) {
    st.textContent = r.status === 'exists' ? `'${r.word}'은(는) 이미 같은 뜻으로 저장되어 있습니다.`
                   : r.status === 'merged' ? `'${r.word}'에 새 뜻을 추가했습니다.`
                   : `'${r.word}' 저장했습니다.`;
    clearTimeout(drawerSaveWord._t);
    drawerSaveWord._t = setTimeout(() => { st.textContent = ''; }, 2500);
  }
  if (wEl) wEl.value = '';
  if (mEl) mEl.value = '';
  const sBox = document.getElementById('drawerWordStatus');
  if (sBox) sBox.innerHTML = '';
  if (wEl) wEl.focus();
}

function vocabResetMiniDrawer() {
  closeVocabDrawer();
  hideWordPopover();
  ['drawerWord', 'drawerMeaning'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['drawerWordStatus', 'drawerSaveStatus', 'drawerSessionList'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
  const cnt = document.getElementById('drawerSessionCount'); if (cnt) cnt.textContent = '0';
}

/* ---------------- 지문 단어 카드 (더블클릭 / 길게 누르기) ---------------- */
const WORD_PICK_RE = /^[A-Za-z][A-Za-z'\-]*(?: [A-Za-z][A-Za-z'\-]*){0,3}$/;
let _wordPickTimer = null;
let _wordPopRange = null;

function fetchMeaningSuggestions(word) {
  const key = word.toLowerCase();
  if (MEANING_SUGGEST_CACHE.has(key)) return MEANING_SUGGEST_CACHE.get(key);
  const p = gsCall('getWordTranslation', [key])
    .then(t => String(t || '').split(',').map(x => x.trim()).filter(Boolean))
    .catch(() => []);
  MEANING_SUGGEST_CACHE.set(key, p);
  return p;
}

function _ensureWordPopover() {
  let pop = document.getElementById('wordPopover');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'wordPopover';
  pop.className = 'word-popover no-print';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `
    <div class="wp-head">
      <input type="text" class="wp-word" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="단어">
      <button type="button" class="wp-btn wp-close" aria-label="닫기">✕</button>
    </div>
    <div class="wp-status"></div>
    <div class="wp-chips"></div>
    <input type="text" class="wp-meaning" placeholder="뜻 (추천 뜻을 누르거나 직접 입력)" autocomplete="off">
    <div class="wp-actions">
      <button type="button" class="wp-btn wp-dict">사전</button>
      <button type="button" class="wp-btn wp-save">단어장에 저장</button>
    </div>`;
  document.body.appendChild(pop);

  pop.addEventListener('mousedown', e => e.stopPropagation());
  pop.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  pop.querySelector('.wp-close').addEventListener('click', hideWordPopover);
  pop.querySelector('.wp-dict').addEventListener('click', () => openDictionary(pop.querySelector('.wp-word').value));
  pop.querySelector('.wp-save').addEventListener('click', _saveFromPopover);
  pop.querySelector('.wp-meaning').addEventListener('keydown', e => { if (e.key === 'Enter') _saveFromPopover(); });
  let editTimer = null;
  pop.querySelector('.wp-word').addEventListener('input', e => {
    clearTimeout(editTimer);
    editTimer = setTimeout(() => _fillWordPopover(e.target.value.trim()), 400);
  });
  pop.querySelector('.wp-chips').addEventListener('click', e => {
    const chip = e.target.closest('.wp-chip');
    if (!chip) return;
    const inp = pop.querySelector('.wp-meaning');
    const parts = inp.value.split(',').map(x => x.trim()).filter(Boolean);
    const m = chip.dataset.m;
    const idx = parts.indexOf(m);
    if (idx >= 0) parts.splice(idx, 1); else parts.push(m);
    inp.value = parts.join(', ');
    chip.classList.toggle('on', idx < 0);
  });
  return pop;
}

function _fillWordPopover(word) {
  const pop = _ensureWordPopover();
  const status = pop.querySelector('.wp-status');
  const chips = pop.querySelector('.wp-chips');
  pop.querySelector('.wp-meaning').value = '';
  chips.innerHTML = '';
  if (!word) { status.innerHTML = '<span class="wp-sub">영어 단어를 입력하면 추천 뜻이 나옵니다.</span>'; return; }
  const lower = String(vocabCorrectTypo(word) || word).toLowerCase();
  const dup = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === lower) : null;
  status.innerHTML = dup
    ? `📘 이미 저장된 단어: <b>${escapeHTML(dup.meaning)}</b><br><span class="wp-sub">새 뜻을 고르면 추가됩니다.</span>`
    : '<span class="wp-sub">추천 뜻을 불러오는 중...</span>';
  fetchMeaningSuggestions(lower).then(list => {
    if (pop.querySelector('.wp-word').value.trim().toLowerCase() !== word.toLowerCase()) return; // 그 사이 단어 변경
    if (!dup) status.innerHTML = list.length ? '<span class="wp-sub">추천 뜻을 눌러 고르십시오.</span>' : '<span class="wp-sub">추천 뜻이 없습니다. 직접 입력해 주십시오.</span>';
    chips.innerHTML = list.map(m => `<button type="button" class="wp-chip" data-m="${escapeHTML(m).replace(/"/g, '&quot;')}">${escapeHTML(m)}</button>`).join('');
  });
}

function _positionWordPopover() {
  const pop = document.getElementById('wordPopover');
  if (!pop || pop.style.display === 'none') return;
  const vv = window.visualViewport;
  const viewH = vv ? vv.height : window.innerHeight;
  const viewTop = vv ? vv.offsetTop : 0;
  if (window.innerWidth < 821) {
    // 휴대폰: 화면 아래쪽 카드 (키보드가 올라오면 그 위로)
    pop.classList.add('wp-sheet');
    pop.style.left = ''; pop.style.top = '';
    pop.style.bottom = Math.max(8, window.innerHeight - (viewH + viewTop) + 8) + 'px';
    return;
  }
  pop.classList.remove('wp-sheet');
  pop.style.bottom = '';
  if (!_wordPopRange) return;
  const rect = _wordPopRange.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let top = rect.bottom + 8;
  if (top + h > viewH - 8) top = rect.top - h - 8;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
  pop.style.top = Math.max(8, top) + 'px';
  pop.style.left = left + 'px';
}

// anchor: 선택 범위(Range) 또는 기준 요소(버튼 등). 단어가 비어 있으면 단어 입력부터 시작합니다.
function showWordPopover(word, anchor) {
  const pop = _ensureWordPopover();
  _wordPopRange = anchor ? (anchor.cloneRange ? anchor.cloneRange() : anchor) : null;
  pop.querySelector('.wp-word').value = word || '';
  pop.style.display = 'block';
  _fillWordPopover(word || '');
  _positionWordPopover();
  vocabInitTypoOnce();
  drawerEnsureLoaded();
  if (!word) setTimeout(() => pop.querySelector('.wp-word').focus(), 0);
}
// 카드를 닫을 때 지문의 단어 선택도 해제합니다(휴대폰에서 선택이 남아 카드가 다시 뜨는 것 방지).
function hideWordPopover() {
  const pop = document.getElementById('wordPopover');
  const wasOpen = pop && pop.style.display !== 'none';
  if (pop) pop.style.display = 'none';
  _wordPopRange = null;
  if (wasOpen) {
    try {
      const sel = window.getSelection();
      const node = sel && sel.anchorNode;
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (el && el.closest('#quizPage')) sel.removeAllRanges();
    } catch (e) {}
  }
}

function _saveFromPopover() {
  const pop = _ensureWordPopover();
  const word = pop.querySelector('.wp-word').value;
  const meaning = pop.querySelector('.wp-meaning').value;
  const r = vocabQuickSave(word, meaning);
  if (!r.ok) { showToast(r.msg, 'error'); return; }
  showToast(r.status === 'exists' ? `'${escapeHTML(r.word)}'은(는) 이미 저장되어 있습니다.`
          : r.status === 'merged' ? `'${escapeHTML(r.word)}'에 새 뜻을 추가했습니다.`
          : `'${escapeHTML(r.word)}' 단어장에 저장했습니다.`, r.status === 'exists' ? 'info' : 'success');
  hideWordPopover();
}

// 지문(문제 풀이 화면) 안에서 영어 단어가 선택되면 단어 카드를 띄웁니다.
function _checkWordSelection() {
  if (!CURRENT_USER || CURRENT_USER.role === 'manager') return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const text = sel.toString().replace(/[’‘]/g, "'").trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
  if (!text || text.length > 40 || !WORD_PICK_RE.test(text)) return;
  const node = sel.anchorNode;
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  if (!el || !el.closest('#quizPage') || el.closest('input, textarea, button, .omr-options-wrap, .op-opt, .op-font-bar')) return;
  showWordPopover(text, sel.getRangeAt(0));
}

function initPassageWordPicker() {
  const schedule = (delay) => { clearTimeout(_wordPickTimer); _wordPickTimer = setTimeout(_checkWordSelection, delay); };
  document.addEventListener('mouseup', e => { if (!e.target.closest || !e.target.closest('#wordPopover')) schedule(200); });
  document.addEventListener('touchend', () => schedule(450));
  // 휴대폰에서 길게 눌러 선택 범위를 조정할 때
  document.addEventListener('selectionchange', () => { if (window.innerWidth < 821) schedule(600); });
  // 카드 밖을 누르면 닫기
  const outside = e => { if (!e.target.closest || !e.target.closest('#wordPopover')) hideWordPopover(); };
  document.addEventListener('mousedown', outside);
  document.addEventListener('touchstart', outside, { passive: true });
  window.addEventListener('scroll', _positionWordPopover, { passive: true });
  window.addEventListener('resize', _positionWordPopover);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', _positionWordPopover);
  const list = document.getElementById('drawerSessionList');
  if (list) list.addEventListener('click', _onMiniListClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideWordPopover(); });
}
initPassageWordPicker();


/* =====================================================================
 * 단어장 페이지 목록 (검색 · 보기 탭 · 정렬 · 가리기 · 펼쳐 보기 · 이어서 보기)
 * 데이터는 VOCAB_CACHE(학생 본인 또는 관리자가 고른 학생)를 사용합니다.
 * ===================================================================== */
const VP_PAGE = 80;
const VP = { filter: 'all', sort: 'recent', hideMeaning: false, hideWord: false, query: '', shown: VP_PAGE, open: null };
let _vpBound = false, _vpObserver = null;

function _escAttr(v) { return escapeHTML(String(v == null ? '' : v)).replace(/"/g, '&quot;'); }
function _vpPrefsKey() { return 'k2_vocab_view:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function _vpLoadPrefs() {
  try {
    const o = JSON.parse(localStorage.getItem(_vpPrefsKey()) || '{}');
    if (['all', 'learning', 'done'].includes(o.filter)) VP.filter = o.filter;
    if (['recent', 'old', 'abc'].includes(o.sort)) VP.sort = o.sort;
    VP.hideMeaning = !!o.hideMeaning; VP.hideWord = !!o.hideWord;
  } catch (e) {}
}
function _vpSavePrefs() {
  try { localStorage.setItem(_vpPrefsKey(), JSON.stringify({ filter: VP.filter, sort: VP.sort, hideMeaning: VP.hideMeaning, hideWord: VP.hideWord })); } catch (e) {}
}

function _vpSyncControls() {
  document.querySelectorAll('#vpTabs .vp-tab').forEach(b => b.classList.toggle('on', b.dataset.filter === VP.filter));
  const sort = document.getElementById('vpSort'); if (sort) sort.value = VP.sort;
  document.querySelectorAll('#vocabPage .vp-toggle').forEach(b => {
    b.classList.toggle('on', b.dataset.hide === 'meaning' ? VP.hideMeaning : VP.hideWord);
  });
}

function _vpFiltered(data) {
  const q = VP.query;
  let list = data.filter(x => {
    if (VP.filter === 'learning' && x.memorized) return false;
    if (VP.filter === 'done' && !x.memorized) return false;
    if (!q) return true;
    return String(x.word || '').toLowerCase().includes(q) || String(x.meaning || '').toLowerCase().includes(q);
  });
  const num = x => Number(x.number) || 0;
  if (VP.sort === 'recent') list.sort((a, b) => num(b) - num(a));
  else if (VP.sort === 'old') list.sort((a, b) => num(a) - num(b));
  else list.sort((a, b) => String(a.word || '').localeCompare(String(b.word || '')));
  return list;
}

// 외움 표시는 단어 시험 결과로만 바뀝니다. 학생의 단어 목록에서는 상태만 보여 주고,
// 선생님(단어장조회)만 목록에서 직접 체크할 수 있습니다.
function _vpCanToggleMemo() { return !!(CURRENT_USER && CURRENT_USER.role === 'manager'); }
function _vpMemoHtml(x) {
  if (_vpCanToggleMemo()) {
    return `<label class="vw-check" title="외움 표시">
      <input type="checkbox" class="vw-memo" ${x.memorized ? 'checked' : ''} aria-label="외움">
      <span>외움</span>
    </label>`;
  }
  return `<span class="vw-check vw-check-ro${x.memorized ? ' on' : ''}" title="단어 시험에서 맞히면 외움으로 표시됩니다">${x.memorized ? '✅ 외움' : '외우는 중'}</span>`;
}
function _vpRowHtml(x) {
  const w = String(x.word || '');
  const open = VP.open === w.toLowerCase();
  return `
  <div class="vw-row${x.memorized ? ' done' : ''}${open ? ' open' : ''}" data-word="${_escAttr(w)}">
    <div class="vw-num">${escapeHTML(String(x.number || ''))}</div>
    <div class="vw-main">
      <div class="vw-word" title="눌러서 펼치기">${escapeHTML(w)}</div>
      <div class="vw-meaning">${escapeHTML(String(x.meaning || ''))}</div>
    </div>
    ${_vpMemoHtml(x)}
    ${open ? _vpDetailHtml() : ''}
  </div>`;
}
function _vpDetailHtml() {
  return `
    <div class="vw-detail">
      <div class="vw-actions">
        <button type="button" class="vw-btn" data-act="dict">사전</button>
        <button type="button" class="vw-btn" data-act="syn">유의어</button>
        <button type="button" class="vw-btn" data-act="ant">반의어</button>
        <button type="button" class="vw-btn" data-act="trg">혼동어휘</button>
        <button type="button" class="vw-btn vw-btn-edit" data-act="edit">수정</button>
        ${_vpCanToggleMemo() ? '<button type="button" class="vw-btn vw-btn-del" data-act="delete">삭제</button>' : ''}
      </div>
      <div class="vw-related"></div>
      <div class="vw-editbox"></div>
    </div>`;
}

function _vpUpdateCounts(data) {
  const done = data.filter(x => x.memorized).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('vpCntAll', data.length); set('vpCntLearning', data.length - done); set('vpCntDone', done);
}

function renderVocabPage(keepShown) {
  const box = document.getElementById('wordList');
  if (!box) return;
  _vpBindOnce();
  _vpSyncControls();
  box.classList.toggle('vp-hide-meaning', VP.hideMeaning);
  box.classList.toggle('vp-hide-word', VP.hideWord);

  const data = VOCAB_CACHE;
  if (data && data.error) { box.innerHTML = '<div class="vw-empty">⚠️ ' + escapeHTML(data.error) + '</div>'; return; }
  if (!Array.isArray(data)) return;
  _vpUpdateCounts(data);
  if (!keepShown) VP.shown = VP_PAGE;

  const list = _vpFiltered(data);
  if (!list.length) {
    box.innerHTML = data.length === 0
      ? '<div class="vw-empty">아직 저장한 단어가 없습니다.<br><span>[+ 단어 추가] 또는 문제 풀이 중 지문의 단어를 더블클릭해서 모아 보십시오.</span></div>'
      : '<div class="vw-empty">조건에 맞는 단어가 없습니다.</div>';
  } else {
    const rows = list.slice(0, VP.shown).map(_vpRowHtml).join('');
    const rest = list.length - VP.shown;
    box.innerHTML = '<div class="vw-head"><span></span><span>영어</span><span>뜻</span><span>외움</span></div>' + rows +
      (rest > 0 ? `<button type="button" class="vw-more vw-btn" data-act="more">더 보기 (${rest}개 남음)</button>` : '');
  }
  box.style.display = 'block';
  const elQuiz = document.getElementById('quiz'); if (elQuiz) elQuiz.innerHTML = '';
  const elScore = document.getElementById('score'); if (elScore) elScore.innerText = '';
  const elShowBtn = document.getElementById('showListBtn'); if (elShowBtn) elShowBtn.style.display = 'none';
  _vpObserveMore();
}

// 기존 호출부 호환: 데이터 인자는 무시하고 VOCAB_CACHE 기준으로 다시 그립니다.
function renderVocabTableFromData() { renderVocabPage(false); }

// '더 보기' 버튼이 화면에 들어오면 자동으로 이어서 표시
function _vpObserveMore() {
  if (!('IntersectionObserver' in window)) return;
  if (_vpObserver) _vpObserver.disconnect();
  const more = document.querySelector('#wordList .vw-more');
  if (!more) return;
  _vpObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { VP.shown += VP_PAGE; renderVocabPage(true); }
  }, { rootMargin: '300px 0px' });
  _vpObserver.observe(more);
}

let _vocabSearchTimer = null;
function vocabOnSearchInput(el) {
  clearTimeout(_vocabSearchTimer);
  _vocabSearchTimer = setTimeout(() => {
    VP.query = el.value.trim().toLowerCase();
    renderVocabPage(false);
  }, 200);
}

function _vpFindItem(word) {
  const lower = String(word || '').toLowerCase();
  return Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === lower) : null;
}

function _vpSetMemorized(row, checked) {
  if (!_vpCanToggleMemo()) return; // 학생은 목록에서 외움을 바꿀 수 없음
  const targetUser = getActiveVocabUser();
  const item = _vpFindItem(row.dataset.word);
  if (!targetUser || !item) return;
  item.memorized = checked;
  row.classList.toggle('done', checked);
  _vpUpdateCounts(VOCAB_CACHE);
  if (checked) { const el = document.getElementById('todayMemorized'); if (el) el.textContent = (parseInt(el.textContent, 10) || 0) + 1; }
  google.script.run
    .withFailureHandler(err => showToast('외움 표시 저장 실패: ' + escapeHTML(String(err)), 'error'))
    .setWordMemorized(targetUser, item.word, checked);
}

function _vpHandleAction(row, btn) {
  const word = row.dataset.word;
  const related = row.querySelector('.vw-related');   // 유의어·반의어·혼동어휘 결과
  const editBox = row.querySelector('.vw-editbox');   // 수정 입력칸 (늦게 오는 검색 결과가 덮어쓰지 않도록 분리)
  const act = btn.dataset.act;
  if (act === 'dict') { openDictionary(word); return; }
  if (act === 'syn' || act === 'ant' || act === 'trg') {
    related.style.display = 'flex';
    // 고른 연관어는 단어 카드로 열어 바로 저장할 수 있게
    fetchDatamuse(act, true, { word: word, resultEl: related, onPick: (w, chip) => showWordPopover(w, chip) });
    return;
  }
  if (act === 'edit') {
    const item = _vpFindItem(word) || { word: word, meaning: '' };
    editBox.innerHTML = `
      <div class="vw-edit">
        <input type="text" class="vw-edit-word" value="${_escAttr(item.word)}" aria-label="단어">
        <input type="text" class="vw-edit-meaning" value="${_escAttr(item.meaning)}" aria-label="뜻">
        <div class="vw-edit-actions">
          <button type="button" class="vw-btn" data-act="cancel">취소</button>
          <button type="button" class="vw-btn vw-btn-primary" data-act="save">저장</button>
        </div>
      </div>`;
    editBox.querySelector('.vw-edit-meaning').focus();
    return;
  }
  if (act === 'cancel') { editBox.innerHTML = ''; return; }
  if (act === 'delete') {
    if (!_vpCanToggleMemo()) return;
    const item = _vpFindItem(word);
    if (!item) return;
    showCustomConfirm(`'${escapeHTML(item.word)}' 단어를 이 학생의 단어장에서 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`, () => vocabDeleteWord(item.word));
    return;
  }
  if (act === 'save') {
    const nw = row.querySelector('.vw-edit-word').value;
    const nm = row.querySelector('.vw-edit-meaning').value;
    if (!vocabQuickEdit(String(word).toLowerCase(), nw, nm)) { showToast('단어와 뜻을 모두 입력해 주십시오.', 'error'); return; }
    VP.open = String(nw).trim().toLowerCase();
    showToast('단어를 수정했습니다.', 'info');
  }
}

function _vpBindOnce() {
  if (_vpBound) return;
  _vpBound = true;
  _vpLoadPrefs();
  const box = document.getElementById('wordList');
  box.addEventListener('change', e => {
    if (e.target.classList.contains('vw-memo')) _vpSetMemorized(e.target.closest('.vw-row'), e.target.checked);
  });
  box.addEventListener('click', e => {
    const more = e.target.closest('[data-act="more"]');
    if (more) { VP.shown += VP_PAGE; renderVocabPage(true); return; }
    const row = e.target.closest('.vw-row');
    if (!row || e.target.closest('.vw-check')) return;
    const btn = e.target.closest('button[data-act]');
    if (btn) { _vpHandleAction(row, btn); return; }
    if (e.target.closest('.vw-detail')) return;
    // 가린 칸은 누르면 보이기
    const masked = e.target.closest(box.classList.contains('vp-hide-meaning') ? '.vw-meaning' : '.vw-none') ||
                   e.target.closest(box.classList.contains('vp-hide-word') ? '.vw-word' : '.vw-none');
    if (masked && !masked.classList.contains('revealed')) { masked.classList.add('revealed'); return; }
    // 그 외: 펼치기/접기
    const key = String(row.dataset.word || '').toLowerCase();
    const wasOpen = row.classList.contains('open');
    document.querySelectorAll('#wordList .vw-row.open').forEach(r => {
      r.classList.remove('open'); const d = r.querySelector('.vw-detail'); if (d) d.remove();
    });
    VP.open = wasOpen ? null : key;
    if (!wasOpen) { row.classList.add('open'); row.insertAdjacentHTML('beforeend', _vpDetailHtml()); }
  });

  document.querySelectorAll('#vpTabs .vp-tab').forEach(b => b.addEventListener('click', () => {
    VP.filter = b.dataset.filter; _vpSavePrefs(); renderVocabPage(false);
  }));
  const sort = document.getElementById('vpSort');
  if (sort) sort.addEventListener('change', () => { VP.sort = sort.value; _vpSavePrefs(); renderVocabPage(false); });
  document.querySelectorAll('#vocabPage .vp-toggle').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.hide === 'meaning') { VP.hideMeaning = !VP.hideMeaning; if (VP.hideMeaning) VP.hideWord = false; }
    else { VP.hideWord = !VP.hideWord; if (VP.hideWord) VP.hideMeaning = false; }
    _vpSavePrefs(); renderVocabPage(true);
  }));
  const addBtn = document.getElementById('btnVocabAdd');
  if (addBtn) addBtn.addEventListener('click', () => {
    if (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER) { showCustomAlert('단어를 추가할 학생을 먼저 선택해 주십시오.'); return; }
    showWordPopover('', addBtn);
  });
  // 단어 카드·미니 단어장에서 저장/수정되면 목록 갱신 (현재 보던 개수 유지)
  document.addEventListener('vocab:changed', () => {
    const page = document.getElementById('vocabPage');
    if (page && page.classList.contains('active')) renderVocabPage(true);
  });
}


/* =====================================================================
 * 단어 시험 (설정 → 한 문제씩 → 결과)
 * 방식: card(카드 넘기기) / choice(객관식 4지선다) / write(주관식)
 * 방향: e2k(영어 → 뜻) / k2e(뜻 → 영어)
 * 객관식 오답 보기는 학생 본인 단어장의 다른 단어에서 뽑습니다.
 * ===================================================================== */
const VT = { items: [], idx: 0, mode: 'choice', dir: 'e2k', correct: 0, wrong: [], answered: false, choices: [] };
const VT_DEFAULT = { scope: 'recent', recentN: 30, rangeFrom: 1, rangeTo: 50, count: 10, mode: 'choice', dir: 'e2k', skipDone: true };

function _vtPrefsKey() { return 'k2_vocab_test:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function _vtLoadPrefs() {
  try { return Object.assign({}, VT_DEFAULT, JSON.parse(localStorage.getItem(_vtPrefsKey()) || '{}')); }
  catch (e) { return Object.assign({}, VT_DEFAULT); }
}
function _vtSavePrefs(p) { try { localStorage.setItem(_vtPrefsKey(), JSON.stringify(p)); } catch (e) {} }
function _shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function _vtBox() { return document.getElementById('vocabStudy'); }

// 시험 화면 ↔ 목록 화면 전환
function _vtShowStudy(on) {
  const box = _vtBox();
  const controls = document.getElementById('vocabAddWordSection');
  const list = document.getElementById('wordList');
  if (box) box.style.display = on ? 'block' : 'none';
  if (controls) controls.classList.toggle('vt-hidden', on);
  if (list) list.classList.toggle('vt-hidden', on);
  if (on) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function vocabStudyExit() {
  _vtShowStudy(false);
  const box = _vtBox(); if (box) box.innerHTML = '';
  renderVocabPage(true);
}

// 범위에 맞는 단어 모음
function _vtPool(p) {
  const data = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE.filter(x => String(x.word || '').trim() && String(x.meaning || '').trim()) : [];
  const num = x => Number(x.number) || 0;
  if (p.scope === 'learning') return data.filter(x => !x.memorized);
  if (p.scope === 'range') {
    // 단어 번호 n번 ~ m번 (앞뒤를 거꾸로 넣어도 동작)
    const lo = Math.min(p.rangeFrom | 0, p.rangeTo | 0), hi = Math.max(p.rangeFrom | 0, p.rangeTo | 0);
    const inRange = data.filter(x => num(x) >= lo && num(x) <= hi);
    return (p.skipDone ? inRange.filter(x => !x.memorized) : inRange).sort((a, b) => num(a) - num(b));
  }
  if (p.scope === 'visible') {
    const visible = _vpFiltered(data);
    return p.skipDone ? visible.filter(x => !x.memorized) : visible;
  }
  const base = p.skipDone ? data.filter(x => !x.memorized) : data;
  return base.slice().sort((a, b) => num(b) - num(a)).slice(0, Math.max(1, p.recentN | 0));
}

function vocabStudyOpenSetup() {
  if (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER) { showCustomAlert('학생을 먼저 선택해 주십시오.'); return; }
  if (!Array.isArray(VOCAB_CACHE)) { showToast('단어장을 불러오는 중입니다. 잠시 후 다시 눌러 주십시오.', 'info'); return; }
  const p = _vtLoadPrefs();
  const box = _vtBox();
  const isMgr = !!(CURRENT_USER && CURRENT_USER.role === 'manager');   // 인쇄 버튼은 관리자에게만
  const maxNo = (Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : []).reduce((m, x) => Math.max(m, Number(x.number) || 0), 0);
  const radio = (name, val, label, cur) => `<label class="vt-opt"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''}><span>${label}</span></label>`;
  box.innerHTML = `
    <div class="vt-card vt-setup">
      <div class="vt-setup-head"><b>📝 단어 시험</b><button type="button" class="vt-btn" data-vt="exit">닫기</button></div>
      <div class="vt-field">
        <div class="vt-label">범위</div>
        <div class="vt-opts">
          ${radio('vtScope', 'recent', `최근 추가 <input type="number" id="vtRecentN" min="1" value="${p.recentN}">개`, p.scope)}
          ${radio('vtScope', 'range', `번호 <input type="number" id="vtRangeFrom" min="1" value="${p.rangeFrom}">번 ~ <input type="number" id="vtRangeTo" min="1" value="${p.rangeTo}">번 <span class="vt-pool-info">(1 ~ ${maxNo}번까지 있습니다)</span>`, p.scope)}
          ${radio('vtScope', 'learning', '외우는 중인 단어 전체', p.scope)}
          ${radio('vtScope', 'visible', '지금 목록에 보이는 단어 (검색·탭 기준)', p.scope)}
        </div>
        <label class="vt-check"><input type="checkbox" id="vtSkipDone" ${p.skipDone ? 'checked' : ''}> 외운 단어는 빼기</label>
      </div>
      <div class="vt-field">
        <div class="vt-label">방식</div>
        <div class="vt-opts vt-row">
          ${radio('vtMode', 'card', '카드 넘기기', p.mode)}
          ${radio('vtMode', 'choice', '객관식', p.mode)}
          ${radio('vtMode', 'write', '주관식', p.mode)}
        </div>
      </div>
      <div class="vt-field">
        <div class="vt-label">방향</div>
        <div class="vt-opts vt-row">
          ${radio('vtDir', 'e2k', '영어 → 뜻', p.dir)}
          ${radio('vtDir', 'k2e', '뜻 → 영어', p.dir)}
        </div>
      </div>
      <div class="vt-field vt-inline">
        <div class="vt-label">문제 수</div>
        <input type="number" id="vtCount" min="1" value="${p.count}"> <span class="vt-pool-info" id="vtPoolInfo"></span>
      </div>
      <div class="vt-known-opt" style="display:none; font-size:12px; color:#64748b;">카드 넘기기는 연습용입니다. 외움 표시는 객관식·주관식 시험에서 맞혀야 바뀝니다.</div>
      <div class="vt-start-row">
        <button type="button" class="vt-btn vt-btn-primary vt-start" data-vt="start">시작하기</button>
        ${isMgr ? `<button type="button" class="vt-btn vt-print" data-vt="print">🖨️ 시험지 인쇄</button>
        <button type="button" class="vt-btn vt-print" data-vt="list">📖 단어장 인쇄</button>` : ''}
      </div>
      <div class="vt-print-note" style="${isMgr ? '' : 'display:none;'}">시험지 인쇄: 문제지와 정답지가 함께 인쇄됩니다. 카드 넘기기는 인쇄할 수 없습니다.<br>단어장 인쇄: 범위 안 단어 전체를 번호순으로, 한 쪽에 2단 100개씩 인쇄합니다. (문제 수와 관계없음)</div>
    </div>`;
  const readPrefs = () => ({
    scope: (box.querySelector('input[name="vtScope"]:checked') || {}).value || 'recent',
    recentN: Math.max(1, parseInt(box.querySelector('#vtRecentN').value, 10) || VT_DEFAULT.recentN),
    rangeFrom: Math.max(1, parseInt(box.querySelector('#vtRangeFrom').value, 10) || 1),
    rangeTo: Math.max(1, parseInt(box.querySelector('#vtRangeTo').value, 10) || 1),
    count: Math.max(1, parseInt(box.querySelector('#vtCount').value, 10) || VT_DEFAULT.count),
    mode: (box.querySelector('input[name="vtMode"]:checked') || {}).value || 'choice',
    dir: (box.querySelector('input[name="vtDir"]:checked') || {}).value || 'e2k',
    skipDone: box.querySelector('#vtSkipDone').checked
  });
  const refresh = () => {
    const pr = readPrefs();
    const n = _vtPool(pr).length;
    box.querySelector('#vtPoolInfo').textContent = `(범위 안 단어 ${n}개 중 ${Math.min(n, pr.count)}문제)`;
    box.querySelector('.vt-known-opt').style.display = pr.mode === 'card' ? 'block' : 'none';
    // 카드 넘기기는 인쇄 불가: 인쇄 버튼을 흐리게 막아 둡니다.
    const printBtn = box.querySelector('[data-vt="print"]');
    if (printBtn) printBtn.disabled = pr.mode === 'card';
    if (printBtn) printBtn.classList.toggle('vt-print-off', pr.mode === 'card');
    if (printBtn) printBtn.title = pr.mode === 'card' ? '카드 넘기기는 인쇄할 수 없습니다. 객관식이나 주관식을 골라 주십시오.' : '';
    box.querySelector('#vtSkipDone').closest('.vt-check').style.display = pr.scope === 'learning' ? 'none' : 'flex';
  };
  box.querySelectorAll('input').forEach(el => { el.addEventListener('change', refresh); el.addEventListener('input', refresh); });
  // 범위 칸 안의 숫자 입력을 누르면 그 범위를 선택
  box.querySelector('#vtRecentN').addEventListener('focus', () => { box.querySelector('input[name="vtScope"][value="recent"]').checked = true; refresh(); });
  ['#vtRangeFrom', '#vtRangeTo'].forEach(sel => box.querySelector(sel).addEventListener('focus', () => { box.querySelector('input[name="vtScope"][value="range"]').checked = true; refresh(); }));
  box.onclick = e => {
    const b = e.target.closest('[data-vt]'); if (!b) return;
    if (b.dataset.vt === 'exit') vocabStudyExit();
    if (b.dataset.vt === 'start') { const pr = readPrefs(); _vtSavePrefs(pr); vocabStudyStart(pr); }
    if (b.dataset.vt === 'print') { if (b.disabled) return; const pr = readPrefs(); _vtSavePrefs(pr); vocabStudyPrint(pr); }
    if (b.dataset.vt === 'list') { const pr = readPrefs(); _vtSavePrefs(pr); vocabListPrint(pr); }
  };
  refresh();
  _vtShowStudy(true);
}

function vocabStudyStart(p, itemsOverride) {
  const pool = itemsOverride || _vtPool(p);
  if (!pool.length) { showToast('범위 안에 시험 볼 단어가 없습니다.', 'error'); return; }
  const all = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : [];
  if (p.mode === 'choice') {
    const keyOf = x => String(p.dir === 'e2k' ? x.meaning : x.word).trim().toLowerCase();
    if (new Set(all.map(keyOf)).size < 4) { showToast('객관식은 서로 다른 단어가 4개 이상 있어야 합니다.', 'error'); return; }
  }
  Object.assign(VT, {
    items: itemsOverride ? _shuffle(pool) : _shuffle(pool).slice(0, p.count),
    idx: 0, mode: p.mode, dir: p.dir, correct: 0, wrong: [], right: [], unmarked: [], answered: false, prefs: p
  });
  _vtShowStudy(true);
  _vtRenderQuestion();
}

function _vtPrompt(item, dir) { return (dir || VT.dir) === 'e2k' ? item.word : item.meaning; }
function _vtAnswer(item, dir) { return (dir || VT.dir) === 'e2k' ? item.meaning : item.word; }
// 정답 1개 + 학생 단어장의 다른 단어 3개로 4지선다 보기 생성 (같은 뜻/철자는 중복 제외)
function _vtMakeChoices(item, dir) {
  const ans = String(_vtAnswer(item, dir)).trim();
  const used = new Set([ans.toLowerCase()]);
  const distract = [];
  _shuffle(Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : []).forEach(x => {
    const t = String(_vtAnswer(x, dir) || '').trim();
    const k = t.toLowerCase();
    if (distract.length < 3 && t && !used.has(k)) { used.add(k); distract.push(t); }
  });
  return _shuffle([ans].concat(distract));
}

function _vtRenderQuestion() {
  const box = _vtBox();
  const item = VT.items[VT.idx];
  VT.answered = false;
  const total = VT.items.length;
  const head = `
    <div class="vt-progress">
      <span>${VT.idx + 1} / ${total}</span>
      <span class="vt-score">맞힘 ${VT.correct}</span>
      <button type="button" class="vt-btn" data-vt="quit">그만하기</button>
    </div>
    <div class="vt-bar"><div style="width:${Math.round(VT.idx / total * 100)}%"></div></div>`;
  const promptCls = VT.dir === 'e2k' ? 'vt-prompt en' : 'vt-prompt ko';
  let body = '';
  if (VT.mode === 'card') {
    body = `
      <div class="${promptCls}">${escapeHTML(_vtPrompt(item))}</div>
      <div class="vt-reveal" hidden>${escapeHTML(_vtAnswer(item))}</div>
      <button type="button" class="vt-btn vt-btn-primary vt-wide" data-vt="flip">${VT.dir === 'e2k' ? '뜻 보기' : '단어 보기'}</button>
      <div class="vt-judge" hidden>
        <button type="button" class="vt-btn vt-btn-no" data-vt="dontknow">몰라요</button>
        <button type="button" class="vt-btn vt-btn-yes" data-vt="know">알아요</button>
      </div>`;
  } else if (VT.mode === 'choice') {
    VT.choices = _vtMakeChoices(item, VT.dir);
    body = `
      <div class="${promptCls}">${escapeHTML(_vtPrompt(item))}</div>
      <div class="vt-choices">
        ${VT.choices.map((c, i) => `<button type="button" class="vt-choice" data-vt="choose" data-i="${i}"><span>${'①②③④'[i]}</span>${escapeHTML(c)}</button>`).join('')}
      </div>
      <div class="vt-feedback"></div>`;
  } else {
    body = `
      <div class="${promptCls}">${escapeHTML(_vtPrompt(item))}</div>
      <div class="vt-write">
        <input type="text" id="vtInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${VT.dir === 'e2k' ? '뜻을 입력하십시오' : '영어 단어를 입력하십시오'}">
        <button type="button" class="vt-btn vt-btn-primary" data-vt="check">확인</button>
      </div>
      <div class="vt-feedback"></div>`;
  }
  box.innerHTML = `<div class="vt-card vt-run">${head}${body}</div>`;
  box.onclick = _vtOnClick;
  const inp = box.querySelector('#vtInput');
  if (inp) {
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (VT.answered) _vtNext(); else _vtCheckWrite();
    });
    setTimeout(() => inp.focus(), 50);
  }
}

function _vtOnClick(e) {
  const b = e.target.closest('[data-vt]'); if (!b) return;
  const act = b.dataset.vt;
  const box = _vtBox();
  if (act === 'quit') { _vtFinish(true); return; }
  if (act === 'next') { _vtNext(); return; }
  if (act === 'flip') {
    box.querySelector('.vt-reveal').hidden = false;
    box.querySelector('.vt-judge').hidden = false;
    b.hidden = true;
    return;
  }
  if (act === 'know' || act === 'dontknow') {
    if (VT.answered) return;
    VT.answered = true;
    const item = VT.items[VT.idx];
    // 카드 넘기기는 스스로 답하는 연습이라 외움 표시를 바꾸지 않습니다. (몰라요 = '다시 풀기' 목록에만 추가)
    if (act === 'know') VT.correct++;
    else VT.wrong.push(item);
    _vtNext();
    return;
  }
  if (act === 'choose') {
    if (VT.answered) { _vtNext(); return; }
    VT.answered = true;
    const item = VT.items[VT.idx];
    const ansKey = String(_vtAnswer(item)).trim().toLowerCase();
    const picked = VT.choices[+b.dataset.i];
    const ok = String(picked).trim().toLowerCase() === ansKey;
    box.querySelectorAll('.vt-choice').forEach((c, i) => {
      if (String(VT.choices[i]).trim().toLowerCase() === ansKey) c.classList.add('correct');
      else if (c === b) c.classList.add('wrong');
      c.classList.add('done');
    });
    _vtFeedback(ok, item);
    return;
  }
  if (act === 'check') { if (VT.answered) _vtNext(); else _vtCheckWrite(); }
}

// 주관식 채점: 영어→뜻은 여러 뜻 중 하나와 맞거나 포함하면 정답, 뜻→영어는 철자가 같아야 정답
function _vtCheckWrite() {
  const box = _vtBox();
  const inp = box.querySelector('#vtInput');
  const ans = String(inp.value || '').trim().toLowerCase();
  if (!ans) { inp.focus(); return; }
  VT.answered = true;
  const item = VT.items[VT.idx];
  let ok;
  if (VT.dir === 'e2k') {
    const ms = String(item.meaning || '').toLowerCase().split(',').map(m => m.trim()).filter(Boolean);
    ok = ms.some(m => m === ans || m.includes(ans) || ans.includes(m));
  } else {
    ok = ans === String(item.word || '').trim().toLowerCase();
  }
  inp.disabled = true;
  inp.classList.add(ok ? 'correct' : 'wrong');
  _vtFeedback(ok, item);
}

function _vtFeedback(ok, item) {
  const box = _vtBox();
  if (ok) { VT.correct++; VT.right.push(item); } else _vtRecordWrong(item);
  const fb = box.querySelector('.vt-feedback');
  const btn = box.querySelector('[data-vt="check"]');
  if (btn) btn.textContent = '다음';
  fb.innerHTML = ok
    ? '<div class="vt-ok">⭕ 정답!</div>'
    : `<div class="vt-no">❌ 정답: <b>${escapeHTML(_vtAnswer(item))}</b></div><button type="button" class="vt-btn vt-btn-primary vt-wide" data-vt="next">다음</button>`;
  box.querySelector('.vt-score').textContent = '맞힘 ' + VT.correct;
  if (ok) setTimeout(() => { if (VT.answered && VT.items[VT.idx] === item) _vtNext(); }, 700);
  else { const nb = fb.querySelector('[data-vt="next"]'); if (nb) nb.focus(); }
}

function _vtNext() {
  if (VT.idx + 1 >= VT.items.length) { _vtFinish(false); return; }
  VT.idx++;
  _vtRenderQuestion();
}

// 틀린 단어 기록. 외움으로 표시돼 있던 단어를 틀리면 '외우는 중'으로 되돌립니다(저장은 시험 끝날 때 한 번에).
function _vtRecordWrong(item) {
  VT.wrong.push(item);
  if (item.memorized) {
    item.memorized = false;
    if (!VT.unmarked.includes(item)) VT.unmarked.push(item);
  }
}

// 여러 단어 외움 표시를 한 번에 저장 (GS가 옛 버전이면 한 단어씩 저장)
function _vtSaveMemorized(items, memorized) {
  const targetUser = getActiveVocabUser();
  const words = items.map(x => x.word).filter(Boolean);
  if (!targetUser || !words.length) return Promise.resolve();
  return gsCall('setWordsMemorized', [targetUser, words, memorized]).then(res => {
    if (res && res.success === false) throw new Error(res.error || '저장 실패');
  }).catch(err => {
    if (!isMissingServerFunction(err)) throw err;
    return Promise.all(words.map(w => gsCall('setWordMemorized', [targetUser, w, memorized])));
  });
}

function _vtFinish(quit) {
  const box = _vtBox();
  const solved = quit ? VT.idx + (VT.answered ? 1 : 0) : VT.items.length;
  if (solved > 0) vocabUpdateQuizStats(VT.correct, solved);
  const pct = solved ? Math.round(VT.correct / solved * 100) : 0;

  // ③ 외움이었는데 틀린 단어 → '외우는 중'으로 저장
  const unmarked = VT.unmarked.slice();
  VT.unmarked = [];
  if (unmarked.length) {
    _vtSaveMemorized(unmarked, false).catch(err => {
      unmarked.forEach(x => { x.memorized = true; });
      document.dispatchEvent(new CustomEvent('vocab:changed', { detail: {} }));
      showToast('외움 해제 저장 실패: ' + escapeHTML(String(err && err.message || err)), 'error');
    });
  }
  // ① 맞혔지만 아직 외움이 아닌 단어 (같은 단어 중복 제거)
  const toMark = [...new Set(VT.right)].filter(x => !x.memorized && !VT.wrong.includes(x));
  const unmarkNote = unmarked.length
    ? `<div class="vt-unmark-note">↩️ 외움이었지만 틀린 단어 <b>${unmarked.length}개</b>를 다시 '외우는 중'으로 돌렸습니다.</div>` : '';
  const markBox = toMark.length
    ? `<div class="vt-mark-box"><button type="button" class="vt-btn vt-btn-mark" data-vt="markRight">✅ 맞힌 단어 ${toMark.length}개 외움으로 표시</button></div>` : '';
  const wrongList = VT.wrong.length
    ? `<div class="vt-wrong-title">틀린 단어 ${VT.wrong.length}개</div>
       <div class="vt-wrong-list">${VT.wrong.map(x => `<div class="vt-wrong-item"><b>${escapeHTML(x.word)}</b><span>${escapeHTML(x.meaning)}</span></div>`).join('')}</div>`
    : (solved ? '<div class="vt-perfect">🎉 모두 맞혔습니다!</div>' : '');
  box.innerHTML = `
    <div class="vt-card vt-result">
      <div class="vt-result-score">${VT.correct} / ${solved}<small>${solved ? pct + '점' : ''}</small></div>
      ${unmarkNote}
      ${markBox}
      ${wrongList}
      <div class="vt-result-actions">
        ${VT.wrong.length ? '<button type="button" class="vt-btn vt-btn-primary" data-vt="retryWrong">틀린 단어 다시 풀기</button>' : ''}
        <button type="button" class="vt-btn" data-vt="again">새로 시험 보기</button>
        <button type="button" class="vt-btn" data-vt="exit">단어 목록으로</button>
      </div>
    </div>`;
  box.onclick = e => {
    const b = e.target.closest('[data-vt]'); if (!b) return;
    if (b.dataset.vt === 'markRight') {
      if (b.disabled) return;
      b.disabled = true;
      b.textContent = '저장 중...';
      toMark.forEach(x => { x.memorized = true; });
      _vtSaveMemorized(toMark, true).then(() => {
        b.closest('.vt-mark-box').innerHTML = `<div class="vt-mark-done">✅ ${toMark.length}개를 외움으로 표시했습니다.</div>`;
        document.dispatchEvent(new CustomEvent('vocab:changed', { detail: {} }));
      }).catch(err => {
        toMark.forEach(x => { x.memorized = false; });
        b.disabled = false;
        b.textContent = `✅ 맞힌 단어 ${toMark.length}개 외움으로 표시`;
        showToast('외움 표시 저장 실패: ' + escapeHTML(String(err && err.message || err)), 'error');
      });
      return;
    }
    if (b.dataset.vt === 'retryWrong') vocabStudyStart(Object.assign({}, VT.prefs), VT.wrong.slice());
    if (b.dataset.vt === 'again') vocabStudyOpenSetup();
    if (b.dataset.vt === 'exit') vocabStudyExit();
  };
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: {} }));
}

(function bindVocabStudy() {
  const btn = document.getElementById('btnVocabStudy');
  if (btn) btn.addEventListener('click', () => {
    const box = _vtBox();
    if (box && box.style.display !== 'none') vocabStudyExit(); else vocabStudyOpenSetup();
  });
})();


/* =====================================================================
 * 단어 시험지 인쇄 (A4, 2단) — 기존 문제지 인쇄와 같은 미리보기 방식(#printSection)
 * 객관식: 4지선다 / 주관식: 빈칸에 쓰기. 문제지와 정답지를 한 번에 인쇄(정답지는 새 쪽에서 시작).
 * 카드 넘기기는 인쇄하지 않습니다.
 * ===================================================================== */
let VT_PRINT = null;

function vocabStudyPrint(p) {
  if (!(CURRENT_USER && CURRENT_USER.role === 'manager')) return;
  if (p.mode === 'card') { showToast('카드 넘기기는 인쇄할 수 없습니다. 객관식이나 주관식을 골라 주십시오.', 'error'); return; }
  const pool = _vtPool(p);
  if (!pool.length) { showToast('범위 안에 시험지로 만들 단어가 없습니다.', 'error'); return; }
  const mode = p.mode === 'choice' ? 'choice' : 'write';
  if (mode === 'choice') {
    const keyOf = x => String(_vtAnswer(x, p.dir)).trim().toLowerCase();
    if (new Set((VOCAB_CACHE || []).map(keyOf)).size < 4) { showToast('객관식은 서로 다른 단어가 4개 이상 있어야 합니다.', 'error'); return; }
  }
  const items = _shuffle(pool).slice(0, p.count).map(it => ({
    item: it, choices: mode === 'choice' ? _vtMakeChoices(it, p.dir) : null
  }));
  const user = getActiveVocabUser() || {};
  const d = new Date();
  VT_PRINT = { items: items, mode: mode, dir: p.dir, name: user.name || '', date: `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` };
  _vtRenderPrint('both');
}

function _vtPrintStyle() {
  return `<style>
    .vsheet { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #000; max-width: 190mm; margin: 0 auto; padding: 8mm 0 0; }
    .vs-head { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .vs-title { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px; }
    .vs-info { width: 100%; border-collapse: collapse; font-size: 13px; }
    .vs-info td { border: 1px solid #000; padding: 5px 8px; }
    .vs-info td.k { width: 1%; white-space: nowrap; font-weight: bold; background: #f3f4f6; text-align: center; }
    .vs-guide { font-size: 13px; margin-top: 8px; font-weight: bold; }
    .vs-cols { column-count: 2; column-gap: 10mm; column-rule: 0.5px solid #bbb; }
    .vs-item { break-inside: avoid; page-break-inside: avoid; display: flex; align-items: flex-end; gap: 6px; font-size: 14px; padding: 7px 0 5px; }
    .vs-no { flex: 0 0 auto; width: 2.2em; font-weight: bold; }
    .vs-q { flex: 0 1 auto; max-width: 58%; word-break: keep-all; overflow-wrap: break-word; }
    .vs-q.en { font-family: "Times New Roman", serif; font-size: 15px; font-weight: bold; }
    .vs-line { flex: 1 1 auto; min-width: 25mm; border-bottom: 1px solid #000; height: 1.2em; }
    .vs-item.ch { display: block; padding: 6px 0 7px; }
    .vs-item.ch .vs-qrow { display: flex; gap: 6px; align-items: baseline; }
    .vs-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; margin: 4px 0 0 2.2em; font-size: 12.5px; }
    .vs-opts.en { font-family: "Times New Roman", serif; font-size: 13.5px; }
    .vs-key { column-count: 2; column-gap: 10mm; column-rule: 0.5px solid #bbb; font-size: 14px; }
    .vs-key div { break-inside: avoid; page-break-inside: avoid; padding: 6px 0; border-bottom: 0.5px dotted #999; }
    .vs-key b { display: inline-block; width: 2.4em; }
    .vs-line.vs-ans { height: auto; min-height: 1.2em; padding: 0 2px; font-weight: bold; color: #b91c1c; font-size: 14px; line-height: 1.2; word-break: keep-all; overflow-wrap: break-word; }
    .vs-line.vs-ans.en { font-family: "Times New Roman", serif; font-size: 15px; }
    .vsheet + .vsheet { break-before: page; page-break-before: always; margin-top: 0; }
    @media screen { .vsheet + .vsheet { margin-top: 14mm; padding-top: 14mm; border-top: 2px dashed #9ca3af; } }
  </style>`;
}

function _vtSheetHtml(withKey) {
  const P = VT_PRINT;
  const n = P.items.length;
  const guide = P.mode === 'choice'
    ? (P.dir === 'e2k' ? '※ 영어 단어의 뜻으로 알맞은 것을 고르시오.' : '※ 우리말 뜻에 알맞은 영어 단어를 고르시오.')
    : (P.dir === 'e2k' ? '※ 영어 단어의 뜻을 쓰시오.' : '※ 우리말 뜻에 알맞은 영어 단어를 쓰시오.');
  const promptCls = P.dir === 'e2k' ? 'vs-q en' : 'vs-q';
  const optCls = P.dir === 'e2k' ? 'vs-opts' : 'vs-opts en';
  const head = `
    <div class="vs-head">
      <div class="vs-title">${withKey ? '영어 단어 시험 · 정답' : '영어 단어 시험'}</div>
      <table class="vs-info"><tr>
        <td class="k">이름</td><td>${escapeHTML(P.name)}</td>
        <td class="k">날짜</td><td>${escapeHTML(P.date)}</td>
        <td class="k">점수</td><td style="text-align:right; width:22%;">/ ${n}</td>
      </tr></table>
      ${withKey ? '' : `<div class="vs-guide">${guide}</div>`}
    </div>`;
  // 주관식 정답지: 문제지와 같은 모양에 빈칸 대신 정답을 적어 줍니다.
  if (withKey && P.mode !== 'choice') {
    const ansCls = P.dir === 'e2k' ? 'vs-line vs-ans' : 'vs-line vs-ans en';
    const body = P.items.map((x, i) => `<div class="vs-item"><span class="vs-no">${i + 1}.</span><span class="${promptCls}">${escapeHTML(_vtPrompt(x.item, P.dir))}</span><span class="${ansCls}">${escapeHTML(_vtAnswer(x.item, P.dir))}</span></div>`).join('');
    return `<div class="vsheet">${head}<div class="vs-cols">${body}</div></div>`;
  }
  if (withKey) {
    const keys = P.items.map((x, i) => {
      const ans = _vtAnswer(x.item, P.dir);
      const mark = x.choices ? '①②③④'[x.choices.indexOf(String(ans).trim())] + ' ' : '';
      return `<div><b>${i + 1}.</b>${mark}${escapeHTML(ans)}</div>`;
    }).join('');
    return `<div class="vsheet">${head}<div class="vs-key">${keys}</div></div>`;
  }
  const body = P.items.map((x, i) => {
    const q = escapeHTML(_vtPrompt(x.item, P.dir));
    if (x.choices) {
      return `<div class="vs-item ch"><div class="vs-qrow"><span class="vs-no">${i + 1}.</span><span class="${promptCls}">${q}</span></div>
        <div class="${optCls}">${x.choices.map((c, k) => `<span>${'①②③④'[k]} ${escapeHTML(c)}</span>`).join('')}</div></div>`;
    }
    return `<div class="vs-item"><span class="vs-no">${i + 1}.</span><span class="${promptCls}">${q}</span><span class="vs-line"></span></div>`;
  }).join('');
  return `<div class="vsheet">${head}<div class="vs-cols">${body}</div></div>`;
}

function _vtRenderPrint(view) {
  if (!VT_PRINT) return;
  const zone = document.getElementById('printSection');
  zone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  const btn = 'border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; white-space:nowrap; color:#fff; width:auto;';
  if (['both', 'sheet', 'key'].indexOf(view) === -1) view = 'both';
  const viewOpt = (v, label) => `<option value="${v}" ${view === v ? 'selected' : ''}>${label}</option>`;
  const sheets = (view !== 'key' ? _vtSheetHtml(false) : '') + (view !== 'sheet' ? _vtSheetHtml(true) : '');
  zone.innerHTML = `
    <div class="print-controls no-print" style="position:fixed; top:0; left:0; right:0; background:#374151; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; z-index:10000; box-shadow:0 2px 10px rgba(0,0,0,0.2); gap:10px; flex-wrap:wrap;">
      <div style="font-size:16px; font-weight:bold;">🖥️ 단어 시험지 미리보기 (${VT_PRINT.items.length}문항)</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <select id="vsView" style="width:auto; margin:0; padding:7px 10px; border-radius:6px; border:none; font-size:14px; font-weight:bold; color:#111827;">
          ${viewOpt('both', '문제지 + 정답지')}${viewOpt('sheet', '문제지만')}${viewOpt('key', '정답지만')}
        </select>
        <button type="button" id="vsReshuffle" style="background:#7c3aed; ${btn}">🔀 다시 섞기</button>
        <button type="button" id="vsPrint" style="background:#2563eb; ${btn}">🖨️ 인쇄하기</button>
        <button type="button" id="vsClose" style="background:#dc2626; ${btn}">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height:64px;"></div>
    ${_vtPrintStyle()}
    ${sheets}`;
  zone.querySelector('#vsView').onchange = e => _vtRenderPrint(e.target.value);
  zone.querySelector('#vsReshuffle').onclick = () => {
    VT_PRINT.items = _shuffle(VT_PRINT.items).map(x => ({ item: x.item, choices: x.choices ? _vtMakeChoices(x.item, VT_PRINT.dir) : null }));
    _vtRenderPrint(view);
  };
  zone.querySelector('#vsPrint').onclick = () => window.print();
  zone.querySelector('#vsClose').onclick = () => closePrintPreview();
}


/* =====================================================================
 * 외우기용 단어장 인쇄 (A4, 2단, 한 단 최대 50개 → 한 쪽 최대 100개)
 * 시험 설정의 '범위'를 그대로 쓰고, 번호순으로 범위 안 단어를 모두 인쇄합니다.
 * 한 줄에 다 들어가지 않는 긴 뜻은 글자를 줄이고, 그래도 넘치면 … 으로 줄입니다.
 * ===================================================================== */
const VL_PER_COL = 50;
let VL_PRINT = null;

function _vlScopeLabel(p) {
  if (p.scope === 'range') {
    const lo = Math.min(p.rangeFrom, p.rangeTo), hi = Math.max(p.rangeFrom, p.rangeTo);
    return `${lo}번 ~ ${hi}번`;
  }
  if (p.scope === 'recent') return `최근 추가 ${p.recentN}개`;
  if (p.scope === 'learning') return '외우는 중인 단어';
  return '목록에 보이는 단어';
}

function vocabListPrint(p) {
  if (!(CURRENT_USER && CURRENT_USER.role === 'manager')) return;
  const num = x => Number(x.number) || 0;
  const words = _vtPool(p).slice().sort((a, b) => num(a) - num(b));
  if (!words.length) { showToast('범위 안에 인쇄할 단어가 없습니다.', 'error'); return; }
  const user = getActiveVocabUser() || {};
  const d = new Date();
  VL_PRINT = { words: words, name: user.name || '', scope: _vlScopeLabel(p), date: `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`, hide: 'none' };
  _vlRender();
}

function _vlStyle() {
  return `<style>
    .vlist-page { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #000; max-width: 180mm; margin: 0 auto; padding: 4mm 0 0; }
    .vlist-page + .vlist-page { break-before: page; page-break-before: always; }
    @media screen { .vlist-page + .vlist-page { margin-top: 12mm; padding-top: 12mm; border-top: 2px dashed #9ca3af; } }
    .vl-head { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 3px; margin-bottom: 3mm; }
    .vl-title { font-size: 17px; font-weight: 800; letter-spacing: 1px; }
    .vl-meta { font-size: 11px; }
    .vl-meta b { margin-left: 8px; }
    .vl-cols { display: flex; gap: 6mm; align-items: flex-start; }
    .vl-col { flex: 1 1 0; min-width: 0; }
    .vl-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .vl-table th { font-size: 10px; background: #f3f4f6; border-top: 1px solid #000; border-bottom: 1px solid #000; height: 5mm; padding: 0 3px; }
    .vl-table td { height: 4.75mm; padding: 0 3px; border-bottom: 0.5px solid #c8c8c8; font-size: 11.5px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
    .vl-table tr:nth-child(5n) td { border-bottom: 0.8px solid #777; }
    .vl-no { width: 8mm; text-align: right; color: #555; font-size: 10px !important; }
    .vl-chk { width: 4mm; text-align: center; }
    .vl-chk i { display: inline-block; width: 2.6mm; height: 2.6mm; border: 0.8px solid #555; }
    .vl-w { width: 33%; font-family: "Times New Roman", serif; font-weight: bold; font-size: 13px !important; }
    .vl-m { width: auto; }
    .vl-sm { font-size: 10px !important; letter-spacing: -0.3px; }
    .vl-xs { font-size: 8.5px !important; letter-spacing: -0.4px; }
    #printSection .vl-hidden { color: transparent !important; }
  </style>`;
}

function _vlFit(text, base) {
  // 칸 너비에 맞게 긴 글자는 작게 (대략 기준)
  const t = String(text || '');
  if (t.length > base * 1.6) return ' vl-xs';
  if (t.length > base) return ' vl-sm';
  return '';
}

function _vlPagesHtml() {
  const P = VL_PRINT;
  const perPage = VL_PER_COL * 2;
  const pages = [];
  for (let i = 0; i < P.words.length; i += perPage) pages.push(P.words.slice(i, i + perPage));
  const hideW = P.hide === 'word', hideM = P.hide === 'meaning';
  const col = list => `
    <div class="vl-col"><table class="vl-table">
      <thead><tr><th class="vl-no">번호</th><th class="vl-chk"></th><th class="vl-w">단어</th><th class="vl-m">뜻</th></tr></thead>
      <tbody>${list.map(x => `<tr>
        <td class="vl-no">${escapeHTML(String(x.number || ''))}</td>
        <td class="vl-chk"><i></i></td>
        <td class="vl-w${_vlFit(x.word, 14)}${hideW ? ' vl-hidden' : ''}">${escapeHTML(x.word)}</td>
        <td class="vl-m${_vlFit(x.meaning, 14)}${hideM ? ' vl-hidden' : ''}">${escapeHTML(x.meaning)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  return pages.map((pg, i) => `
    <div class="vlist-page">
      <div class="vl-head">
        <div class="vl-title">영어 단어장</div>
        <div class="vl-meta"><b>이름</b> ${escapeHTML(P.name)} <b>범위</b> ${escapeHTML(P.scope)} (${P.words.length}개) <b>날짜</b> ${escapeHTML(P.date)}${pages.length > 1 ? ` <b>${i + 1} / ${pages.length}</b>` : ''}</div>
      </div>
      <div class="vl-cols">${col(pg.slice(0, VL_PER_COL))}${pg.length > VL_PER_COL ? col(pg.slice(VL_PER_COL)) : '<div class="vl-col"></div>'}</div>
    </div>`).join('');
}

function _vlRender() {
  if (!VL_PRINT) return;
  const zone = document.getElementById('printSection');
  zone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  const btn = 'border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; white-space:nowrap; color:#fff; width:auto;';
  const opt = (v, label) => `<option value="${v}" ${VL_PRINT.hide === v ? 'selected' : ''}>${label}</option>`;
  const pageCount = Math.ceil(VL_PRINT.words.length / (VL_PER_COL * 2));
  zone.innerHTML = `
    <div class="print-controls no-print" style="position:fixed; top:0; left:0; right:0; background:#374151; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; z-index:10000; box-shadow:0 2px 10px rgba(0,0,0,0.2); gap:10px; flex-wrap:wrap;">
      <div style="font-size:16px; font-weight:bold;">📖 단어장 미리보기 (${VL_PRINT.words.length}개 · ${pageCount}쪽)</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <select id="vlHide" style="width:auto; margin:0; padding:7px 10px; border-radius:6px; border:none; font-size:14px; font-weight:bold; color:#111827;">
          ${opt('none', '단어 + 뜻 모두')}${opt('meaning', '뜻 가리기 (빈칸)')}${opt('word', '단어 가리기 (빈칸)')}
        </select>
        <button type="button" id="vlPrint" style="background:#2563eb; ${btn}">🖨️ 인쇄하기</button>
        <button type="button" id="vlClose" style="background:#dc2626; ${btn}">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height:64px;"></div>
    ${_vlStyle()}
    ${_vlPagesHtml()}`;
  zone.querySelector('#vlHide').onchange = e => { VL_PRINT.hide = e.target.value; _vlRender(); };
  zone.querySelector('#vlPrint').onclick = () => window.print();
  zone.querySelector('#vlClose').onclick = () => closePrintPreview();
}
window.vocabListPrint = vocabListPrint;
