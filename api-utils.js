/* ===================== 외부 호스팅용 GAS 통신 브릿지 ===================== */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxT3cLH186aTrATC7ldGeMWqzrx5QlcieOE9YNqGAwebhmczRg-vZQFaxy2i15aiOy7/exec';

// 로그인한 관리자의 인증 정보 (학생·로그아웃 상태면 null)
function _bridgeAuth() {
  try {
    const u = (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : null;
    return (u && u.role === 'manager' && u.token) ? { id: u.id, token: u.token } : null;
  } catch (e) { return null; }
}

if (typeof google === 'undefined' || !google.script) {
  function createGasRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function(fn) { return createGasRunner(fn, failureHandler); };
        }
        if (prop === 'withFailureHandler') {
          return function(fn) { return createGasRunner(successHandler, fn); };
        }
        return function(...args) {
          // 구글 스크립트 doPost로 요청 전송 (CORS 사전 요청 방지를 위해 text/plain 사용)
          fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ func: prop, args: args, auth: _bridgeAuth() })
          })
          .then(res => res.json())
          .then(res => {
            if (res && res.ok) {
              if (typeof successHandler === 'function') successHandler(res.data);
            } else {
              const errMsg = (res && res.error) ? res.error : 'Server Error';
              if (typeof failureHandler === 'function') failureHandler(errMsg);
              else console.error('GAS Error:', errMsg);
            }
          })
          .catch(err => {
            if (typeof failureHandler === 'function') failureHandler(err);
            else console.error('Fetch Error:', err);
          });
        };
      }
    });
  }

  window.google = {
    script: {
      run: createGasRunner(null, null),
      url: {
        getLocation: function(callback) {
          const params = new URLSearchParams(window.location.search);
          const parameters = {};
          const parameter = {};
          for (const [key, val] of params.entries()) {
            if (!parameters[key]) parameters[key] = [];
            parameters[key].push(val);
            if (parameter[key] === undefined) parameter[key] = val;
          }
          callback({
            href: window.location.href,
            hash: window.location.hash ? window.location.hash.replace(/^#/, '') : '',
            parameter: parameter,
            parameters: parameters
          });
        }
      }
    }
  };
}

/* ===================== 공통 유틸 ===================== */
function syncLoginUI() { refreshHeaderAuth(); }
function escapeHTML(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// 속성값(value="...", data-x="...")에 넣을 때: 따옴표까지 바꿉니다.
function escapeAttr(str){ return escapeHTML(str == null ? '' : str).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// onclick="fn(...)" 안에 글자를 인자로 넣을 때: 따옴표·줄바꿈이 들어 있어도 깨지지 않습니다.
function jsArgAttr(v){ return escapeAttr(JSON.stringify(String(v == null ? '' : v))); }
function hasGsRun(){ try{ return typeof google!=='undefined' && google.script && google.script.run; }catch(e){ return false; } }
function toOneLine(html){ return String(html||'').replace(/^(?:\s|<br>)+/gi,'').replace(/(?:\s*<br>\s*)+/gi,' ').replace(/\s+/g,' ').trim(); }

let _globalToastTimer = null; // [신규] 타이머 중첩 방지용 전역 변수

// [신규] 화면 가림 없는 비동기 알림창 (Toast)
function showToast(message, type = 'info') {
    let toast = document.getElementById('globalToast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.cssText = 'position:fixed; bottom:80px; right:20px; padding:12px 20px; border-radius:8px; color:#fff; font-size:14px; font-weight:bold; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:opacity 0.3s; pointer-events:none;'; // 알림이 아래 버튼 클릭을 막지 않도록
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = type === 'success' ? '#059669' : (type === 'error' ? '#dc2626' : '#2b6cb0');
    toast.innerHTML = message;
    toast.style.opacity = '1';
    toast.style.display = 'block';

    // 1. 기존에 돌고 있던 숨김 타이머 강제 종료 (덮어쓰기 방지)
    if (_globalToastTimer) {
        clearTimeout(_globalToastTimer);
    }

    // 2. 타입에 따라 화면 노출 시간 차등 적용 (성공 시 4초, 그 외 2.5초)
    const duration = (type === 'success') ? 4000 : 2500;

    // 3. 새로운 단일 타이머 세팅
    _globalToastTimer = setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.style.display = 'none', 300); 
    }, duration);
}

// [추가] 해설 토글 기능
function toggleExplanation(btn, idx) {
    const parent = btn.closest('.question-card');
    const box = parent.querySelector('.explanation-box');
    if(!box) return;
    const isHidden = (window.getComputedStyle(box).display === 'none');
    box.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? '닫기' : '해설';
    btn.style.background = isHidden ? '#4b5563' : '#6b7280';
}

function normalizeImgSrc(u){
  if(!u) return ''; 
  var url = String(u).trim();
  if(/^(https?:|data:)/i.test(url)) return url; 
  // 구글 드라이브 파일 ID만 적은 경우(drive:파일ID) 이미지 주소로 바꿉니다.
  if(/^[A-Za-z0-9_-]{20,}$/.test(url)) return 'https://drive.google.com/thumbnail?id=' + url + '&sz=w1600';
  return '';
}

    // [신규] 무지개 색상 적용 헬퍼 함수
    function applyRainbow(str) {
      var colors = ['#dc2626', '#d97706', '#eab308', '#059669', '#2b6cb0', '#4f46e5', '#7c3aed'];
      var res = '';
      var idx = 0;
      for (var i = 0; i < str.length; i++) {
        if (str[i].trim() === '') {
          res += str[i];
        } else {
          // 인쇄 시에도 색상이 유지되도록 !important 및 print-color-adjust 속성 추가
          res += '<span style="color:' + colors[idx % colors.length] + ' !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">' + str[i] + '</span>';
          idx++;
        }
      }
      return res;
    }

// 문서에서 복사해 온 '특수 하이픈'을 보통 하이픈(-)으로 바꿉니다.
// - U+00AD(소프트 하이픈)은 줄 끝에 걸릴 때만 보이고 평소에는 사라져 "red-eye"가 "redeye"처럼 보입니다.
// - U+2010·U+2011·U+2012는 글꼴에 따라 글자가 없어 빈칸으로 나옵니다.
// - 줄표(–, —)는 그대로 두고, 가로줄(U+2015)만 글꼴에 흔히 있는 —로 맞춥니다.
function normalizeHyphens(str) {
  return String(str == null ? '' : str).replace(/[\u00AD\u2010\u2011\u2012]/g, '-').replace(/\u2015/g, '\u2014');
}

    function sanitizeInlineHTML(input) {
      // 1. 입력을 안전한 문자열로 변환
  var raw = normalizeHyphens(input).trim().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // 2. 먼저 일반적인 이스케이프 처리를 수행 (표 내부의 태그까지 다 글자로 바뀜)
  var s = escapeHTML(raw.replace(/\r?\n/g, '<br>'))
          .replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // 3. 표(table)는 틀(행/칸)만 먼저 만듭니다. 칸 안의 글자는 이스케이프된 그대로 두고,
  //    아래 4~6단계(허용 태그·색상·이미지)가 표 밖 글자와 똑같이 처리합니다.
  s = s.replace(/&lt;table&gt;([\s\S]*?)&lt;\/table&gt;/gi, function(match, content) {
      return parseSimplifiedTable('<table>' + content + '</table>');
  });
  // 표 바로 앞뒤 줄바꿈이 빈 줄로 남아 공간을 차지하지 않도록 한 줄씩 제거
  s = s.replace(/<br>\s*(<table\b)/gi, '$1').replace(/(<\/table>)\s*<br>/gi, '$1');

  // 4. 나머지 기본 태그 처리
  s = s.replace(/&lt;(u|b|i|strong|em|sub|sup|center)\b[^&]*&gt;/gi, '<$1>')
       .replace(/&lt;\/(u|b|i|strong|em|sub|sup|center)\s*&gt;/gi, '</$1>');

  s = s.replace(/&lt;c&gt;/gi, '<center>').replace(/&lt;\/c&gt;/gi, '</center>');
  s = s.replace(/&lt;(?:right|r)&gt;/gi, '<div style="text-align:right; font-size:calc(1em - 1pt);">')
       .replace(/&lt;\/(?:right|r)&gt;/gi, '</div>');
  s = s.replace(/&lt;box&gt;/gi, '<div class="exam-q-box">')
       .replace(/&lt;\/box&gt;/gi, '</div>');
  
  // 색상 태그 처리 (클래스 기반으로 변경)
  s = s.replace(/&lt;red&gt;/gi, '<span class="txt-red">').replace(/&lt;\/red&gt;/gi, '</span>');
  s = s.replace(/&lt;blue&gt;/gi, '<span class="txt-blue">').replace(/&lt;\/blue&gt;/gi, '</span>');
  s = s.replace(/&lt;green&gt;/gi, '<span class="txt-green">').replace(/&lt;\/green&gt;/gi, '</span>');
  s = s.replace(/&lt;orange&gt;/gi, '<span class="txt-orange">').replace(/&lt;\/orange&gt;/gi, '</span>');
  s = s.replace(/&lt;rainbow&gt;([\s\S]*?)&lt;\/rainbow&gt;/gi, function(match, p1) { return applyRainbow(p1); });

  // 5. 이미지 태그 처리
  s = s.replace(/&lt;img\b[^&]*?src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s&>]+))[^&]*?&gt;/gi, function(_, g1, g2, g3) {
    var rawSrc = g1 || g2 || g3 || '', final = normalizeImgSrc(rawSrc) || rawSrc;
    var q = function(v) { return v.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }; // 속성 밖으로 새지 않게
    return '<img src="' + q(final) + '" loading="lazy" referrerpolicy="no-referrer" data-src-original="' + q(rawSrc) + '">';
  });

  // 6. 드라이브 링크 처리
  s = s.replace(/drive:([A-Za-z0-9_-]{20,})/g, function(_, id) {
    return '<img src="' + normalizeImgSrc(id) + '" loading="lazy" referrerpolicy="no-referrer" data-src-original="' + id + '">';
  });

  s = s.replace(/(^|[^"'])(https?:\/\/[^\s<"']+\.(?:jpe?g|png|gif|webp|bmp))/gi, function(match, prefix, url) {
    return prefix + '<img src="' + url + '" loading="lazy" referrerpolicy="no-referrer" data-src-original="' + url + '">';
  });

  return s;
}

/* [신규] 파이프(|) 구분자를 HTML 테이블로 자동 변환하는 파서 */
function parseSimplifiedTable(rawContent) {
  return rawContent.replace(/<table>([\s\S]*?)<\/table>/gi, (match, content) => {
    // 줄바꿈(<br>)을 기준으로 행을 구분하도록 변경
    const lines = content.trim().split(/<br\s*\/?>/gi);
    const validLines = lines.map(line => line.trim()).filter(line => line !== "");

    let maxCols = 0;
    const rows = validLines.map(line => {
      const cells = line.split('|').map(c => c.trim());
      if (cells.length > maxCols) maxCols = cells.length;
      return cells;
    });

    // 1. 셀 데이터 객체화 및 세로 병합(rowspan) 계산
        const cellData = rows.map(cells => {
            return cells.map(c => ({ text: c, rowspan: 1, skip: false }));
        });

        for (let r = 1; r < cellData.length; r++) {
            for (let c = 0; c < cellData[r].length; c++) {
                // 현재 칸이 비어있다면 세로 병합 대상일 가능성이 높음
                if (cellData[r][c] && cellData[r][c].text === "") {
                    let prevR = r - 1;
                    // 바로 위 칸이 이미 병합되어 숨겨진(skip) 상태라면 그 위로 계속 탐색
                    while (prevR >= 0 && cellData[prevR][c] && cellData[prevR][c].skip) {
                        prevR--;
                    }
                    // 유효한 윗칸을 찾았다면 높이를 1 늘리고, 현재 칸은 렌더링 생략(skip)
                    if (prevR >= 0 && cellData[prevR][c]) {
                        cellData[prevR][c].rowspan += 1;
                        cellData[r][c].skip = true;
                    }
                }
            }
        }

    // 2. HTML 렌더링
    // 여백을 줄인 표: 셀 안쪽 3px·6px, 줄 간격 1.35, 위아래 6px
    let html = '<table class="q-table" style="width:100%; border-collapse:collapse; border:1px solid #ddd; margin:6px 0;">';
    cellData.forEach((cells, rowIndex) => {
      html += '<tr>';
      const colSpanValue = (maxCols - cells.length) + 1;
      cells.forEach((cellObj, index) => {
        if (cellObj.skip) return; // 세로 병합된 빈 칸은 렌더링 생략

        const isLastCell = (index === cells.length - 1);
        const colspanAttr = (isLastCell && colSpanValue > 1) ? `colspan="${colSpanValue}"` : '';
        const rowspanAttr = (cellObj.rowspan > 1) ? `rowspan="${cellObj.rowspan}"` : '';
        
        // 속성(Attribute) 조합
        const attrs = [colspanAttr, rowspanAttr].filter(Boolean).join(' ');

        // 칸 안의 태그(<b>, <red>, <c> 등)는 sanitizeInlineHTML의 다음 단계에서 변환됩니다.
        // 여기서는 ;; 기호만 칸 내부 줄바꿈으로 바꿉니다. (&lt; &gt; &amp; 끝의 ;는 건드리지 않음)
        let processedCell = cellObj.text.replace(/(&(?:lt|gt|amp);)|;;/g, function(m, ent) { return ent || '<br>'; });
    
            html += `<td ${attrs} style="border:1px solid #ddd; padding:3px 6px; line-height:1.35; text-align:left; vertical-align:middle;">${processedCell}</td>`;
      });
        html += '</tr>';
      });
    html += '</table>';
    return html;
  });
}


// 서술형 괄호 [] 패턴 비교 함수
function compareWithBrackets(input, template) {
  // 템플릿(정답) 소문자화 및 기호 제거
  let pattern = template.toLowerCase().trim().replace(/[.,?!]/g, '');

  // [A/B] 패턴을 (A|B) 정규식 그룹으로 변환
  pattern = pattern.replace(/\[([^\]]+)\]/g, function(match, contents) {
    const alts = contents.split('/').map(s => s.trim()).join('|');
    return '(' + alts + ')';
  });

  // 공백 유연성 처리
  pattern = pattern.replace(/\s+/g, '\\s*');
  
  try {
    const reg = new RegExp('^' + pattern + '$', 'i');
    return reg.test(input);
  } catch (e) {
    return input === template.toLowerCase().trim().replace(/[.,?!]/g, '');
  }
}

/* ===================== [신규] 예쁜 커스텀 팝업 (URL 알림 제거용) ===================== */

// 1. 확인창 (Confirm 대체)
function showCustomConfirm(msg, yesCallback) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const box = document.createElement('div');
    box.className = 'popup-box confirm';
    
    const text = document.createElement('div');
    text.className = 'popup-text confirm-text';
    text.innerHTML = msg.replace(/\n/g, '<br>');
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'popup-btn-group';
    
    const btnNo = document.createElement('button');
    btnNo.className = 'popup-btn no';
    btnNo.innerText = "취소";
    btnNo.onclick = function() { document.body.removeChild(overlay); };
    
    const btnYes = document.createElement('button');
    btnYes.className = 'popup-btn yes';
    btnYes.innerText = "확인";
    btnYes.onclick = function() {
        document.body.removeChild(overlay);
        if(yesCallback) yesCallback();
    };
    
    btnGroup.appendChild(btnNo);
    btnGroup.appendChild(btnYes);
    box.appendChild(text);
    box.appendChild(btnGroup);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// 2. 알림창 (Alert 대체)
function showCustomAlert(msg) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const box = document.createElement('div');
    box.className = 'popup-box alert';
    
    const text = document.createElement('div');
    text.className = 'popup-text';
    text.innerHTML = msg.replace(/\n/g, '<br>');
    
    const btn = document.createElement('button');
    btn.className = 'popup-btn yes full';
    btn.innerText = "확인";
    btn.onclick = function() { document.body.removeChild(overlay); };
    
    box.appendChild(text);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// 3. 이미지 전용 팝업 및 난이도 가이드 호출 함수
function showImagePopup(imgUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay dark';
    
    const box = document.createElement('div');
    box.className = 'popup-box img';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close-btn';
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = function() { document.body.removeChild(overlay); };
    
    const img = document.createElement('img');
    img.className = 'popup-img-content';
    img.src = imgUrl;
    
    box.appendChild(closeBtn);
    box.appendChild(img);
    overlay.appendChild(box);
    
    overlay.onclick = function(e) {
        if (e.target === overlay) document.body.removeChild(overlay);
    };
    
    document.body.appendChild(overlay);
}

function showDifficultyGuide() {
    showImagePopup('https://i.imgur.com/aXAiKUV.jpeg');
}

/* ===================== 화면 데이터 캐시: 먼저 보여주고 뒤에서 갱신 =====================
 * - 한 번 받은 목록을 브라우저(localStorage)에 저장해 두고, 다음에 열 때 즉시 표시합니다.
 * - 동시에 서버에서 최신 데이터를 받아 내용이 바뀌었을 때만 다시 그립니다.
 * - 같은 요청이 진행 중이면 새로 보내지 않고 기다립니다(미리 받기와 화면 열기가 겹쳐도 1번만 요청).
 * - 키는 사용자 ID별로 분리되며, 로그아웃 버튼을 누르면 모두 지웁니다.
 */
const SWR_PREFIX = 'k2c:';
const SWR_MAX_AGE = 7 * 24 * 3600 * 1000; // 7일 지난 저장본은 쓰지 않음
const SWR_INFLIGHT = {};

function _swrKey(key, scope) { return SWR_PREFIX + (scope || 'global') + ':' + key; }

function swrRead(key, scope) {
  try {
    const raw = localStorage.getItem(_swrKey(key, scope));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || Date.now() - o.t > SWR_MAX_AGE) return null;
    return o;
  } catch (e) { return null; }
}

function swrWrite(key, scope, value) {
  const k = _swrKey(key, scope);
  let str;
  try { str = JSON.stringify({ t: Date.now(), v: value }); } catch (e) { return; }
  try { localStorage.setItem(k, str); }
  catch (e) {
    // 저장 공간이 부족하면 이전 저장본을 비우고 한 번 더 시도
    swrClearAll();
    try { localStorage.setItem(k, str); } catch (e2) {}
  }
}

function swrInvalidate(key, scope) { try { localStorage.removeItem(_swrKey(key, scope)); } catch (e) {} }

function swrClearAll() {
  try {
    Object.keys(localStorage).filter(k => k.indexOf(SWR_PREFIX) === 0).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// 서버 호출 + 저장. 진행 중인 같은 요청은 공유합니다. 서버가 {error:...}를 돌려주면 저장하지 않습니다.
function swrFetch(key, scope, funcName, args) {
  const k = _swrKey(key, scope);
  if (SWR_INFLIGHT[k]) return SWR_INFLIGHT[k];
  const p = new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[funcName].apply(null, args || []);
  }).then(v => {
    delete SWR_INFLIGHT[k];
    if (!(v && typeof v === 'object' && !Array.isArray(v) && v.error)) swrWrite(key, scope, v);
    return v;
  }, err => { delete SWR_INFLIGHT[k]; throw err; });
  SWR_INFLIGHT[k] = p;
  return p;
}

/**
 * opts: { key, scope, func, args, onData(data, {fromCache}), onError(err, {hadCache}), guard() }
 * - 저장본이 있으면 onData를 즉시(동기) 호출하고, 서버 응답이 다를 때 한 번 더 호출합니다.
 * - guard()가 false면(예: 그 사이 로그아웃/학생 변경) 화면을 건드리지 않습니다.
 */
function swrLoad(opts) {
  const guard = opts.guard || (() => true);
  const cached = swrRead(opts.key, opts.scope);
  let shownStr = null;
  if (cached) {
    shownStr = JSON.stringify(cached.v);
    try { opts.onData(cached.v, { fromCache: true, savedAt: cached.t }); } catch (e) { console.error(e); }
  }
  return swrFetch(opts.key, opts.scope, opts.func, opts.args).then(v => {
    if (!guard()) return v;
    if (JSON.stringify(v) !== shownStr) opts.onData(v, { fromCache: false });
    return v;
  }).catch(err => {
    if (!guard()) return;
    if (opts.onError) opts.onError(err, { hadCache: shownStr !== null });
    else if (shownStr !== null) showToast('최신 정보를 불러오지 못해 저장된 내용을 표시합니다.', 'error');
    else showCustomAlert('불러오기 오류: ' + err);
  });
}

// 화면에 그리지 않고 미리 받아 저장만 합니다(실패는 무시).
function swrPrefetch(key, scope, func, args) {
  if (!hasGsRun()) return Promise.resolve(null);
  return swrFetch(key, scope, func, args).catch(() => null);
}

// 표/목록 자리에 넣는 작은 로딩 표시 (화면 전체를 막지 않음)
function inlineLoadingHTML(text, colspan) {
  const inner = `<div style="padding:24px; text-align:center; color:#6b7280; font-size:14px;">⏳ ${text || '불러오는 중...'}</div>`;
  return colspan ? `<tr><td colspan="${colspan}">${inner}</td></tr>` : inner;
}

// google.script.run을 Promise로 감싼 호출
function gsCall(funcName, args) {
  return new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[funcName].apply(null, args || []);
  });
}
// 서버를 아직 새 버전으로 배포하지 않아 새 함수가 없을 때
function isMissingServerFunction(err) {
  const m = String(err && err.message ? err.message : err);
  return m.indexOf('허용되지 않은 함수') !== -1 || m.indexOf('존재하지 않는 함수') !== -1;
}


/* ==========================================================================
 * 과제 QR: 과제지에 찍어 두면 학생이 휴대폰으로 찍어 그 과제의 OMR로 바로 갑니다.
 *  - 주소: 사이트주소#omr=<문항목록 열쇠>.<만료일 YYMMDD>
 *  - 같은 문항 목록으로 여러 학생에게 낸 과제(일괄 출제)도 QR 하나로 각자 자기 과제를 엽니다.
 *  - 출력한 날부터 QR_VALID_DAYS일이 지나면 첫 화면으로 보냅니다.
 * ========================================================================== */
const QR_VALID_DAYS = 7;
function qrAssignKey(qids) {
  let list = qids;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = []; } }
  const s = (Array.isArray(list) ? list : []).map(String).join('|');
  let h = 0x811c9dc5;                                   // FNV-1a 32비트
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function _qrYmd(d) { return String(d.getFullYear() % 100).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function qrAssignExpiry(from) { const d = new Date(from || Date.now()); d.setDate(d.getDate() + QR_VALID_DAYS); return d; }
function qrAssignUrl(qids, from) {
  return window.location.origin + window.location.pathname + '#omr=' + qrAssignKey(qids) + '.' + _qrYmd(qrAssignExpiry(from));
}
// "#omr=abc123.261120" → { key, exp, expired }
function parseQrHash(hash) {
  const m = String(hash || '').replace(/^#/, '').match(/^omr=([0-9a-z]{1,13})\.(\d{6})$/);
  if (!m) return null;
  return { key: m[1], exp: m[2], expired: _qrYmd(new Date()) > m[2] };
}
