
// ★ 새 사이트(깃헙) 주소. 옛 구글 스크립트 주소로 들어온 학생을 이 주소로 보냅니다.
const NEW_SITE_URL = 'https://k2academyenglish.github.io/K2AcademyEnglish1/';

// 옛 화면(index/list)은 더 이상 열지 않습니다. 새 주소 안내만 보여 줍니다.
// (옛 화면에서는 비밀번호·포인트·공지 기능이 없고, 관리자 보호를 우회할 수 있어서 막았습니다)
function doGet(e) {
  const url = String(NEW_SITE_URL || '').trim();
  const safe = /^https:\/\/[^"'<>\s]+$/.test(url) ? url : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{margin:0;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .box{background:#fff;border-radius:16px;padding:32px 24px;max-width:420px;width:90%;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.08);}
  h1{font-size:20px;margin:0 0 12px;color:#111827;} p{font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 20px;}
  a.go{display:block;background:#2b6cb0;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:14px;border-radius:10px;}
  .url{margin-top:12px;font-size:12px;color:#9ca3af;word-break:break-all;}
</style></head><body><div class="box">
  <h1>🏫 케이투학원 주소가 바뀌었습니다</h1>
  <p>새 주소로 자동으로 이동합니다...<br>이동하지 않으면 아래 버튼을 눌러 주십시오.<br>새 주소에서 <b>즐겨찾기(홈 화면 추가)</b>를 새로 해 주십시오.</p>
  ${safe ? `<a class="go" href="${safe}" target="_top">새 주소로 가기</a><div class="url">${safe}</div>` : '<p><b>선생님께 새 주소를 물어봐 주십시오.</b></p>'}
</div>
${safe ? `<script>
  // 구글 스크립트 화면은 틀(iframe) 안에서 열리므로, 바깥 창(top)을 새 주소로 보냅니다.
  (function () {
    var url = ${JSON.stringify(safe)};
    try { window.top.location.replace(url); return; } catch (e) {}
    try { window.open(url, '_top'); } catch (e) {}
  })();
</script>` : ''}
</body></html>`;
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('케이투학원 - 주소 변경 안내');
}

// 외부(GitHub) 프론트엔드에서 호출 가능한 함수 목록. 새 서버 함수를 화면에서 쓰려면 여기에 추가해야 합니다.
const PUBLIC_API_ = new Set([
  'doLogin', 'getManagedStudents',
  // 단어장
  'getVocabulary', 'addWordToFormAndSheet', 'editWord', 'deleteWord', 'setWordMemorized', 'setWordsMemorized',
  'getTypoCorrections', 'getWordTranslation', 'getDailyLogs', 'getConfusingWordsFromSheet',
  // 문제 풀이 / 오답 / 과제(학생)
  'getSourceFiltersAndTypes', 'getQuestionsByFilter', 'getQuestionsByQids', 'logAttempt',
  'getWrongStats', 'getWrongNote', 'getAllMyAssignments', 'loadRetryData', 'getAssignmentResult',
  // 관리자
  'getAdminQuestionInventory', 'createAssignment', 'createBulkAssignments',
  'getAllAssignmentsForAdmin', 'getRecentAssignmentsForStudent',
  'loadWeeklyStudentBundle', 'updateMasterIndex', 'getWeeklyReportData',
  'getQuestionMetaIndex', 'getStudentQuestionStats', 'loadWeeklyStudentStats',
  // 알림 · 포인트 · 교환권 (학생)
  'getStudentHome', 'markNoticesRead', 'getMyPoints', 'requestPointExchange', 'cancelPointExchange',
  // 알림 · 포인트 · 교환권 (관리자: 비밀번호 인증 필요)
  'adminGetPoints', 'adminAdjustPoints', 'adminCancelPointEntry', 'adminResolveExchange',
  'adminSendNotice', 'adminListNotices', 'adminDeleteNotice',
  // 속도 기록 (관리자)
  'adminGetPerf',
  // 문제은행 편집기 (관리자)
  'qbListSheets', 'qbLoadSheet', 'qbWriteQuestions', 'qbCreateSheet', 'qbSetHidden'
]);

// 관리자만 쓸 수 있는 기존 기능: 요청에 담긴 관리자 인증(auth)을 확인한 뒤에만 실행합니다.
// (화면 쪽 api-utils.js가 로그인한 관리자의 인증 정보를 자동으로 함께 보냅니다)
const ADMIN_API_ = new Set([
  'getManagedStudents', 'getAdminQuestionInventory', 'createAssignment', 'createBulkAssignments',
  'getAllAssignmentsForAdmin', 'getRecentAssignmentsForStudent',
  'loadWeeklyStudentBundle', 'updateMasterIndex', 'getWeeklyReportData',
  'getQuestionMetaIndex', 'getStudentQuestionStats', 'loadWeeklyStudentStats', 'getAssignmentResult',
  'deleteWord',
  'qbListSheets', 'qbLoadSheet', 'qbWriteQuestions', 'qbCreateSheet', 'qbSetHidden'
]);

// doPost(깃헙 화면)로 들어온 요청인지 표시. 관리자 기능은 이 길로만 열립니다.
let _VIA_POST_ = false;

// 관리자 기능 직접 호출 차단: 구글 스크립트 페이지(google.script.run) 등 doPost를 거치지 않은 호출은
// 스크립트 주인이 편집기에서 직접 실행한 경우만 허용합니다.
function _guardDirect_() {
  if (_VIA_POST_) return;
  let active = '', owner = '';
  try { active = Session.getActiveUser().getEmail(); owner = Session.getEffectiveUser().getEmail(); } catch (err) {}
  if (!active || active !== owner) throw new Error('허용되지 않은 접근입니다. 새 주소에서 이용해 주십시오.');
}

/* ===================== [속도 기록] =====================
 * 서버 함수마다 걸린 시간(구글 서버 안에서의 처리 시간)을 최근 400건까지 6시간 동안 기억합니다.
 * 관리자 화면 [📢 공지·포인트] → [⏱ 속도] 탭에서 볼 수 있습니다.
 * (학생 기기 ↔ 구글 사이의 기본 연결 시간 1~2초는 여기에 포함되지 않습니다)
 */
const PERF_KEY = 'PERF_LOG_V1', PERF_MAX = 400;
let _PERF_T0_ = 0, _PERF_FUNC_ = '';
function _perfLog_(func, ms, ok) {
  if (func === 'adminGetPerf') return;
  try {
    const cache = CacheService.getScriptCache();
    let list = [];
    try { list = JSON.parse(cache.get(PERF_KEY) || '[]'); } catch (e) { list = []; }
    list.push([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd HH:mm:ss'), func, ms, ok ? 1 : 0]);
    if (list.length > PERF_MAX) list = list.slice(list.length - PERF_MAX);
    cache.put(PERF_KEY, JSON.stringify(list), 21600);
  } catch (e) {}
}
function adminGetPerf(auth, clear) {
  _requireManager_(auth);
  const cache = CacheService.getScriptCache();
  if (clear) { cache.remove(PERF_KEY); return { summary: [], recent: [], total: 0 }; }
  let list = [];
  try { list = JSON.parse(cache.get(PERF_KEY) || '[]'); } catch (e) { list = []; }
  const by = {};
  list.forEach(r => { (by[r[1]] = by[r[1]] || []).push(r); });
  const summary = Object.keys(by).map(f => {
    const ms = by[f].map(r => Number(r[2]) || 0).sort((a, b) => a - b);
    const avg = Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
    return { func: f, count: ms.length, avg: avg, median: ms[Math.floor(ms.length / 2)], max: ms[ms.length - 1],
             fails: by[f].filter(r => !r[3]).length };
  }).sort((a, b) => b.avg * b.count - a.avg * a.count);
  return { summary: summary, recent: list.slice(-60).reverse().map(r => ({ time: r[0], func: r[1], ms: r[2], ok: !!r[3] })), total: list.length };
}

function doPost(e) {
  _VIA_POST_ = true;
  _PERF_T0_ = Date.now();
  try {
    const body = JSON.parse(e.postData.contents);
    const funcName = String(body.func || '');
    const args = Array.isArray(body.args) ? body.args : [];

    // 허용 목록에 있는 전역 함수만 실행
    if (!PUBLIC_API_.has(funcName) || typeof this[funcName] !== 'function') {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: '허용되지 않은 함수입니다: ' + funcName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (ADMIN_API_.has(funcName)) _requireManager_(body.auth);

    _PERF_FUNC_ = funcName;
    const result = this[funcName].apply(this, args);
    _perfLog_(funcName, Date.now() - _PERF_T0_, true);
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    if (_PERF_FUNC_) _perfLog_(_PERF_FUNC_, Date.now() - _PERF_T0_, false);
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: String(err && err.message ? err.message : err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**************************************
 * 1) 단어장(Vocab) 영역
 **************************************/
const VOCAB_SHEET_ID = '1dFZ--yjQfebd-0F8IYFH6Xysnv2PXW0DChd1E0x3mLI';

function _getVocabCacheKey(user) {
  return 'VOCAB_LIST_v1_' + (user.id || user.name || 'unknown'); 
}

function _invalidateVocabCache(user) {
  CacheService.getScriptCache().remove(_getVocabCacheKey(user));
}

function getVocabulary(user) {
  // 1. 캐시 확인
  const cache = CacheService.getScriptCache();
  const cacheKey = _getVocabCacheKey(user);
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  // 2. 캐시에 없으면 기존 로직 실행
  const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
  const sheetName = _makeSheetName(user);
  if (!sheetName) return { error: '잘못된 회원 정보입니다.' };

  const sheet = _vocabSheet_(ss, user);
  if (!sheet) {
    return { error: '아직 단어장이 생성되지 않았습니다. 단어를 추가하면 생성됩니다.' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const memoColIndex = headers.indexOf('외움');
  data.shift();
  
  const result = data.map((row, i) => ({
    number: i + 1,
    word: row[0],
    meaning: row[1],
    memorized: memoColIndex !== -1 && row.length > memoColIndex && row[memoColIndex] === 'O'
  }));

  // 3. 결과 캐시에 저장 (10분간 유지)
  try {
    cache.put(cacheKey, JSON.stringify(result), 600);
  } catch (e) {}

  return result;
}

function addWordToFormAndSheet(user, word, meaning, opts) {
  // 잠금은 새 단어장 시트를 만드는 순간만 잡습니다. 단어 추가(appendRow)는 학생 본인 시트에만 씁니다.
  try {
    opts = opts || {};
    word = String(word || '').toLowerCase();
    
    const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    
    // ✅ 1. 시트 이름 생성: "ID(이름)" 형식 (표준 함수 사용)
    const sheetName = _makeSheetName(user);
    if (!sheetName) return '오류: 사용자 정보 없음';

    // 2. 시트 가져오기 또는 생성
    let sheet = _vocabSheet_(ss, user);
    if (!sheet) {
      sheet = _withLock_(() => {
        const again = _vocabSheet_(ss, user);
        if (again) return again;
        // 5번째 위치(인덱스 4)에 시트 생성. 기존 시트가 4개 이하라면 맨 끝에 생성.
        const targetIndex = Math.min(4, ss.getNumSheets());
        const created = ss.insertSheet(sheetName, targetIndex);
        created.appendRow(['단어', '뜻', '외움']);
        return created;
      });
    }

    const data = sheet.getDataRange().getValues();
    // 3. 중복 단어 확인 및 뜻 합치기 로직
    for (let i = 1; i < data.length; i++) {
      // 같은 단어를 찾았을 때
      if (String(data[i][0] || '').toLowerCase() === word) {
        
        // 기존 뜻과 새 뜻을 배열로 분리
        const existingMeanings = String(data[i][1] || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
        const inputMeanings = String(meaning || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
        
        // 완전히 새로운 뜻만 골라냄
        const newMeaningsOnly = inputMeanings.filter(m => !existingMeanings.includes(m));
        if (newMeaningsOnly.length === 0) return '⚠️ 이미 존재하는 단어/뜻입니다.';

        // 뜻 합치기 (기존 + 신규)
        const allMeanings = Array.from(new Set([...existingMeanings, ...newMeaningsOnly]));
        const updatedMeaning = allMeanings.join(', ');
        
        // 시트에 덮어쓰기
        sheet.getRange(i + 1, 2).setValue(updatedMeaning);
        
        _invalidateVocabCache(user);
        return '⚠️ 기존 단어에 새로운 뜻을 추가했습니다.';
      }
    }

    // 4. 중복이 없으면 새 단어 추가
    sheet.appendRow([word, meaning]);
    _invalidateVocabCache(user);
    _appendVocabLog_(user, word, meaning, 'add');
    return '✅ 저장 완료';
  } catch (e) {
    return '오류 발생: ' + String(e);
  }
}

function getTypoCorrections() {
  const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
  const sheet = ss.getSheetByName('오타정정');
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const typoMap = {};
  for (let i = 1; i < data.length; i++) {
    const typo = data[i][0]?.toString().trim().toLowerCase();
    const correct = data[i][1]?.toString().trim();
    if (typo && correct) typoMap[typo] = correct;
  }
  return typoMap;
}

function getWordTranslation(word) {
  if (!word) return '';
  try {
    // 네이버 영한사전 자동완성 API 활용
    const url = 'https://ac.dict.naver.com/enendict/ac?st=11001&r_lt=11001&q=' + encodeURIComponent(word.toLowerCase());
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() === 200) {
      const json = JSON.parse(response.getContentText());
      let rawMeanings = [];
      
      if (json.items && json.items[0] && Array.isArray(json.items[0])) {
        // 검색어와 일치하는 항목 찾기
        for (let i = 0; i < json.items[0].length; i++) {
          const entry = json.items[0][i];
          if (entry && entry[0] && String(entry[0]).toLowerCase() === word.toLowerCase()) {
            if (Array.isArray(entry[1])) {
              rawMeanings = entry[1];
              break;
            }
          }
        }
        // 정확히 일치하는 단어가 없다면 가장 첫 번째 결과 활용
        if (rawMeanings.length === 0 && json.items[0][0] && Array.isArray(json.items[0][0][1])) {
          rawMeanings = json.items[0][0][1];
        }
      }
      
      if (rawMeanings.length > 0) {
        let meanings = [];
        rawMeanings.forEach(item => {
          // 네이버 API 내부 배열 구조에 맞춰 뜻 문자열 추출
          let text = Array.isArray(item) ? String(item[0] || '') : String(item || '');
          // 괄호 및 부가 설명 제거
          text = text.replace(/\(.*?\)/g, '').trim();
          if (text) {
            text.split(/[,/]|(?:\d+\.)/).forEach(sub => {
              let cleanSub = sub.trim();
              if (cleanSub) meanings.push(cleanSub);
            });
          }
        });
        
        // 중복 제거 및 최대 6개 추출
        meanings = [...new Set(meanings)].slice(0, 6);
        if (meanings.length > 0) return meanings.join(', ');
      }
    }
    
    // 네이버 사전에 결과가 없거나 통신 실패 시 구글 기본 번역기로 우회
    return LanguageApp.translate(word, 'en', 'ko');
  } catch(e) {
    try {
      return LanguageApp.translate(word, 'en', 'ko');
    } catch(fallbackErr) {
      return '';
    }
  }
}

function setWordMemorized(user, word, memorized) {
  // 학생 본인 시트의 한 행만 수정하므로 전체 잠금을 쓰지 않습니다(다른 학생 대기 방지).
  try {
    const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    const sheet = _vocabSheet_(ss, user);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const header = data[0] || [];
    let memoColIndex = header.indexOf('외움');
    if (memoColIndex === -1) {
      memoColIndex = header.length;
      sheet.getRange(1, memoColIndex + 1).setValue('외움');
    }

    const tf = sheet.getRange("A:A").createTextFinder(String(word || '')).matchCase(false).matchEntireCell(true).findNext();
    if (tf) {
        sheet.getRange(tf.getRow(), memoColIndex + 1).setValue(memorized ? 'O' : '');
        if (memorized) {
          const rowVals = sheet.getRange(tf.getRow(), 1, 1, 2).getValues()[0];
          _appendVocabLog_(user, rowVals[0], rowVals[1], 'memorize');
        }
        _invalidateVocabCache(user);
    }
  } catch (e) {
    console.error(e);
  }
}

// 여러 단어의 외움 표시를 한 번에 바꿉니다. (단어 시험 결과 반영용)
// 시트를 한 번 읽고 '외움' 열만 한 번에 다시 씁니다. 외움으로 바꾼 단어는 '기록' 시트에도 남깁니다.
function setWordsMemorized(user, words, memorized) {
  const list = (Array.isArray(words) ? words : []).map(w => String(w || '').trim()).filter(Boolean);
  if (!list.length) return { success: true, count: 0 };
  try {
    const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    const sheet = _vocabSheet_(ss, user);
    if (!sheet) return { success: false, error: '단어장 시트가 없습니다.' };
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, count: 0 };
    const header = data[0] || [];
    let memoCol = header.indexOf('외움');
    if (memoCol === -1) {
      memoCol = header.length;
      sheet.getRange(1, memoCol + 1).setValue('외움');
    }
    const want = new Set(list.map(w => w.toLowerCase()));
    const mark = memorized ? 'O' : '';
    const col = [];
    const logs = [];
    let changed = 0;
    for (let i = 1; i < data.length; i++) {
      const cur = memoCol < data[i].length ? data[i][memoCol] : '';
      const w = String(data[i][0] || '').trim();
      if (w && want.has(w.toLowerCase()) && String(cur) !== mark) {
        col.push([mark]);
        changed++;
        if (memorized) logs.push([new Date(), (typeof user === 'object') ? (user.name || '') : String(user || ''), w, String(data[i][1] || ''), 'memorize']);
      } else {
        col.push([cur]);
      }
    }
    if (changed) {
      sheet.getRange(2, memoCol + 1, col.length, 1).setValues(col);
      _invalidateVocabCache(user);
      if (logs.length) _vocabLogAppend_(ss, user, logs);
    }
    return { success: true, count: changed };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getDailyLogs(studentObjOrName, sinceDate) {
  const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
  const formSheet = ss.getSheetByName('기록');
  if (!formSheet) return [];
  const lastRow = formSheet.getLastRow(), lastCol = formSheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];

  const headers = formSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const timestampIdx = headers.indexOf('타임스탬프');
  const nameIdx = headers.indexOf('이름');
  const wordIdx = headers.indexOf('단어');
  const meaningIdx = headers.indexOf('뜻');
  const typeIdx = headers.indexOf('기록유형');

  const isObj = !!studentObjOrName && typeof studentObjOrName === 'object';
  const targetName = isObj ? String(studentObjOrName.name || '').trim() : String(studentObjOrName || '').trim();
  const targetId = isObj ? String(studentObjOrName.id || '').trim() : '';
  const idIdx = headers.map(h => String(h || '').trim()).indexOf(VOCAB_LOG_ID_HEADER);
  const tz = Session.getScriptTimeZone();
  if (!targetName || nameIdx === -1) return [];
  const since = String(sinceDate || '').trim(); // 'yyyy-MM-dd' (선택) — 이 날짜 이후 기록만 반환

  // 시트 전체 대신 이름 열에서 해당 학생 행만 찾아 읽습니다.
  // 같은 이름의 행을 찾은 뒤, 'ID가 같은 행' 또는 'ID가 비어 있는 예전 행'만 남깁니다.
  const rowNumbers = _findRowNumbers_(formSheet, nameIdx + 1, targetName, true);
  const useId = idIdx !== -1 && !!targetId;
  if (useId) {
    // 이름을 바꾼 학생의 새 기록(ID는 같고 이름이 다른 행)도 포함
    const seen = new Set(rowNumbers);
    _findRowNumbers_(formSheet, idIdx + 1, targetId, true).forEach(n => { if (!seen.has(n)) { seen.add(n); rowNumbers.push(n); } });
    rowNumbers.sort((a, b) => a - b);
  }
  const data = _readRowNumbers_(formSheet, rowNumbers, lastCol).map(item => item.values);

  const logs = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const name = String(row[nameIdx] || '').trim();
    if (useId) {
      const rowId = String(row[idIdx] == null ? '' : row[idIdx]).trim();
      if (rowId ? rowId !== targetId : name !== targetName) continue;
    } else if (name !== targetName) continue;

    const timestamp = row[timestampIdx];
    const date = (timestamp instanceof Date) ? Utilities.formatDate(timestamp, tz, 'yyyy-MM-dd') : String(timestamp || '').substring(0, 10);
    if (since && date < since) continue;

    logs.push({
      date: date,
      name: name,
      word: wordIdx !== -1 ? String(row[wordIdx] || '') : '',
      meaning: meaningIdx !== -1 ? String(row[meaningIdx] || '') : '',
      action: typeIdx !== -1 ? String(row[typeIdx] || '').trim() : 'add'
    });
  }
  return logs;
}

// 단어 삭제 (선생님 전용: 단어장조회 화면에서 학생의 단어를 지울 때). user = 대상 학생 {id, name}
function deleteWord(user, word) {
  _guardDirect_();
  try {
    const target = String(word || '').trim();
    if (!target) return { error: '삭제할 단어가 없습니다.' };
    const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    const sheet = _vocabSheet_(ss, user);
    if (!sheet) return { error: '단어장을 찾을 수 없습니다.' };
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { error: '해당 단어를 찾을 수 없습니다.' };
    // 머리줄(1행)은 건드리지 않도록 2행부터 찾습니다.
    const tf = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(target).matchCase(false).matchEntireCell(true).findNext();
    if (!tf) return { error: '해당 단어를 찾을 수 없습니다.' };
    sheet.deleteRow(tf.getRow());
    _invalidateVocabCache(user);
    return { success: true };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}

function editWord(user, oldWord, newWord, newMeaning) {
  // 학생 본인 시트의 한 행만 수정하므로 전체 잠금을 쓰지 않습니다(다른 학생 대기 방지).
  try {
    const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    const sheet = _vocabSheet_(ss, user);
    if (!sheet) return {error: '단어장을 찾을 수 없습니다.'};

    const targetWord = String(oldWord||'').toLowerCase();
    const tf = sheet.getRange("A:A").createTextFinder(targetWord).matchCase(false).matchEntireCell(true).findNext();
    if (tf) {
        const row = tf.getRow();
        sheet.getRange(row, 1).setValue(newWord);
        sheet.getRange(row, 2).setValue(newMeaning);
        _invalidateVocabCache(user);
        return {success: true};
    }
    return {error: '해당 단어를 찾을 수 없습니다.'};
  } catch (e) {
    return {error: String(e)};
  }
}

/**************************************
 * 2) 고등영어 문제은행(QBank) 영역
 **************************************/
const QBANK_SHEET_ID = '1Mdwr2g7fVwOcg3KS2Lh76vrKeQYZNTdabslQnThJzmY';
const QBANK_LOG_BOOK_ID = '1BOaNO-vxlMT_8mZziZYdoxH9cc1QRBcrPURX-rZ0tPk';
const QBANK_MASTER_LOG_SHEET = 'StudentLogs';

let SS_CONTENTS, SS_LOG;
function _contentsSS(){ return SS_CONTENTS || (SS_CONTENTS = SpreadsheetApp.openById(QBANK_SHEET_ID)); }
function _logSS(){ return SS_LOG || (SS_LOG = SpreadsheetApp.openById(QBANK_LOG_BOOK_ID)); }

function _S(v){ return (v == null ? '' : String(v)); }
function _arr(x){
  if (Array.isArray(x)) return x.filter(s => String(s||'').trim() !== '').map(String);
  if (x == null || x === '') return [];
  return [String(x)];
}
function _nowIso(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function _uuid(){ return Utilities.getUuid(); }

/** 출처 파서 (유동적 파싱) */
function parseSource_(src) {
  src = String(src || '').replace(/\s+/g, ' ').trim();
  const parts = src.split(' ');

  let grade = '';
  let year = '';
  let leftovers = []; 

  parts.forEach(part => {
    if (/^(고[1-3]|중[1-3]|m[1-3]|h[1-3])$/i.test(part)) {
      let pLower = part.toLowerCase();
      if (pLower.startsWith('m')) {
          grade = '중' + pLower.replace('m', '');
      } else if (pLower.startsWith('h')) {
          grade = '고' + pLower.replace('h', '');
      } else {
          grade = part;
      }
      return; 
    }
    const yMatch = part.match(/^(\d{4}|\d{2})(?:년|학년도)?$/);
    if (yMatch) {
      let y = yMatch[1];
      year = (y.length === 2) ? '20' + y : y;
      return;
    }
    leftovers.push(part);
  });
  const monthOrBook = leftovers.length > 0 ? leftovers[0] : '';
  const detailInfo = leftovers.length > 1 ? leftovers.slice(1).join(' ') : '';
  return { grade, year, month: monthOrBook, detail: detailInfo };
}

/** Cache */
const CACHE_NS = 'QBANK_V1';
const CACHE_TTL = 60 * 60 * 6; 
function _cache(){ return CacheService.getScriptCache(); }
function invalidateCache(){
  _cache().remove(CACHE_NS);
  _cache().remove(CACHE_NS + '_chunks'); // [추가] 분할 캐시 키도 삭제
  _cache().remove('QBANK_MASTER_META_V3_count');
  return {ok:true, msg:'cache invalidated'};
}

// 문항 메타 목록은 아래 MasterIndex 기반 gatherAllCols_()에서 제공합니다.
// (본문/보기/해설은 getQuestionsByQids()로 필요한 문항만 읽습니다.)

function getSourceFiltersAndTypes() {
  // 원본 시트 전체 순회 대신 캐시/인덱스(gatherAllCols_)를 즉시 활용
  const allRows = gatherAllCols_();
  
  const grades = new Set();
  const yearsByGrade = { 'm1': new Set(), 'm2': new Set(), 'm3': new Set(), 'h1': new Set(), 'h2': new Set(), 'h3': new Set() };
  const monthsByGrade = { 'm1': new Set(), 'm2': new Set(), 'm3': new Set(), 'h1': new Set(), 'h2': new Set(), 'h3': new Set() };
  const detailsByGrade = { 'm1': new Set(), 'm2': new Set(), 'm3': new Set(), 'h1': new Set(), 'h2': new Set(), 'h3': new Set() };
  const types = new Set();
  const difficulties = new Set();

  allRows.forEach(r => {
    const g = String(r.grade || '').trim();
    const typ = String(r.type || '').trim();
    const dif = String(r.difficulty || '').trim();

    if (g) {
      grades.add(g);
      let gradeId = g;
      if (g.startsWith('중')) gradeId = 'm' + g.replace('중', '');
      if (g.startsWith('고')) gradeId = 'h' + g.replace('고', '');
      if (yearsByGrade[gradeId]) {
        if (r.year) yearsByGrade[gradeId].add(String(r.year));
        if (r.month) monthsByGrade[gradeId].add(r.month);
        if (r.detail) detailsByGrade[gradeId].add(r.detail);
      }
    }

    if (typ && typ.length < 15 && !typ.includes('_')) {
      types.add(typ);
    }
    if (dif) difficulties.add(dif);
  });

  const resultYears = {};
  const resultMonths = {};
  const resultDetails = {};
  for (const g in yearsByGrade) { resultYears[g] = [...yearsByGrade[g]].sort(); }
  for (const g in monthsByGrade) { resultMonths[g] = [...monthsByGrade[g]].sort(); }
  for (const g in detailsByGrade) { resultDetails[g] = [...detailsByGrade[g]].sort(); }

  return { 
    grades: [...grades].sort(), 
    yearsByGrade: resultYears, 
    monthsByGrade: resultMonths,
    detailsByGrade: resultDetails,
    types: [...types].sort(),
    difficulties: [...difficulties].sort((a,b)=>Number(a)-Number(b))
  };
}

function _filterRows(rows, filters){
  // 1. 공통 필터 (유형 등)
  const wantT = new Set(_arr(filters && (filters.types || filters.type)));
  const wantD = new Set(_arr(filters && filters.difficulties));
  
  // 2. 복합 필터 (Composite Filters) 존재 여부 확인
  const composites = filters && filters.composite;
  const hasComposite = Array.isArray(composites) && composites.length > 0;

  // 3. 기존 레거시 필터 (단일 필터)
  const wantG = new Set(_arr(filters && (filters.grades || filters.grade)));
  const wantY = new Set(_arr(filters && (filters.years  || filters.year  )).map(String));
  const wantM = new Set(_arr(filters && (filters.months || filters.month )));

  return rows.filter(r => {
    // (A) 유형(Type) 체크 (공통)
    if (wantT.size && !wantT.has(r.type)) return false;
    if (wantD.size && !wantD.has(String(r.difficulty))) return false;

    // (B) 학년/년도/월 체크
    if (hasComposite) {
        // [신규 로직] 학년별 개별 설정 (OR Logic)
        let matchAnyGroup = false;
        
        for (let i = 0; i < composites.length; i++) {
            const c = composites[i];
            const gSet = new Set(_arr(c.grade));
            const ySet = new Set(_arr(c.years).map(String));
            const mSet = new Set(_arr(c.months));
            
            const matchG = !gSet.size || gSet.has(r.grade);
            const matchY = !ySet.size || ySet.has(String(r.year));
            const matchM = !mSet.size || mSet.has(r.month);
            const dSet = new Set(_arr(c.details));
            const matchD = !dSet.size || dSet.has(r.detail);

            if (matchG && matchY && matchM && matchD) {
                matchAnyGroup = true;
                break;
            }
        }
        if (!matchAnyGroup) return false;

    } else {
        // [기존 로직] 전체 교집합 (AND Logic)
        if (wantG.size && !wantG.has(r.grade)) return false;
        if (wantY.size && !wantY.has(String(r.year))) return false;
        if (wantM.size && !wantM.has(r.month)) return false;
        const wantDetail = new Set(_arr(filters && (filters.details || filters.detail)));
        if (wantDetail.size && !wantDetail.has(r.detail)) return false;
    }

    return true;
  });
}

function getQuestionsByFilter(filters, count, options) {
  options = options || {};
  
  // 1. 기본 필터링 및 안 푼 문제 제외 로직 (기존 유지)
  let rows = _filterRows(gatherAllCols_(), filters || {});
  if (options.excludeSolved && filters.username) {
    try {
      const targetId = String(filters.username.id || filters.username).trim().toLowerCase();
      const solvedQids = new Set();

      // 로그 전체 대신 해당 학생 ID가 있는 행만 찾아 읽습니다.
      _logSheets_().forEach(sh => {
        _studentLogRows_(sh, targetId).forEach(r => {
          // C열: 학생 ID, O열: 정답여부
          if (String(r[2]).trim().toLowerCase() === targetId && r[14] === true) solvedQids.add(String(r[3]));
        });
      });

      if (solvedQids.size > 0) rows = rows.filter(r => !solvedQids.has(String(r.qid)));
    } catch (e) { console.error(e); }
  }

  // 2. 모의고사 모드: 메타로 순서를 정한 뒤 본문을 한 번에 읽습니다.
  if (options.mockMode) return getQuestionsByQids(_generateMockExam(rows));

  // 3. 지문(꾸러미) 단위로 그룹화 (화면 그룹핑과 같은 연계ID → 문제ID → QID 순)
  const groups = {};
  rows.forEach(row => {
    const key = _bundleKey_(row);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  let groupKeys = Object.keys(groups);

  // 4. [수정] 지문 세트 단위로 무작위 셔플 (기존과 동일)
  if (options.allInOrder !== true) {
    for (let i = groupKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groupKeys[i], groupKeys[j]] = [groupKeys[j], groupKeys[i]];
    }
  }

  // 5. [핵심 수정] count를 '지문 세트 개수'로 해석하여 추출
  const reqBundleCount = (Number(count) === 0) ? groupKeys.length : Math.max(1, Number(count || 5));
  const selectedKeys = groupKeys.slice(0, reqBundleCount);

  let finalPool = [];
  selectedKeys.forEach(key => {
    const bundle = groups[key];
    bundle.sort((a,b) => Number(a.col) - Number(b.col)); // 세트 내부 문항 순서 정렬
    finalPool = finalPool.concat(bundle);
  });

  // 6. 최종 출력은 시트/열 순서대로 정렬
  finalPool.sort((a,b) => {
    if (a.sheet !== b.sheet) return String(a.sheet).localeCompare(String(b.sheet));
    return Number(a.col) - Number(b.col);
  });

  // 7. MasterIndex에는 본문이 없으므로 선택된 문항만 원본 시트에서 읽어 반환
  return getQuestionsByQids(finalPool.map(q => q.qid));
}

function _bundleKey_(row) {
  return String(row.linkedId || '').trim() || String(row.extId || '').trim() || String(row.qid);
}

// 문서에서 복사해 온 '특수 하이픈'을 보통 하이픈(-)으로 바꿉니다. (화면 api-utils.js의 normalizeHyphens와 같은 규칙)
// 소프트 하이픈(U+00AD)은 화면에서 안 보여 "red-eye"가 "redeye"처럼 보이고, 서술형 정답 비교도 어긋납니다.
function _fixHyphens_(v) {
  return (v == null ? '' : String(v)).replace(/[\u00AD\u2010\u2011\u2012]/g, '-').replace(/\u2015/g, '\u2014');
}

function _mapOutput(q){
  ['question', 'answer', 'box1', 'box2', 'box3', 'box4', 'explanation'].forEach(k => { if (q[k] != null) q[k] = _fixHyphens_(q[k]); });
  if (Array.isArray(q.options)) q.options = q.options.map(_fixHyphens_);
  const out = {
    qid: q.qid,
    extId: q.extId || '',
    source: q.source,
    type: q.type,
    grade: q.grade,
    year: q.year,
    month: q.month,
    detail: q.detail,
    difficulty: q.difficulty || '-',
    question: q.question,
    answer: String(q.answer).trim()
  };

  out.groupHash = q.linkedId ? String(q.linkedId).trim() : (q.extId ? String(q.extId).trim() : q.qid);
  
  // 데이터가 존재하는 경우에만 속성 추가 (페이로드 최소화)
  if (q.box1) out.box1 = q.box1;
  if (q.box2) out.box2 = q.box2;
  if (q.box3) out.box3 = q.box3;
  if (q.box4) out.box4 = q.box4;
  
  // 보기가 배열이고 유효한 값이 하나라도 있을 때만 전송
  if (q.options && Array.isArray(q.options) && q.options.some(opt => String(opt||'').trim() !== '')) {
    out.options = q.options;
  }
  
  if (q.explanation) out.explanation = q.explanation;
  
  return out;
}

function _generateMockExam(rows) {
  const groups = {};
  rows.forEach(r => {
    const k = _bundleKey_(r);
    if(!groups[k]) groups[k] = [];
    groups[k].push(r);
  });
  const bundles = Object.values(groups);

  const pool = {};
  const addToPool = (type, bundle) => {
    if(!type) type = '기타';
    if(!pool[type]) pool[type] = [];
    pool[type].push(bundle);
  };
  bundles.forEach(b => {
    const t = String(b[0].type || '').trim();
    addToPool(t, b);
  });

  const popBundle = (keywords, minSize) => {
    const availableTypes = Object.keys(pool);
    const matches = availableTypes.filter(t => keywords.some(k => t.includes(k)));
    if(matches.length === 0) return null;

    const targetType = matches[Math.floor(Math.random() * matches.length)];
    let list = pool[targetType];

    if(!list || list.length === 0) return null;

    let candidates = list;
    if(minSize > 1) {
       candidates = list.filter(b => b.length >= minSize);
    }
    
    if(candidates.length === 0) return null;

    const idx = Math.floor(Math.random() * candidates.length);
    const selectedBundle = candidates[idx];

    const originalIdx = list.indexOf(selectedBundle);
    if (originalIdx > -1) list.splice(originalIdx, 1);
    if (list.length === 0) delete pool[targetType];

    return selectedBundle;
  };

  const SEQUENCE = [
    { keys:['목적'] },               
    { keys:['심경','분위기'] },      
    { keys:['주장'] },               
    { keys:['함축','밑줄'] },         
    { keys:['요지'] },               
    { keys:['주제'] },               
    { keys:['제목'] },               
    { keys:['도표'] },               
    { keys:['설명문','일치','불일치','지칭'] },
    { keys:['실용문','안내문'] },      
    { keys:['실용문','안내문'] },      
    { keys:['어법'] },               
    { keys:['어휘','영영풀이'] },               
    { keys:['빈칸'], count: 4 },     
    { keys:['흐름','무관'] },         
    { keys:['순서'], count: 2 },     
    { keys:['삽입','끼워'], count: 2 },
    { keys:['요약'] },               
    { keys:['41','42','장문'], isSet: true, minSize: 2 }, 
    { keys:['43','45','장문'], isSet: true, minSize: 3 }  
  ];

  let result = [];
  SEQUENCE.forEach(step => {
    const loop = step.count || 1;
    for(let i=0; i<loop; i++){
      const bundle = popBundle(step.keys, step.minSize || 1);
      if(bundle) {
        bundle.sort((a,b) => Number(a.col) - Number(b.col));
        result = result.concat(bundle);
      }
    }
  });
  // QID 순서만 반환하고 본문은 호출부에서 getQuestionsByQids로 읽습니다.
  return result.map(q => q.qid);
}


// 떨어진 행/열을 묶어 읽기 횟수와 불필요한 셀 읽기를 함께 줄입니다.
function _compactSpans_(numbers) {
  const sorted = [...new Set(numbers)].sort((a,b) => a-b);
  const spans = [];
  sorted.forEach(n => {
    const last = spans[spans.length - 1];
    if (last && n - last.end <= 16) last.end = n;
    else spans.push({start:n, end:n});
  });
  // getValues 개별 호출이 늘지 않도록 가까운 구간부터 최대 8개로 묶습니다.
  while (spans.length > 8) {
    let best=0, gap=Infinity;
    for(let i=0;i<spans.length-1;i++) {
      const distance=spans[i+1].start-spans[i].end;
      if(distance<gap) {gap=distance;best=i;}
    }
    spans[best].end=spans[best+1].end;
    spans.splice(best+1,1);
  }
  return spans;
}

function _findRowNumbers_(sheet, column, value, caseSensitive) {
  const text=String(value == null ? '' : value).trim();
  const lastRow=sheet.getLastRow();
  if(!text || lastRow < 2) return [];
  const escaped=text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sheet.getRange(2,column,lastRow-1,1)
    .createTextFinder('^\\s*'+escaped+'\\s*$').useRegularExpression(true)
    .matchEntireCell(true).matchCase(caseSensitive === true).findAll()
    .map(cell=>cell.getRow()).sort((a,b)=>a-b);
}

function _readRowNumbers_(sheet, numbers, width) {
  const wanted=new Set(numbers), result=[];
  let spans=_compactSpans_(numbers);
  // 대상 행이 넓게 퍼진 경우 과도한 왕복 대신 한 구간으로 읽습니다.
  if(spans.length>1) {
    const first=spans[0].start, last=spans[spans.length-1].end;
    const covered=spans.reduce((sum,span)=>sum+span.end-span.start+1,0);
    if(covered>=(last-first+1)*0.6) spans=[{start:first,end:last}];
  }
  spans.forEach(span=>{
    const data=sheet.getRange(span.start,1,span.end-span.start+1,width).getValues();
    data.forEach((values,i)=>{
      const rowNumber=span.start+i;
      if(wanted.has(rowNumber)) result.push({rowNumber,values});
    });
  });
  return result;
}

function _logSheets_() {
  return _logSS().getSheets().filter(sh => {
    const n = sh.getName();
    return n === QBANK_MASTER_LOG_SHEET || n.indexOf('Logs_') === 0;
  });
}

/* ===================== [속도] 풀이 기록 검색 범위 줄이기 =====================
 * 답안은 제출 시각의 분기 시트(Logs_2026_4Q 등)에 쌓이고, 과제 답안은 배부일 이후에만 생깁니다.
 * 그래서 배부일 기준 한 분기 전부터의 로그 시트만 검색합니다. (배부일을 나중에 고친 경우를 대비한 여유)
 * 예전 통합 로그(StudentLogs)는 마지막 기록이 배부일보다 이르면 건너뜁니다.
 * 배부일을 알 수 없는 세션(자유 풀이 등)은 예전처럼 모든 로그 시트를 봅니다.
 */
function _assignmentFloor_(sessionId) {
  const id=String(sessionId||'').trim();
  if(!id || id.length>200) return null;
  const cache=CacheService.getScriptCache(), key='ASGN_FLOOR_v1_'+id;
  const hit=cache.get(key);
  if(hit) { try { return JSON.parse(hit); } catch(e) {} }
  const sheet=_logSS().getSheetByName('과제');
  if(!sheet) return null;
  const rows=_findRowNumbers_(sheet,1,id,true);
  if(!rows.length) return null;
  const raw=sheet.getRange(rows[0],2).getValue();
  const tz=Session.getScriptTimeZone();
  let year, month, time;
  const local=typeof raw==='string' ? raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) : null;
  if(local) { year=Number(local[1]); month=Number(local[2]); time=new Date(year,month-1,Number(local[3])).getTime(); }
  else {
    const d=raw instanceof Date?raw:new Date(raw);
    if(isNaN(d.getTime())) return null;
    year=Number(Utilities.formatDate(d,tz,'yyyy')); month=Number(Utilities.formatDate(d,tz,'M')); time=d.getTime();
  }
  if(!(month>=1 && month<=12)) return null;
  const floor={y:year,q:Math.ceil(month/3),t:time};
  try { cache.put(key,JSON.stringify(floor),21600); } catch(e) {}
  return floor;
}

function _historySheets_(ss, sessionId) {
  const all=ss.getSheets().filter(sh=>sh.getName()===QBANK_MASTER_LOG_SHEET || sh.getName().indexOf('Logs_')===0);
  const floor=_assignmentFloor_(sessionId);
  if(!floor) return all;
  const minIdx=floor.y*4+floor.q-1-1;          // 한 분기 여유
  const minTime=floor.t-100*86400000;           // 통합 로그: 100일 여유
  return all.filter(sh=>{
    const name=sh.getName();
    const m=name.match(/^Logs_(\d{4})_([1-4])Q$/);
    if(m) return Number(m[1])*4+Number(m[2])-1>=minIdx;
    if(name===QBANK_MASTER_LOG_SHEET) {
      const last=_masterLogLastTime_(sh);
      return last===null || last>=minTime;
    }
    return true;   // 이름 규칙이 다른 시트는 안전하게 포함
  });
}

// 통합 로그의 마지막 기록 시각 (새 답안은 분기 시트에만 쌓이므로 1시간 기억)
function _masterLogLastTime_(sheet) {
  const cache=CacheService.getScriptCache(), key='MASTER_LOG_LAST_v1';
  const hit=cache.get(key);
  if(hit!==null) return hit==='' ? null : Number(hit);
  let t=null;
  try {
    const last=sheet.getLastRow();
    if(last>=2) { const v=sheet.getRange(last,1).getValue(); const n=(v instanceof Date?v:new Date(v)).getTime(); t=isNaN(n)?null:n; }
    else t=0;
  } catch(e) { t=null; }
  try { cache.put(key,t===null?'':String(t),3600); } catch(e) {}
  return t;
}

function _studentLogRows_(sheet, studentId) {
  return _readRowNumbers_(sheet,_findRowNumbers_(sheet,3,studentId,false),15)
    .map(item=>item.values);
}

/* ===================== [속도] 문항 내용 1시간 기억 =====================
 * 같은 문항을 여러 학생이 열 때 문제 시트를 매번 열지 않습니다.
 * 관리자 화면의 [🔄 문제 목록 인덱스 갱신] 버튼을 누르면 기억한 내용을 모두 버리고 새로 읽습니다.
 */
const QCACHE_TTL = 3600;
let _QCACHE_VER_ = null;
function _qcacheVer_() {
  if (_QCACHE_VER_ !== null) return _QCACHE_VER_;
  let v = '';
  try { v = PropertiesService.getScriptProperties().getProperty('QCACHE_VER') || ''; } catch (e) {}
  if (!v) { v = '1'; try { PropertiesService.getScriptProperties().setProperty('QCACHE_VER', v); } catch (e) {} }
  return (_QCACHE_VER_ = v);
}
function _bumpQcacheVer_() {
  const v = String(Date.now());
  try { PropertiesService.getScriptProperties().setProperty('QCACHE_VER', v); } catch (e) {}
  _QCACHE_VER_ = v;
}

function getQuestionsByQids(qids, omrOnly) {
  const want = _arr(qids).map(String);
  if (!want.length) return [];
  const mode = omrOnly === true ? 'L' : (omrOnly === 'result' ? 'R' : 'F');
  const uniq = [...new Set(want)];
  const keyOf = qid => (qid.length <= 180) ? 'QC_' + _qcacheVer_() + '_' + mode + '_' + qid : null;
  const found = new Map();
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (cache) {
    const keys = uniq.map(keyOf).filter(Boolean);
    let hits = {};
    try { hits = keys.length ? cache.getAll(keys) : {}; } catch (e) { hits = {}; }
    uniq.forEach(qid => {
      const k = keyOf(qid);
      if (k && hits[k]) { try { found.set(qid, JSON.parse(hits[k])); } catch (e) {} }
    });
  }
  const missing = uniq.filter(qid => !found.has(qid));
  if (missing.length) {
    const loaded = _loadQuestionsByQids_(missing, omrOnly);
    const toPut = {};
    loaded.forEach(q => {
      found.set(String(q.qid), q);
      const k = keyOf(String(q.qid));
      if (k) { const v = JSON.stringify(q); if (v.length < 90000) toPut[k] = v; }
    });
    if (cache && Object.keys(toPut).length) { try { cache.putAll(toPut, QCACHE_TTL); } catch (e) {} }
  }
  // 호출한 쪽이 문항 객체를 고쳐도 서로 영향이 없도록 복사본을 돌려줍니다.
  return want.map(qid => found.get(qid)).filter(Boolean).map(q => JSON.parse(JSON.stringify(q)));
}

function _loadQuestionsByQids_(qids, omrOnly) {
  const want=_arr(qids);
  const slim = omrOnly === true || omrOnly === 'result';
  if(!want.length) return [];
  // QID 자체가 "시트명!0기준열"이므로 전체 MasterIndex 조회가 필요하지 않습니다.
  const groups=Object.create(null);
  [...new Set(want)].forEach(qid=>{
    const match=String(qid).match(/^(.+)!([0-9]+)$/);
    if(!match) throw new Error('잘못된 문항 ID: '+qid);
    const col=Number(match[2]);
    if(!Number.isSafeInteger(col) || col<1) throw new Error('잘못된 문항 열: '+qid);
    if(!groups[match[1]]) groups[match[1]]=[];
    groups[match[1]].push({qid:String(qid),col});
  });
  const ss=_contentsSS(), found=new Map();
  Object.keys(groups).forEach(name=>{
    const sheet=ss.getSheetByName(name);
    if(!sheet) throw new Error('문항 시트를 찾을 수 없습니다: '+name);
    const metas=groups[name], lastCol=sheet.getLastColumn();
    if(metas.some(m=>m.col+1>lastCol)) throw new Error('문항 열 범위를 확인하십시오: '+name);
    _compactSpans_(metas.map(m=>m.col)).forEach(span=>{
      const width=span.end-span.start+1;
      const top=sheet.getRange(1,span.start+1,slim ? (omrOnly === 'result' ? 5 : 6) : 17,width).getValues();
      const answers=slim?sheet.getRange(16,span.start+1,1,width).getValues()[0]:null;
      metas.filter(m=>m.col>=span.start && m.col<=span.end).forEach(m=>{
        const offset=m.col-span.start, data=top.map(row=>row[offset]);
        const source=_S(data[1]), parsed=parseSource_(source);
        const q={qid:m.qid, extId:_S(data[0]), source, type:_S(data[2]),
          linkedId:_S(data[3]).trim(), difficulty:_S(data[4]), question:_S(data[5]),
          grade:parsed.grade,year:parsed.year,month:parsed.month,detail:parsed.detail,
          answer:slim?_S(answers[offset]).trim():_S(data[15]).trim()};
        if(!slim) {
          q.box1=_S(data[6]);q.box2=_S(data[7]);q.box3=_S(data[8]);q.box4=_S(data[9]);
          q.options=data.slice(10,15).map(_S);q.explanation=_S(data[16]);
        }
        const out=_mapOutput(q);
        if(omrOnly===true) out._omrLite=true;
        found.set(m.qid,out);
      });
    });
  });
  return want.map(qid=>found.get(String(qid))).filter(Boolean);
}

function ensureSheetIn_(fileId, sheetName, headers) {
  const ss = (fileId === QBANK_LOG_BOOK_ID) ? _logSS() : SpreadsheetApp.openById(fileId);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    if (headers && headers.length) {
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}


function gatherAllCols_(force) {
  const cacheKey = 'QBANK_MASTER_META_V3';
  if (!force) {
    const hit = _getLargeCache(cacheKey);
    if (hit) {
      try { const rows = JSON.parse(hit); if (Array.isArray(rows)) return rows; } catch(e) {}
    }
  }
  const ss = _contentsSS();
  let indexSheet = ss.getSheetByName('MasterIndex');
  if (!indexSheet) {
    _updateMasterIndex_();
    indexSheet = ss.getSheetByName('MasterIndex');
    if (!indexSheet) return [];
  }
  const lastRow = indexSheet.getLastRow();
  const data = lastRow > 1 ? indexSheet.getRange(2, 1, lastRow - 1, 12).getValues() : [];
  const result = data.map(row => ({
    qid: row[0], grade: row[1], year: row[2], month: row[3],
    type: row[4], difficulty: row[5], linkedId: row[6], extId: row[7],
    source: row[8], sheet: row[9], col: row[10], detail: row[11]
  }));
  // 최초 조회 및 시간 트리거 강제 갱신 모두 실제 캐시 저장까지 수행합니다.
  try { _putLargeCache(cacheKey, JSON.stringify(result)); } catch(e) {}
  return result;
}

/** 2. 인덱스 갱신 및 대용량 분할 캐싱 함수 */
function updateMasterIndex() {
  _guardDirect_();
  return _updateMasterIndex_();
}
function _updateMasterIndex_() {
  _bumpQcacheVer_();   // 문항 기억(1시간 캐시)을 버리고 새로 읽게 합니다.
  const ss = _contentsSS();
  let indexSheet = ss.getSheetByName('MasterIndex') || ss.insertSheet('MasterIndex');
  indexSheet.clear().appendRow(['QID', 'Grade', 'Year', 'Month', 'Type', 'Difficulty', 'LinkedId', 'ExtId', 'Source', 'SheetName', 'ColIndex', 'Detail']);
  const allMeta = [];
  const cacheBucket = { 'm1':[], 'm2':[], 'm3':[], 'h1':[], 'h2':[], 'h3':[] };
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    if (['양식', 'MasterIndex'].includes(name)) return;
    const data = sh.getRange(1, 1, 6, sh.getLastColumn()).getValues(); 
    
    for (let col = 1; col < data[1].length; col++) {
      const source = String(data[1][col] || '').trim();
      if (!source) continue;
      const p = parseSource_(source);
      const qid = name + '!' + col;
      const rowArr = [qid, p.grade, p.year, p.month, String(data[2][col]||''), String(data[4][col]||''), 
String(data[3][col]||''), String(data[0][col]||''), source, name, col, p.detail];
      allMeta.push(rowArr);
      
      let gKey = p.grade;
      if (gKey.startsWith('중')) gKey = 'm' + gKey.replace('중', '');
      if (gKey.startsWith('고')) gKey = 'h' + gKey.replace('고', '');
      
      if (cacheBucket[gKey]) {
        cacheBucket[gKey].push({ qid, grade: p.grade, year: p.year, month: p.month, detail: p.detail, type: rowArr[4], difficulty: rowArr[5], linkedId: rowArr[6], extId: rowArr[7], source, sheet: name, col });
      }
    }
  });

  if (allMeta.length > 0) indexSheet.getRange(2, 1, allMeta.length, allMeta[0].length).setValues(allMeta);
  
  // 학년별로 데이터를 JSON으로 만든 뒤, 용량이 크면 쪼개서 캐시에 저장합니다.
  for (let g in cacheBucket) {
    const jsonStr = JSON.stringify(cacheBucket[g]);
    _putLargeCache('QBANK_V2_DATA_' + g, jsonStr);
  }
  
  const fullMeta = allMeta.map(row => ({
    qid:row[0],grade:row[1],year:row[2],month:row[3],type:row[4],difficulty:row[5],
    linkedId:row[6],extId:row[7],source:row[8],sheet:row[9],col:row[10],detail:row[11]
  }));
  try { _putLargeCache('QBANK_MASTER_META_V3', JSON.stringify(fullMeta)); } catch(e) {}
  // 관리자 브라우저에 저장된 문항 목록이 새로 받도록 버전을 올립니다.
  try { PropertiesService.getScriptProperties().setProperty('QBANK_INDEX_VERSION', 'v' + Date.now()); } catch(e) {}
  return { success: true };
}

/** [추가] 대용량 캐시 저장을 위한 보조 함수 (쪼개기) */
function _putLargeCache(baseKey, dataStr) {
  const cache = CacheService.getScriptCache();
  const chunkSize = 24000; // 한글 포함 UTF-8 100KB 한도 내에서 분할
  const chunks = Math.ceil(dataStr.length / chunkSize);
  // 조각을 한 번에 저장합니다. 개수(_count)는 조각 저장이 끝난 뒤 기록합니다.
  const parts = {};
  for (let i = 0; i < chunks; i++) {
    parts[baseKey + '_' + i] = dataStr.substring(i * chunkSize, (i + 1) * chunkSize);
  }
  cache.putAll(parts, 21600);
  cache.put(baseKey + '_count', String(chunks), 21600);
}

/** [추가] 대용량 캐시 조립을 위한 보조 함수 (합치기) */
function _getLargeCache(baseKey) {
  const cache = CacheService.getScriptCache();
  const countStr = cache.get(baseKey + '_count');
  if (!countStr) return null;
  
  const count = parseInt(countStr, 10);
  if (!(count > 0)) return null;
  // 조각마다 cache.get을 부르지 않고 getAll 한 번으로 읽습니다.
  const keys = [];
  for (let i = 0; i < count; i++) keys.push(baseKey + '_' + i);
  const parts = cache.getAll(keys);
  let fullData = '';
  for (let i = 0; i < keys.length; i++) {
    const part = parts[keys[i]];
    if (part == null) return null;
    fullData += part;
  }
  return fullData;
}



/**************************************
 * 과제별 최신 결과: 배부 분기별 저장
 * 원본 Logs_*는 기존처럼 제출 분기에 계속 누적합니다.
 **************************************/
const ASSIGNMENT_RESULT_HEADERS = ['과제ID','학생ID','학생이름','문항순서','문항QID','문제ID','문제유형','난이도','정답','최신학생답','현재정답여부','누적오답횟수','오답이력여부','최종제출시각'];
const ASSIGNMENT_RESULT_INDEX_HEADERS = ['조회키','학생ID','과제ID','결과시트','시작행','문항수','갱신상태','갱신시각'];

function _resultContext_(userOrId, assignmentId) {
  const id = String(typeof userOrId === 'object' ? userOrId.id || '' : userOrId || '').trim();
  const aId = String(assignmentId || '').trim();
  if (!id || !aId) return null;
  const sheet = _logSS().getSheetByName('과제');
  if (!sheet) return null;
  const matches = _findRowNumbers_(sheet, 1, aId, true);
  if (!matches.length) return null;
  const rowNumber = matches[0], row = sheet.getRange(rowNumber,1,1,9).getValues()[0];
  const owner = String(row[7] || '').trim();
  if (owner && owner.toLowerCase() !== id.toLowerCase()) throw new Error('학생과 과제가 일치하지 않습니다.');
  let qids;
  try { qids = Array.isArray(row[5]) ? row[5] : JSON.parse(row[5]); } catch(e) { throw new Error('과제 문항 목록을 확인하십시오.'); }
  if (!Array.isArray(qids)) throw new Error('과제 문항 목록이 배열이 아닙니다.');
  const tz = Session.getScriptTimeZone();
  const localDate = typeof row[1] === 'string' && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(row[1])
    ? row[1].match(/^(\d{4})-(\d{1,2})-\d{1,2}(?:[ T]|$)/) : null;
  let year, month;
  if (localDate) { year=localDate[1]; month=Number(localDate[2]); }
  else {
    const date=row[1] instanceof Date?row[1]:new Date(row[1]);
    if(isNaN(date.getTime())) throw new Error('과제 배부일을 확인하십시오.');
    year=Utilities.formatDate(date,tz,'yyyy');month=Number(Utilities.formatDate(date,tz,'M'));
  }
  if(month<1 || month>12) throw new Error('과제 배부월을 확인하십시오.');
  const quarter=Math.ceil(month/3);
  return { id: owner || id, name: String(row[2] || ''), assignmentId: aId,
    qids: qids.map(String), assignmentSheet: sheet, assignmentRow: rowNumber,
    totalCount: parseInt(row[4],10) || 0,
    resultSheetName: '과제결과_' + year + '_' + quarter + 'Q',
    key: JSON.stringify([(owner || id).toLowerCase(), aId]) };
}

// 시트 끝에 행을 추가하는 순간처럼 꼭 필요한 구간만 잠급니다. (학생끼리 오래 기다리지 않도록)
function _withLock_(fn, waitMs) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs || 20000)) throw new Error('저장 요청이 몰려 있습니다. 잠시 후 다시 시도하십시오.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function _resultIndex_(ctx) {
  const find = sheet => {
    const matches = _findRowNumbers_(sheet,1,ctx.key,true);
    if (!matches.length) return null;
    const rowNumber=matches[0];
    return {sheet,rowNumber,values:sheet.getRange(rowNumber,1,1,8).getValues()[0]};
  };
  const existingSheet = _logSS().getSheetByName('과제결과_색인');
  const found = existingSheet ? find(existingSheet) : null;
  if (found) return found;
  // 새 색인 행 추가만 잠금 안에서 처리 (다른 요청이 먼저 만들었는지 다시 확인)
  return _withLock_(() => {
    const sheet = ensureSheetIn_(QBANK_LOG_BOOK_ID,'과제결과_색인',ASSIGNMENT_RESULT_INDEX_HEADERS);
    const again = find(sheet);
    if (again) return again;
    const rowNumber=sheet.getLastRow()+1;
    const values=[ctx.key,ctx.id,ctx.assignmentId,ctx.resultSheetName,0,0,'DIRTY',''];
    sheet.getRange(rowNumber,1,1,8).setValues([values]);
    return {sheet,rowNumber,values};
  });
}

// DIRTY 표시와 함께 고유 표식을 남기고 돌려줍니다. 더 늦게 들어온 갱신이 있으면 표식이 바뀝니다.
function _markResultDirty_(entry) {
  const stamp=_nowIso()+'#'+_uuid().slice(0,8);
  entry.values[6]='DIRTY';entry.values[7]=stamp;
  entry.sheet.getRange(entry.rowNumber,7,1,2).setValues([['DIRTY',stamp]]);
  return stamp;
}

function _storedResultRows_(ctx,entry) {
  const v=entry.values;
  if (String(v[3])!==ctx.resultSheetName || Number(v[5])!==ctx.qids.length) return null;
  if (!ctx.qids.length) return [];
  if (Number(v[4])<2) return null;
  const sheet=_logSS().getSheetByName(ctx.resultSheetName);
  if (!sheet) return null;
  const rows=sheet.getRange(Number(v[4]),1,ctx.qids.length,14).getValues();
  const valid=rows.every((row,i)=>String(row[0])===ctx.assignmentId &&
    String(row[1]).toLowerCase()===ctx.id.toLowerCase() && String(row[4])===ctx.qids[i]);
  return valid?rows:null;
}

function _writeAssignmentResult_(ctx,entry,history,stamp) {
  const existing=_storedResultRows_(ctx,entry);
  let questions;
  if (existing) {
    questions=existing.map(row=>({qid:String(row[4]),extId:String(row[5]),type:String(row[6]),difficulty:String(row[7]),answer:String(row[8])}));
  } else {
    questions=getQuestionsByQids(ctx.qids,'result');
    if (questions.length!==ctx.qids.length) throw new Error('일부 문항 정보를 찾을 수 없습니다.');
  }
  const rows=questions.map((q,i)=>{
    const h=history[q.qid] || {};
    const submitted=h.empty===false && String(h.selected||'').trim()!=='';
    return [ctx.assignmentId,ctx.id,ctx.name,i+1,q.qid,String(q.extId||''),String(q.type||''),String(q.difficulty||''),
      String(q.answer||''),submitted?String(h.selected):'',submitted?h.isCorrect===true:'',Number(h.wrongCount)||0,
      h.wasWrong===true,submitted?String(h.lastSubmittedAt||''):''];
  });
  const reusable=existing && Number(entry.values[4])>=2;
  let start=0;
  if (rows.length && reusable) {
    // 이 과제 전용 구역을 덮어쓰므로 잠금이 필요 없습니다.
    start=Number(entry.values[4]);
    _logSS().getSheetByName(ctx.resultSheetName).getRange(start,1,rows.length,14).setValues(rows);
  } else if (rows.length) {
    // 시트 끝에 새 구역을 잡는 순간만 잠급니다.
    start=_withLock_(() => {
      const sheet=ensureSheetIn_(QBANK_LOG_BOOK_ID,ctx.resultSheetName,ASSIGNMENT_RESULT_HEADERS);
      const at=sheet.getLastRow()+1;
      sheet.getRange(at,1,rows.length,14).setValues(rows);
      return at;
    });
  }
  // 그 사이 새 제출이 DIRTY 표식을 바꿨다면 READY로 만들지 않습니다(다음 조회 때 최신 기록으로 재계산).
  _withLock_(() => {
    const current=entry.sheet.getRange(entry.rowNumber,1,1,8).getValues()[0];
    if (stamp && String(current[7])!==String(stamp)) return;
    entry.values=[ctx.key,ctx.id,ctx.assignmentId,ctx.resultSheetName,start,rows.length,'READY',_nowIso()];
    entry.sheet.getRange(entry.rowNumber,1,1,8).setValues([entry.values]);
  }, 10000);
  return rows;
}

// 과제 완료 기준: 모든 문항의 '가장 최근 답'이 정답일 때만 '완료'.
// (예전에는 모든 문항에 답만 하면 완료로 잠겨서, 오답을 고치지 못하는 문제가 있었습니다.)
// 오답이 남아 있는데 '완료'로 잠겨 있던 과제는 '미완료'로 되돌려 다시 풀 수 있게 합니다.
// forceComplete(브라우저가 보낸 값)는 더 이상 쓰지 않고, 서버 기록만으로 판단합니다.
function _syncResultSummary_(ctx,history,forceComplete) {
  let answered=0,strict=0,correctNow=0;
  Object.values(history).forEach(h=>{
    if(h && !h.empty && String(h.selected||'').trim()!=='') {
      answered++;
      if(h.isCorrect===true) correctNow++;
      if(h.isCorrect===true && !h.wasWrong) strict++;
    }
  });
  const total=(ctx.qids && ctx.qids.length) || ctx.totalCount || 0;
  const allCorrect=total>0 && correctNow>=total;
  const statusCell=ctx.assignmentSheet.getRange(ctx.assignmentRow,7);
  const current=String(statusCell.getValue()||'').trim();
  const next=allCorrect?'완료':'미완료';
  if(current!==next) statusCell.setValue(next);
  ctx.assignmentSheet.getRange(ctx.assignmentRow,10,1,2).setValues([[answered,strict]]);
}

/* [한 번만 실행] 오답이 남았는데 '완료'로 잠긴 과제를 '미완료'로 되돌립니다.
 * GS 편집기에서 함수 목록의 fixWronglyCompletedAssignments 를 고르고 ▶실행 하세요.
 * 최근 days일(기본 120일) 안에 배부된 '완료' 과제만 검사합니다. 결과는 실행 로그에 나옵니다.
 */
function fixWronglyCompletedAssignments(days) {
  const limitDays=Number(days)||120;
  const sheet=_logSS().getSheetByName('과제');
  if(!sheet) return 'no sheet';
  const data=sheet.getDataRange().getValues();
  const since=Date.now()-limitDays*86400000;
  const started=Date.now();
  let checked=0,reopened=0,stopped=false;
  for(let i=1;i<data.length;i++){
    if(Date.now()-started>300000){stopped=true;break;} // 5분 넘으면 멈춤(다시 실행하면 이어서 검사)
    const row=data[i];
    if(String(row[6]||'').trim()!=='완료') continue;
    const t=new Date(row[1]).getTime();
    if(!isNaN(t) && t<since) continue;
    const sid=String(row[7]||'').trim(); if(!sid) continue;
    let qids=[];try{qids=Array.isArray(row[5])?row[5]:JSON.parse(row[5]);}catch(e){continue;}
    if(!Array.isArray(qids)||!qids.length) continue;
    checked++;
    const history=getAssignmentHistory(sid,qids.map(String),String(row[0]));
    const allCorrect=qids.every(q=>history[String(q)] && history[String(q)].isCorrect===true);
    if(!allCorrect){
      sheet.getRange(i+1,7).setValue('미완료');
      reopened++;
      console.log('미완료로 되돌림: '+row[2]+' / '+row[3]);
    }
  }
  const msg='검사 '+checked+'건, 되돌림 '+reopened+'건'+(stopped?' (시간 초과로 중간에 멈춤 → 한 번 더 실행하십시오)':'');
  console.log(msg);
  return msg;
}

function _resultResponse_(rows) {
  const qs=[],history={};
  rows.forEach(row=>{
    const qid=String(row[4]),selected=String(row[9]||'');
    qs.push({qid,extId:String(row[5]),type:String(row[6]),difficulty:String(row[7]),answer:String(row[8])});
    history[qid]={empty:selected.trim()==='',selected,isCorrect:row[10]===true,
      wrongCount:Number(row[11])||0,wasWrong:row[12]===true,correctAnswer:String(row[8])};
  });
  return {qs,history};
}

// 최근 과제 상세와 배부기록 결과표 전용. 본문·보기·해설을 읽지 않습니다.
function getAssignmentResult(userOrId, ignoredQids, assignmentId) {
  _guardDirect_();
  // 읽기 전용 경로는 잠그지 않습니다. 재계산이 필요할 때도 행 추가 순간만 잠깁니다.
  const ctx=_resultContext_(userOrId,assignmentId);
  if (!ctx) throw new Error('과제를 찾을 수 없습니다. 목록을 새로고침하십시오.');
  const entry=_resultIndex_(ctx);
  let rows=entry.values[6]==='READY'?_storedResultRows_(ctx,entry):null;
  if (!rows) {
    const stamp=_markResultDirty_(entry);
    const history=getAssignmentHistory({id:ctx.id},ctx.qids,ctx.assignmentId,true);
    _syncResultSummary_(ctx,history,false);
    rows=_writeAssignmentResult_(ctx,entry,history,stamp);
  }
  return _resultResponse_(rows);
}

function logAttempt(payload) {
  let logCommitted=false,sessionId='',count=0;
  try {
    payload=payload||{};
    const user=payload.user;
    if (!user || !user.id) return {ok:false,msg:'Login required'};
    sessionId=_S(payload.sessionId)||_uuid();
    // 같은 제출이 재전송되어도 로그가 두 번 쌓이지 않도록 6시간 동안 기억합니다.
    const attemptKey=payload.attemptId?'ATTEMPT_'+String(payload.attemptId).slice(0,80):'';
    const cache=CacheService.getScriptCache();
    if (attemptKey) {
      const done=cache.get(attemptKey);
      if (done) return {ok:true,sessionId,count:Number(done)||0,duplicate:true};
    }
    const ts=_nowIso();
    const answers=(payload.answers||[]).filter(a=>a.selected && String(a.selected).trim()!=='');
    const ctx=payload.sessionId?_resultContext_(user,sessionId):null;
    const entry=ctx?_resultIndex_(ctx):null;
    if (entry) _markResultDirty_(entry); // 도중에 멈춰도 다음 조회 때 다시 계산되도록 먼저 표시
    const now=new Date(),tz=Session.getScriptTimeZone();
    const year=Utilities.formatDate(now,tz,'yyyy');
    const quarter=Math.ceil(Number(Utilities.formatDate(now,tz,'M'))/3);
    const rows=answers.map(a=>[ts,sessionId,String(user.id).trim(),_S(a.qid),String(_S(a.qid).split('!')[1]||''),
      _S(a.extId||''),_S(a.source),_S(a.type),_S(a.grade),_S(a.year),_S(a.month),_S(a.question).slice(0,200),
      _S(a.correctAnswer),_S(a.selected),a.isCorrect===true]);
    // 잠금은 로그 시트 끝에 행을 붙이는 순간에만 잡습니다.
    if(rows.length) {
      _withLock_(() => {
        const currentLog=ensureSheetIn_(QBANK_LOG_BOOK_ID,`Logs_${year}_${quarter}Q`,[
          'Timestamp','SessionId','Name','QID','SheetCol','ExtID','Source','Type','Grade','Year','Month','Question','CorrectAnswer','Selected','IsCorrect'
        ]);
        currentLog.getRange(currentLog.getLastRow()+1,1,rows.length,15).setValues(rows);
      }, 30000);
    }
    logCommitted=true;count=rows.length;
    if (attemptKey) { try { cache.put(attemptKey,String(count),21600); } catch(e) {} }
    if(ctx) {
      // 이후 결과표 갱신은 잠금 밖에서 처리합니다. 도중 실패해도 DIRTY로 남아 다음 조회에서 복구됩니다.
      const stamp=_markResultDirty_(entry);
      const history=getAssignmentHistory({id:ctx.id},ctx.qids,sessionId,true);
      _syncResultSummary_(ctx,history,payload.isComplete);
      _writeAssignmentResult_(ctx,entry,history,stamp);
    }
    return {ok:true,sessionId,count};
  } catch(e) {
    // 원본 로그가 저장됐다면 재제출을 유도하지 않습니다. DIRTY 결과는 다음 조회에서 복구됩니다.
    if(logCommitted) return {ok:true,sessionId,count,resultPending:true,msg:String(e)};
    return {ok:false,msg:String(e)};
  }
}

/* [신규] 문제와 풀이 기록을 한 번에 로딩하는 통합 함수 */
function loadRetryData(user, qids, assignmentId, viewMode) {
  // 1. 문제 정보 가져오기
  const qs = getQuestionsByQids(qids, viewMode === 'omr');
  
  // 2. 풀이 기록 가져오기
  // (기존 getAssignmentHistory 로직 재사용)
  const history = getAssignmentHistory(user, qids, assignmentId);
  
  return { qs: qs, history: history };
}

function getWrongStats(user, sinceDays){
  const ss = _logSS();
  // user 객체에서 ID를 추출 (문자열로 넘어올 경우 대비)
  const targetId = (typeof user === 'object') ? String(user.id || '').trim().toLowerCase() : String(user || '').trim().toLowerCase();
  
  // 전체 시트 중 로그 시트만 필터링
  const logSheets = ss.getSheets().filter(sh => {
    const n = sh.getName();
    return n === QBANK_MASTER_LOG_SHEET || n.indexOf('Logs_') === 0;
  });

  if (logSheets.length === 0) return [];

  const tz = Session.getScriptTimeZone();
  const minTime = (sinceDays && sinceDays > 0) ? new Date(Date.now() - sinceDays * 24 * 3600 * 1000) : null;
  const agg = new Map();

  // 모든 로그 시트에서 대상 학생의 행만 찾아 읽습니다.
  logSheets.forEach(sheet => {
    const data = [[]].concat(_studentLogRows_(sheet, targetId));
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const rowUserId = String(r[2] || '').trim().toLowerCase();
      
      // 해당 학생의 기록이 아니면 건너뜀
      if (rowUserId !== targetId) continue;

      const tsStr = String(r[0] || '');
      const ts = new Date(tsStr);
      if (minTime && ts < minTime) continue;

      const qid = String(r[3] || '');
      if (!qid) continue;

      const isCorrect = (r[14] === true);
      const selected = String(r[13] || '').trim();
      
      // 풀지 않은 빈 답안 제출은 오답 통계에서 제외
      if (!isCorrect && selected === '') continue;

      const sheetCol = String(r[4] || '');
      const extId = String(r[5] || '');
      const source = String(r[6] || '');
      const type = String(r[7] || '');
      const grade = String(r[8] || '');
      const year = String(r[9] || '');
      const month = String(r[10] || '');

      if (!agg.has(qid)) {
        let numFromExt = ''; 
        const m = extId.match(/(\d+)\s*$/); 
        if (m) numFromExt = m[1];
        const number = numFromExt || sheetCol;
        
        agg.set(qid, {
          qid, grade, year, month, type, source, number, 
          wrongCount: isCorrect ? 0 : 1,
          lastTs: ts, 
          lastIsCorrect: isCorrect
        });
      } else {
        const it = agg.get(qid);
        if (!isCorrect) it.wrongCount += 1;
        
        // 더 나중에 푼 기록이 있으면 최종 상태 갱신
        if (ts > it.lastTs) { 
          it.lastTs = ts; 
          it.lastIsCorrect = isCorrect; 
        }
      }
    }
  });

  // 오답 이력이 있는(wrongCount > 0) 항목만 배열로 변환
  const out = Array.from(agg.values())
    .filter(it => it.wrongCount > 0)
    .map(it => ({
      ...it,
      fixed: it.lastIsCorrect === true,
      lastTs: Utilities.formatDate(it.lastTs, tz, 'yyyy-MM-dd HH:mm:ss')
    }));

  // 정렬: 최신 풀이일 역순 -> 학년 -> 년도 -> 월 -> 번호
  out.sort((a,b)=>{
    if (b.lastTs.localeCompare(a.lastTs) !== 0) return b.lastTs.localeCompare(a.lastTs);
    if ((a.grade||'').localeCompare(b.grade||'') !== 0) return (a.grade||'').localeCompare(b.grade||'');
    if ((b.year||'').localeCompare(a.year||'') !== 0) return (b.year||'').localeCompare(a.year||'');
    if ((a.month||'').localeCompare(b.month||'') !== 0) return (a.month||'').localeCompare(b.month||'');
    const an = Number(a.number||0), bn = Number(b.number||0);
    return (isNaN(an)||isNaN(bn)) ? String(a.number||'').localeCompare(String(b.number||'')) : (an - bn);
  });
  
  return out;
}

/* [오답노트 v2] 학생이 푼 모든 문항의 '과제(세션)별 첫 시도' 기록을 돌려줍니다.
 * - 같은 과제에서 여러 번 다시 풀어도 한 번만 셉니다. (과제출제·주간평가 통계와 같은 기준)
 * - 기간(7일/30일/전체)·유형·난이도별 정답률은 브라우저에서 계산합니다.
 * - 고침 여부는 어디서 풀었든 '가장 마지막 시도'가 정답인지로 정합니다.
 * 반환: { v:2, items:[{ qid, grade, year, month, detail, type, number, difficulty, last, lastCorrect, a:[[초, 정답1/0], ...] }] }
 */
function getWrongNote(user) {
  const targetId = (typeof user === 'object') ? String(user.id || '').trim().toLowerCase() : String(user || '').trim().toLowerCase();
  if (!targetId) return { v: 2, items: [] };

  const meta = new Map();
  try { gatherAllCols_().forEach(q => meta.set(String(q.qid), q)); } catch (e) { console.error('오답노트 메타 읽기 실패', e); }

  const agg = new Map();
  _logSheets_().forEach(sheet => {
    _studentLogRows_(sheet, targetId).forEach(r => {
      if (String(r[2] || '').trim().toLowerCase() !== targetId) return;
      const selected = String(r[13] || '').trim();
      if (!selected) return; // 비워 둔 답은 세지 않음
      const qid = String(r[3] || '').trim();
      if (!qid) return;
      const ts = new Date(r[0]).getTime();
      if (isNaN(ts)) return;
      const correct = r[14] === true ? 1 : 0;
      const sid = String(r[1] || '').trim() || ('_' + ts);

      let it = agg.get(qid);
      if (!it) {
        const m = meta.get(qid) || {};
        const extId = String(r[5] || '');
        const mm = extId.match(/(\d+)\s*$/);
        it = {
          qid: qid,
          grade: String(m.grade || r[8] || ''),
          year: String(m.year || r[9] || ''),
          month: String(m.month || r[10] || ''),
          detail: String(m.detail || ''),
          type: String(m.type || r[7] || ''),
          number: mm ? mm[1] : String(r[4] || ''),
          difficulty: String(m.difficulty == null ? '' : m.difficulty),
          last: 0, lastCorrect: 0,
          sess: {}
        };
        agg.set(qid, it);
      }
      const prev = it.sess[sid];
      if (!prev || ts < prev[0]) it.sess[sid] = [ts, correct];
      if (ts >= it.last) { it.last = ts; it.lastCorrect = correct; }
    });
  });

  const items = [];
  agg.forEach(it => {
    const a = Object.keys(it.sess).map(k => [Math.floor(it.sess[k][0] / 1000), it.sess[k][1]]).sort((x, y) => x[0] - y[0]);
    delete it.sess;
    it.last = Math.floor(it.last / 1000);
    it.a = a;
    items.push(it);
  });
  return { v: 2, items: items };
}

/**************************************
 * 3) 과제(Assignment) 배부 및 관리 시스템
 **************************************/

// 과제 데이터 저장 (관리자가 출력 시 실행)
function createAssignment(targetUserObj, filterSummary, qids, isWeekly) {
  _guardDirect_();
  try {
    const assignmentId = Utilities.getUuid();
    const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const qidString = JSON.stringify(qids);
    const count = qids.length;
    
    const title = filterSummary || '선택 출제 과제';
    const weeklyTag = isWeekly ? 'TRUE' : '';
    // 잠금은 '과제' 시트에 행을 붙이는 순간에만 잡습니다. (잠금을 못 잡으면 오류로 알려 줍니다)
    _withLock_(() => {
      const sheet = _assignmentSheet_();
      // J/K열(제출 수, 정답 수)을 0으로 기록해 두면 배부기록 조회 때 로그를 다시 계산하지 않습니다.
      sheet.appendRow([
          assignmentId, date, targetUserObj.name, title, count, 
          qidString, '미완료', targetUserObj.id, weeklyTag, 0, 0
      ]);
    }, 30000);

    // 인쇄용 문항 본문은 잠금을 푼 뒤 읽어 함께 전달 (1-Trip 유지)
    const qs = getQuestionsByQids(qids);
    return { success: true, assignmentId: assignmentId, qs: qs, title: title };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}

// '과제' 시트를 돌려줍니다(없으면 만듭니다). 잠금 안에서 호출합니다.
function _assignmentSheet_() {
  const ss = _logSS();
  let sheet = ss.getSheetByName('과제');
  if (!sheet) {
    sheet = ss.insertSheet('과제');
    sheet.appendRow(['ID', '배부일', '학생이름', '과제명', '문항수', '문항목록(JSON)', '상태', '학생ID', '주간평가여부']);
  }
  return sheet;
}

/* [추가] 여러 학생에게 동일한 과제를 일괄 생성 (순서 보장) */
function createBulkAssignments(userList, title, qids) {
  _guardDirect_();
  try {
    const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const qidString = JSON.stringify(qids);
    const count = qids.length;

    // 학생 수만큼 appendRow를 반복하지 않고 한 번에 기록합니다.
    const newRows = userList.map(user => [
      Utilities.getUuid(), date, user.name, title, count,
      qidString, '미완료', user.id, '', 0, 0
    ]);
    if (newRows.length) {
      _withLock_(() => {
        const sheet = _assignmentSheet_();
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 11).setValues(newRows);
      }, 30000);
    }

    const qs = getQuestionsByQids(qids);
    return { success: true, count: userList.length, qs: qs };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}


// 학생용: 과제 완료 처리 (채점 후 호출)
function getAdminQuestionInventory(studentIdInput) {
  _guardDirect_();
  const allQuestions = gatherAllCols_();
  const questionStats = {}; 
  const ss = _logSS();
  
  let targetId = String(studentIdInput).trim().toLowerCase();

  // 1. 모든 로그 시트 찾기 (StudentLogs + Logs_로 시작하는 모든 시트)
  const logSheets = ss.getSheets().filter(sh => {
    const name = sh.getName();
    return name === QBANK_MASTER_LOG_SHEET || name.indexOf('Logs_') === 0;
  });

  const sessionStats = {};

  // 2. 모든 로그 시트 순회
  logSheets.forEach(sh => {
    const data = [[]].concat(_studentLogRows_(sh, targetId));
    for (let i = 1; i < data.length; i++) {
      // 데이터 예시 기준: C열(index 2)이 학생 ID(Name)
      const rowUserId = String(data[i][2] || '').trim().toLowerCase();
      if (rowUserId !== targetId) continue;

      const rowTs = new Date(data[i][0]);
      const sessionId = String(data[i][1] || '').trim(); // B열: 과제ID
      const qid = String(data[i][3] || '').trim();      // D열: QID
      const extId = String(data[i][5] || '').trim();    // F열: ExtID
      const isCorrect = data[i][14];                    // O열: 정답여부
      const selected = String(data[i][13] || '').trim(); // N열: 학생답

      const key = extId || qid; 
      if (!key) continue;

      if (!sessionStats[key]) sessionStats[key] = {};
      if (!sessionStats[key][sessionId]) {
        sessionStats[key][sessionId] = { isSolved: false, wrongCount: 0, lastTs: rowTs };
      }

      const curr = sessionStats[key][sessionId];
      if (rowTs > curr.lastTs) curr.lastTs = rowTs;
      if (isCorrect === true) curr.isSolved = true;
      else if (isCorrect === false && selected !== '') curr.wrongCount++;
    }
  });

  // 3. 가장 최근 세션의 기록만 추출
  for (const key in sessionStats) {
    let latestSess = null;
    let maxTs = -1;
    for (const sId in sessionStats[key]) {
      const ts = (sessionStats[key][sId].lastTs instanceof Date) ? sessionStats[key][sId].lastTs.getTime() : 0;
      if (ts > maxTs) { maxTs = ts; latestSess = sessionStats[key][sId]; }
    }
    if (latestSess) {
      questionStats[key] = { isSolved: latestSess.isSolved, wrongCount: latestSess.wrongCount, lastTs: latestSess.lastTs };
    }
  }

  // 4. 인벤토리 매핑 (학년 통합 인덱스 기반)
  return allQuestions.map(q => {
    const qExt = String(q.extId || '').trim();
    const stat = questionStats[qExt] || questionStats[q.qid] || { isSolved: false, wrongCount: 0 };
    return {
      qid: q.qid, grade: q.grade, year: q.year, month: q.month, detail: q.detail, type: q.type, difficulty: q.difficulty,
      number: q.extId || '', isSolved: stat.isSolved, wrongCount: stat.wrongCount,
      lastTs: stat.lastTs ? Utilities.formatDate(stat.lastTs, Session.getScriptTimeZone(), "yyyy-MM-dd") : null,
      groupHash: q.linkedId || q.extId || q.qid
    };
  });
}



// ★ [최적화] 미완료 및 완료 과제를 한 번에 묶어서 반환하는 통합 함수 (시트 1회 단일 스캔)
function getAllMyAssignments(user) {
  const ss = _logSS();
  const sheet = ss.getSheetByName('과제');
  if (!sheet) return { active: [], completed: [] };

  const active = [];
  const completed = [];

  const targetId = (typeof user === 'object') ? String(user.id || '').trim() : '';
  const targetName = (typeof user === 'object') ? String(user.name || '').trim() : String(user || '').trim();

  // 과제 시트 전체(모든 학생의 문항 JSON 포함) 대신 H열(학생ID)·C열(이름)이 일치하는 행만 읽습니다.
  // 이름 검색은 학생ID가 없는 구형 과제용이며, 아래 isMatch에서 동명이인을 다시 걸러냅니다.
  const rowNumbers = targetId ? _findRowNumbers_(sheet, 8, targetId, true) : [];
  if (targetName) rowNumbers.push(..._findRowNumbers_(sheet, 3, targetName, true));
  const width = Math.min(11, sheet.getMaxColumns());
  const data = [[]].concat(_readRowNumbers_(sheet, rowNumbers, width)
    .sort((a, b) => a.rowNumber - b.rowNumber).map(item => item.values));

  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  const thresholdTime = d.getTime();
  const tz = Session.getScriptTimeZone();

  // 최신순 탐색
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const rowId = String(row[7] || '').trim();
    const rowName = String(row[2] || '').trim();
    const status = String(row[6] || '').trim();

    const isMatch = (rowId && targetId) ? (rowId === targetId) : (rowName === targetName);
    if (!isMatch) continue;

    let dateValue = row[1];
    let rowTime = 0;
    if (dateValue instanceof Date) {
      rowTime = dateValue.getTime();
      try { dateValue = Utilities.formatDate(dateValue, tz, 'yyyy-MM-dd HH:mm'); } catch(e) { dateValue = String(dateValue); }
    } else {
      rowTime = new Date(dateValue).getTime();
    }

    if (status === '미완료') {
      active.push({
        id: row[0],
        date: dateValue,
        title: row[3],
        count: row[4],
        qids: row[5],
        isWeekly: String(row[8] || '').trim().toUpperCase() === 'TRUE'
      });
    } else if (status === '완료') {
      if (thresholdTime > 0 && !isNaN(rowTime) && rowTime < thresholdTime) continue;
      completed.push({
        id: row[0],
        date: dateValue,
        student: rowName,
        title: row[3],
        count: row[4],
        qids: row[5],
        status: status,
        isWeekly: String(row[8] || '').trim().toUpperCase() === 'TRUE',
        studentId: rowId
      });
    }
  }
  return { active: active, completed: completed };
}

// 2. 특정 과제 문항들의 과거 풀이 기록(정답 여부) 가져오기
function getAssignmentHistory(userOrId, qids, targetSessionId, includeTimestamp) {
  const ss=_logSS();
  const targetId=String(typeof userOrId==='object'?userOrId.id:userOrId).trim().toLowerCase();
  const sessionId=String(targetSessionId||'').trim();
  const history={}, latest={};
  _arr(qids).forEach(qid=>{history[qid]={empty:true,wrongCount:0,wasWrong:false,isCorrect:false,selected:'',correctAnswer:''};});
  if(!targetId || !sessionId || !Object.keys(history).length) return history;
  // [속도] 이 과제의 답안이 들어 있을 수 있는 로그 시트만 봅니다. (배부일 이전 분기 시트는 건너뜀)
  const sheets=_historySheets_(ss,sessionId);
  sheets.forEach(sheet=>{
    const numbers=_findRowNumbers_(sheet,2,sessionId,true);
    // 해당 과제의 행만 묶어서 읽고 타 학생 기록은 다시 검증합니다.
    _readRowNumbers_(sheet,numbers,15).forEach(item=>{
      const row=item.values, qid=String(row[3]);
      if(String(row[2]).trim().toLowerCase()!==targetId || !Object.prototype.hasOwnProperty.call(history,qid)) return;
      const entry=history[qid], selected=String(row[13]).trim(), correct=row[14]===true;
      entry.empty=false;
      if(!correct && selected!=='') {entry.wrongCount++;entry.wasWrong=true;}
      const time=new Date(row[0]).getTime();
      // 분기 시트 순서와 무관하게 가장 최근 답안을 복원합니다.
      const stamp=isNaN(time)?0:time;
      if(latest[qid]===undefined || stamp>=latest[qid]) {
        latest[qid]=stamp;entry.selected=selected;entry.isCorrect=correct;entry.correctAnswer=String(row[12]);
        if (includeTimestamp) entry.lastSubmittedAt = row[0] instanceof Date
          ? Utilities.formatDate(row[0],Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss') : String(row[0]);
      }
    });
  });
  return history;
}

// [GS 파일 하단에 추가] 관리자용: 전체 과제 기록 초고속 조회 (로그 스캔 제거 + 과거 과제 자동 동기화)
function getAllAssignmentsForAdmin(searchName, loadAll) {
  _guardDirect_();
  const ss = SpreadsheetApp.openById(QBANK_LOG_BOOK_ID);
  const sheet = ss.getSheetByName('과제');
  if (!sheet) return [];

  const rawList = [];
  const query = String(searchName || '').trim().toLowerCase();

  let thresholdTime = 0;
  if (loadAll !== true) {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    thresholdTime = d.getTime();
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  // 과제는 배부 순서대로 쌓이므로, B열(배부일)만 먼저 읽어 기간 안의 첫 행부터만 본문을 읽습니다.
  let firstRow = 2;
  if (thresholdTime > 0) {
    const dates = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    let found = -1;
    for (let k = 0; k < dates.length; k++) {
      const t = new Date(dates[k][0]).getTime();
      if (!isNaN(t) && t >= thresholdTime) { found = k; break; }
    }
    if (found === -1) return [];
    firstRow = 2 + found;
  }
  const body = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, Math.min(11, sheet.getMaxColumns())).getValues();
  // 기존 루프(행번호 = i + 1)를 그대로 쓰기 위해 앞쪽을 빈 배열로 채웁니다.
  const data = new Array(firstRow - 1).fill(null).concat(body);

  // 1. 기본 과제 정보 수집 (최신순 탐색)
  for (let i = data.length - 1; i >= firstRow - 1; i--) {
    const row = data[i];
    let dateValue = row[1];
    if (!dateValue) continue;

    const rowTime = new Date(dateValue).getTime();
    if (thresholdTime > 0 && !isNaN(rowTime) && rowTime < thresholdTime) {
      continue; 
    }

    const studentName = String(row[2] || '');
    if (query && !studentName.toLowerCase().includes(query)) continue;

    try { 
      dateValue = Utilities.formatDate(new Date(dateValue), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); 
    } catch(e) { dateValue = String(dateValue); }

    // J열(index 9)과 K열(index 10)에 이미 기록된 숫자가 있는지 확인
    const hasJ = row.length > 9 && row[9] !== '';
    const hasK = row.length > 10 && row[10] !== '';

    rawList.push({
      id: String(row[0]), // SessionId
      date: dateValue,
      student: studentName,
      title: String(row[3]),
      totalCount: parseInt(row[4], 10) || 0,
      qids: row[5],
      status: String(row[6]),
      isWeekly: String(row[8] || '').trim().toUpperCase() === 'TRUE',
      studentId: String(row[7] || '').trim(),
      rowIndex: i + 1, // 시트 행 번호
      answeredCount: hasJ ? parseInt(row[9], 10) : null,
      strictCorrectCount: hasK ? parseInt(row[10], 10) : null
    });
  }

  if (rawList.length === 0) return [];

  // ★ 2. 과거 과제 자동 동기화 (J, K열이 비어있는 행만 딱 1회 계산 후 영구 저장)
  const needBackfill = rawList.filter(r => r.answeredCount === null || r.strictCorrectCount === null);

  // 새 과제는 생성 시 0으로 기록되므로 보통 비어 있지 않습니다. 소수만 비었으면 과제별로 해당 행만 조회합니다.
  if (needBackfill.length > 0 && needBackfill.length <= 15 && needBackfill.every(r => r.studentId)) {
    needBackfill.forEach(item => {
      let qids = [];
      try { qids = Array.isArray(item.qids) ? item.qids : JSON.parse(item.qids); } catch(e) {}
      const history = getAssignmentHistory(item.studentId, qids, item.id);
      let answered = 0, strict = 0;
      Object.values(history).forEach(h => {
        if (h && !h.empty && String(h.selected || '').trim() !== '') {
          answered++;
          if (h.isCorrect === true && !h.wasWrong) strict++;
        }
      });
      item.answeredCount = answered;
      item.strictCorrectCount = strict;
      try { sheet.getRange(item.rowIndex, 10, 1, 2).setValues([[answered, strict]]); } catch(e) {}
    });
  } else if (needBackfill.length > 0) {
    // 과거 데이터가 많이 비어 있는 첫 1회만 로그 전체를 훑어 채웁니다(이후에는 시트에 저장된 값 사용).
    const logSheets = ss.getSheets().filter(sh => {
      const n = sh.getName();
      return n === QBANK_MASTER_LOG_SHEET || n.indexOf('Logs_') === 0;
    });

    const needSessionIds = new Set(needBackfill.map(r => r.id));
    const statsMap = {}; 

    logSheets.forEach(sh => {
      const logData = sh.getDataRange().getValues();
      for (let j = 1; j < logData.length; j++) {
        const sId = String(logData[j][1]).trim();
        if (!needSessionIds.has(sId)) continue;

        if (!statsMap[sId]) {
          statsMap[sId] = { answered: new Set(), everWrong: new Set(), correct: new Set() };
        }

        const qid = String(logData[j][3]);
        const isCorrect = logData[j][14] === true;
        const selected = String(logData[j][13]).trim();

        if (selected !== "") {
          statsMap[sId].answered.add(qid);
          if (!isCorrect) statsMap[sId].everWrong.add(qid);
          if (isCorrect) statsMap[sId].correct.add(qid);
          else statsMap[sId].correct.delete(qid);
        }
      }
    });

    // 계산된 과거 과제 수치를 시트 J열, K열에 즉시 영구 기록
    needBackfill.forEach(item => {
      const stats = statsMap[item.id] || { answered: new Set(), everWrong: new Set(), correct: new Set() };
      item.answeredCount = stats.answered.size;
      let strictCorrect = 0;
      stats.correct.forEach(qid => {
        if (!stats.everWrong.has(qid)) strictCorrect++;
      });
      item.strictCorrectCount = strictCorrect;

      try {
        sheet.getRange(item.rowIndex, 10, 1, 2).setValues([[item.answeredCount, item.strictCorrectCount]]);
      } catch(e) {}
    });
  }

  // ★ 3. E열(총문항)과 J열(푼개수)을 비교하여 상태 판정 (로그 스캔 완전 생략)
  return rawList.map(item => {
    const answeredCount = item.answeredCount || 0;
    const strictCorrectCount = item.strictCorrectCount || 0;

    // '완료'는 모든 문항을 맞혔을 때(과제 시트 G열)만. 다 풀었지만 오답이 남았으면 '오답 수정 중'
    let displayStatus = "";
    if (String(item.status).trim() === '완료') {
      displayStatus = "완료";
    } else if (answeredCount === 0) {
      displayStatus = "미완료";
    } else if (answeredCount < item.totalCount) {
      displayStatus = "진행 중";
    } else {
      displayStatus = "오답 수정 중";
    }

    return {
      id: item.id,
      date: item.date,
      student: item.student,
      title: item.title,
      totalCount: item.totalCount,
      qids: item.qids,
      status: item.status,
      isWeekly: item.isWeekly,
      studentId: item.studentId,
      displayStatus: displayStatus,
      answeredCount: answeredCount,
      strictCorrectCount: strictCorrectCount
    };
  });
}


function getRecentAssignmentsForStudent(user, limit) {
  _guardDirect_();
  if(!user || !user.id) return [];
  const sheet=_logSS().getSheetByName('과제');
  if(!sheet) return [];
  const studentId=String(user.id).trim(), name=String(user.name||'').trim();
  const numbers=_findRowNumbers_(sheet,8,studentId,true);
  // 구형 과제(ID 미저장)는 이름으로만 보완하고, 다른 ID의 동명이인은 제외
  if(name) numbers.push(..._findRowNumbers_(sheet,3,name,true));
  const rows=_readRowNumbers_(sheet,numbers,11)
    .filter(item=>{const row=item.values,id=String(row[7]||'').trim();return id?id===studentId:String(row[2]||'').trim()===name;})
    .sort((a,b)=>b.rowNumber-a.rowNumber);
  const d=new Date();d.setMonth(d.getMonth()-3);
  const selected=rows.filter(item=>{
    const value=item.values[1];if(!value) return false;
    const time=new Date(value).getTime();return isNaN(time)||time>=d.getTime();
  }).slice(0,Math.max(1,Math.min(Number(limit)||5,20)));
  const tz=Session.getScriptTimeZone();
  return selected.map(item=>{
    const row=item.values;
    let answered=row[9]!=='' && row[9]!=null?Number(row[9]):null;
    let strict=row[10]!=='' && row[10]!=null?Number(row[10]):null;
    if(answered===null || strict===null) {
      let qids=[];try{qids=Array.isArray(row[5])?row[5]:JSON.parse(row[5]);}catch(e){}
      const history=getAssignmentHistory(user,qids,row[0]);
      const entries=Object.values(history).filter(h=>!h.empty && String(h.selected||'').trim()!=='');
      answered=entries.length;strict=entries.filter(h=>h.isCorrect && !h.wasWrong).length;
    }
    const totalCount=parseInt(row[4],10)||0;
    let date=row[1];try{date=Utilities.formatDate(new Date(date),tz,'yyyy-MM-dd HH:mm');}catch(e){date=String(date);}
    return {id:String(row[0]),date,student:String(row[2]),title:String(row[3]),totalCount,qids:row[5],
      status:String(row[6]),isWeekly:String(row[8]||'').trim().toUpperCase()==='TRUE',studentId:String(row[7]||'').trim(),
      answeredCount:answered||0,strictCorrectCount:strict||0,
      displayStatus:String(row[6]).trim()==='완료'?'완료':!answered?'미완료':answered<totalCount?'진행 중':'오답 수정 중'};
  });
}

function doLogin(inputId, includeManagedStudents, password) {
  const ss = SpreadsheetApp.openById(QBANK_LOG_BOOK_ID);
  const sheet = ss.getSheetByName('멤버');
  if (!sheet) return { error: '멤버 시트가 없습니다. 관리자에게 문의하십시오.' };

  const lastRow = sheet.getLastRow();
  const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
  // 멤버 A:D만 읽고 헤더(1행)를 제외하여 검색
  // A열:ID, B열:이름, C열:권한(관리자/학생), D열:담당자ID
  const cleanId = String(inputId || '').trim();
  
  for (let i = 0; i < data.length; i++) {
    const rowId = String(data[i][0] || '').trim(); // A열
    if (rowId === cleanId) {
      
      // ★ [수정] 한글 '관리자'를 영문 'manager'로 변환하는 로직 추가
      const rawRole = String(data[i][2] || '').trim(); // C열
      let roleCode = 'student'; // 기본값
      
      if (rawRole === '관리자' || rawRole.toLowerCase() === 'manager') {
        roleCode = 'manager';
      }

      const result = {
        success: true,
        id: rowId,
        name: String(data[i][1] || '').trim(), // B열
        role: roleCode,                        // 변환된 권한 코드 (manager/student)
        // D열: 학생은 담당 관리자 ID, 관리자는 비밀번호(화면으로 내보내지 않음)
        managerId: roleCode === 'manager' ? '' : String(data[i][3] || '').trim()
      };
      if (roleCode === 'manager') {
        // 관리자는 비밀번호 확인을 통과해야 로그인됩니다. (최초 로그인 시 D열에 등록)
        const auth = _managerLogin_(sheet, i + 2, rowId, password);
        if (auth.response) return auth.response;
        result.token = auth.token;
        if (auth.firstTime) result.passwordCreated = true;
      }
      if (includeManagedStudents === true && roleCode === 'manager') {
        result.managedStudents = _managedStudentsFromRows_(data, rowId);
      }
      return result;
    }
  }
  return { error: 'ID를 찾을 수 없습니다.' };
}

// 관리자가 담당하는 학생 목록 가져오기
function getManagedStudents(managerId) {
  _guardDirect_();
  const ss = SpreadsheetApp.openById(QBANK_LOG_BOOK_ID);
  const sheet = ss.getSheetByName('멤버');
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
  return _managedStudentsFromRows_(data, managerId);
}

// 로그인에서 이미 읽은 멤버 A:D 배열을 재사용합니다. 헤더는 제외한 배열입니다.
function _managedStudentsFromRows_(data, managerId) {
  const mgrId = String(managerId || '').trim();
  return data.filter(row => {
    const role = String(row[2] || '').trim();
    return (role === 'student' || role === '학생') &&
      String(row[3] || '').trim() === mgrId;
  }).map(row => ({
    id: String(row[0]),
    name: String(row[1])
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// [공통 헬퍼] 시트 이름 생성 규칙: "ID(이름)"
function _makeSheetName(userObj) {
  if (!userObj || !userObj.id || !userObj.name) return null;
  return String(userObj.id).trim() + '(' + String(userObj.name).trim() + ')';
}

// 학생 단어장 시트 찾기. 먼저 "ID(이름)"으로 찾고, 없으면(멤버 시트에서 이름을 바꾼 경우)
// "ID("로 시작하는 기존 시트를 찾아 새 이름으로 바꿔서 그대로 이어 씁니다.
function _vocabSheet_(ss, user) {
  const name = _makeSheetName(user);
  if (!name) return null;
  const exact = ss.getSheetByName(name);
  if (exact) return exact;
  const prefix = String(user.id).trim() + '(';
  const old = ss.getSheets().filter(s => {
    const n = s.getName();
    return n.indexOf(prefix) === 0 && n.charAt(n.length - 1) === ')';
  });
  if (old.length !== 1) return null;
  try { old[0].setName(name); } catch (e) {}
  return old[0];
}

/* ---------- 단어 '기록' 시트 ----------
 * 예전 기록은 이름만 적혀 있습니다. 새 기록부터는 '학생ID' 열에 ID도 함께 적어
 * 이름이 같은 학생의 기록이 섞이지 않게 합니다. (ID가 비어 있는 예전 기록은 이전처럼 이름으로 찾습니다)
 */
const VOCAB_LOG_SHEET = '기록';
const VOCAB_LOG_ID_HEADER = '학생ID';
function _vocabLogSheet_(ss) {
  let sheet = ss.getSheetByName(VOCAB_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(VOCAB_LOG_SHEET);
    sheet.appendRow(['타임스탬프', '이름', '단어', '뜻', '기록유형', VOCAB_LOG_ID_HEADER]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 6, sheet.getMaxRows(), 1).setNumberFormat('@');
    return { sheet: sheet, idCol: 6 };
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  let idCol = headers.indexOf(VOCAB_LOG_ID_HEADER) + 1;
  if (!idCol) {
    idCol = Math.max(lastCol, 5) + 1;   // 기존 열(타임스탬프~기록유형) 뒤에 추가
    if (sheet.getMaxColumns() < idCol) sheet.insertColumnsAfter(sheet.getMaxColumns(), idCol - sheet.getMaxColumns());
    sheet.getRange(1, idCol, sheet.getMaxRows(), 1).setNumberFormat('@');
    sheet.getRange(1, idCol).setValue(VOCAB_LOG_ID_HEADER);
  }
  return { sheet: sheet, idCol: idCol };
}
// rows: [[시각, 이름, 단어, 뜻, 기록유형], ...]  → '학생ID' 열까지 채워 한 번에 붙입니다.
function _vocabLogAppend_(ss, user, rows) {
  if (!rows.length) return;
  const log = _vocabLogSheet_(ss);
  const id = (user && typeof user === 'object') ? String(user.id || '').trim() : '';
  const out = rows.map(r => {
    const row = r.slice(0, 5);
    while (row.length < log.idCol) row.push('');
    row[log.idCol - 1] = id;
    return row;
  });
  const start = log.sheet.getLastRow() + 1;
  log.sheet.getRange(start, log.idCol, out.length, 1).setNumberFormat('@');
  log.sheet.getRange(start, 1, out.length, log.idCol).setValues(out);
}

/**************************************
 * 4) 캐시 최적화 (Pre-warming) 스케줄러
 **************************************/
// 관리자가 Apps Script 편집기에서 이 함수를 딱 한 번만 수동 실행하면 됩니다.
function setupCacheWarmingTrigger() {
  const funcName = 'refreshCacheWorker';
  
  // 기존에 중복 등록된 동일 트리거가 있다면 삭제
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === funcName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // 매 1시간마다 백그라운드에서 캐시를 갱신하도록 설정
  ScriptApp.newTrigger(funcName)
    .timeBased()
    .everyHours(1)
    .create();
}

// 트리거에 의해 백그라운드에서 실행될 실제 작업 함수
function refreshCacheWorker() {
  try {
    // gatherAllCols_ 내부의 force 매개변수를 활용하여 강제 갱신 유도
    gatherAllCols_(true);
  } catch(e) {
    // 백그라운드 실행이므로 실패 시 조용히 넘어갑니다.
  }
}

// [신규] 주간평가 리포트용 데이터 생성 함수
function getWeeklyReportData(assignmentId) {
  _guardDirect_();
  const ssLog = _logSS();
  const assignSheet = ssLog.getSheetByName('과제');
  if (!assignSheet) return { error: '과제 시트가 없습니다.' };

  const width = Math.min(11, assignSheet.getMaxColumns());
  // 1. 현재 과제 정보 찾기 (A열 과제ID 검색 — 시트 전체를 읽지 않음)
  const hit = _findRowNumbers_(assignSheet, 1, String(assignmentId), true);
  if (!hit.length) return { error: '과제를 찾을 수 없습니다.' };
  const currentRow = assignSheet.getRange(hit[0], 1, 1, width).getValues()[0];

  const targetId = String(currentRow[7]); // 학생ID
  // 같은 학생(H열)의 과제 행만 읽습니다. (아래 루프는 1번 인덱스부터 보므로 앞에 빈 행을 둡니다)
  const data = [[]].concat(targetId.trim()
    ? _readRowNumbers_(assignSheet, _findRowNumbers_(assignSheet, 8, targetId.trim(), true), width).map(item => item.values)
    : [currentRow]);
  const targetName = String(currentRow[2]); // 학생이름
  const currentQidsStr = String(currentRow[5]);
  const currentDate = currentRow[1]; // 날짜

  // 2. 학생의 과거 주간평가 기록 찾기 (최근 5회)
  // (같은 학생 & 주간평가=TRUE 인 것들을 날짜 역순으로 수집)
  const historyList = [];
  for (let i = 1; i < data.length; i++) {
      const rId = String(data[i][7]); // 학생ID
      const rWeekly = String(data[i][8]).toUpperCase() === 'TRUE';
      
      if (rId === targetId && rWeekly) {
          historyList.push({
              id: String(data[i][0]),
              date: data[i][1],
              title: String(data[i][3]),
              qids: String(data[i][5]),
              // K열: 한 번에 맞힌 문항 수 (제출 시 자동 기록)
              strict: (data[i][10] !== '' && data[i][10] != null) ? Number(data[i][10]) : null
          });
      }
  }
  // 날짜 내림차순 정렬 후 최근 5개만 남김 (오래된 순으로 재정렬하여 그래프용 데이터 생성)
  historyList.sort((a,b) => new Date(b.date) - new Date(a.date));
  const recent5 = historyList.slice(0, 5).reverse(); 

 // 3. 점수 계산 헬퍼
  const calcScore = (aId, qidsJson) => {
      let qids = [];
      try { qids = JSON.parse(qidsJson); } catch(e) {}
      if (!qids.length) return 0;
      // 풀이 기록 조회 (기존 함수 재활용)
      const hist = getAssignmentHistory({id:targetId, name:targetName}, qids, aId);
      let correct = 0;
      // [수정] 오답 이력이 없고(wasWrong !== true), 현재 정답인 경우만 점수 인정
      Object.values(hist).forEach(h => { 
          if(h && !h.empty && h.isCorrect === true && h.wasWrong !== true) correct++; 
      });
      return Math.round((correct / qids.length) * 100);
  };

  // 4. 과거 성적 추이 데이터 생성 (K열 저장값 사용, 없을 때만 로그에서 계산)
  const scoreFromSheet = h => {
      let n = 0;
      try { n = JSON.parse(h.qids).length; } catch(e) {}
      if (h.strict === null || isNaN(h.strict) || !n) return null;
      return Math.round((h.strict / n) * 100);
  };
  const trendData = recent5.map(h => {
      // 제목에서 난이도(Lv.N) 추출
      const levelMatch = String(h.title).match(/Lv\.(\d+)/i);
      const levelStr = levelMatch ? `Lv.${levelMatch[1]}` : '-';
      
      return {
          // 배열로 넘겨주면 Chart.js가 알아서 예쁘게 두 줄로 자동 렌더링함
          label: [
              Utilities.formatDate(new Date(h.date), Session.getScriptTimeZone(), 'MM/dd'),
              levelStr
          ],
          // 이번 과제는 아래에서 최신 기록으로 계산한 점수로 교체합니다.
          score: (h.id === String(assignmentId)) ? null : (() => { const v = scoreFromSheet(h); return v === null ? calcScore(h.id, h.qids) : v; })(),
          _id: h.id
      };
  });

  // 5. 이번 시험 상세 분석 (5대 영역 및 문항 리스트)
  let currentQids = [];
  try { currentQids = JSON.parse(currentQidsStr); } catch(e){}
  
  // 리포트에는 유형·출처·난이도만 필요하므로 본문/보기/해설은 읽지 않습니다.
  const qs = getQuestionsByQids(currentQids, 'result');
  const currentHist = getAssignmentHistory({id:targetId, name:targetName}, currentQids, assignmentId);

  // 5대 영역 정의
  const categories = {
      '빈칸/추론': { total:0, correct:0 },
      '논리/흐름': { total:0, correct:0 },
      '대의파악': { total:0, correct:0 },
      '어법/어휘': { total:0, correct:0 },
      '세부/장문': { total:0, correct:0 }
  };

  // 문항별 분석 리스트
  const questionList = qs.map((q, idx) => {
      const h = currentHist[q.qid] || {};
      // [수정] 고쳐서 맞은 문제도 무조건 X로 처리하기 위한 엄격한 정답 판별
      const isStrictCorrect = (h && !h.empty && h.isCorrect === true && h.wasWrong !== true);
      const type = String(q.type || '').trim();
      
      // 카테고리 분류
      let cat = '세부/장문'; // 기본값
      if (/빈칸|함축|요약/.test(type)) cat = '빈칸/추론';
      else if (/순서|삽입|흐름|무관/.test(type)) cat = '논리/흐름';
      else if (/주제|제목|요지|주장|목적|심경/.test(type)) cat = '대의파악';
      else if (/어법|어휘/.test(type)) cat = '어법/어휘';
      
      categories[cat].total++;
      if (isStrictCorrect) categories[cat].correct++;

      // 리포트는 학부모가 보므로 문항 출처(학년·연도·회차)는 보내지 않습니다.
      return {
          no: idx + 1,
          type: type,
          difficulty: q.difficulty || '-', // 요청하신 1~15 난이도 그대로 사용
          result: isStrictCorrect ? 'O' : 'X',
          isCorrect: isStrictCorrect
      };
  });

  // 카테고리별 점수 배열 (순서대로)
  const radarData = [
      Math.round(categories['빈칸/추론'].total ? (categories['빈칸/추론'].correct/categories['빈칸/추론'].total)*100 : 0),
      Math.round(categories['논리/흐름'].total ? (categories['논리/흐름'].correct/categories['논리/흐름'].total)*100 : 0),
      Math.round(categories['대의파악'].total ? (categories['대의파악'].correct/categories['대의파악'].total)*100 : 0),
      Math.round(categories['어법/어휘'].total ? (categories['어법/어휘'].correct/categories['어법/어휘'].total)*100 : 0),
      Math.round(categories['세부/장문'].total ? (categories['세부/장문'].correct/categories['세부/장문'].total)*100 : 0)
  ];

  // 문항 유형별 정답 수 (리포트의 유형별 정답률 그래프용)
  const typeStats = {};
  questionList.forEach(x => {
      const t = x.type || '기타';
      if (!typeStats[t]) typeStats[t] = { total: 0, correct: 0 };
      typeStats[t].total++;
      if (x.isCorrect) typeStats[t].correct++;
  });

  // 지난 주간평가들(같은 학생, 이번 시험보다 앞, 최대 4회)의 유형별 결과를 모아
  //  - prev: 바로 앞 평가 (점수 비교용)
  //  - typeCum: 이번 평가 포함 최근 5회의 유형별 누적 정답 수
  const curIdx = historyList.findIndex(h => h.id === String(assignmentId));
  const olderList = (curIdx >= 0 ? historyList.slice(curIdx + 1)
                                 : historyList.filter(h => new Date(h.date) < new Date(currentDate))).slice(0, 4);
  const typeCum = {};
  const addCum = (t, ok) => { if (!typeCum[t]) typeCum[t] = { total: 0, correct: 0 }; typeCum[t].total++; if (ok) typeCum[t].correct++; };
  questionList.forEach(x => addCum(x.type || '기타', x.isCorrect));
  let cumCount = 1;
  let prev = null;
  olderList.forEach((older, k) => {
      try {
          let pq = [];
          try { pq = JSON.parse(older.qids) || []; } catch (e) {}
          if (!pq.length) return;
          const pqs = getQuestionsByQids(pq, 'result');
          const ph = getAssignmentHistory({ id: targetId, name: targetName }, pq, older.id);
          const pts = {};
          let pc = 0;
          pqs.forEach(q => {
              const h = ph[q.qid] || {};
              const ok = (h && !h.empty && h.isCorrect === true && h.wasWrong !== true);
              const t = String(q.type || '').trim() || '기타';
              if (!pts[t]) pts[t] = { total: 0, correct: 0 };
              pts[t].total++;
              if (ok) { pts[t].correct++; pc++; }
              addCum(t, ok);
          });
          cumCount++;
          if (k === 0) {
              const lv = String(older.title).match(/Lv\.(\d+)/i);
              prev = {
                  date: Utilities.formatDate(new Date(older.date), Session.getScriptTimeZone(), 'MM/dd'),
                  level: lv ? Number(lv[1]) : null,
                  score: pq.length ? Math.round((pc / pq.length) * 100) : 0,
                  correctCount: pc,
                  totalCount: pq.length,
                  typeStats: pts
              };
          }
      } catch (e) { /* 그 회차는 건너뜀 */ }
  });

  // 총점 계산 (위에서 읽은 이번 과제 기록을 재사용 — 로그 재조회 없음)
  const correctCnt = questionList.filter(x=>x.isCorrect).length;
  const myScore = currentQids.length ? Math.round((correctCnt / currentQids.length) * 100) : 0;
  trendData.forEach(t => { if (t._id === String(assignmentId)) t.score = myScore; delete t._id; });

  return {
      success: true,
      meta: {
          name: targetName,
          title: String(currentRow[3]),
          date: Utilities.formatDate(new Date(currentDate), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          score: myScore,
          correctCount: correctCnt,
          totalCount: currentQids.length
      },
      radar: radarData,
      typeStats: typeStats,
      typeCum: typeCum,
      cumCount: cumCount,
      prev: prev,
      trend: trendData,
      questions: questionList
  };
}


/**
 * 스프레드시트 '혼동어휘' 시트에서 데이터를 읽어와 2차원 배열로 반환
 */
function getConfusingWordsFromSheet() {
  const ssId = "1dFZ--yjQfebd-0F8IYFH6Xysnv2PXW0DChd1E0x3mLI";
  const sheetName = "혼동어휘";
  
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    const values = sheet.getDataRange().getValues();
    
    // 행별로 순회하며 빈 칸 제거 및 유효한 단어 세트만 추출
    return values.map(row => 
      row.map(cell => String(cell).trim()).filter(cell => cell !== "")
    ).filter(group => group.length > 0);
    
  }
  catch (e) {
    console.error("혼동어휘 로드 오류: " + e.toString());
    return [];
  }
}

/**
 * [최적화] 주간평가용 학생 취약유형 통계 + 문제 인벤토리를 로그 시트 1회 스캔으로 통합 반환
 */
function loadWeeklyStudentBundle(studentIdInput, days) {
  _guardDirect_();
  const allQuestions = gatherAllCols_();
  const questionStats = {};
  const ss = _logSS();
  const targetId = String(studentIdInput || '').trim().toLowerCase();

  const logSheets = ss.getSheets().filter(sh => {
    const n = sh.getName();
    return n === QBANK_MASTER_LOG_SHEET || n.indexOf('Logs_') === 0;
  });

  const minTime = (days && days > 0) ? new Date(Date.now() - days * 24 * 3600 * 1000) : null;
  const attemptMap = new Map();
  const sessionStats = {};

  // 모든 로그 시트를 단 1회만 순회하며 두 가지 데이터 동시 집계
  logSheets.forEach(sh => {
    const data = [[]].concat(_studentLogRows_(sh, targetId));
    for (let i = 1; i < data.length; i++) {
      const rowUserId = String(data[i][2] || '').trim().toLowerCase();
      if (rowUserId !== targetId) continue;

      const rowTs = new Date(data[i][0]);
      const sessionId = String(data[i][1] || '').trim();
      const qid = String(data[i][3] || '').trim();
      const extId = String(data[i][5] || '').trim();
      const type = String(data[i][7] || '').trim();
      const selected = String(data[i][13] || '').trim();
      const isCorrect = (data[i][14] === true);

      // 1) 인벤토리용 최신 세션 통계 집계
      const key = extId || qid;
      if (key) {
        if (!sessionStats[key]) sessionStats[key] = {};
        if (!sessionStats[key][sessionId]) {
          sessionStats[key][sessionId] = { isSolved: false, wrongCount: 0, lastTs: rowTs };
        }
        const curr = sessionStats[key][sessionId];
        if (rowTs > curr.lastTs) curr.lastTs = rowTs;
        if (isCorrect === true) curr.isSolved = true;
        else if (isCorrect === false && selected !== '') curr.wrongCount++;
      }

      // 2) 취약 유형 통계 집계 (days 기간 필터 적용)
      if (selected !== '' && qid && type) {
        if (!minTime || rowTs >= minTime) {
          const attemptKey = sessionId + '_' + qid;
          if (!attemptMap.has(attemptKey)) {
            attemptMap.set(attemptKey, { ts: rowTs, isCorrect: isCorrect, type: type });
          } else {
            const existing = attemptMap.get(attemptKey);
            if (rowTs < existing.ts) {
              existing.ts = rowTs;
              existing.isCorrect = isCorrect;
            }
          }
        }
      }
    }
  });

  // 인벤토리 최신 세션 매핑
  for (const key in sessionStats) {
    let latestSess = null;
    let maxTs = -1;
    for (const sId in sessionStats[key]) {
      const ts = (sessionStats[key][sId].lastTs instanceof Date) ? sessionStats[key][sId].lastTs.getTime() : 0;
      if (ts > maxTs) { maxTs = ts; latestSess = sessionStats[key][sId]; }
    }
    if (latestSess) {
      questionStats[key] = { isSolved: latestSess.isSolved, wrongCount: latestSess.wrongCount, lastTs: latestSess.lastTs };
    }
  }

  const tz = Session.getScriptTimeZone();
  const inventory = allQuestions.map(q => {
    const qExt = String(q.extId || '').trim();
    const stat = questionStats[qExt] || questionStats[q.qid] || { isSolved: false, wrongCount: 0 };
    return {
      qid: q.qid, grade: q.grade, year: q.year, month: q.month, detail: q.detail, type: q.type, difficulty: q.difficulty,
      number: q.extId || '', isSolved: stat.isSolved, wrongCount: stat.wrongCount,
      lastTs: stat.lastTs ? Utilities.formatDate(stat.lastTs, tz, "yyyy-MM-dd") : null,
      groupHash: q.linkedId || q.extId || q.qid
    };
  });

  // 취약 유형 Top 10 계산
  const typeStats = new Map();
  attemptMap.forEach(val => {
    if (!typeStats.has(val.type)) {
      typeStats.set(val.type, { type: val.type, total: 0, correct: 0 });
    }
    const stat = typeStats.get(val.type);
    stat.total += 1;
    if (val.isCorrect) stat.correct += 1;
  });

  let statsResult = Array.from(typeStats.values());
  statsResult.forEach(r => {
    r.rate = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
    r.wrong = r.total - r.correct;
  });
  statsResult.sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    return b.total - a.total;
  });

  return {
    stats: statsResult.slice(0, 10),
    inventory: inventory
  };
}

/**
 * [추가] 단어 추가/암기 시 '기록' 시트에 타임스탬프/이름/단어/뜻/기록유형 로그 남기기
 */
function _appendVocabLog_(user, word, meaning, actionType) {
  try {
    const ss = SpreadsheetApp.openById(VOCAB_SHEET_ID);
    const nameStr = (user && typeof user === 'object') ? (user.name || '') : String(user || '');
    _vocabLogAppend_(ss, user, [[new Date(), nameStr, String(word || ''), String(meaning || ''), String(actionType || 'add')]]);
  } catch (e) {
    console.error("기록 시트 로깅 오류: " + e.toString());
  }
}

/**************************************
 * 5) 관리자 인벤토리 분리: 문항 목록(공통, 브라우저 저장) + 학생 풀이 통계(학생별, 작음)
 **************************************/
function _qbankIndexVersion_() {
  const props = PropertiesService.getScriptProperties();
  let v = props.getProperty('QBANK_INDEX_VERSION');
  if (!v) { v = 'v' + Date.now(); props.setProperty('QBANK_INDEX_VERSION', v); }
  return v;
}

/**
 * 문항 메타 목록. 브라우저가 가진 버전(knownVersion)과 같으면 목록을 보내지 않습니다.
 * rows: [qid, grade, year, month, detail, type, difficulty, extId, linkedId]
 */
function getQuestionMetaIndex(knownVersion) {
  _guardDirect_();
  const version = _qbankIndexVersion_();
  if (knownVersion && String(knownVersion) === version) return { version: version, unchanged: true };
  const rows = gatherAllCols_().map(q => [
    q.qid, q.grade, q.year, q.month, q.detail || '', q.type, q.difficulty, q.extId || '', q.linkedId || ''
  ]);
  return { version: version, rows: rows };
}

// 학생 로그를 한 번만 훑어 (1) 문항별 최근 과제 기준 풀이 상태 (2) 유형별 정답률을 함께 계산합니다.
function _studentQuestionStats_(studentIdInput, days) {
  const targetId = String(studentIdInput || '').trim().toLowerCase();
  const minTime = (days && days > 0) ? new Date(Date.now() - days * 24 * 3600 * 1000) : null;
  const sessionStats = {};
  const attemptMap = new Map();

  _logSheets_().forEach(sh => {
    _studentLogRows_(sh, targetId).forEach(r => {
      if (String(r[2] || '').trim().toLowerCase() !== targetId) return;
      const rowTs = new Date(r[0]);
      const sessionId = String(r[1] || '').trim();
      const qid = String(r[3] || '').trim();
      const extId = String(r[5] || '').trim();
      const type = String(r[7] || '').trim();
      const selected = String(r[13] || '').trim();
      const rawCorrect = r[14];

      // (1) 인벤토리: 문제ID(없으면 QID)별, 과제(세션)별 상태
      const key = extId || qid;
      if (key) {
        if (!sessionStats[key]) sessionStats[key] = {};
        if (!sessionStats[key][sessionId]) sessionStats[key][sessionId] = { isSolved: false, wrongCount: 0, lastTs: rowTs };
        const curr = sessionStats[key][sessionId];
        if (rowTs > curr.lastTs) curr.lastTs = rowTs;
        if (rawCorrect === true) curr.isSolved = true;
        else if (rawCorrect === false && selected !== '') curr.wrongCount++;
      }

      // (2) 취약 유형: 과제별 첫 시도 기준 (기간 제한 적용)
      if (selected !== '' && qid && type && (!minTime || rowTs >= minTime)) {
        const attemptKey = sessionId + '_' + qid;
        const existing = attemptMap.get(attemptKey);
        if (!existing) attemptMap.set(attemptKey, { ts: rowTs, isCorrect: rawCorrect === true, type: type, qid: qid });
        else if (rowTs < existing.ts) { existing.ts = rowTs; existing.isCorrect = rawCorrect === true; }
      }
    });
  });

  // 문항별로 가장 최근 과제의 상태만 남깁니다. 값: [푼여부(1/0), 오답횟수, 최근풀이일]
  const tz = Session.getScriptTimeZone();
  const qstats = {};
  Object.keys(sessionStats).forEach(key => {
    let latest = null, maxTs = -1;
    Object.keys(sessionStats[key]).forEach(sId => {
      const st = sessionStats[key][sId];
      const t = (st.lastTs instanceof Date && !isNaN(st.lastTs.getTime())) ? st.lastTs.getTime() : 0;
      if (t > maxTs) { maxTs = t; latest = st; }
    });
    if (latest) {
      const d = (latest.lastTs instanceof Date && !isNaN(latest.lastTs.getTime())) ? Utilities.formatDate(latest.lastTs, tz, 'yyyy-MM-dd') : null;
      qstats[key] = [latest.isSolved ? 1 : 0, latest.wrongCount, d];
    }
  });

  const typeStats = new Map();
  attemptMap.forEach(val => {
    if (!typeStats.has(val.type)) typeStats.set(val.type, { type: val.type, total: 0, correct: 0 });
    const st = typeStats.get(val.type);
    st.total += 1;
    if (val.isCorrect) st.correct += 1;
  });
  const stats = Array.from(typeStats.values()).map(r => {
    r.rate = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
    r.wrong = r.total - r.correct;
    return r;
  }).sort((a, b) => (a.rate !== b.rate) ? a.rate - b.rate : b.total - a.total).slice(0, 10);

  // 기간 안 문항별 첫 시도 결과 [시도 수, 정답 수] → 브라우저에서 난이도별 정답률 계산용
  const qrecent = {};
  attemptMap.forEach(val => {
    if (!val.qid) return;
    const q = qrecent[val.qid] || (qrecent[val.qid] = [0, 0]);
    q[0] += 1;
    if (val.isCorrect) q[1] += 1;
  });

  const asg = _studentAssignInfo_(studentIdInput);
  return { qstats: qstats, stats: stats, qrecent: qrecent, acounts: asg.counts, alast: asg.last };
}

// 학생에게 배부된 횟수와 마지막 배부 시각 (문항 QID별).
// 과제 시트에서 그 학생(H열) 행만 찾아 F열(문항 목록)과 B열(배부일)을 봅니다.
function _studentAssignInfo_(studentIdInput) {
  const id = String(studentIdInput || '').trim();
  const counts = {}, last = {};
  const out = { counts: counts, last: last };
  if (!id) return out;
  const sheet = _logSS().getSheetByName('과제');
  if (!sheet) return out;
  const rows = _readRowNumbers_(sheet, _findRowNumbers_(sheet, 8, id, false), 8);
  rows.forEach(item => {
    if (String(item.values[7] || '').trim().toLowerCase() !== id.toLowerCase()) return;
    let qids = [];
    try { qids = JSON.parse(item.values[5] || '[]'); } catch (e) {}
    const raw = item.values[1];
    let ts = (raw instanceof Date) ? raw.getTime() : new Date(String(raw || '').replace(' ', 'T')).getTime();
    if (isNaN(ts)) ts = 0;
    new Set(Array.isArray(qids) ? qids : []).forEach(q => {
      q = String(q);
      counts[q] = (counts[q] || 0) + 1;
      if (ts > (last[q] || 0)) last[q] = ts;
    });
  });
  return out;
}

// 관리자 '불러오기': 문항 목록 없이 학생 풀이 상태만 반환
// 과제출제 '불러오기': 문항별 풀이 상태 + 최근 days일 취약 유형/난이도용 기록
function getStudentQuestionStats(studentIdInput, days) {
  _guardDirect_();
  const r = _studentQuestionStats_(studentIdInput, Number(days) || 0);
  return { qstats: r.qstats, acounts: r.acounts, alast: r.alast, stats: r.stats, qrecent: r.qrecent };
}

// 주간평가 '학생 데이터 로드': 취약 유형 Top10 + 문항별 풀이 상태 (문항 목록은 브라우저 저장본 사용)
function loadWeeklyStudentStats(studentIdInput, days) {
  _guardDirect_();
  return _studentQuestionStats_(studentIdInput, days);
}


/**************************************
 * 5) 관리자 비밀번호 · 알림(공지) · 포인트 · 교환권
 *
 *  - 시트는 로그북(QBANK_LOG_BOOK_ID)에 자동으로 만들어집니다: 알림 / 알림_읽음 / 포인트내역 / 교환신청
 *  - 관리자 비밀번호는 '멤버' 시트 D열(관리자 행)에 암호화되어 저장됩니다.
 *    비밀번호를 잊었으면 그 칸을 지우세요. 다음 로그인 때 새로 정하게 됩니다.
 **************************************/
const NP_NOTICE_SHEET = '알림';
const NP_READ_SHEET = '알림_읽음';
const NP_POINT_SHEET = '포인트내역';
const NP_EXCHANGE_SHEET = '교환신청';

const NP_NOTICE_HEADERS = ['알림ID','작성시각','작성자ID','작성자이름','종류','대상구분','대상ID','제목','내용','중요','만료일','상태'];
const NP_READ_HEADERS = ['알림ID','사용자ID','읽은시각'];
const NP_POINT_HEADERS = ['내역ID','시각','학생ID','학생이름','증감','잔액','구분','사유','처리자ID','처리자이름','관련ID','취소여부'];
const NP_EXCHANGE_HEADERS = ['신청ID','신청시각','학생ID','학생이름','포인트','상태','처리자ID','처리자이름','처리시각','메모'];

const POINT_EXCHANGE_UNIT = 100;   // 교환권 1장 = 100pt
const NOTICE_DEFAULT_DAYS = 7;     // 공지 기본 게시 기간(일)
const POINT_NOTICE_DAYS = 30;      // 포인트 자동 알림이 보이는 기간(일)
const MANAGER_PW_MIN = 4;          // 관리자 비밀번호 최소 길이

/* ---------- 시트 공통 ---------- */
function _npSheet_(name, headers) {
  const ss = _logSS();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    // 날짜·숫자 자동 변환을 막기 위해 전부 '일반 텍스트'로 둡니다.
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function _npRows_(sh, width) {
  const last = sh.getLastRow();
  return last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
}
function _npCell_(v) {
  // '='로 시작하면 수식으로 해석되므로 앞에 공백을 붙여 글자로 저장합니다.
  const s = (v == null) ? '' : String(v);
  return s.charAt(0) === '=' ? ' ' + s : s;
}
function _npAppend_(sh, rows) {
  if (!rows.length) return;
  const start = sh.getLastRow() + 1;
  const need = start + rows.length - 1 - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
  const range = sh.getRange(start, 1, rows.length, rows[0].length);
  range.setNumberFormat('@');
  range.setValues(rows.map(r => r.map(_npCell_)));
}
function _npStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  return (v == null ? '' : String(v)).trim();
}
function _npNum_(v) { const n = Number(_npStr_(v)); return isFinite(n) ? n : 0; }
function _npDay_(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function _npId_(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function _npUserId_(user) {
  return String((user && typeof user === 'object') ? (user.id || '') : (user || '')).trim();
}

/* ---------- 멤버 ---------- */
function _npMembers_() {
  const sheet = _logSS().getSheetByName('멤버');
  if (!sheet) throw new Error('멤버 시트가 없습니다. 관리자에게 문의하십시오.');
  const last = sheet.getLastRow();
  const data = last > 1 ? sheet.getRange(2, 1, last - 1, 4).getValues() : [];
  const list = [];
  data.forEach((r, i) => {
    const id = String(r[0] || '').trim();
    if (!id) return;
    const raw = String(r[2] || '').trim();
    const isMgr = (raw === '관리자' || raw.toLowerCase() === 'manager');
    list.push({
      row: i + 2, id: id, name: String(r[1] || '').trim(),
      role: isMgr ? 'manager' : 'student',
      d: String(r[3] || '').trim()   // 학생: 담당 관리자 ID / 관리자: 비밀번호(암호화)
    });
  });
  return { sheet: sheet, list: list };
}
function _npStudent_(members, id) {
  const me = members.find(m => m.id === id && m.role === 'student');
  if (!me) throw new Error('학생 정보를 찾을 수 없습니다. 다시 로그인해 주십시오.');
  return me;
}

/* ---------- 관리자 비밀번호 / 인증 ---------- */
function _authSecret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('K2_AUTH_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('K2_AUTH_SECRET', s);
  }
  return s;
}
function _hashPw_(id, pw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    id + '|' + pw + '|' + _authSecret_(), Utilities.Charset.UTF_8);
  return 'pw$' + Utilities.base64EncodeWebSafe(bytes);
}
function _managerToken_(id, stored) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(id + '|' + stored, _authSecret_(), Utilities.Charset.UTF_8));
}

// doLogin에서 관리자 행을 찾았을 때 호출됩니다.
// 반환: { response: 화면에 그대로 돌려줄 응답 }  또는  { token: 인증 토큰 }
function _managerLogin_(sheet, rowNum, id, password) {
  const pw = (password == null) ? '' : String(password);
  const cell = sheet.getRange(rowNum, 4);
  let stored = String(cell.getValue() || '').trim();

  if (!pw) return { response: { needPassword: true, firstTime: !stored, id: id } };

  const cache = CacheService.getScriptCache();
  const failKey = 'K2_PWFAIL_' + id;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) {
    return { response: { error: '비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 시도하십시오.', passwordError: true } };
  }

  if (!stored) {
    // 최초 로그인: 입력한 비밀번호를 등록
    if (pw.length < MANAGER_PW_MIN) {
      return { response: { error: '비밀번호는 ' + MANAGER_PW_MIN + '자 이상으로 정해 주십시오.', passwordError: true, firstTime: true } };
    }
    return _withLock_(function () {
      const now = String(cell.getValue() || '').trim();
      if (now) return { response: { error: '방금 다른 곳에서 비밀번호가 등록되었습니다. 다시 로그인해 주십시오.', passwordError: true } };
      const hashed = _hashPw_(id, pw);
      cell.setNumberFormat('@').setValue(hashed);
      return { token: _managerToken_(id, hashed), firstTime: true };
    });
  }

  let ok = false;
  if (stored.indexOf('pw$') === 0) {
    ok = (stored === _hashPw_(id, pw));
  } else if (stored === pw) {
    // 시트에 직접 적어 둔 비밀번호 → 암호화해서 다시 저장
    ok = true;
    stored = _hashPw_(id, pw);
    cell.setNumberFormat('@').setValue(stored);
  }
  if (!ok) {
    cache.put(failKey, String(fails + 1), 600);
    return { response: { error: '비밀번호가 맞지 않습니다.', passwordError: true } };
  }
  cache.remove(failKey);
  return { token: _managerToken_(id, stored) };
}

// 관리자 전용 기능 앞에서 반드시 호출합니다. auth = { id, token }
function _requireManager_(auth) {
  const id = String((auth && auth.id) || '').trim();
  const token = String((auth && auth.token) || '');
  const members = _npMembers_().list;
  const me = members.find(m => m.id === id && m.role === 'manager');
  if (!me || !me.d || !token || token !== _managerToken_(id, me.d)) {
    throw new Error('관리자 인증이 만료되었습니다. 로그아웃 후 다시 로그인해 주십시오.');
  }
  return { id: id, name: me.name, members: members };
}

/* ---------- 알림 내부 ---------- */
function _noticeObj_(r) {
  return {
    id: _npStr_(r[0]), time: _npStr_(r[1]), authorId: _npStr_(r[2]), author: _npStr_(r[3]),
    kind: _npStr_(r[4]), targetType: _npStr_(r[5]), targetIds: _npStr_(r[6]),
    title: _npStr_(r[7]), body: _npStr_(r[8]), important: _npStr_(r[9]) === 'Y',
    expiry: _npStr_(r[10]).slice(0, 10), status: _npStr_(r[11])
  };
}
function _noticeTargets_(n, members) {
  const students = members.filter(m => m.role === 'student');
  if (n.targetType === '전체') return students;
  if (n.targetType === '담당') return students.filter(s => s.d === n.targetIds);
  const ids = n.targetIds.split(',').map(s => s.trim()).filter(Boolean);
  return students.filter(s => ids.indexOf(s.id) !== -1);
}
function _noticeVisibleTo_(n, student, today) {
  if (n.status === '삭제') return false;
  if (n.expiry && n.expiry < today) return false;
  if (n.targetType === '전체') return true;
  if (n.targetType === '담당') return !!student.d && n.targetIds === student.d;
  return (',' + n.targetIds + ',').indexOf(',' + student.id + ',') !== -1;
}
// 학생 한 명에게 가는 자동 알림(포인트 적립·교환 결과 등)
function _personalNoticeRow_(actor, studentId, title, body) {
  return [_npId_('N'), _nowIso(), actor.id, actor.name, '포인트', '지정', studentId, title, body, '', _npDay_(POINT_NOTICE_DAYS), '정상'];
}

/* ---------- 포인트 내부 ---------- */
function _pointState_() {
  const balances = {}, pending = {};
  _npRows_(_npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS), NP_POINT_HEADERS.length).forEach(r => {
    const sid = _npStr_(r[2]);
    if (sid) balances[sid] = (balances[sid] || 0) + _npNum_(r[4]);
  });
  _npRows_(_npSheet_(NP_EXCHANGE_SHEET, NP_EXCHANGE_HEADERS), NP_EXCHANGE_HEADERS.length).forEach(r => {
    const sid = _npStr_(r[2]);
    if (sid && _npStr_(r[5]) === '대기') pending[sid] = (pending[sid] || 0) + _npNum_(r[4]);
  });
  return { balances: balances, pending: pending };
}
function _ledgerObj_(r) {
  return {
    id: _npStr_(r[0]), time: _npStr_(r[1]), studentId: _npStr_(r[2]), studentName: _npStr_(r[3]),
    delta: _npNum_(r[4]), balance: _npNum_(r[5]), kind: _npStr_(r[6]), reason: _npStr_(r[7]),
    actor: _npStr_(r[9]), refId: _npStr_(r[10]), cancelled: _npStr_(r[11]) === 'Y'
  };
}
function _exchangeObj_(r) {
  return {
    id: _npStr_(r[0]), time: _npStr_(r[1]), studentId: _npStr_(r[2]), studentName: _npStr_(r[3]),
    points: _npNum_(r[4]), status: _npStr_(r[5]), actor: _npStr_(r[7]), doneTime: _npStr_(r[8]), memo: _npStr_(r[9])
  };
}
function _fmtPt_(n) { return (n > 0 ? '+' : '') + n + 'pt'; }

/**
 * [자동 적립용 자리] 나중에 "과제 완료 시 +10" 같은 규칙을 붙일 때 이 함수를 호출하면 됩니다.
 * refKey가 같은 적립은 한 번만 들어갑니다(중복 적립 방지). 예: 'auto:과제완료:' + 과제ID
 */
function _awardPointsAuto_(studentId, delta, reason, refKey) {
  delta = Math.round(Number(delta) || 0);
  if (!delta) return false;
  return _withLock_(function () {
    const student = _npStudent_(_npMembers_().list, String(studentId).trim());
    const sh = _npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS);
    if (refKey && _npRows_(sh, NP_POINT_HEADERS.length).some(r => _npStr_(r[10]) === refKey)) return false;
    const bal = (_pointState_().balances[student.id] || 0) + delta;
    const actor = { id: 'system', name: '자동' };
    _npAppend_(sh, [[_npId_('P'), _nowIso(), student.id, student.name, delta, bal, '자동', reason, actor.id, actor.name, refKey || '', '']]);
    _npAppend_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS),
      [_personalNoticeRow_(actor, student.id, '포인트 ' + _fmtPt_(delta), reason + '\n현재 잔액: ' + bal + 'pt')]);
    return true;
  });
}

/* ================= 학생용 API ================= */

// 로그인 직후·종 아이콘을 열 때: 알림 목록 + 포인트 잔액을 한 번에
function getStudentHome(user) {
  const members = _npMembers_().list;
  const me = _npStudent_(members, _npUserId_(user));
  const today = _npDay_(0);

  const readSet = {};
  _npRows_(_npSheet_(NP_READ_SHEET, NP_READ_HEADERS), 2).forEach(r => {
    if (_npStr_(r[1]) === me.id) readSet[_npStr_(r[0])] = true;
  });

  const notices = _npRows_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS), NP_NOTICE_HEADERS.length)
    .map(_noticeObj_)
    .filter(n => n.id && _noticeVisibleTo_(n, me, today))
    .map(n => ({ id: n.id, time: n.time, author: n.author, kind: n.kind, title: n.title, body: n.body,
                 important: n.important, read: !!readSet[n.id] }))
    .sort((a, b) => a.time < b.time ? 1 : (a.time > b.time ? -1 : 0))
    .slice(0, 60);

  const st = _pointState_();
  return {
    notices: notices,
    unread: notices.filter(n => !n.read).length,
    points: { balance: st.balances[me.id] || 0, pending: st.pending[me.id] || 0, unit: POINT_EXCHANGE_UNIT }
  };
}

function markNoticesRead(user, noticeIds) {
  const id = _npUserId_(user);
  const ids = _arr(noticeIds).map(String).filter(Boolean).slice(0, 100);
  if (!id || !ids.length) return { ok: true };
  return _withLock_(function () {
    const sh = _npSheet_(NP_READ_SHEET, NP_READ_HEADERS);
    const have = {};
    _npRows_(sh, 2).forEach(r => { if (_npStr_(r[1]) === id) have[_npStr_(r[0])] = true; });
    const now = _nowIso();
    _npAppend_(sh, ids.filter(n => !have[n]).map(n => [n, id, now]));
    return { ok: true };
  });
}

function getMyPoints(user) {
  const me = _npStudent_(_npMembers_().list, _npUserId_(user));
  const st = _pointState_();
  const history = _npRows_(_npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS), NP_POINT_HEADERS.length)
    .filter(r => _npStr_(r[2]) === me.id).map(_ledgerObj_).reverse().slice(0, 100);
  const requests = _npRows_(_npSheet_(NP_EXCHANGE_SHEET, NP_EXCHANGE_HEADERS), NP_EXCHANGE_HEADERS.length)
    .filter(r => _npStr_(r[2]) === me.id).map(_exchangeObj_).reverse().slice(0, 20);
  return {
    points: { balance: st.balances[me.id] || 0, pending: st.pending[me.id] || 0, unit: POINT_EXCHANGE_UNIT },
    history: history, requests: requests
  };
}

// 교환권 신청: tickets = 장 수 (1장 = 100pt). 선생님이 승인해야 차감됩니다.
function requestPointExchange(user, tickets) {
  const n = Math.floor(Number(tickets));
  if (!(n >= 1 && n <= 50)) throw new Error('교환권 장 수를 다시 확인해 주십시오.');
  const pts = n * POINT_EXCHANGE_UNIT;
  return _withLock_(function () {
    const me = _npStudent_(_npMembers_().list, _npUserId_(user));
    const st = _pointState_();
    const balance = st.balances[me.id] || 0, pending = st.pending[me.id] || 0;
    if (balance - pending < pts) {
      throw new Error('포인트가 부족합니다. (신청 가능: ' + Math.max(0, balance - pending) + 'pt)');
    }
    _npAppend_(_npSheet_(NP_EXCHANGE_SHEET, NP_EXCHANGE_HEADERS),
      [[_npId_('X'), _nowIso(), me.id, me.name, pts, '대기', '', '', '', '']]);
    return { ok: true, points: { balance: balance, pending: pending + pts, unit: POINT_EXCHANGE_UNIT } };
  });
}

function cancelPointExchange(user, requestId) {
  const id = _npUserId_(user);
  return _withLock_(function () {
    const sh = _npSheet_(NP_EXCHANGE_SHEET, NP_EXCHANGE_HEADERS);
    const rows = _npRows_(sh, NP_EXCHANGE_HEADERS.length);
    const idx = rows.findIndex(r => _npStr_(r[0]) === String(requestId) && _npStr_(r[2]) === id);
    if (idx < 0) throw new Error('신청 내역을 찾을 수 없습니다.');
    if (_npStr_(rows[idx][5]) !== '대기') throw new Error('이미 처리된 신청입니다.');
    sh.getRange(idx + 2, 6, 1, 5).setNumberFormat('@').setValues([['취소', id, '본인', _nowIso(), '']]);
    return { ok: true };
  });
}

/* ================= 관리자용 API (첫 인자 auth = {id, token}) ================= */

// 포인트 화면 + 종 아이콘(교환 신청 대기 건수)에 쓰는 데이터. scope: 'mine'(담당 학생) | 'all'(전체 학생)
function adminGetPoints(auth, scope) {
  const me = _requireManager_(auth);
  const allStudents = me.members.filter(m => m.role === 'student');
  const mine = allStudents.filter(s => s.d === me.id);
  const useAll = (scope === 'all') || !mine.length;
  const students = useAll ? allStudents : mine;
  const inScope = {};
  students.forEach(s => { inScope[s.id] = true; });

  const st = _pointState_();
  const requests = _npRows_(_npSheet_(NP_EXCHANGE_SHEET, NP_EXCHANGE_HEADERS), NP_EXCHANGE_HEADERS.length)
    .map(_exchangeObj_).filter(x => inScope[x.studentId]);
  const ledger = _npRows_(_npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS), NP_POINT_HEADERS.length)
    .map(_ledgerObj_).filter(x => inScope[x.studentId]).reverse().slice(0, 100);

  return {
    scope: useAll ? 'all' : 'mine',
    hasMine: mine.length > 0,
    unit: POINT_EXCHANGE_UNIT,
    students: students.map(s => ({ id: s.id, name: s.name, balance: st.balances[s.id] || 0, pending: st.pending[s.id] || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    pendingRequests: requests.filter(x => x.status === '대기').map(x => {
      x.balance = st.balances[x.studentId] || 0; return x;
    }),
    doneRequests: requests.filter(x => x.status !== '대기').reverse().slice(0, 20),
    ledger: ledger
  };
}

// 적립/차감. payload = { studentIds:[], delta: +10 또는 -50, reason:'' }
function adminAdjustPoints(auth, payload) {
  const me = _requireManager_(auth);
  const p = payload || {};
  const delta = Math.round(Number(p.delta));
  const reason = String(p.reason || '').trim().slice(0, 100);
  const ids = _arr(p.studentIds).map(s => String(s).trim()).filter((v, i, a) => v && a.indexOf(v) === i);
  if (!ids.length) throw new Error('학생을 선택하십시오.');
  if (!isFinite(delta) || delta === 0 || Math.abs(delta) > 100000) throw new Error('포인트 값을 다시 확인하십시오.');
  if (!reason) throw new Error('사유를 입력하십시오.');

  return _withLock_(function () {
    const targets = ids.map(id => _npStudent_(me.members, id));
    const st = _pointState_();
    if (delta < 0) {
      const lack = targets.filter(s => (st.balances[s.id] || 0) - (st.pending[s.id] || 0) + delta < 0);
      if (lack.length) {
        throw new Error('잔액이 부족한 학생이 있어 처리하지 않았습니다: ' +
          lack.map(s => s.name + '(' + ((st.balances[s.id] || 0) - (st.pending[s.id] || 0)) + 'pt)').join(', '));
      }
    }
    const now = _nowIso(), kind = delta > 0 ? '적립' : '차감';
    const result = {};
    const ledgerRows = [], noticeRows = [];
    targets.forEach(s => {
      const bal = (st.balances[s.id] || 0) + delta;
      result[s.id] = bal;
      ledgerRows.push([_npId_('P'), now, s.id, s.name, delta, bal, kind, reason, me.id, me.name, '', '']);
      noticeRows.push(_personalNoticeRow_(me, s.id, '포인트 ' + _fmtPt_(delta) + ' ' + kind, reason + '\n현재 잔액: ' + bal + 'pt'));
    });
    _npAppend_(_npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS), ledgerRows);
    _npAppend_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS), noticeRows);
    return { ok: true, count: targets.length, balances: result };
  });
}

// 잘못 입력한 내역 취소(반대 금액을 한 줄 더 적는 방식이라 기록이 남습니다)
function adminCancelPointEntry(auth, entryId) {
  const me = _requireManager_(auth);
  return _withLock_(function () {
    const sh = _npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS);
    const rows = _npRows_(sh, NP_POINT_HEADERS.length);
    const idx = rows.findIndex(r => _npStr_(r[0]) === String(entryId));
    if (idx < 0) throw new Error('내역을 찾을 수 없습니다.');
    const e = _ledgerObj_(rows[idx]);
    if (e.cancelled || e.kind === '취소') throw new Error('이미 취소되었거나 취소할 수 없는 내역입니다.');
    let bal = 0;
    rows.forEach(r => { if (_npStr_(r[2]) === e.studentId) bal += _npNum_(r[4]); });
    const newBal = bal - e.delta;
    if (newBal < 0) throw new Error('학생이 이미 포인트를 사용해서 취소할 수 없습니다. (현재 잔액 ' + bal + 'pt)');
    sh.getRange(idx + 2, 12).setNumberFormat('@').setValue('Y');
    _npAppend_(sh, [[_npId_('P'), _nowIso(), e.studentId, e.studentName, -e.delta, newBal, '취소', '취소: ' + e.reason, me.id, me.name, e.id, '']]);
    _npAppend_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS),
      [_personalNoticeRow_(me, e.studentId, '포인트 내역 취소 ' + _fmtPt_(-e.delta), '취소된 내역: ' + e.reason + '\n현재 잔액: ' + newBal + 'pt')]);
    return { ok: true, balance: newBal };
  });
}

// 교환 신청 승인/거절. 승인하면 그 자리에서 포인트가 차감됩니다.
function adminResolveExchange(auth, requestId, approve, memo) {
  const me = _requireManager_(auth);
  const note = String(memo || '').trim().slice(0, 100);
  return _withLock_(function () {
    const sh = _npSheet_(NP_EXCHANGE_SHEET, NP_EXCHANGE_HEADERS);
    const rows = _npRows_(sh, NP_EXCHANGE_HEADERS.length);
    const idx = rows.findIndex(r => _npStr_(r[0]) === String(requestId));
    if (idx < 0) throw new Error('신청 내역을 찾을 수 없습니다.');
    const x = _exchangeObj_(rows[idx]);
    if (x.status !== '대기') throw new Error('이미 처리된 신청입니다. (' + x.status + ')');
    const tickets = Math.round(x.points / POINT_EXCHANGE_UNIT);
    const now = _nowIso();
    let noticeRow, balance;

    if (approve) {
      balance = _pointState_().balances[x.studentId] || 0;
      if (balance < x.points) throw new Error('학생의 잔액이 부족합니다. (잔액 ' + balance + 'pt / 신청 ' + x.points + 'pt)');
      balance -= x.points;
      _npAppend_(_npSheet_(NP_POINT_SHEET, NP_POINT_HEADERS),
        [[_npId_('P'), now, x.studentId, x.studentName, -x.points, balance, '교환', '교환권 ' + tickets + '장 교환', me.id, me.name, x.id, '']]);
      noticeRow = _personalNoticeRow_(me, x.studentId, '교환권 ' + tickets + '장 승인 🎉',
        x.points + 'pt가 차감되었습니다. 선생님께 교환권을 받아 가십시오.\n현재 잔액: ' + balance + 'pt');
    } else {
      noticeRow = _personalNoticeRow_(me, x.studentId, '교환 신청이 반려되었습니다',
        '신청: 교환권 ' + tickets + '장 (' + x.points + 'pt)' + (note ? '\n사유: ' + note : '') + '\n포인트는 차감되지 않았습니다.');
    }
    sh.getRange(idx + 2, 6, 1, 5).setNumberFormat('@')
      .setValues([[approve ? '승인' : '거절', me.id, me.name, now, _npCell_(note)]]);
    _npAppend_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS), [noticeRow]);
    return { ok: true, approved: !!approve, balance: balance };
  });
}

// 공지·개인 알림 보내기.
// payload = { targetType:'all'|'managed'|'ids', targetIds:[], title, body, important, days }
function adminSendNotice(auth, payload) {
  const me = _requireManager_(auth);
  const p = payload || {};
  const title = String(p.title || '').trim().slice(0, 100);
  const body = String(p.body || '').trim().slice(0, 2000);
  if (!title) throw new Error('제목을 입력하십시오.');
  let days = Math.floor(Number(p.days));
  if (!(days >= 1)) days = NOTICE_DEFAULT_DAYS;
  if (days > 365) days = 365;

  let targetType, targetIds, kind = '공지';
  if (p.targetType === 'all') { targetType = '전체'; targetIds = ''; }
  else if (p.targetType === 'managed') { targetType = '담당'; targetIds = me.id; }
  else {
    const ids = _arr(p.targetIds).map(s => String(s).trim()).filter((v, i, a) => v && a.indexOf(v) === i);
    if (!ids.length) throw new Error('받는 학생을 선택하십시오.');
    ids.forEach(id => _npStudent_(me.members, id));
    targetType = '지정'; targetIds = ids.join(','); kind = '개인';
  }
  const id = _npId_('N');
  _withLock_(function () {
    _npAppend_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS),
      [[id, _nowIso(), me.id, me.name, kind, targetType, targetIds, title, body, p.important ? 'Y' : '', _npDay_(days), '정상']]);
  });
  return { ok: true, id: id, expiry: _npDay_(days) };
}

// 보낸 공지 목록 + 읽음 현황
function adminListNotices(auth) {
  const me = _requireManager_(auth);
  const today = _npDay_(0);
  const notices = _npRows_(_npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS), NP_NOTICE_HEADERS.length)
    .map(_noticeObj_)
    .filter(n => n.id && n.status !== '삭제' && (n.kind === '공지' || n.kind === '개인'))
    .reverse().slice(0, 50);
  const wanted = {};
  notices.forEach(n => { wanted[n.id] = {}; });
  _npRows_(_npSheet_(NP_READ_SHEET, NP_READ_HEADERS), 2).forEach(r => {
    const nid = _npStr_(r[0]);
    if (wanted[nid]) wanted[nid][_npStr_(r[1])] = true;
  });
  return notices.map(n => {
    const targets = _noticeTargets_(n, me.members);
    const readers = targets.filter(s => wanted[n.id][s.id]);
    const unreadNames = targets.filter(s => !wanted[n.id][s.id]).map(s => s.name);
    return {
      id: n.id, time: n.time, author: n.author, mine: n.authorId === me.id, kind: n.kind,
      targetLabel: n.targetType === '전체' ? '전체 학생' : (n.targetType === '담당' ? n.author + ' 담당 학생' : targets.map(s => s.name).join(', ')),
      title: n.title, body: n.body, important: n.important, expiry: n.expiry, expired: !!n.expiry && n.expiry < today,
      targetCount: targets.length, readCount: readers.length,
      unreadNames: unreadNames.slice(0, 80)
    };
  });
}

function adminDeleteNotice(auth, noticeId) {
  _requireManager_(auth);
  return _withLock_(function () {
    const sh = _npSheet_(NP_NOTICE_SHEET, NP_NOTICE_HEADERS);
    const rows = _npRows_(sh, 1);
    const idx = rows.findIndex(r => _npStr_(r[0]) === String(noticeId));
    if (idx < 0) throw new Error('알림을 찾을 수 없습니다.');
    sh.getRange(idx + 2, 12).setNumberFormat('@').setValue('삭제');
    return { ok: true };
  });
}

/**************************************
 * 문제은행 편집기 (관리자 전용)
 * 문제은행 시트는 '한 열 = 한 문항', 1~17행 = 항목(ID·출처·…·해설) 구조입니다.
 * 문항 ID(qid)가 "시트명!열번호"라서, 열을 지우거나 끼워 넣으면 그 뒤 문항의 풀이 기록·과제가 어긋납니다.
 * 그래서 편집기는 ① 열을 지우지 않고 ② 새 문항은 항상 오른쪽 끝에 붙이며 ③ 삭제 대신 '숨기기'(출처를 메모로 옮김)를 씁니다.
 **************************************/
const QB_ROWS = 17;
const QB_LABELS = ['ID', '출처', '유형', '연계', '난이도', '질문', 'Box1', 'Box2', 'Box3', 'Box4', 1, 2, 3, 4, 5, '정답', '해설'];
const QB_HIDDEN_NOTE = 'K2_HIDDEN_SOURCE:';
const QB_NOT_BANK_ = ['양식', 'MasterIndex'];

function _qbSheet_(name, mustExist) {
  name = String(name || '').trim();
  if (!name || QB_NOT_BANK_.indexOf(name) !== -1) throw new Error('문제은행 시트 이름을 확인하십시오.');
  const sheet = _contentsSS().getSheetByName(name);
  if (!sheet && mustExist !== false) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sheet;
}

// 시트 목록 + 시트별 문항 수(출제 목록에 보이는 문항 기준)
function qbListSheets() {
  _guardDirect_();
  const counts = {};
  try { gatherAllCols_().forEach(r => { counts[r.sheet] = (counts[r.sheet] || 0) + 1; }); } catch (e) {}
  const out = [];
  _contentsSS().getSheets().forEach(sh => {
    const name = sh.getName();
    if (QB_NOT_BANK_.indexOf(name) !== -1) return;
    out.push({ name: name, count: counts[name] || 0 });
  });
  return { sheets: out };
}

// 시트의 모든 문항을 값과 수식으로 함께 읽습니다. (장문 연결 칸은 수식 '=Y7' 등으로 들어 있습니다)
function qbLoadSheet(name) {
  _guardDirect_();
  const sheet = _qbSheet_(name);
  return _qbReadSheet_(sheet);
}
function _qbReadSheet_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const range = sheet.getRange(1, 1, QB_ROWS, lastCol);
  const values = range.getValues(), formulas = range.getFormulas();
  const notes = sheet.getRange(2, 1, 1, lastCol).getNotes()[0];
  const tz = Session.getScriptTimeZone();
  const str = v => (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : (v == null ? '' : String(v));
  const cols = [];
  for (let c = 1; c < lastCol; c++) {
    const v = [], f = [];
    for (let r = 0; r < QB_ROWS; r++) { v.push(str(values[r][c])); f.push(formulas[r][c] || ''); }
    const note = String(notes[c] || '');
    const hiddenSource = note.indexOf(QB_HIDDEN_NOTE) === 0 ? note.slice(QB_HIDDEN_NOTE.length) : '';
    const empty = v.every(x => x === '') && f.every(x => x === '');
    cols.push({ col: c, letter: _qbColLetter_(c + 1), qid: sheet.getName() + '!' + c, v: v, f: f, hidden: !!hiddenSource, hiddenSource: hiddenSource, empty: empty });
  }
  return { name: sheet.getName(), labels: values.map(row => str(row[0])), cols: cols };
}
function _qbColLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// 셀에 넣을 값 만들기: 수식은 그대로, 난이도·정답 숫자는 숫자로, 나머지 글자는 시트가 숫자·날짜·수식으로 바꾸지 않게 지킵니다.
function _qbCellValue_(row, cell) {
  const raw = (cell && typeof cell === 'object') ? cell.v : cell;
  const isFormula = !!(cell && typeof cell === 'object' && cell.f);
  let v = raw == null ? '' : String(raw).replace(/\r\n?/g, '\n');
  if (isFormula) {
    if (!/^=/.test(v)) throw new Error('연결(수식) 칸은 =로 시작해야 합니다: ' + v);
    return v;
  }
  if (v === '') return '';
  if ((row === 4 || row === 15) && /^\s*\d+\s*$/.test(v)) return Number(v.trim());
  // 숫자·날짜처럼 보이거나 = + - @ 로 시작하는 글자는 앞에 '를 붙여 글자 그대로 저장 (시트에는 '가 보이지 않습니다)
  if (/^[=+\-@]/.test(v) || /^[\d\s.,:\/%()-]+$/.test(v)) return "'" + v;
  return v;
}
function _qbSame_(a, b) { return String(a == null ? '' : a).replace(/\r\n?/g, '\n') === String(b == null ? '' : b).replace(/\r\n?/g, '\n'); }

/**
 * 문항 저장(여러 개 한 번에).
 * items: [{ col: 열번호(0=A열이므로 1부터) | null(새 문항: 오른쪽 끝에 추가),
 *           cells: { 행번호(0~16): {v, f} },        // 바꾼 칸만
 *           expect: { 행번호: '저장 전 값 또는 수식' } }] // 다른 사람이 그사이 고쳤는지 확인용
 * 반환: { ok, saved: [{col, qid}], conflicts: [{col, row, current}], sheet: 시트 전체(새로 읽은 값) }
 */
function qbWriteQuestions(name, items) {
  _guardDirect_();
  if (!Array.isArray(items) || !items.length) throw new Error('저장할 문항이 없습니다.');
  if (items.length > 200) throw new Error('한 번에 200문항까지 저장할 수 있습니다.');
  return _withLock_(() => {
    const sheet = _qbSheet_(name);
    let lastCol = Math.max(sheet.getLastColumn(), 1);
    const conflicts = [], saved = [];

    // 1) 기존 문항 고치기: 바꾼 칸만 씁니다. (건드리지 않은 장문 연결 수식은 그대로 남습니다)
    const edits = items.filter(it => it && it.col != null);
    if (edits.length) {
      const range = sheet.getRange(1, 1, QB_ROWS, lastCol);
      const values = range.getValues(), formulas = range.getFormulas();
      const tz = Session.getScriptTimeZone();
      const str = v => (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : (v == null ? '' : String(v));
      edits.forEach(it => {
        const c = Number(it.col);
        if (!Number.isSafeInteger(c) || c < 1 || c >= lastCol) throw new Error('문항 열을 확인하십시오: ' + it.col);
        const expect = it.expect || {};
        Object.keys(expect).forEach(k => {
          const r = Number(k), cur = formulas[r][c] || str(values[r][c]);
          if (!_qbSame_(cur, expect[k])) conflicts.push({ col: c, row: r, current: String(cur) });
        });
      });
      if (conflicts.length) return { ok: false, conflicts: conflicts, sheet: _qbReadSheet_(sheet) };
      edits.forEach(it => {
        const c = Number(it.col);
        Object.keys(it.cells || {}).forEach(k => {
          const r = Number(k);
          if (!(r >= 0 && r < QB_ROWS)) return;
          const cell = sheet.getRange(r + 1, c + 1);
          const v = _qbCellValue_(r, it.cells[k]);
          if (typeof v === 'string' && /^=/.test(v)) cell.setFormula(v); else cell.setValue(v);
        });
        saved.push({ col: c, qid: name + '!' + c });
      });
    }

    // 2) 새 문항: 오른쪽 끝 열부터 차례로 붙입니다. (한 번에 씁니다)
    const adds = items.filter(it => it && it.col == null);
    if (adds.length) {
      const block = [];
      for (let r = 0; r < QB_ROWS; r++) block.push(adds.map(it => _qbCellValue_(r, (it.cells || {})[r])));
      if (sheet.getMaxColumns() < lastCol + adds.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), lastCol + adds.length - sheet.getMaxColumns());
      sheet.getRange(1, lastCol + 1, QB_ROWS, adds.length).setValues(block);
      adds.forEach((it, i) => saved.push({ col: lastCol + i, qid: name + '!' + (lastCol + i), temp: it.temp || '' }));
      lastCol += adds.length;
    }
    SpreadsheetApp.flush();
    _qbSyncIndex_(sheet);
    return { ok: true, saved: saved, sheet: _qbReadSheet_(sheet) };
  }, 30000);
}

/**
 * 새 시험지(시트) 만들기.
 * opts: { from, to: 번호 틀(예: 18~45, 비우면 틀 없이), types: {번호: 유형}, linkLong: 장문(41-42, 43-45) 연결 수식 넣기 }
 * 틀 칸에는 ID·유형만 넣고 출처는 비워 둡니다. → 출처를 넣고 저장하기 전까지 학생 출제 목록에 나오지 않습니다.
 */
function qbCreateSheet(name, opts) {
  _guardDirect_();
  name = String(name || '').trim();
  if (!/^[0-9A-Za-z가-힣_()\-]{3,60}$/.test(name)) throw new Error('시트 이름은 영문·숫자·한글·_ ( ) - 만 쓸 수 있습니다 (3~60자).');
  opts = opts || {};
  return _withLock_(() => {
    const ss = _contentsSS();
    if (ss.getSheetByName(name)) throw new Error('같은 이름의 시트가 이미 있습니다: ' + name);
    const tpl = ss.getSheetByName('양식');
    const sheet = tpl ? ss.insertSheet(name, ss.getSheets().length, { template: tpl }) : ss.insertSheet(name, ss.getSheets().length);
    // 양식에 들어 있던 예시 문항은 지우고, A열 항목 이름을 맞춥니다.
    if (sheet.getLastColumn() > 1) sheet.getRange(1, 2, Math.max(sheet.getMaxRows(), QB_ROWS), sheet.getLastColumn() - 1).clearContent().clearNote();
    sheet.getRange(1, 1, QB_ROWS, 1).setValues(QB_LABELS.map(x => [x]));
    sheet.setFrozenColumns(1);

    const from = parseInt(opts.from, 10), to = parseInt(opts.to, 10);
    if (from > 0 && to >= from && to - from < 100) {
      const nums = []; for (let n = from; n <= to; n++) nums.push(n);
      const types = opts.types || {};
      const colOf = n => nums.indexOf(n) + 1;                 // 0=A열이므로 첫 번호가 1(B열)
      const ref = (n, row) => '=' + _qbColLetter_(colOf(n) + 1) + row;
      const block = [];
      for (let r = 0; r < QB_ROWS; r++) block.push(nums.map(() => ''));
      nums.forEach((n, i) => {
        block[0][i] = "'" + name + '_' + (n < 10 ? '0' + n : n);
        block[2][i] = types[n] || '';
      });
      if (opts.linkLong) {
        // 기존 시트와 같은 방식: 42는 41의 지문·해설, 44·45는 43의 지문(A)~(D)·해설을 가져옵니다.
        const link = (n, head, rows) => {
          if (nums.indexOf(n) === -1 || nums.indexOf(head) === -1) return;
          const i = nums.indexOf(n);
          block[3][i] = ref(head, 1);
          rows.forEach(row => { block[row - 1][i] = ref(head, row); });
        };
        link(42, 41, [7, 17]);
        link(44, 43, [7, 8, 9, 10, 17]);
        link(45, 43, [7, 8, 9, 10, 17]);
      }
      if (sheet.getMaxColumns() < nums.length + 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), nums.length + 1 - sheet.getMaxColumns());
      sheet.getRange(1, 2, QB_ROWS, nums.length).setValues(block);
    }
    SpreadsheetApp.flush();
    return { ok: true, sheet: _qbReadSheet_(sheet) };
  }, 30000);
}

// 숨기기/되살리기: 출처를 칸 메모로 옮겨 두면 출제 목록에서 빠집니다. (열은 그대로라 풀이 기록이 안전합니다)
function qbSetHidden(name, col, hide) {
  _guardDirect_();
  return _withLock_(() => {
    const sheet = _qbSheet_(name);
    const c = Number(col);
    if (!Number.isSafeInteger(c) || c < 1 || c >= sheet.getLastColumn()) throw new Error('문항 열을 확인하십시오.');
    const cell = sheet.getRange(2, c + 1);
    const note = String(cell.getNote() || '');
    if (hide) {
      if (note.indexOf(QB_HIDDEN_NOTE) === 0) return { ok: true, sheet: _qbReadSheet_(sheet) };
      const src = cell.getFormula() || String(cell.getValue() || '');
      if (!src) throw new Error('출처가 비어 있는 문항은 이미 출제 목록에 나오지 않습니다.');
      cell.setNote(QB_HIDDEN_NOTE + src).clearContent();
    } else {
      if (note.indexOf(QB_HIDDEN_NOTE) !== 0) throw new Error('숨긴 문항이 아닙니다.');
      const src = note.slice(QB_HIDDEN_NOTE.length);
      if (/^=/.test(src)) cell.setFormula(src); else cell.setValue(_qbCellValue_(1, src));
      cell.clearNote();
    }
    SpreadsheetApp.flush();
    _qbSyncIndex_(sheet);
    return { ok: true, sheet: _qbReadSheet_(sheet) };
  }, 30000);
}

// 고친 시트의 MasterIndex 줄만 맞춥니다. (전체 인덱스 갱신보다 훨씬 빠릅니다)
function _qbSyncIndex_(sheet) {
  const ss = _contentsSS();
  const name = sheet.getName();
  let idx = ss.getSheetByName('MasterIndex');
  if (!idx) { _updateMasterIndex_(); return; }
  const lastCol = sheet.getLastColumn();
  const top = lastCol > 1 ? sheet.getRange(1, 1, 6, lastCol).getValues() : [];
  const want = new Map();
  for (let c = 1; c < lastCol; c++) {
    const source = String(top[1][c] || '').trim();
    if (!source) continue;
    const p = parseSource_(source);
    want.set(name + '!' + c, [name + '!' + c, p.grade, p.year, p.month, String(top[2][c] || ''), String(top[4][c] || ''),
      String(top[3][c] || ''), String(top[0][c] || ''), source, name, c, p.detail]);
  }
  const lastRow = idx.getLastRow();
  const cur = lastRow > 1 ? idx.getRange(2, 1, lastRow - 1, 12).getValues() : [];
  const removeRows = [];
  cur.forEach((row, i) => {
    if (String(row[9]) !== name) return;
    const qid = String(row[0]);
    const next = want.get(qid);
    if (!next) { removeRows.push(i + 2); return; }
    want.delete(qid);
    const differs = next.some((v, k) => String(v) !== String(row[k]));
    if (differs) idx.getRange(i + 2, 1, 1, 12).setValues([next]);
  });
  removeRows.reverse().forEach(r => idx.deleteRow(r));
  const adds = [...want.values()];
  if (adds.length) idx.getRange(idx.getLastRow() + 1, 1, adds.length, 12).setValues(adds);
  // 메타·문항 기억(캐시)을 버리고, 관리자 화면이 새 목록을 받도록 버전을 올립니다.
  const cache = CacheService.getScriptCache();
  try { cache.removeAll(['QBANK_MASTER_META_V3_count', 'QBANK_V2_DATA_m1_count', 'QBANK_V2_DATA_m2_count', 'QBANK_V2_DATA_m3_count',
    'QBANK_V2_DATA_h1_count', 'QBANK_V2_DATA_h2_count', 'QBANK_V2_DATA_h3_count']); } catch (e) {}
  _bumpQcacheVer_();
  try { PropertiesService.getScriptProperties().setProperty('QBANK_INDEX_VERSION', 'v' + Date.now()); } catch (e) {}
}
