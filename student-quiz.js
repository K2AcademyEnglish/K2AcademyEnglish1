/* ===================== QBank: 칩 ===================== */
/* [신규] 탭 전환 함수 */
function switchGradeTab(gradeId) {
    document.querySelectorAll('#selectPage .grade-tab').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick').includes(gradeId));
    });
    document.querySelectorAll('#selectPage .grade-panel').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById('gp_' + gradeId).classList.add('active');
}


/* ===================== QBank: 문제 요청 ===================== */
function startQuizWithOptions(){
  if(!CURRENT_USER) return routeTo('quiz');
  if(!hasGsRun()){ showCustomAlert('서버 연결에 문제가 있습니다.'); return; }

  // 학년 버튼(여러 개) → 학년 전체 범위. 난이도·유형은 고른 것만 (안 고르면 전체)
  if (!SF.grades.size) { showCustomAlert('학년을 하나 이상 골라 주십시오.'); return; }
  const composites = Array.from(SF.grades).map(g => ({ grade: g, years: [], months: [], details: [] }));
  const filters = {
    composite: composites,
    types: Array.from(SF.types),
    difficulties: Array.from(SF.diffs),
    username: CURRENT_USER
  };
  CURRENT_FILTERS = filters;

  const isExcludeSolved = document.getElementById('excludeSolved') ? document.getElementById('excludeSolved').checked : false;
  const val = parseInt((document.getElementById('countInput').value || '').trim(), 10);
  const requestCount = (Number.isFinite(val) && val > 0) ? val : 5;
  const options = { max: 100, excludeSolved: isExcludeSolved };

  const loadingEl = document.getElementById('loadingOverlay');
  if(loadingEl) loadingEl.classList.add('active');

  google.script.run
    .withSuccessHandler(qs => {
      if(loadingEl) loadingEl.classList.remove('active');
      if(Array.isArray(qs)) qs = qs.filter(q => q && q.question && String(q.question).trim() !== '');
      if(!qs || !qs.length){ 
        showCustomAlert('조건에 맞는 문항이 없습니다.\n(선택한 범위에 해당 유형의 문제가 부족할 수 있습니다.)'); 
        return; 
      }
      renderQuestions(qs);
    })
    .withFailureHandler(err => {
      if(loadingEl) loadingEl.classList.remove('active');
      showCustomAlert('문항을 불러오는 중 오류가 발생했습니다: ' + err);
    })
    .getQuestionsByFilter(filters, requestCount, options);
}

/* ===================== QBank: 렌더/채점/로그 ===================== */
function renderQuestions(qs){
  // 질문이 비어 있는 문항(유령 문제)은 제외
  if(Array.isArray(qs)) {
      qs = qs.filter(q => q && q.question && String(q.question).trim() !== '');
  }
  CURRENT_QUIZ_DATA = qs;
  showPanel('quizPage');
  setTopTab('quiz');

  // OMR 버튼이 남아 있다면 숨기고, 이전/다음 버튼 복구
  const omrBtn = document.getElementById('btnSubmitOMR');
  if(omrBtn) omrBtn.style.display = 'none';
  const navGroup = document.querySelector('.footer-bar .nav-btn-group');
  if(navGroup) navGroup.style.display = 'flex';

  const quizPage = document.getElementById('quizPage');
  quizPage.removeAttribute('data-assign-id');
  quizPage.classList.remove('wk-omr');
  quizPage.innerHTML = '';

  // 지문 세트(groupHash)별로 묶기
  const groups = new Map();
  qs.forEach((q, idxGlobal)=>{
    const key = q.groupHash ? q.groupHash : (q.qid || 'Q_' + idxGlobal);
    if(!groups.has(key)){
      groups.set(key, { passage: [q.box1,q.box2,q.box3,q.box4], meta: {grade:q.grade, year:q.year, month:q.month}, items: [] });
    }
    groups.get(key).items.push({ q, idxGlobal });
  });

  const symbols = ['①','②','③','④','⑤'];
  const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
  // 질문 문장 정리: 앞 번호("28.")는 떼어 번호로 쓰고, <보기> 상자는 따로 분리
  const splitStem = (q, fallbackNum) => {
    let stem = sanitizeInlineHTML(q.question || '').trim();
    let num = fallbackNum;
    const m = toOneLine(stem).match(/^(\d+)[\.．]/);
    if (m) num = m[1];
    stem = stem.replace(/^\s*\d+[\.．]\s*/, '');
    let box = '';
    const bm = stem.match(boxRegex);
    if (bm) { box = bm[0]; stem = stem.replace(boxRegex, ''); }
    return { num, stem: toOneLine(stem).trim(), box };
  };

  let runningIndex = 0;
  let slideIndex = 0;
  const fragment = document.createDocumentFragment();

  groups.forEach(({ passage, meta, items })=>{
    const slide = document.createElement('div');
    slide.className = 'q-slide qz-slide';
    slide.setAttribute('data-s-idx', slideIndex++);

    const isSingle = (items.length === 1);
    const passages = (passage || []).map(raw => sanitizeInlineHTML(raw || ''))
        .filter(h => h.replace(/<br\s*\/?>/gi, '').trim() !== '');

    // 번호 미리 계산
    const parts = items.map(({ q }) => { runningIndex += 1; return splitStem(q, runningIndex); });

    // ── 왼쪽: 글자 크기 · 출처 · (한 문항이면) 질문 · 지문
    const box = document.createElement('div');
    box.className = 'online-box qz-box';
    const left = document.createElement('div');
    left.className = 'op-left';
    const srcText = [meta.grade || '', meta.year || '', meta.month || ''].filter(Boolean).join(' ');
    let leftHtml = '<div class="op-font-bar">' +
        (srcText ? `<span class="qz-src">${escapeHTML(srcText)}</span>` : '') +
        '<span class="op-font-title">글자 크기</span>' +
        '<button type="button" class="op-font-btn" data-font="-" aria-label="글자 작게">A−</button>' +
        '<span class="op-font-size">15</span>' +
        '<button type="button" class="op-font-btn" data-font="+" aria-label="글자 크게">A+</button>' +
        '<button type="button" class="op-font-btn op-font-reset" data-font="auto">기본</button>' +
        '</div>';
    if (isSingle) {
      const p = parts[0];
      leftHtml += `<div class="op-question"><span class="qz-num">${escapeHTML(String(p.num))}.</span> ${p.stem}</div>` +
                  (p.box ? `<div class="op-box">${p.box}</div>` : '');
    } else {
      const range = parts[0].num + '~' + parts[parts.length - 1].num;
      leftHtml += `<div class="op-question">[${escapeHTML(range)}] 다음 글을 읽고 물음에 답하시오.</div>`;
    }
    if (passages.length) {
      leftHtml += `<div class="passage-wrap op-passage">${passages.map(h => `<p class="passage-p">${h}</p>`).join('')}</div>`;
    }
    left.innerHTML = leftHtml;
    box.appendChild(left);

    // ── 오른쪽: 문항별 번호 · (세트면) 질문 · 선택지 · 결과 · 해설
    const right = document.createElement('div');
    right.className = 'op-right';

    items.forEach(({ q, idxGlobal }, k)=>{
        const p = parts[k];
        const card = document.createElement('div');
        card.className = 'question-card qz-card';
        card.setAttribute('data-idx', String(idxGlobal));
        card.setAttribute('data-q-num', p.num);

        const headerFlex = document.createElement('div');
        headerFlex.className = 'q-header-flex';
        const title = document.createElement('h3');
        title.className = 'question-title';
        title.innerHTML = `<span class="qz-num">${escapeHTML(String(p.num))}번</span>` + (isSingle ? '' : ' ' + p.stem);
        headerFlex.appendChild(title);

        const btnExp = document.createElement('button');
        btnExp.className = 'btn-exp';
        btnExp.type = 'button';
        btnExp.textContent = '해설';
        btnExp.style.display = 'none'; // 채점 후 노출
        btnExp.setAttribute('data-exp-btn', idxGlobal);
        btnExp.onclick = function() { toggleExplanation(this, idxGlobal); };
        headerFlex.appendChild(btnExp);
        card.appendChild(headerFlex);

        if (!isSingle && p.box) {
            const b = document.createElement('div');
            b.className = 'op-box';
            b.innerHTML = p.box;
            card.appendChild(b);
        }

        const nameGroup = 'q_'+idxGlobal;
        const isDescriptive = String(q.type || '').includes('서술형');

        if (isDescriptive) {
            const answers = String(q.answer || '').split('||').map(s => s.trim());
            const descContainer = document.createElement('div');
            descContainer.className = 'desc-input-group';
            const labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];
            answers.forEach((_, i) => {
                const row = document.createElement('div');
                row.className = 'qz-desc-row';
                if (answers.length > 1) {
                    const lbl = document.createElement('span');
                    lbl.className = 'qz-desc-label';
                    lbl.textContent = labels[i] || `(${i+1})`;
                    row.appendChild(lbl);
                }
                const input = document.createElement('input');
                input.type = 'text';
                input.name = nameGroup + '_' + i;
                input.className = 'desc-input';
                input.placeholder = '정답을 입력하십시오';
                input.autocomplete = 'off';
                row.appendChild(input);
                descContainer.appendChild(row);
            });
            card.appendChild(descContainer);
        } else {
            let opts = q.options || [];
            if (opts.length === 0) opts = ['', '', '', '', ''];
            const wrap = document.createElement('div');
            wrap.className = 'qz-opts';
            opts.forEach((opt, i)=>{
                // 채점 코드가 그대로 읽을 수 있도록 label.option + radio(name=q_번호) 구조 유지
                const label = document.createElement('label');
                label.className = 'option op-opt';
                label.innerHTML = `<input type="radio" name="${nameGroup}" value="${i+1}">` +
                    `<span class="op-sym">${symbols[i] || ''}</span>` +
                    `<span class="op-opt-text">${sanitizeInlineHTML(opt || '')}</span>`;
                wrap.appendChild(label);
            });
            card.appendChild(wrap);
        }

        const resultBar = document.createElement('div');
        resultBar.className = 'result-bar';
        resultBar.style.display = 'none';
        card.appendChild(resultBar);

        const expBox = document.createElement('div');
        expBox.className = 'explanation-box';
        expBox.innerHTML = '<b style="color:#2b6cb0;">[해설]</b><br>' + sanitizeInlineHTML(q.explanation || '해설 정보가 등록되지 않았습니다.');
        card.appendChild(expBox);
        right.appendChild(card);
    });

    box.appendChild(right);
    slide.appendChild(box);
    _bindQuizPaper(slide, box);
    fragment.appendChild(slide);
  });

  quizPage.appendChild(fragment);

  CURRENT_SLIDE_IDX = 0;
  updateSlideView();
  renderQuestionMap();
  showFooter();
  const btnMap = document.getElementById('btnShowMap');
  if(btnMap) btnMap.style.display = 'inline-flex';
  const btnVocab = document.getElementById('btnOpenVocab');
  if(btnVocab) btnVocab.style.display = 'inline-flex';
}

// 온라인 문제 화면: 글자 크기 버튼 · 이미지 로드 후 화면 맞춤
function _bindQuizPaper(slide, box) {
  box.addEventListener('click', e => {
    const fontBtn = e.target.closest('[data-font]');
    if (fontBtn) changeOnlineFont(null, box, fontBtn.dataset.font);
  });
  box.querySelectorAll('.op-left img').forEach(img => img.addEventListener('load', () => {
    if (slide.classList.contains('active-slide')) fitOnlineViewToScreen(null, box, false);
  }));
}
function _fitActiveQuizSlide() {
  const slide = document.querySelector('#quizPage .qz-slide.active-slide');
  const box = slide && slide.querySelector('.qz-box');
  if (box) fitOnlineViewToScreen(null, box, false);
}
window.addEventListener('resize', () => {
  clearTimeout(window._qzFitTimer);
  window._qzFitTimer = setTimeout(_fitActiveQuizSlide, 200);
});

function gradeAll(onSuccessCallback, forceCompleteStatus){
  const cards = document.querySelectorAll('.question-card[data-idx]');
  if(!cards.length){ return; }

  const collectedAnswers = [];
  
  // 문항 수 카운트
  let totalCnt = 0;
  let answeredCnt = 0;
  let totalCorrectCnt = 0; // 총 정답 수 추적
  
  cards.forEach(card => {
      totalCnt++;
      const idx = parseInt(card.getAttribute('data-idx'), 10);
      const q = CURRENT_QUIZ_DATA[idx];
      if(!q) return;

      // 1. 서술형인지 객관식인지 확인
      const isDescriptive = String(q.type || '').includes('서술형');
      const correct = String(q.answer || '').trim();

      let selected = '';
      let isCorrect = null;
      let hasAnswered = false;

      // 2. 문항 유형별로 답안을 가져오는 로직
      if (isDescriptive) {
          const answers = correct.split('||').map(s => s.trim());
          const ansCount = answers.length;
          const userInputs = [];
          let allCorrect = true;
          let anyAnswered = false;

          for(let i=0; i<ansCount; i++) {
              // 서술형 입력창 찾기
              let inp = card.querySelector(`input[name="q_${idx}_${i}"]`);
              if(!inp) inp = card.querySelector(`input[name="omr_${idx}_${i}"]`);
              
              const rawVal = inp ? inp.value : '';
              if (rawVal.trim() !== '') anyAnswered = true;
              userInputs.push(rawVal);
          }
          
          if (anyAnswered) {
              hasAnswered = true;
              for(let i=0; i<ansCount; i++) {
                  // 학생 입력값 정리
                  const cleanInput = userInputs[i].toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,?!]/g, '');
                  // 정답 템플릿
                  const templates = answers[i].split(/\s*\/\s*(?![^\[]*\])/);
                  
                  // 정답 여부 판별
                  const isPartCorrect = templates.some(template => compareWithBrackets(cleanInput, template));
                  if (!isPartCorrect) allCorrect = false;
                  
                  // UI 업데이트 (색상 처리)
                  let inp = card.querySelector(`input[name="q_${idx}_${i}"]`);
                  if(!inp) inp = card.querySelector(`input[name="omr_${idx}_${i}"]`);
                  if (inp) {
                      inp.disabled = true;
                      inp.style.backgroundColor = isPartCorrect ? '#d1fae5' : '#fee2e2';
                      inp.style.borderColor = isPartCorrect ? '#10b981' : '#ef4444';
                      inp.style.color = isPartCorrect ? '#065f46' : '#991b1b';
                  }
              }
              isCorrect = allCorrect;
              selected = userInputs.join('||');
          }
      } else {
          // 객관식 로직
          const nameGroupQ = 'q_'+idx;
          const nameGroupOMR = 'omr_'+idx;
          let checked = card.querySelector('input[name="'+nameGroupQ+'"]:checked');
          if(!checked) checked = card.querySelector('input[name="'+nameGroupOMR+'"]:checked');

          selected = checked ? checked.value : ''; 
          if (selected) {
              hasAnswered = true;
              isCorrect = (selected === correct);
          }
      }

      if(hasAnswered) answeredCnt++;

    // 미입력(빈칸) 문항은 이전 시도의 오답 표식이 남아있지 않도록 초기화 (스크롤 타겟에서 제외)
      if (!hasAnswered && card.getAttribute('data-already-correct') !== 'true') {
          card.removeAttribute('data-currently-wrong');
      }

      // 3. 결과 표시 UI 분기 (OMR 모드 vs 일반 모드) - 이미 맞은 문제는 UI 재렌더링 생략
      if (hasAnswered && card.getAttribute('data-already-correct') !== 'true') {
          const isOMR = card.classList.contains('omr-card');
          const isRetrying = card.getAttribute('data-retrying') === 'true';
          const btnExp = card.querySelector('button[data-exp-btn]');
          if (btnExp) btnExp.style.display = 'inline-block';

          if (isOMR) {
              // [OMR 모드 전용 UI 및 잠금]
              const title = card.querySelector('.question-title');
              let numText = title.innerText.split('번')[0] + '번';
              
              title.classList.remove('wrong', 'corrected', 'correct');
              let titleColor = "#059669"; 
              let statusTxt = " (정답 ✓)";

              if (!isCorrect) {
                  title.classList.add('wrong');
                  titleColor = "#dc2626"; 
                  statusTxt = " (오답 ✖)";
                  card.setAttribute('data-currently-wrong', 'true');
              } else if (isRetrying) {
                  title.classList.add('corrected');
                  titleColor = "#d97706"; 
                  statusTxt = " (정답 ▲)";
                  card.removeAttribute('data-currently-wrong');
                  card.removeAttribute('data-retrying');
              } else {
                  title.classList.add('correct');
                  card.removeAttribute('data-currently-wrong');
                  card.removeAttribute('data-retrying');
              }
              
              title.innerHTML = `<span style="font-size:18px; font-weight:bold; color:${titleColor};">${numText}${statusTxt}</span>`;

              const optWrap = card.querySelector('.omr-options-wrap');
              if (optWrap) optWrap.style.pointerEvents = 'none';
              
              const descWrap = card.querySelector('.desc-input-group');
              if (descWrap) descWrap.style.pointerEvents = 'none';

              const descInputs = card.querySelectorAll('.desc-input');
              descInputs.forEach(inp => {
                  inp.disabled = true;
                  if (isCorrect) {
                      inp.style.backgroundColor = isRetrying ? '#fef3c7' : '#d1fae5';
                      inp.style.color = isRetrying ? '#92400e' : '#065f46';
                  } else {
                      inp.style.backgroundColor = '#fee2e2';
                      inp.style.color = '#991b1b';
                  }
              });

              if (!isDescriptive) {
                  const omrLabels = card.querySelectorAll('.omr-opt-label');
                  omrLabels.forEach((label) => {
                      const inp = label.querySelector('input');
                      if (inp) inp.disabled = true;
                      label.classList.add('disabled');
                      
                      if (inp && inp.value === selected) {
                          if (isCorrect) label.classList.add(isRetrying ? 'corrected' : 'correct');
                          else label.classList.add('wrong');
                      } else {
                          label.classList.add('dimmed');
                      }
                  });
              }
          } else {
              // [일반 온라인 풀기 모드 기존 UI]
              const title = card.querySelector('.question-title');
              const resultBar = card.querySelector('.result-bar');
              if (title) title.classList.toggle('wrong', !isCorrect);
              if (resultBar) {
                  resultBar.style.display = 'block';
                  resultBar.textContent = isCorrect ? '정답' : '오답';
                  resultBar.style.color = isCorrect ? '#059669' : '#b91c1c';
              }
              if (!isDescriptive) {
                  const optionLabels = card.querySelectorAll('.option');
                  optionLabels.forEach((lab, i)=>{
                      const val = String(i+1);
                      const inp = lab.querySelector('input');
                      if(inp) inp.disabled = true; 
                      if(val === selected){
                          lab.style.background = isCorrect ? '#d1fae5' : '#fee2e2';
                          lab.style.borderColor = isCorrect ? '#10b981' : '#ef4444';
                          lab.style.color = isCorrect ? '#065f46' : '#991b1b';
                      } else {
                          lab.style.opacity = 0.5;
                      }
                  });
              }
          }
      }

      // 정답 개수 추적 및 처리
      if (card.getAttribute('data-already-correct') === 'true') {
          totalCorrectCnt++;
          return; 
      } else if (isCorrect === true) {
          totalCorrectCnt++;
      }

      if (!selected || selected.trim() === '') {
          return; 
      }

      collectedAnswers.push({
        qid: q.qid||'',
        extId: q.extId||'',
        source: q.source||'',
        type: q.type||'',
        grade: q.grade||'',
        year: q.year||'',
        month: q.month||'',
        question: toOneLine(q.question||''),
        correctAnswer: correct,
        selected: selected,
        isCorrect: isCorrect
      });
      
      // 이번에 맞힌 문제(처음 맞힌 문제 및 틀렸다가 고쳐서 맞힌 문제)는 정답 확정 처리하여 다음 스크롤 타겟에서 제외
      if (isCorrect === true) {
          card.setAttribute('data-already-correct', 'true');
          card.removeAttribute('data-currently-wrong');
          card.removeAttribute('data-retrying');
      }
      card.setAttribute('data-graded','1');
  }); // <-- forEach 루프 종료

  if(hasGsRun() && CURRENT_USER){
      const pageAssignId = document.getElementById('quizPage').getAttribute('data-assign-id');
      const activeSessionId = pageAssignId || CURRENT_ASSIGNMENT_ID || CURRENT_SESSION || undefined;
      
      // 완료 여부 결정 로직
      let isCompleteFinal = false;
      if (typeof forceCompleteStatus === 'boolean') {
          isCompleteFinal = forceCompleteStatus;
      } else {
          isCompleteFinal = (totalCorrectCnt === totalCnt && totalCnt > 0);
      }

      const payload = {
        user: { id: CURRENT_USER.id, name: CURRENT_USER.name },
        sessionId: activeSessionId, 
        filters: CURRENT_FILTERS || undefined,
        answers: collectedAnswers,
        isComplete: isCompleteFinal,
        attemptId: newAttemptId()
      };

      // [OMR 과제] 채점은 이미 화면에서 끝났으므로 서버 응답을 기다리지 않고 바로 다음 단계로 진행합니다.
      if (onSuccessCallback && typeof onSuccessCallback === 'function') {
          enqueueAttempt(payload);
          onSuccessCallback({ ok: true, queued: true, sessionId: activeSessionId });
          return;
      }

      const isClickEvent = (onSuccessCallback && typeof onSuccessCallback === 'object' && onSuccessCallback.type === 'click');

      const loadEl = document.getElementById('loadingOverlay');
      if (isClickEvent && loadEl) {
          loadEl.querySelector('.loading-text').innerHTML = '채점 및 결과를 서버에 저장 중입니다...';
          loadEl.classList.add('active');
      }

      google.script.run
        .withSuccessHandler(function(res){
          if (isClickEvent && loadEl) loadEl.classList.remove('active');
          if (!res || res.ok !== true) {
              const btn = document.getElementById('btnSubmitOMR');
              if (btn) { btn.disabled = false; btn.textContent = '다시 제출'; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
              showCustomAlert('답안 저장 실패: ' + (res && res.msg || '서버 응답을 확인하십시오.'));
              return;
          }

          if(onSuccessCallback && typeof onSuccessCallback === 'function') {
              onSuccessCallback(res); 
          } 
          else if (isClickEvent) {
              if (activeSessionId) {
                  if (isCompleteFinal) {
                      showCustomAlert('100% 정답입니다!\n과제가 최종 완료 처리되었습니다.');
                      routeTo('assignment');
                  } else {
                      showCustomAlert('채점이 반영되었습니다.\n(오답이 남아있어 미완료 상태로 유지됩니다.)');
                  }
              } else {
                  showCustomAlert('채점이 완료되었습니다.\n오답노트에서 틀린 문제를 다시 풀어보십시오.');
              }
          }
        })
        .withFailureHandler(function(err){
          if (isClickEvent && loadEl) loadEl.classList.remove('active');
          showCustomAlert('오류: 채점 결과 저장 실패!\n' + err);
        })
        .logAttempt(payload);
  } else if (!CURRENT_USER) {
      showCustomAlert('로그인 상태가 아닙니다.');
  }
}

/* ===================== 오답노트 =====================
 * 서버(getWrongNote)는 문항별 '과제(세션)별 첫 시도' 기록만 보내고,
 * 기간·유형·난이도 정답률과 목록 필터는 여기서 계산합니다.
 *  - 틀린 횟수: 과제마다 한 번 (그 과제의 첫 시도가 오답이면 1)
 *  - 상태: 어디서 풀었든 가장 마지막 시도가 정답이면 '고침'
 */
let WRONG_STATS = [];            // 서버에서 받은 문항 목록 (v2 형식으로 맞춘 것)
let WRONG_SELECTED = new Set();  // 선택한 문항 QID
let WN_HAS_RATES = true;         // 옛 GS(getWrongStats)면 정답률 계산 불가
const WN = {
  period: 0,                     // 0 = 전체, 7, 30 (일)
  status: 'open',                // open(남은 오답) | fixed(고친 문제) | all
  types: new Set(), diffs: new Set(), grades: new Set(),
  q: '',
  sort: { key: 'wrong', dir: -1 },
  randomN: 10
};

function loadWrongStats(){ return runAfterAttemptsSaved(_loadWrongStatsNow); }
function _loadWrongStatsNow(){
  if(!CURRENT_USER) return;
  if(!hasGsRun()){ showCustomAlert('서버 연결 문제'); return; }
  const user = CURRENT_USER;
  const wrap = document.getElementById('wrongStatsWrap');

  let shown = false;
  const apply = (data, hasRates) => {
    shown = true;
    WN_HAS_RATES = hasRates;
    WRONG_STATS = data;
    const ids = new Set(data.map(x => x.qid));
    Array.from(WRONG_SELECTED).forEach(q => { if (!ids.has(q)) WRONG_SELECTED.delete(q); });
    renderWrongNote();
  };
  swrLoad({
    key: 'wrongNote', scope: user.id, func: 'getWrongNote', args: [user],
    guard: () => CURRENT_USER === user,
    onData: res => apply((res && Array.isArray(res.items)) ? res.items : [], true),
    onError: (err, info) => {
      if (isMissingServerFunction(err)) {
        // GS가 아직 옛 버전: 기존 오답 목록으로 표시 (정답률 없음)
        gsCall('getWrongStats', [user, null]).then(stats => {
          if (CURRENT_USER !== user) return;
          apply(_wnFromOld(stats), false);
        }).catch(e2 => { if (wrap) wrap.innerHTML = `<div class="wn-error">오류: ${escapeHTML(String(e2))}</div>`; });
        return;
      }
      if (info.hadCache) showToast('최신 오답 기록을 불러오지 못했습니다. 저장된 목록을 표시합니다.', 'error');
      else if (wrap) wrap.innerHTML = `<div class="wn-error">오류: ${escapeHTML(String(err))}</div>`;
    }
  });
  if (!shown && wrap) wrap.innerHTML = inlineLoadingHTML('오답 데이터를 가져오는 중...');
}

// 옛 getWrongStats 결과 → v2 모양
function _wnFromOld(stats) {
  return (Array.isArray(stats) ? stats : []).map(it => {
    const t = Math.floor(new Date(String(it.lastTs || '').replace(' ', 'T')).getTime() / 1000) || 0;
    return {
      qid: it.qid, grade: it.grade || '', year: String(it.year || ''), month: it.month || '', detail: '',
      type: it.type || '', number: it.number || '', difficulty: '',
      last: t, lastCorrect: it.fixed ? 1 : 0, a: null, oldWrong: Number(it.wrongCount || 0)
    };
  });
}

function _wnNum(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 9999 : n; }
const WN_GRADE_ORDER = { '중1': 1, '중2': 2, '중3': 3, '고1': 4, '고2': 5, '고3': 6 };
function _wnSrcCmp(a, b) {
  const ka = [WN_GRADE_ORDER[a.grade] || 9, _wnNum(a.year), _wnNum(a.month), String(a.month), _wnNum(a.number)];
  const kb = [WN_GRADE_ORDER[b.grade] || 9, _wnNum(b.year), _wnNum(b.month), String(b.month), _wnNum(b.number)];
  for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
  return 0;
}
function _wnDate(sec) {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _wnRateCls(rate, total) { if (total < 3) return 'few'; return rate <= 40 ? 'low' : rate <= 70 ? 'mid' : 'high'; }

// 기간 안 기록으로 문항별 값 계산
function _wnDerive() {
  const minSec = WN.period ? Math.floor(Date.now() / 1000) - WN.period * 86400 : 0;
  const rows = [];
  let total = 0, correct = 0;
  const byType = {}, byDiff = {};
  WRONG_STATS.forEach(it => {
    let wrong, tried, ok;
    if (it.a) {
      const pa = it.a.filter(x => x[0] >= minSec);
      tried = pa.length;
      ok = pa.filter(x => x[1] === 1).length;
      wrong = tried - ok;
    } else {
      // 옛 형식: 시도 기록 없음
      tried = 0; ok = 0;
      wrong = (!minSec || it.last >= minSec) ? it.oldWrong : 0;
    }
    if (tried) {
      total += tried; correct += ok;
      const t = it.type || '기타';
      const bt = byType[t] || (byType[t] = { total: 0, correct: 0, open: 0 });
      bt.total += tried; bt.correct += ok;
      const d = parseInt(it.difficulty, 10);
      if (!isNaN(d)) {
        const bd = byDiff[d] || (byDiff[d] = { total: 0, correct: 0, open: 0 });
        bd.total += tried; bd.correct += ok;
      }
    }
    // 첫 시도는 맞혔지만 나중에 틀려 '마지막이 오답'인 경우도 목록에 남김
    const lastWrongInPeriod = !it.lastCorrect && (!minSec || it.last >= minSec);
    if (wrong > 0 || lastWrongInPeriod) {
      const r = Object.assign({}, it, { wrong: Math.max(wrong, 1), fixed: !!it.lastCorrect });
      rows.push(r);
      if (!r.fixed) {
        const t = it.type || '기타';
        (byType[t] || (byType[t] = { total: 0, correct: 0, open: 0 })).open++;
        const d = parseInt(it.difficulty, 10);
        if (!isNaN(d)) (byDiff[d] || (byDiff[d] = { total: 0, correct: 0, open: 0 })).open++;
      }
    }
  });
  return { rows, total, correct, byType, byDiff };
}

function renderWrongNote() {
  const wrap = document.getElementById('wrongStatsWrap');
  if (!wrap) return;
  if (!WRONG_STATS.length) {
    wrap.innerHTML = '<div class="wn-empty-all">아직 푼 기록이 없습니다. 문제를 풀면 틀린 문항이 여기에 모입니다.</div>';
    return;
  }
  if (!wrap.querySelector('#wnList')) {
    wrap.innerHTML = `
      <div class="wn-card wn-summary-card">
        <div class="wn-top">
          <div class="wn-period" id="wnPeriod">
            <button type="button" data-p="7">최근 7일</button>
            <button type="button" data-p="30">최근 30일</button>
            <button type="button" data-p="0">전체</button>
          </div>
          <div class="wn-summary" id="wnSummary"></div>
        </div>
        <div id="wnChips"></div>
      </div>
      <div class="wn-card wn-list-card">
        <div class="wn-filters">
          <div class="wn-status" id="wnStatus">
            <button type="button" data-s="open">남은 오답 <b id="wnCntOpen">0</b></button>
            <button type="button" data-s="fixed">고친 문제 <b id="wnCntFixed">0</b></button>
            <button type="button" data-s="all">전체 <b id="wnCntAll">0</b></button>
          </div>
          <div class="wn-grade-chips" id="wnGrades"></div>
          <input type="search" id="wnSearch" class="wn-search" placeholder="🔍 연도·월·번호 검색 (예: 2023 6월 22)" autocomplete="off">
          <select id="wnSortSel" class="wn-sort-sel" aria-label="정렬">
            <option value="wrong">많이 틀린 순</option>
            <option value="last">최근 푼 순</option>
            <option value="difficulty">어려운 순</option>
            <option value="source">출처 순</option>
            <option value="type">유형 순</option>
          </select>
          <button type="button" class="wn-ghost" id="wnReset">필터 초기화</button>
        </div>
        <div class="wn-active" id="wnActive"></div>
        <div class="wn-table-wrap">
          <table class="wn-table">
            <thead><tr>
              <th class="c-chk"><input type="checkbox" id="wnCheckAll" title="보이는 문항 모두 선택"></th>
              <th class="c-src" data-k="source">출처</th>
              <th class="c-num" data-k="number">번호</th>
              <th class="c-type" data-k="type">유형</th>
              <th class="c-diff" data-k="difficulty">난이도</th>
              <th class="c-wrong" data-k="wrong">틀린 횟수</th>
              <th class="c-last" data-k="last">최근 풀이</th>
              <th class="c-stat" data-k="status">상태</th>
            </tr></thead>
            <tbody id="wnList"></tbody>
          </table>
        </div>
        <div class="wn-bar">
          <span class="wn-sel">선택 <b id="wnSelCount">0</b>개</span>
          <span class="wn-rand"><input type="number" id="wnRandN" min="1" max="100" value="${WN.randomN}"><button type="button" class="wn-ghost" id="wnRandom">개 랜덤 고르기</button></span>
          <button type="button" class="wn-ghost" id="wnClear">선택 해제</button>
          <button type="button" class="wn-play" id="wnPlay">선택한 문제 풀기</button>
        </div>
      </div>`;
    _wnBind(wrap);
  }
  _wnRenderAll();
}

function _wnBind(wrap) {
  wrap.querySelector('#wnPeriod').addEventListener('click', e => {
    const b = e.target.closest('button[data-p]'); if (!b) return;
    WN.period = Number(b.dataset.p);
    _wnRenderAll();
  });
  wrap.querySelector('#wnStatus').addEventListener('click', e => {
    const b = e.target.closest('button[data-s]'); if (!b) return;
    WN.status = b.dataset.s;
    _wnRenderAll();
  });
  wrap.querySelector('#wnChips').addEventListener('click', e => {
    const b = e.target.closest('button.wn-chip'); if (!b) return;
    const set = b.dataset.kind === 'type' ? WN.types : WN.diffs;
    const v = b.dataset.val;
    if (set.has(v)) set.delete(v); else set.add(v);
    _wnRenderAll();
  });
  wrap.querySelector('#wnGrades').addEventListener('click', e => {
    const b = e.target.closest('button[data-g]'); if (!b) return;
    const g = b.dataset.g;
    if (WN.grades.has(g)) WN.grades.delete(g); else WN.grades.add(g);
    _wnRenderAll();
  });
  wrap.querySelector('#wnActive').addEventListener('click', e => {
    const b = e.target.closest('button[data-rm]'); if (!b) return;
    const [kind, v] = [b.dataset.rm, b.dataset.val];
    if (kind === 'type') WN.types.delete(v);
    if (kind === 'diff') WN.diffs.delete(v);
    if (kind === 'grade') WN.grades.delete(v);
    if (kind === 'q') { WN.q = ''; wrap.querySelector('#wnSearch').value = ''; }
    _wnRenderAll();
  });
  let t = null;
  wrap.querySelector('#wnSearch').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { WN.q = e.target.value.trim(); _wnRenderAll(); }, 200);
  });
  wrap.querySelector('#wnReset').addEventListener('click', () => {
    WN.types.clear(); WN.diffs.clear(); WN.grades.clear(); WN.q = '';
    wrap.querySelector('#wnSearch').value = '';
    _wnRenderAll();
  });
  wrap.querySelector('#wnSortSel').addEventListener('change', e => {
    const k = e.target.value;
    WN.sort = { key: k, dir: (k === 'wrong' || k === 'last' || k === 'difficulty') ? -1 : 1 };
    _wnRenderList();
  });
  wrap.querySelectorAll('.wn-table th[data-k]').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.k;
    if (WN.sort.key === k) WN.sort.dir *= -1;
    else WN.sort = { key: k, dir: (k === 'wrong' || k === 'last' || k === 'difficulty') ? -1 : 1 };
    _wnRenderList();
  }));

  const tbody = wrap.querySelector('#wnList');
  tbody.addEventListener('click', e => {
    const tr = e.target.closest('tr.wn-row'); if (!tr) return;
    const q = tr.dataset.qid;
    const on = e.target.classList.contains('wn-check') ? e.target.checked : !WRONG_SELECTED.has(q);
    if (on) WRONG_SELECTED.add(q); else WRONG_SELECTED.delete(q);
    tr.classList.toggle('selected', on);
    const cb = tr.querySelector('.wn-check'); if (cb) cb.checked = on;
    _wnUpdateSel();
  });
  wrap.querySelector('#wnCheckAll').addEventListener('change', e => {
    tbody.querySelectorAll('tr.wn-row').forEach(tr => {
      if (e.target.checked) WRONG_SELECTED.add(tr.dataset.qid); else WRONG_SELECTED.delete(tr.dataset.qid);
    });
    _wnRenderList();
  });
  wrap.querySelector('#wnClear').addEventListener('click', () => { WRONG_SELECTED.clear(); _wnRenderList(); });
  wrap.querySelector('#wnRandom').addEventListener('click', () => {
    const n = Math.max(1, Math.min(100, parseInt(wrap.querySelector('#wnRandN').value, 10) || 10));
    WN.randomN = n;
    const vis = _wnVisibleRows();
    if (!vis.length) { showToast('지금 보이는 문항이 없습니다.', 'error'); return; }
    // 남은 오답을 먼저, 많이 틀린 문항이 조금 더 잘 뽑히도록
    const pool = vis.map(r => ({ r, k: (r.fixed ? 1 : 0) + Math.random() / (1 + r.wrong) }));
    pool.sort((a, b) => a.k - b.k);
    WRONG_SELECTED.clear();
    pool.slice(0, n).forEach(x => WRONG_SELECTED.add(x.r.qid));
    _wnRenderList();
    showToast(`${Math.min(n, pool.length)}문항을 골랐습니다.`);
  });
  wrap.querySelector('#wnPlay').addEventListener('click', _wnPlay);
}

let WN_DERIVED = null;
function _wnRenderAll() {
  WN_DERIVED = _wnDerive();
  _wnRenderSummary();
  _wnRenderChips();
  _wnRenderFilters();
  _wnRenderList();
}

function _wnRenderSummary() {
  const d = WN_DERIVED;
  document.querySelectorAll('#wnPeriod button').forEach(b => b.classList.toggle('on', Number(b.dataset.p) === WN.period));
  const open = d.rows.filter(r => !r.fixed).length, fixed = d.rows.length - open;
  const label = WN.period ? `최근 ${WN.period}일` : '전체 기간';
  const rate = d.total ? Math.round(d.correct / d.total * 100) : null;
  document.getElementById('wnSummary').innerHTML = `
    <span class="wn-sum-label">${label}</span>
    ${WN_HAS_RATES ? `<span>푼 문항 <b>${d.total}</b></span><span>정답률 <b>${rate == null ? '-' : rate + '%'}</b></span>` : ''}
    <span class="wn-sum-open">남은 오답 <b>${open}</b></span>
    <span class="wn-sum-fixed">고친 문제 <b>${fixed}</b></span>`;
}

function _wnRenderChips() {
  const box = document.getElementById('wnChips');
  const d = WN_DERIVED;
  if (!WN_HAS_RATES) {
    box.innerHTML = '<div class="wn-note">GS를 새 버전으로 배포하면 유형·난이도별 정답률이 표시됩니다.</div>';
    return;
  }
  if (!d.total) {
    box.innerHTML = `<div class="wn-note">이 기간에 푼 기록이 없습니다.</div>`;
    return;
  }
  const chip = (kind, val, label, b) => {
    const rate = Math.round(b.correct / b.total * 100);
    const set = kind === 'type' ? WN.types : WN.diffs;
    return `<button type="button" class="wn-chip ${_wnRateCls(rate, b.total)}${set.has(String(val)) ? ' on' : ''}" data-kind="${kind}" data-val="${escapeHTML(String(val))}" title="${b.total}문항 중 ${b.correct}개 정답 · 남은 오답 ${b.open}개">
      <span class="wn-chip-name">${escapeHTML(label)}</span><b>${rate}%</b>${b.open ? `<em>남은 ${b.open}</em>` : ''}</button>`;
  };
  const types = Object.keys(d.byType).filter(t => d.byType[t].total > 0)
    .sort((a, b) => (d.byType[a].correct / d.byType[a].total) - (d.byType[b].correct / d.byType[b].total) || d.byType[b].total - d.byType[a].total)
    .map(t => chip('type', t, t, d.byType[t])).join('');
  const diffs = Object.keys(d.byDiff).map(Number).filter(x => d.byDiff[x].total > 0).sort((a, b) => a - b)
    .map(x => chip('diff', x, x + '단계', d.byDiff[x])).join('');
  box.innerHTML = `
    <div class="wn-chip-line"><span class="wn-chip-label">유형별</span><div class="wn-chip-row">${types}</div></div>
    <div class="wn-chip-line"><span class="wn-chip-label">난이도별</span><div class="wn-chip-row">${diffs || '<span class="wn-note">난이도 정보 없음</span>'}</div></div>
    <div class="wn-legend"><i class="low"></i>40% 이하 <i class="mid"></i>70% 이하 <i class="high"></i>그 이상 · 정답률 낮은 순 · 누르면 아래 목록이 걸러집니다</div>`;
}

function _wnRenderFilters() {
  const d = WN_DERIVED;
  document.querySelectorAll('#wnStatus button').forEach(b => b.classList.toggle('on', b.dataset.s === WN.status));
  const open = d.rows.filter(r => !r.fixed).length;
  document.getElementById('wnCntOpen').textContent = open;
  document.getElementById('wnCntFixed').textContent = d.rows.length - open;
  document.getElementById('wnCntAll').textContent = d.rows.length;
  const grades = [...new Set(d.rows.map(r => r.grade).filter(Boolean))].sort((a, b) => (WN_GRADE_ORDER[a] || 9) - (WN_GRADE_ORDER[b] || 9));
  document.getElementById('wnGrades').innerHTML = grades.length > 1
    ? grades.map(g => `<button type="button" data-g="${escapeHTML(g)}" class="${WN.grades.has(g) ? 'on' : ''}">${escapeHTML(g)}</button>`).join('') : '';
  const act = [];
  WN.types.forEach(v => act.push(['type', v, v]));
  WN.diffs.forEach(v => act.push(['diff', v, v + '단계']));
  WN.grades.forEach(v => act.push(['grade', v, v]));
  if (WN.q) act.push(['q', WN.q, '"' + WN.q + '"']);
  document.getElementById('wnActive').innerHTML = act.length
    ? '<span>적용 중:</span>' + act.map(([k, v, l]) => `<button type="button" data-rm="${k}" data-val="${escapeHTML(String(v))}">${escapeHTML(l)} ✕</button>`).join('') : '';
}

function _wnVisibleRows() {
  const qs = WN.q.toLowerCase().split(/\s+/).filter(Boolean);
  return WN_DERIVED.rows.filter(r => {
    if (WN.status === 'open' && r.fixed) return false;
    if (WN.status === 'fixed' && !r.fixed) return false;
    if (WN.types.size && !WN.types.has(r.type || '기타')) return false;
    if (WN.diffs.size && !WN.diffs.has(String(parseInt(r.difficulty, 10)))) return false;
    if (WN.grades.size && !WN.grades.has(r.grade)) return false;
    if (qs.length) {
      const hay = [r.grade, r.year, r.month, r.detail, r.number, r.type].join(' ').toLowerCase();
      if (!qs.every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

function _wnRenderList() {
  const tbody = document.getElementById('wnList');
  if (!tbody) return;
  const rows = _wnVisibleRows();
  const k = WN.sort.key, dir = WN.sort.dir;
  const val = r => k === 'number' ? _wnNum(r.number) : k === 'type' ? String(r.type || '') : k === 'difficulty' ? (parseInt(r.difficulty, 10) || 0)
    : k === 'wrong' ? r.wrong : k === 'last' ? r.last : k === 'status' ? (r.fixed ? 1 : 0) : 0;
  rows.sort((a, b) => {
    if (k !== 'source') {
      const va = val(a), vb = val(b);
      const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      if (c) return c * dir;
      if (k === 'wrong' && b.last !== a.last) return b.last - a.last;
    }
    return _wnSrcCmp(a, b) * (k === 'source' ? dir : 1);
  });
  const sortSel = document.getElementById('wnSortSel');
  if (sortSel && Array.from(sortSel.options).some(o => o.value === k)) sortSel.value = k;
  document.querySelectorAll('.wn-table th[data-k]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.k === k);
    th.dataset.dir = th.dataset.k === k ? (dir > 0 ? '▲' : '▼') : '';
  });

  if (!rows.length) {
    const msg = WN.status === 'open' && WN_DERIVED.rows.length
      ? '🎉 이 조건에서 남은 오답이 없습니다.' : '조건에 맞는 문항이 없습니다.';
    tbody.innerHTML = `<tr class="wn-msg"><td colspan="8">${msg}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      const sel = WRONG_SELECTED.has(r.qid);
      const src = [r.grade, r.year, r.month, r.detail].filter(Boolean).join(' ');
      return `<tr class="wn-row${sel ? ' selected' : ''}${r.fixed ? ' fixed' : ''}" data-qid="${escapeHTML(r.qid)}">
        <td class="c-chk"><input type="checkbox" class="wn-check"${sel ? ' checked' : ''}></td>
        <td class="c-src">${escapeHTML(src)}</td>
        <td class="c-num">${escapeHTML(String(r.number || ''))}</td>
        <td class="c-type">${escapeHTML(r.type || '-')}</td>
        <td class="c-diff">${r.difficulty ? `<span class="wn-diff">${escapeHTML(String(r.difficulty))}</span>` : '<span class="wn-dash">-</span>'}</td>
        <td class="c-wrong"><span class="wn-wrong">${r.wrong}회</span></td>
        <td class="c-last">${_wnDate(r.last)}</td>
        <td class="c-stat">${r.fixed ? '<span class="wn-st ok">고침</span>' : '<span class="wn-st open">남은 오답</span>'}</td>
      </tr>`;
    }).join('');
  }
  _wnUpdateSel();
}

function _wnUpdateSel() {
  const n = WRONG_SELECTED.size;
  const c = document.getElementById('wnSelCount'); if (c) c.textContent = n;
  const play = document.getElementById('wnPlay'); if (play) play.disabled = n === 0;
  const all = document.getElementById('wnCheckAll');
  if (all) {
    const vis = Array.from(document.querySelectorAll('#wnList tr.wn-row'));
    all.checked = vis.length > 0 && vis.every(tr => WRONG_SELECTED.has(tr.dataset.qid));
  }
}

function _wnPlay() {
  const pick = Array.from(WRONG_SELECTED);
  if (!pick.length) { showCustomAlert('선택한 문항이 없습니다. 목록에서 골라 주십시오.'); return; }
  if (!hasGsRun()) { showCustomAlert('서버 연결에 문제가 있습니다.'); return; }
  const go = () => {
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) loadingEl.classList.add('active');
    google.script.run
      .withSuccessHandler(qs => {
        if (loadingEl) loadingEl.classList.remove('active');
        if (Array.isArray(qs)) qs = qs.filter(q => q && q.question && String(q.question).trim() !== '');
        if (!qs || !qs.length) { showCustomAlert('선택한 문항을 불러오지 못했습니다.\n(삭제되었거나 내용이 없는 문제일 수 있습니다.)'); return; }
        WRONG_SELECTED.clear();
        renderQuestions(qs);
      })
      .withFailureHandler(err => {
        if (loadingEl) loadingEl.classList.remove('active');
        showCustomAlert('문항 불러오기 오류: ' + err);
      })
      .getQuestionsByQids(pick);
  };
  if (pick.length > 40) showCustomConfirm(`${pick.length}문항을 한 번에 풉니다. 계속하시겠습니까?`, go);
  else go();
}


function showSelectWarning(msg){
  const w = document.getElementById('selectWarning');
  if(!w) return;
  if(!msg){ w.style.display='none'; w.textContent=''; return; }
  w.style.display='block';
  w.textContent=msg;
}

function updateSlideView(){
  const slides = document.querySelectorAll('.q-slide');
  const total = slides.length;
  if(total === 0) return;

  // 1. 인덱스 범위 체크
  if(CURRENT_SLIDE_IDX < 0) CURRENT_SLIDE_IDX = 0;
  if(CURRENT_SLIDE_IDX >= total) CURRENT_SLIDE_IDX = total - 1;

  // 2. 현재 슬라이드만 보여주기
  slides.forEach((s, i) => {
    if(i === CURRENT_SLIDE_IDX) s.classList.add('active-slide');
    else s.classList.remove('active-slide');
  });

  // 3. 버튼 제어 로직 (핵심)
  const btnPrev = document.getElementById('btnPrevQ');
  const btnNext = document.getElementById('btnNextQ');
  const btnGrade = document.getElementById('btnGradeAll');

  // [이전] 버튼: 첫 문제에서는 비활성화(흐리게) 혹은 숨김
  if(btnPrev) {
      btnPrev.disabled = (CURRENT_SLIDE_IDX === 0);
      // 첫 페이지에서 아예 안 보이게 하려면 아래 주석 해제
      // btnPrev.style.visibility = (CURRENT_SLIDE_IDX === 0) ? 'hidden' : 'visible';
  }

  // [다음] vs [채점] 버튼 교체
  const isLast = (CURRENT_SLIDE_IDX === total - 1);
  
  if(isLast) {
      // 마지막 문제: '다음' 숨기고 '채점' 보이기
      if(btnNext) btnNext.style.display = 'none';
      if(btnGrade) btnGrade.style.display = 'block';
  } else {
      // 평소: '다음' 보이기, '채점' 숨기기
      if(btnNext) {
          btnNext.style.display = 'block';
          btnNext.textContent = '다음'; // 텍스트 초기화
      }
      if(btnGrade) btnGrade.style.display = 'none';
  }
  
  // 4. 기타 UI 갱신 (목록 하이라이트 등)
  updateMapHighlight();
  window.scrollTo(0, 0);
  _fitActiveQuizSlide(); // 온라인 문제: 휴대폰에서 지문이 한 화면에 들어오게 맞춤
}

// 이전/다음 버튼 동작
function prevSlide(){ CURRENT_SLIDE_IDX--; updateSlideView(); }
function nextSlide(){ CURRENT_SLIDE_IDX++; updateSlideView(); }

// 우측 목록(맵) 생성
function renderQuestionMap(){
  const grid = document.getElementById('qMapGrid');
  const slides = document.querySelectorAll('.q-slide');
  if(!grid) return;
  grid.innerHTML = '';

  slides.forEach((slide, idx)=>{
    // 슬라이드 안의 첫 번째 문제 번호를 가져옴
    const firstCard = slide.querySelector('.question-card');
    const qNum = firstCard ? firstCard.getAttribute('data-q-num') : (idx+1);

    const btn = document.createElement('div');
    btn.className = 'map-item';
    btn.textContent = qNum;
    btn.setAttribute('data-s-target', idx);
    
    btn.addEventListener('click', ()=>{
      CURRENT_SLIDE_IDX = idx;
      updateSlideView();
      closeQuestionMap(); // 이동 후 닫기
    });
    grid.appendChild(btn);
  });
}

// 현재 위치 맵에 표시
function updateMapHighlight(){
    const items = document.querySelectorAll('.map-item');
    items.forEach(it => {
        const target = parseInt(it.getAttribute('data-s-target'));
        if(target === CURRENT_SLIDE_IDX) it.classList.add('current');
        else it.classList.remove('current');
    });
}

// 목록 드로어 열기/닫기
function openQuestionMap(){
    const d = document.getElementById('questionMapDrawer');
    const o = document.getElementById('drawerOverlay');
    if(d) d.classList.add('open');
    if(o) o.style.display = 'block';
}
function closeQuestionMap(){
    const d = document.getElementById('questionMapDrawer');
    const o = document.getElementById('drawerOverlay'); // 단어장이랑 오버레이 공유
    if(d) d.classList.remove('open');
    if(o) o.style.display = 'none';
}

/* ===================== [속도] 과제 OMR 미리 받아 두기 =====================
 * 과제 목록이 뜨면 맨 위 미완료 과제의 OMR 데이터를 뒤에서 받아 둡니다. → 누르면 바로 열림
 * - 답안을 제출(저장)하면 받아 둔 데이터는 버립니다. (풀이 기록이 바뀌므로)
 * - 5분이 지나면 버리고 새로 받습니다.
 * - 한 번에 한 과제만 받아서 서버에 부담을 주지 않습니다.
 */
const OMR_PREFETCH = new Map();          // 과제ID → { promise, at, uid }
const OMR_PREFETCH_TTL = 5 * 60 * 1000;
function _asgnQids(id) {
  const a = ASGN_CACHE[id];
  if (!a) return null;
  let q = a.qids;
  if (typeof q === 'string') { try { q = JSON.parse(q); } catch (e) { return null; } }
  return Array.isArray(q) && q.length ? q : null;
}
function prefetchOMR(id) {
  if (!CURRENT_USER || !hasGsRun() || !id || OMR_PREFETCH.has(id)) return;
  if (typeof hasPendingAttempts === 'function' && hasPendingAttempts()) return;
  const qids = _asgnQids(id);
  if (!qids) return;
  const uid = CURRENT_USER.id;
  const promise = gsCall('loadRetryData', [CURRENT_USER, qids, id, 'omr']);
  promise.catch(() => { if (OMR_PREFETCH.get(id) && OMR_PREFETCH.get(id).promise === promise) OMR_PREFETCH.delete(id); });
  OMR_PREFETCH.set(id, { promise: promise, at: Date.now(), uid: uid });
}
function clearOMRPrefetch() { OMR_PREFETCH.clear(); }
// 받아 둔 것이 있으면 그것을, 없거나 실패하면 새로 받습니다.
function loadOMRData(id, qids) {
  const fresh = () => gsCall('loadRetryData', [CURRENT_USER, qids, id, 'omr']);
  const hit = OMR_PREFETCH.get(id);
  OMR_PREFETCH.delete(id);
  if (hit && CURRENT_USER && hit.uid === CURRENT_USER.id && Date.now() - hit.at < OMR_PREFETCH_TTL) {
    return hit.promise.catch(fresh);
  }
  return fresh();
}
let OMR_PREFETCH_TIMER = null;
function schedulePrefetchFirstActive(list) {
  if (OMR_PREFETCH_TIMER) clearTimeout(OMR_PREFETCH_TIMER);
  const first = (list || []).find(a => a && a.id);
  if (!first) return;
  OMR_PREFETCH_TIMER = setTimeout(() => { OMR_PREFETCH_TIMER = null; prefetchOMR(first.id); }, 700);
}

function loadMyAssignments(){ return runAfterAttemptsSaved(_loadMyAssignmentsNow); }
function _loadMyAssignmentsNow(){
  const listActive = document.getElementById('assignmentList');
  const listDone = document.getElementById('completedAssignmentList');
  
  if(!listActive || !listDone || !CURRENT_USER) return;
  const user = CURRENT_USER;

  // 저장된 목록이 있으면 즉시 표시하고, 최신 목록은 뒤에서 받아 바뀐 경우에만 다시 그립니다.
  let shown = false;
  swrLoad({
    key: 'myAssignments', scope: user.id, func: 'getAllMyAssignments', args: [user],
    guard: () => CURRENT_USER === user,
    onData: res => {
      shown = true;
      renderAssignmentList(listActive, (res && res.active) || [], false);   // 미완료
      renderAssignmentList(listDone, (res && res.completed) || [], true);   // 완료
      schedulePrefetchFirstActive((res && res.active) || []);              // 맨 위 미완료 과제 미리 받기
    },
    onError: (err, info) => {
      if (info.hadCache) showToast('최신 과제 목록을 불러오지 못했습니다. 저장된 목록을 표시합니다.', 'error');
      else listActive.innerHTML = `<div style="padding:20px; text-align:center; color:#dc2626; font-size:14px;">과제 목록 로드 실패: ${escapeHTML(String(err))}</div>`;
    }
  });
  if (!shown) {
    listActive.innerHTML = inlineLoadingHTML('과제 보관함을 확인 중...');
    listDone.innerHTML = '';
  }
}

let MY_ASSIGNMENTS_CACHE = []; // 내 과제 데이터를 임시 저장할 배열

function renderAssignmentList(container, data, isCompleted) {
  container.innerHTML = '';
  if(!data || !data.length) { 
    container.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:14px;">목록이 없습니다.</div>`;
    return;
  }

  // 데이터 캐싱: 나중에 ID로 문항 정보를 찾을 수 있게 저장
  data.forEach(item => { ASGN_CACHE[item.id] = item; });

  data.forEach(asgn => {
      const card = document.createElement('div');
      card.className = 'question-card';
      card.style.marginBottom = '12px';
      card.style.borderLeft = isCompleted ? '5px solid #6b7280' : (asgn.isWeekly ? '5px solid #1e3a5f' : '5px solid #2b6cb0');
      if (asgn.isWeekly) card.classList.add('wk-asgn-card');

      let dateStr = asgn.date;
      try { dateStr = String(asgn.date).substring(5, 16).replace('-','/'); } catch(e){}

      const statusBadge = isCompleted 
        ? `<span style="background:#e5e7eb; color:#374151; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">완료됨</span>`
        : `<span style="background:#dbeafe; color:#1e40af; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">미완료</span>`;

      // ★ 버튼 수정: qids를 직접 넘기지 않고 id와 모드만 전달
      const btnHtml = isCompleted
        ? `<button class="btn-ghost" style="width:100%; padding:8px; font-size:14px;" onclick="startRetryAssignment('${asgn.id}', null, true)">📊 결과 확인</button>`
        : `<button class="btn-primary" style="width:100%; padding:10px 0; font-size:14px; background:${asgn.isWeekly ? '#1e3a5f' : '#2b6cb0'}; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;" onclick="startAssignment('${asgn.id}', 'omr')">📝 과제 풀기 (OMR & 온라인)</button>`;

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h3 style="margin:0 0 6px; font-size:16px; color:#111827;">${asgn.isWeekly ? '<span class="wk-badge">주간평가</span>' : ''}${sanitizeInlineHTML(asgn.title)}</h3>
            <div style="font-size:12px; color:#6b7280;">📅 ${dateStr} | 📝 ${asgn.count}문항</div>
          </div>
          ${statusBadge}
        </div>
        <div style="margin-top:10px;">${btnHtml}</div>
      `;
      container.appendChild(card);
  });
}

// 과제지 QR로 들어온 경우: 내 과제 중 같은 문항 목록인 과제를 찾아 OMR을 엽니다.
// (일괄 출제로 여러 학생이 같은 QR을 써도 각자 자기 과제가 열립니다)
function openAssignmentByQr(qr) {
  if (!CURRENT_USER || !qr) return;
  const user = CURRENT_USER;
  if (window.history && window.history.replaceState) window.history.replaceState({ page: 'assignment' }, '', '#assignment');
  routeTo('assignment', true);
  const loadEl = document.getElementById('loadingOverlay');
  if (loadEl) { loadEl.querySelector('.loading-text').innerHTML = 'QR 과제를 찾는 중...'; loadEl.classList.add('active'); }
  gsCall('getAllMyAssignments', [user])
    .then(res => {
      if (loadEl) loadEl.classList.remove('active');
      if (CURRENT_USER !== user) return;
      const active = (res && res.active) || [], done = (res && res.completed) || [];
      active.concat(done).forEach(a => { if (a && a.id) ASGN_CACHE[a.id] = a; });
      const hit = active.find(a => qrAssignKey(a.qids) === qr.key);
      if (hit) { startAssignment(hit.id, 'omr'); return; }
      const old = done.find(a => qrAssignKey(a.qids) === qr.key);
      if (old) { showToast('이미 제출한 과제입니다. 결과 화면을 엽니다.', 'info'); startRetryAssignment(old.id, null, true); return; }
      showCustomAlert('이 계정에는 QR의 과제가 없습니다.\n본인 ID로 로그인했는지 확인해 주십시오.');
    })
    .catch(err => {
      if (loadEl) loadEl.classList.remove('active');
      showCustomAlert('과제 목록을 불러오지 못했습니다: ' + err);
    });
}

// 과제 시작하기
function startAssignment(id, mode){ return runAfterAttemptsSaved(() => _startAssignmentNow(id, mode)); }
function _startAssignmentNow(id, mode){
  CURRENT_ASSIGNMENT_ID = id;
  CURRENT_SESSION = id; 
  
  // 캐시에서 과제 정보 가져오기
  const asgn = ASGN_CACHE[id];
  if(!asgn) {
      showCustomAlert('과제 데이터를 찾을 수 없습니다. 목록을 새로고침해 주십시오.');
      return;
  }

  let qids = asgn.qids;
  if (typeof qids === 'string') {
      try { qids = JSON.parse(qids); } catch(e){ showCustomAlert('데이터 오류'); return; }
  }
  
  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '과제 데이터를 불러오는 중...';
      loadEl.classList.add('active');
  }

  const request = (mode === 'omr')
    ? loadOMRData(id, qids)
    : gsCall('loadRetryData', [CURRENT_USER, qids, id, null]);
  request
    .then(res => {
        if(loadEl) loadEl.classList.remove('active');
        const qs = res.qs;
        const history = res.history;

        if (mode === 'omr') {
            // [📟 OMR 입력] 모드
            renderOMRSheet(qs, history, false, id);
        } else {
            // [✍️ 온라인 풀기] 모드
            const qPage = document.getElementById('quizPage');
            qPage.setAttribute('data-assign-id', id); // 채점 시 과제 완료 처리를 위해 세팅
            qPage.innerHTML = ''; 
            
            renderQuestions(qs); 
            
            // 온라인 풀기 시에도 단어장 버튼 노출
            document.getElementById('btnOpenVocab').style.display = 'inline-flex';
        }
    })
    .catch(err => {
      if(loadEl) loadEl.classList.remove('active');
      showCustomAlert('오류 발생: ' + (err && err.message ? err.message : err));
    });
}

/* [도우미 함수] 과제 OMR '온라인' 보기 HTML (기존 온라인 보기 디자인 유지)
 * 왼쪽(op-left): 질문 → 주어진 문장 박스 → 지문 박스 — 너비는 실제 모의고사 한 단과 같은 글자 수
 * 오른쪽(op-right): 선택지 버튼
 * 좁은 화면에서는 위아래로(질문 → 지문 → 선택지) 이어서 보입니다. (style.css 참고)
 */
function generateOnlineViewHtml(q) {
    const passages = [q.box1, q.box2, q.box3, q.box4]
        .map(x => x ? sanitizeInlineHTML(x) : '')
        .filter(x => x.replace(/<br\s*\/?>/gi, '').trim() !== '');

    let stem = sanitizeInlineHTML(q.question || '').trim().replace(/^\d+[\.．]\s*/, '');
    let extractedBox = '';
    const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
    const boxMatch = stem.match(boxRegex);
    if (boxMatch) {
        extractedBox = boxMatch[0];
        stem = stem.replace(boxRegex, '');
    }
    const questionHtml = `<div class="op-question">${toOneLine(stem).trim()}</div>` +
                         (extractedBox ? `<div class="op-box">${extractedBox}</div>` : '');

    let optionsHtml = '';
    const isDesc = String(q.type || '').includes('서술형');
    if (!isDesc && q.options && q.options.length > 0) {
        const symbols = ['①','②','③','④','⑤'];
        q.options.forEach((opt, optIdx) => {
            if (String(opt || '').trim()) {
                optionsHtml += `<div class="op-opt" role="button" tabindex="0" data-opt="${optIdx + 1}">` +
                               `<span class="op-sym">${symbols[optIdx] || ''}</span>` +
                               `<span class="op-opt-text">${sanitizeInlineHTML(opt)}</span></div>`;
            }
        });
    } else if (isDesc) {
        optionsHtml = '<div class="op-note">※ 서술형 문항의 정답은 OMR 입력칸을 이용해 주십시오.</div>';
    }

    const passageHtml = passages.length
        ? `<div class="passage-wrap op-passage">${passages.join('<div style="height:12px;"></div>')}</div>`
        : '';
    const fontBar = '<div class="op-font-bar">' +
        '<span class="op-font-title">글자 크기</span>' +
        '<button type="button" class="op-font-btn" data-font="-" aria-label="글자 작게">A−</button>' +
        '<span class="op-font-size">15</span>' +
        '<button type="button" class="op-font-btn" data-font="+" aria-label="글자 크게">A+</button>' +
        '<button type="button" class="op-font-btn op-font-reset" data-font="auto">기본</button>' +
        '</div>';
    return `<div class="op-left">${fontBar}${questionHtml}${passageHtml}</div>` +
           (optionsHtml ? `<div class="op-right">${optionsHtml}</div>` : '');
}

/* [휴대폰] 온라인 보기의 질문+지문이 한 화면에 들어오도록 지문 글자 크기를 15px → 최소 12px까지 줄입니다.
 * 화면 폭 820px 이상(PC·태블릿 가로)은 좌우 배치이므로 적용하지 않습니다.
 * 반환값: 휴대폰 맞춤을 적용했으면 true
 */
const ONLINE_FONT_MAX = 15, ONLINE_FONT_MIN = 12;

/* 학생이 A−/A+로 정한 글자 크기 (기기 브라우저에 학생 ID별로 저장, 서버 저장 없음) */
const ONLINE_FONT_STEP = 0.5, ONLINE_FONT_LIMIT_MIN = 11, ONLINE_FONT_LIMIT_MAX = 22;
function _onlineFontKey() { return 'k2_online_font:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function getSavedOnlineFont() {
    try {
        const v = parseFloat(localStorage.getItem(_onlineFontKey()));
        return (v >= ONLINE_FONT_LIMIT_MIN && v <= ONLINE_FONT_LIMIT_MAX) ? v : null;
    } catch (e) { return null; }
}
function saveOnlineFont(v) {
    try {
        if (v == null) localStorage.removeItem(_onlineFontKey());
        else localStorage.setItem(_onlineFontKey(), String(v));
    } catch (e) {}
}
// 지문·질문 글자 크기 적용 (size가 null이면 기본 스타일로 되돌림)
function applyOnlineFont(box, size) {
    box.querySelectorAll('.op-passage, .op-question').forEach(el => { el.style.fontSize = size == null ? '' : size + 'px'; });
    // PC·태블릿 가로: 지문 칸 너비가 글자 크기에 비례해 늘거나 줄도록 (한 줄 글자 수 유지)
    const grid = box.classList.contains('qz-box') ? box : (box.closest('.question-card') || box);
    if (size == null) grid.style.removeProperty('--op-font');
    else grid.style.setProperty('--op-font', size + 'px');
    updateOnlineFontLabel(box);
}
function updateOnlineFontLabel(box) {
    const label = box.querySelector('.op-font-size');
    const target = box.querySelector('.op-passage') || box.querySelector('.op-question');
    if (label && target) label.textContent = String(parseFloat(getComputedStyle(target).fontSize));
    const reset = box.querySelector('.op-font-reset');
    if (reset) reset.classList.toggle('active', getSavedOnlineFont() == null);
}
function changeOnlineFont(card, box, action) {
    if (action === 'auto') {
        saveOnlineFont(null);
        applyOnlineFont(box, null);
        fitOnlineViewToScreen(card, box, false);
        return;
    }
    const target = box.querySelector('.op-passage') || box.querySelector('.op-question');
    const current = getSavedOnlineFont() || (target ? parseFloat(getComputedStyle(target).fontSize) : ONLINE_FONT_MAX);
    let next = current + (action === '+' ? ONLINE_FONT_STEP : -ONLINE_FONT_STEP);
    next = Math.min(ONLINE_FONT_LIMIT_MAX, Math.max(ONLINE_FONT_LIMIT_MIN, Math.round(next * 2) / 2));
    saveOnlineFont(next);
    applyOnlineFont(box, next);
}

function fitOnlineViewToScreen(card, box, scrollToTop) {
    const left = box.querySelector('.op-left');
    const passage = box.querySelector('.op-passage');
    if (!left) return false;
    const saved = getSavedOnlineFont();
    const isPhone = window.innerWidth < 820;
    // 학생이 정한 크기가 있으면 자동 맞춤 대신 그 크기를 사용
    if (saved != null) {
        applyOnlineFont(box, saved);
    } else if (!isPhone) {
        applyOnlineFont(box, null);
    }
    if (!isPhone) return false;
    const header = document.getElementById('globalHeader');
    const footer = document.getElementById('globalFooter');
    const visible = el => el && getComputedStyle(el).display !== 'none';
    const headerH = visible(header) ? header.offsetHeight : 0;
    const footerH = visible(footer) ? footer.offsetHeight : 0;
    const viewH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const avail = viewH - headerH - footerH - 16;

    if (passage && saved == null) {
        let size = ONLINE_FONT_MAX;
        passage.style.fontSize = size + 'px';
        while (left.offsetHeight > avail && size > ONLINE_FONT_MIN) {
            size -= 0.5;
            passage.style.fontSize = size + 'px';
        }
        updateOnlineFontLabel(box);
    }
    if (scrollToTop) {
        const top = left.getBoundingClientRect().top + window.scrollY - headerH - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    return true;
}
// 화면 회전/크기 변경 시 열려 있는 온라인 보기 다시 맞춤
let _onlineFitTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(_onlineFitTimer);
    _onlineFitTimer = setTimeout(() => {
        const card = document.querySelector('.question-card.online-open');
        const box = card && card.querySelector('.online-box');
        if (box && box.style.display !== 'none') fitOnlineViewToScreen(card, box, false);
    }, 200);
});

// 온라인 보기의 선택지 ↔ OMR 버튼 양방향 동기화 (카드당 1회 연결)
function bindOnlinePaper(card, box, idx) {
    const radioName = 'omr_' + idx;
    const sync = () => {
        const checked = card.querySelector(`.omr-options-wrap input[name="${radioName}"]:checked`);
        const val = checked ? checked.value : '';
        box.querySelectorAll('.op-opt').forEach(el => {
            el.classList.toggle('selected', el.dataset.opt === val);
            const radio = card.querySelector(`.omr-options-wrap input[name="${radioName}"][value="${el.dataset.opt}"]`);
            el.classList.toggle('locked', !radio || radio.disabled);
        });
    };
    if (!box.dataset.bound) {
        box.dataset.bound = 'true';
        box.querySelectorAll('img').forEach(img => img.addEventListener('load', () => {
            if (card.classList.contains('online-open')) fitOnlineViewToScreen(card, box, false);
        }));
        const choose = (opt) => {
            const radio = card.querySelector(`.omr-options-wrap input[name="${radioName}"][value="${opt.dataset.opt}"]`);
            if (radio && !radio.disabled) radio.click(); // 기존 OMR 클릭 처리(선택/해제)를 그대로 사용
            sync();
        };
        box.addEventListener('click', e => {
            const fontBtn = e.target.closest('[data-font]');
            if (fontBtn) { changeOnlineFont(card, box, fontBtn.dataset.font); return; }
            const opt = e.target.closest('.op-opt');
            if (opt) choose(opt);
        });
        box.addEventListener('keydown', e => {
            const opt = e.target.closest('.op-opt');
            if (opt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(opt); }
        });
        // OMR 버튼을 직접 눌렀을 때도 시험지에 표시 (상위 OMR 처리 후 반영)
        card.addEventListener('click', e => {
            if (e.target && e.target.matches && e.target.matches(`input[name="${radioName}"]`)) setTimeout(sync, 0);
        });
    }
    sync();
}

// 문항 객체별로 진행 중 요청을 공유합니다. 과제 기록은 캐시하지 않습니다.
const OMR_DETAIL_PENDING = new WeakMap();
// [속도] 한 번 받은 문항 본문(지문·보기·해설)은 이 화면을 닫기 전까지 기억합니다. (문항 ID 기준)
const OMR_FULL_DETAIL = new Map();
function _applyFullDetail(q) {
  const full = q && q._omrLite && OMR_FULL_DETAIL.get(q.qid);
  if (!full) return false;
  Object.assign(q, full);
  delete q._omrLite;
  return true;
}
// OMR을 연 뒤 뒤에서 전체 문항 본문을 한 번에 받아 둡니다. → [온라인] 버튼이 바로 열림
function prefetchOMRDetails(qs) {
  const need = (qs || []).filter(q => q && q._omrLite && !_applyFullDetail(q));
  if (!need.length || !hasGsRun()) return;
  const ids = [...new Set(need.map(q => q.qid))];
  gsCall('getQuestionsByQids', [ids]).then(rows => {
    (rows || []).forEach(full => { if (full && full.qid) OMR_FULL_DETAIL.set(full.qid, full); });
    need.forEach(_applyFullDetail);
  }).catch(() => {});
}
function ensureOMRQuestionDetail(q) {
  if (!q._omrLite || _applyFullDetail(q)) return Promise.resolve(q);
  if (OMR_DETAIL_PENDING.has(q)) return OMR_DETAIL_PENDING.get(q);
  const pending = new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(rows => {
      const full = (rows || []).find(item => item.qid === q.qid);
      if (!full) { reject(new Error('문항 정보를 찾을 수 없습니다.')); return; }
      OMR_FULL_DETAIL.set(full.qid, full);
      Object.assign(q, full);
      delete q._omrLite;
      resolve(q);
    }).withFailureHandler(reject).getQuestionsByQids([q.qid]);
  });
  OMR_DETAIL_PENDING.set(q, pending);
  // 실패한 요청은 재시도할 수 있도록 제거합니다.
  pending.then(() => OMR_DETAIL_PENDING.delete(q), () => OMR_DETAIL_PENDING.delete(q));
  return pending;
}

/* [프론트엔드] OMR 답안지 및 결과 화면 렌더링 함수 (최적화 통합 버전) */
function renderOMRSheet(qs, history, isReviewMode, assignmentId) {
  (qs || []).forEach(_applyFullDetail);          // 이미 받아 둔 본문이 있으면 바로 채움
  setTimeout(() => prefetchOMRDetails(qs), 1200); // 나머지 본문은 뒤에서 한 번에
  CURRENT_QUIZ_DATA = qs;
  showPanel('quizPage');
  setTopTab('quiz');
  const quizPage = document.getElementById('quizPage');
  
  // 1. 과제 ID 설정 및 화면 초기화
  if(assignmentId) {
      quizPage.setAttribute('data-assign-id', assignmentId);
      CURRENT_ASSIGNMENT_ID = assignmentId; 
  } else {
      quizPage.removeAttribute('data-assign-id');
  }

  // 주간평가면 시험지와 같은 남색 양식(머리글 띠·번호 네모)으로 보여 줍니다.
  const wkAsgn = assignmentId && typeof ASGN_CACHE !== 'undefined' ? ASGN_CACHE[assignmentId] : null;
  const isWeeklyOMR = !!(wkAsgn && wkAsgn.isWeekly);
  quizPage.classList.toggle('wk-omr', isWeeklyOMR);

  // [속도 최적화 1] 실제 화면(DOM)을 직접 건드리지 않고 가상 도화지(Fragment) 생성
  quizPage.innerHTML = '';
  const fragment = document.createDocumentFragment();

  // 진짜 오답과 빈칸 분리 계산
  let realWrongCount = 0;
  let blankCount = 0;
  qs.forEach(q => {
      const h = history ? history[q.qid] : null;
      if (h) {
          if (h.isCorrect === false) {
              if (String(h.selected || '').trim() !== '') realWrongCount++;
              else blankCount++;
          }
      } else {
          blankCount++; // history 기록 자체가 없으면 미입력(빈칸)
      }
  });

  const isRetry = history && Object.values(history).some(h => !h.empty);

  // 2. 헤더 생성 및 가상 도화지에 추가
  let headerHtml = '';
  if (isReviewMode) {
      headerHtml = `<h2 style="margin:0; color:#4b5563; font-size:20px;">📊 과제 결과 확인</h2>`;
  } else if (isRetry) {
      let msg = '';
      if (realWrongCount > 0 && blankCount > 0) msg = `<b style="color:#dc2626">${realWrongCount}문제</b>가 틀렸고, <b style="color:#d97706">${blankCount}문제</b>가 미입력 상태입니다.`;
      else if (realWrongCount > 0) msg = `<b style="color:#dc2626">${realWrongCount}문제</b>가 틀렸습니다.`;
      else if (blankCount > 0) msg = `<b style="color:#d97706">${blankCount}문제</b>가 미입력 상태입니다.`;
      else msg = '모두 정답입니다!';

      headerHtml = `<h2 style="margin:0; color:#4b5563; font-size:20px;">↺ 오답 및 미입력 풀기</h2>
                    <div style="font-size:14px; margin-top:5px;">
                        ${msg} 정답은 고정되며, <b>오답과 빈칸만 다시 풀 수 있습니다.</b>
                    </div>`;
  } else {
      headerHtml = `<h2 style="margin:0; color:#1e40af; font-size:20px;">📝 과제 답안 제출</h2>`;
  }

  if (isWeeklyOMR) {
      const t = String(wkAsgn.title || '');
      const wkWeek = (t.match(/\d+월\s*\d+주차/) || [''])[0];
      const wkLv = (t.match(/Lv\.?\s*(\d+)/i) || [])[1] || '';
      headerHtml = `<div class="wk-band">
              <div class="wk-brand"><span class="wk-k2">K2</span> WEEKLY TEST</div>
              <div class="wk-band-title">주간평가${wkLv ? `<span class="wk-lv">Level ${escapeHTML(wkLv)}</span>` : ''}</div>
          </div>
          <div class="wk-sub">${headerHtml.replace(/<h2[^>]*>/, '<div class="wk-sub-title">').replace('</h2>', '</div>')}<div class="wk-sub-count">${qs.length}문항</div></div>`;
  }

  const header = document.createElement('div');
  header.className = 'omr-header' + (isWeeklyOMR ? ' wk-omr-header' : '');
  header.innerHTML = headerHtml;
  fragment.appendChild(header);

  // 3. 문제들을 담을 OMR 컨테이너 생성
  const omrContainer = document.createElement('div');
  omrContainer.className = 'omr-container';

  // 4. 문제 루프 시작
  qs.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card omr-card';
    card.setAttribute('data-idx', String(idx));

    const qHistory = history ? history[q.qid] : null;
    const isCorrect = qHistory && qHistory.isCorrect === true;
    
    if(isCorrect) {
        card.setAttribute('data-already-correct', 'true');
    }

    // [오류 해결] 변수 선언은 루프 상단에서 한 번만 수행
    const prevSelected = qHistory ? String(qHistory.selected || '').trim() : '';
    const isRealWrong = (qHistory && !isCorrect && prevSelected !== ''); 
    // 빈칸 때문에 올라간 서버 카운트 대신, 실제로 오답을 제출한 적이 있는지(wasWrong)를 체크하여 억울한 노란색 방지
    const isCorrected = isCorrect && (qHistory && qHistory.wasWrong === true);
    
    if (isRealWrong) {
        card.setAttribute('data-retrying', 'true');
        card.setAttribute('data-currently-wrong', 'true');
    }

    const currentWrongCount = qHistory ? (qHistory.wrongCount || 0) : 0;

    // 카드 상단 (번호 및 상태 표시)
    const headerFlex = document.createElement('div');
    headerFlex.className = 'q-header-flex';

    const title = document.createElement('div');
    title.className = 'question-title';
    if (isRealWrong) title.classList.add('wrong');
    else if (isCorrected) title.classList.add('corrected');
    else if (isCorrect) title.classList.add('correct');

    let titleColor = isCorrect ? (isCorrected ? "#d97706" : "#059669") : (isRealWrong ? "#dc2626" : "#2b6cb0"); 
    let statusTxt = isCorrect ? (isCorrected ? " (정답 ▲)" : " (정답 ✓)") : (isRealWrong ? " (오답 ✖)" : "");

    title.innerHTML = isWeeklyOMR
        ? `<span class="wk-qnum">${idx + 1}</span><span style="font-size:14px; font-weight:bold; color:${titleColor};">${statusTxt.trim()}</span>`
        : `<span style="font-size:18px; font-weight:bold; color:${titleColor};">${idx + 1}번${statusTxt}</span>`;
    title.style.margin = '0';
    headerFlex.appendChild(title);

    // 해설 버튼 (정답이거나 2회 이상 틀렸을 때 표시)
    const btnExp = document.createElement('button');
    btnExp.className = 'btn-exp';
    btnExp.type = 'button';
    btnExp.textContent = '해설';
    btnExp.style.display = (isCorrect || currentWrongCount >= 2) ? 'inline-block' : 'none';
    btnExp.setAttribute('data-exp-btn', idx);
    btnExp.onclick = async function() {
        if (this.disabled) return;
        this.disabled = true;
        try {
            await ensureOMRQuestionDetail(q);
            if (!card.isConnected || !CURRENT_QUIZ_DATA.includes(q)) return;
            if (!expBox.dataset.detailReady) {
                expBox.innerHTML = `<b style="color:#2b6cb0;">[해설]</b><br>${sanitizeInlineHTML(q.explanation || '해설 정보가 등록되지 않았습니다.')}`;
                expBox.dataset.detailReady = 'true';
            }
            toggleExplanation(this, idx);
        } catch (err) { showCustomAlert('해설 로드 실패: ' + err); }
        finally { this.disabled = false; }
    };
    
    // [신규] '온라인' 버튼 생성 및 아코디언 토글 (지연 로딩 및 스파게티 분리 적용)
    const btnOnline = document.createElement('button');
    btnOnline.className = 'btn-exp';
    btnOnline.type = 'button';
    btnOnline.textContent = '온라인';
    btnOnline.style.display = isReviewMode ? 'none' : 'inline-block';
    btnOnline.style.marginRight = '4px';
    btnOnline.style.background = '#4f46e5';
    btnOnline.onclick = async function() {
        if (this.disabled) return;
        const targetBox = card.querySelector('.online-box');
        if (targetBox.style.display !== 'none') {
            targetBox.style.display = 'none';
            card.classList.remove('online-open');
            return;
        }
        this.disabled = true;
        const previousText = this.textContent;
        this.textContent = '불러오는 중...';
        try {
            await ensureOMRQuestionDetail(q);
            if (!card.isConnected || !CURRENT_QUIZ_DATA.includes(q)) return;
            if (targetBox.innerHTML === '') targetBox.innerHTML = generateOnlineViewHtml(q);
            // 다른 문항의 온라인 보기는 닫고, 이 카드를 한 줄 전체로 펼침
            document.querySelectorAll('.online-box').forEach(box => box.style.display = 'none');
            document.querySelectorAll('.question-card.online-open').forEach(c => c.classList.remove('online-open'));
            targetBox.style.display = 'block';
            card.classList.add('online-open');
            bindOnlinePaper(card, targetBox, idx);
            // 휴대폰: 질문+지문이 한 화면에 들어오도록 글자 크기 조정 후 질문 위치로 이동
            if (!fitOnlineViewToScreen(card, targetBox, true)) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) { showCustomAlert('문항 로드 실패: ' + err); }
        finally { this.disabled = false; this.textContent = previousText; }
    };
    headerFlex.appendChild(btnOnline);
    headerFlex.appendChild(btnExp);
    card.appendChild(headerFlex);

    const isDescriptive = String(q.type || '').includes('서술형');
    const interactionDisabled = (isRetry && isCorrect) || isReviewMode;

    // --- 문제 유형별 입력창/번호 생성 ---
    if (isDescriptive) {
        /* [서술형] */
        const answers = String(q.answer || '').split('||').map(s => s.trim());
        const userVals = prevSelected ? prevSelected.split('||') : [];
        const ansCount = answers.length;
        const descContainer = document.createElement('div');
        descContainer.className = 'desc-input-group';
        descContainer.style.marginTop = '10px';

        for(let i=0; i<ansCount; i++) {
            const row = document.createElement('div');
            row.style.marginBottom = '8px';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            
            let labelText = ansCount > 1 ? (['(A)', '(B)', '(C)', '(D)', '(E)'][i] || `(${i+1})`) : '';
            if (labelText) {
                const lbl = document.createElement('span');
                lbl.textContent = labelText;
                lbl.style.cssText = "font-weight:bold; margin-right:8px; color:#374151;";
                row.appendChild(lbl);
            }
            
            const input = document.createElement('input');
            input.type = 'text';
            input.name = 'omr_' + idx + '_' + i;
            input.className = 'desc-input';
            input.style.cssText = "flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px;";
            input.value = userVals[i] || '';

            if (interactionDisabled) {
                input.disabled = true;
                
                // 1. 학생 입력값과 정답 템플릿 준비
                const cleanInput = (userVals[i] || '').toLowerCase().trim().replace(/[.,?!]/g, '');
                const templates = answers[i].split(/\s*\/\s*(?![^\[]*\])/);
                
                // 2. 우리가 만든 compareWithBrackets 함수로 정답 여부 판별
                const isCorrectPart = templates.some(t => compareWithBrackets(cleanInput, t));

                if (isCorrectPart) {
                    // 정답일 때 (녹색/노란색)
                    input.style.backgroundColor = isCorrected ? '#fef9c3' : '#d1fae5'; 
                    input.style.borderColor = isCorrected ? '#eab308' : '#10b981'; 
                    input.style.color = isCorrected ? '#ca8a04' : '#065f46';
                } else if (userVals[i] || isReviewMode) {
                    // 오답일 때 (붉은색)
                    input.style.backgroundColor = '#fee2e2'; 
                    input.style.borderColor = '#ef4444'; 
                    input.style.color = '#991b1b';
                } else {
                    input.style.backgroundColor = '#f3f4f6';
                }
            }
            row.appendChild(input);
            descContainer.appendChild(row);
        }
        card.appendChild(descContainer);
    } else {
        /* [객관식 1~5번] */
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'omr-options-wrap';

        for(let i=1; i<=5; i++) {
            const val = String(i);
            const label = document.createElement('label');
            label.className = 'option omr-opt-label';
            const input = document.createElement('input');
            input.type = 'radio'; input.name = 'omr_' + idx; input.value = val; input.style.display = 'none';

            if (interactionDisabled) {
                input.disabled = true;
                label.classList.add('disabled');
                if (val === prevSelected) {
                    input.checked = true;
                    if (isCorrect) {
                        label.classList.add(isCorrected ? 'corrected' : 'correct');
                    } else {
                        label.classList.add('wrong');
                    }
                } else { label.classList.add('dimmed'); }
            }
            label.appendChild(input);
            label.appendChild(document.createTextNode(i));
            optionsDiv.appendChild(label);
        }
        card.appendChild(optionsDiv);
    }

  // [신규] 온라인 풀기 동적 영역 컨테이너 (내용은 클릭 시 지연 로딩됨)
    const onlineBox = document.createElement('div');
    onlineBox.className = 'online-box';
    onlineBox.style.display = 'none'; // 모양은 style.css의 .online-box / .op-left / .op-right
    card.appendChild(onlineBox);

    // [해설 박스 추가]
    const expBox = document.createElement('div');
    expBox.className = 'explanation-box';
    if (!q._omrLite) {
        expBox.innerHTML = `<b style="color:#2b6cb0;">[해설]</b><br>${sanitizeInlineHTML(q.explanation || '해설 정보가 등록되지 않았습니다.')}`;
        expBox.dataset.detailReady = 'true';
    }
    card.appendChild(expBox);

    // [속도 최적화 2] 카드를 컨테이너에 추가 (아직 화면에 안 그림)
    omrContainer.appendChild(card);
  });
  
  // 5. 전체를 가상 도화지에 담기
  fragment.appendChild(omrContainer);

  // 6. [속도 최적화 3] 마지막에 딱 한 번 실제 화면(DOM)에 붙임
  quizPage.appendChild(fragment);

  // 이벤트 위임 설정: 리뷰 모드 여부와 상관없이 항상 부착
  omrContainer.addEventListener('click', function(e) {
      if (e.target && e.target.matches('input[type="radio"][name^="omr_"]')) {
          const radio = e.target;
          if (radio.disabled) return;
          const label = radio.closest('.omr-opt-label');
          const currentOptDiv = radio.closest('.omr-options-wrap');
          if (radio.dataset.wasChecked === 'true') {
              radio.checked = false;
              radio.dataset.wasChecked = 'false';
              if (label) label.classList.remove('active');
          } else {
              if (currentOptDiv) {
                  currentOptDiv.querySelectorAll('input[type="radio"]').forEach(r => r.dataset.wasChecked = 'false');
                  currentOptDiv.querySelectorAll('.omr-opt-label').forEach(lb => lb.classList.remove('active'));
              }
              radio.checked = true;
              radio.dataset.wasChecked = 'true';
              if (label) label.classList.add('active');
          }
      }
  });
  
  // 7. 하단 고정 버튼 바 업데이트
  updateOMRFooterButtons(isReviewMode, isRetry, realWrongCount, assignmentId, qs);

  // OMR 화면(과제 풀이) 진입 시 상단 단어장 버튼 노출
  const btnVocab = document.getElementById('btnOpenVocab');
  if (btnVocab) btnVocab.style.display = 'inline-flex';
}

/* [보조 함수] 하단 버튼 바 관리 */
function updateOMRFooterButtons(isReviewMode, isRetry, wrongCount, assignmentId, qs) {
  const footer = document.getElementById('globalFooter');
  footer.style.display = 'flex';
  footer.querySelector('.nav-btn-group').style.display = 'none';

  let btnContainer = document.getElementById('omrBtnContainer');
  if(!btnContainer) {
      btnContainer = document.createElement('div');
      btnContainer.id = 'omrBtnContainer';
      btnContainer.style.cssText = 'display:flex; gap:10px; width:100%; max-width:600px;';
      footer.appendChild(btnContainer);
  } else {
      btnContainer.innerHTML = '';
  }

  const createBtn = (id, text, bg, onClick) => {
      const b = document.createElement('button');
      b.id = id; b.className = 'btn btn-primary';
      b.textContent = text;
      b.style.cssText = `width:100%; flex:1; background:${bg};`;
      b.onclick = onClick;
      return b;
  };

  if (isReviewMode) {
      btnContainer.appendChild(createBtn('btnBackList', '목록으로', '#6b7280', () => routeTo('assignment')));
      if (wrongCount > 0) {
          btnContainer.appendChild(createBtn('btnRetryWrong', `↺ 오답 다시 풀기 (${wrongCount}개)`, '#d97706', () => {
             enterInstantRetryMode(assignmentId, qs);
          }));
      }
  } else {
      const submitText = isRetry ? '↺ 수정된 답안 제출' : '📝 제출 및 채점하기';
      const submitBg = isRetry ? '#4b5563' : '#2b6cb0';
      
      btnContainer.appendChild(createBtn('btnSubmitOMR', submitText, submitBg, function() {
          const btn = this;
          if (btn.disabled) return; // 중복 클릭 방지
          
          // 1. 중복 클릭 방지
          btn.disabled = true;
          
          // 2. 화면에서 즉시 채점하고, 서버 저장은 백그라운드 큐가 순서대로 처리합니다.
          gradeAll(function(res) {
              // 3. 화면 새로고침 없이 그 자리에서 오답 잠금 해제 (연속 풀이 가능)
              enterInstantRetryMode(assignmentId, qs);
          });
      }));
  }
}

// [수정] 제출 안 한 문제와 고쳐서 맞은 문제를 제외하고 '계속 틀린 문제'로만 이동 (다 맞으면 최상단 이동)
function enterInstantRetryMode(assignmentId, qs) {
    CURRENT_ASSIGNMENT_ID = assignmentId;
    
    // 1. 헤더 변경 (OMR 모드인 경우)
    const header = document.querySelector('.omr-header');
    let currentWrong = 0;
    let currentBlank = 0;

    document.querySelectorAll('.question-card[data-idx]').forEach(card => {
        if (card.getAttribute('data-already-correct') === 'true') return;
        const title = card.querySelector('.question-title');
        const isStillWrong = (title && title.classList.contains('wrong')) || card.getAttribute('data-currently-wrong') === 'true';
        if (isStillWrong) currentWrong++;
        else currentBlank++;
    });

    if (header) {
        let msg = '';
        if (currentWrong > 0 && currentBlank > 0) msg = `<b style="color:#dc2626">${currentWrong}문제</b>가 틀렸고, <b style="color:#d97706">${currentBlank}문제</b>가 미입력 상태입니다.`;
        else if (currentWrong > 0) msg = `<b style="color:#dc2626">${currentWrong}문제</b>가 틀렸습니다.`;
        else if (currentBlank > 0) msg = `<b style="color:#d97706">${currentBlank}문제</b>가 미입력 상태입니다.`;
        else msg = '모두 정답입니다!';

        header.innerHTML = `<h2 style="margin:0; color:#4b5563; font-size:20px;">↺ 오답 및 미입력 풀기</h2>
                            <div style="font-size:14px; margin-top:5px;">
                                ${msg} 정답은 고정되며, <b>오답과 빈칸만 다시 풀 수 있습니다.</b>
                            </div>`;
    }

    // 2. 문제 카드 스캔 및 오답 잠금 해제
    const cards = document.querySelectorAll('.question-card[data-idx]');
    cards.forEach(card => {
        // 이미 맞은 문제(처음부터 맞은 문제 + 틀렸는데 고친 문제)는 이동 대상에서 완전 제외
        if (card.getAttribute('data-already-correct') === 'true') {
            card.removeAttribute('data-retrying');
            card.removeAttribute('data-currently-wrong');
            return;
        }

        const title = card.querySelector('.question-title');
        const isWrong = (title && title.classList.contains('wrong')) || card.getAttribute('data-currently-wrong') === 'true';
        
        if (isWrong) {
            // 계속 틀린 문제만 재시도 및 이동 타겟으로 설정
            card.removeAttribute('data-graded');
            card.setAttribute('data-retrying', 'true');
            card.setAttribute('data-currently-wrong', 'true');
            
            if (title) {
                title.classList.remove('wrong');
                title.innerHTML = title.innerHTML.replace(/\s*\(오답 ✖\)/g, '');
            }

            // 결과 바 숨김 (일반 온라인 모드용)
            const resultBar = card.querySelector('.result-bar');
            if (resultBar) resultBar.style.display = 'none';

            // 해설창 및 해설 버튼 숨김
            const expBox = card.querySelector('.explanation-box');
            if (expBox) expBox.style.display = 'none';
            
            const btnExp = card.querySelector('button[data-exp-btn]');
            if (btnExp) {
                btnExp.style.display = 'none';
                btnExp.textContent = '해설';
                btnExp.style.background = '#6b7280';
            }

            // --- 입력폼 초기화 및 물리적 잠금 해제 ---
            // 1) 서술형 입력창 강제 초기화
            const descWrap = card.querySelector('.desc-input-group');
            if (descWrap) descWrap.style.pointerEvents = 'auto';
            
            const descInputs = card.querySelectorAll('.desc-input');
            descInputs.forEach(inp => {
                inp.disabled = false;
                inp.value = '';
                inp.style.backgroundColor = '';
                inp.style.borderColor = '#d1d5db';
                inp.style.color = '';
                inp.style.pointerEvents = 'auto';
            });

            // 2) OMR 객관식 라디오
            const optWrap = card.querySelector('.omr-options-wrap');
            if (optWrap) optWrap.style.pointerEvents = 'auto';
            
            const omrLabels = card.querySelectorAll('.omr-opt-label');
            if (omrLabels.length > 0) {
                omrLabels.forEach(label => {
                    label.classList.remove('disabled', 'wrong', 'dimmed', 'active', 'correct', 'corrected');
                    const radio = label.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.disabled = false;
                        radio.checked = false;
                        radio.dataset.wasChecked = 'false';
                    }
                });
            }

            // 3) 일반 객관식 라디오 (온라인 풀기 모드용)
            const normalLabels = card.querySelectorAll('.option:not(.omr-opt-label)');
            if (normalLabels.length > 0) {
                normalLabels.forEach(label => {
                    label.style.background = '';
                    label.style.borderColor = '#d1d5db';
                    label.style.color = '';
                    label.style.opacity = '1';
                    const radio = label.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.disabled = false;
                        radio.checked = false;
                    }
                });
            }
        } else {
            // 제출을 안 한 문제(미입력 빈칸)는 이동 타겟에서 제외
            card.removeAttribute('data-retrying');
            card.removeAttribute('data-currently-wrong');
        }
    });

    // 3. 하단 버튼을 "수정된 답안 제출" 상태로 즉시 변경
    updateOMRFooterButtons(false, true, 0, assignmentId, qs);
    
    // 4. 스크롤 이동 제어
    // - 미입력(빈칸)과 맞은 문제(고쳐서 맞은 문제 포함)를 모두 제외하고, 가장 번호가 낮은 '틀린 문제' 1개를 탐색
    const firstStillWrongCard = document.querySelector('.question-card[data-currently-wrong="true"]:not([data-already-correct="true"])');
    
    if (firstStillWrongCard) {
        showToast('🔓 오답 잠금이 해제되었습니다. 틀린 문제를 다시 풀어보십시오.', 'info');
        setTimeout(() => {
            const yOffset = firstStillWrongCard.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top: Math.max(0, yOffset), behavior: 'smooth' });
        }, 50);
    } else if (currentWrong === 0 && currentBlank === 0) {
        // 틀린 문제도 없고 빈칸도 없이 100% 다 맞혔을 때만 최상단으로 이동
        showToast('🎉 모든 문제를 맞혔습니다!', 'success');
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
    } else if (currentWrong === 0 && currentBlank > 0) {
        // 틀린 문제는 없으나 미입력(빈칸)이 남아있는 경우: 최상단으로 강제 이동하지 않고 현재 위치 유지
        showToast(`✏️ 채점이 반영되었습니다. 미입력된 ${currentBlank}문제를 마저 풀어보십시오.`, 'info');
    }
}
function startRetryAssignment(id, qidsInput, isReviewMode) {
  return runAfterAttemptsSaved(() => _startRetryAssignmentNow(id, qidsInput, isReviewMode));
}
function _startRetryAssignmentNow(id, qidsInput, isReviewMode) {
  CURRENT_ASSIGNMENT_ID = id;
  CURRENT_SESSION = id;

  // qidsInput이 없으면 캐시에서 찾아옴
  let qids = qidsInput;
  if (!qids && ASGN_CACHE[id]) {
      qids = ASGN_CACHE[id].qids;
  }

  if (typeof qids === 'string') {
      try { qids = JSON.parse(qids); } catch(e) { /* 에러무시 */ }
  }

  if (!qids) { showCustomAlert('문항 데이터를 불러올 수 없습니다.'); return; }

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '과제 데이터를 불러오는 중...';
      loadEl.classList.add('active');
  }

  loadOMRData(id, qids).then(res => {
      if(loadEl) loadEl.classList.remove('active');
      renderOMRSheet(res.qs, res.history, isReviewMode, id);
  }).catch(err => {
      if(loadEl) loadEl.classList.remove('active');
      showCustomAlert('과제 로드 실패: ' + (err && err.message ? err.message : err));
  });
}


/* ===================== 답안 백그라운드 저장 큐 =====================
 * - 제출 답안을 브라우저(localStorage)에 먼저 보관한 뒤 서버로 순서대로 전송합니다.
 * - 전송 실패 시 자동 재시도하며, 새로고침/재접속 후에도 남은 답안을 다시 보냅니다.
 * - 서버는 attemptId로 중복 전송을 무시하므로 같은 답안이 두 번 기록되지 않습니다.
 */
const ATTEMPT_QUEUE_KEY = 'k2_pending_attempts';
const ATTEMPT_RETRY_DELAYS = [2000, 5000, 10000, 20000];
const ATTEMPT_MAX_TOTAL_TRIES = 12;
let ATTEMPT_MEM_QUEUE = [];
let ATTEMPT_SAVING = false;
let ATTEMPT_RETRY_IDX = 0;
let ATTEMPT_RETRY_TIMER = null;
let ATTEMPT_WAITERS = [];

function newAttemptId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function _readAttemptQueue() {
  try {
    const raw = localStorage.getItem(ATTEMPT_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return ATTEMPT_MEM_QUEUE.slice(); }
}
function _writeAttemptQueue(q) {
  ATTEMPT_MEM_QUEUE = q.slice();
  try {
    if (q.length) localStorage.setItem(ATTEMPT_QUEUE_KEY, JSON.stringify(q));
    else localStorage.removeItem(ATTEMPT_QUEUE_KEY);
  } catch (e) {}
}
function hasPendingAttempts() { return _readAttemptQueue().length > 0; }

function enqueueAttempt(payload) {
  clearOMRPrefetch();   // 풀이 기록이 바뀌므로 미리 받아 둔 OMR은 버립니다.
  const q = _readAttemptQueue();
  q.push(payload);
  _writeAttemptQueue(q);
  ATTEMPT_RETRY_IDX = 0;
  if (ATTEMPT_RETRY_TIMER) { clearTimeout(ATTEMPT_RETRY_TIMER); ATTEMPT_RETRY_TIMER = null; }
  updateAttemptSaveBadge();
  flushAttemptQueue();
}

function _resolveAttemptWaiters(saved) {
  const waiters = ATTEMPT_WAITERS; ATTEMPT_WAITERS = [];
  waiters.forEach(fn => { try { fn(saved); } catch (e) {} });
}

function flushAttemptQueue() {
  if (ATTEMPT_SAVING) return;
  const q = _readAttemptQueue();
  updateAttemptSaveBadge();
  if (!q.length) { _resolveAttemptWaiters(true); return; }
  if (!hasGsRun()) return;

  ATTEMPT_SAVING = true;
  const item = q[0];
  const onFail = (msg) => {
    ATTEMPT_SAVING = false;
    // 계속 실패하는 답안(예: 삭제된 과제)은 무한 재시도하지 않도록 정리합니다.
    const cur = _readAttemptQueue();
    const head = cur.find(x => x.attemptId === item.attemptId);
    if (head) {
      head._tries = (head._tries || 0) + 1;
      if (head._tries >= ATTEMPT_MAX_TOTAL_TRIES) {
        console.error('답안 저장 포기:', head, msg);
        _writeAttemptQueue(cur.filter(x => x.attemptId !== item.attemptId));
        showToast('⚠️ 일부 답안을 저장하지 못했습니다: ' + escapeHTML(String(msg || '')), 'error');
        ATTEMPT_RETRY_IDX = 0;
        flushAttemptQueue();
        return;
      }
      _writeAttemptQueue(cur);
    }
    if (ATTEMPT_RETRY_IDX < ATTEMPT_RETRY_DELAYS.length) {
      const delay = ATTEMPT_RETRY_DELAYS[ATTEMPT_RETRY_IDX++];
      updateAttemptSaveBadge('retry');
      ATTEMPT_RETRY_TIMER = setTimeout(() => { ATTEMPT_RETRY_TIMER = null; flushAttemptQueue(); }, delay);
    } else {
      // 이번 접속에서는 재시도를 멈추고, 다음 제출/새로고침 때 다시 보냅니다.
      ATTEMPT_RETRY_IDX = 0;
      updateAttemptSaveBadge('fail');
      showToast('⚠️ 답안 저장이 지연되고 있습니다. 인터넷 연결을 확인해 주십시오. (자동 재전송 예정)', 'error');
      _resolveAttemptWaiters(false);
    }
  };

  google.script.run
    .withSuccessHandler(res => {
      if (!res || res.ok !== true) { onFail(res && res.msg); return; }
      ATTEMPT_SAVING = false;
      ATTEMPT_RETRY_IDX = 0;
      _writeAttemptQueue(_readAttemptQueue().filter(x => x.attemptId !== item.attemptId));
      // 방금 저장한 답안이 반영되도록 해당 학생의 과제/오답 저장본을 비움
      const uid = item.user && item.user.id;
      if (uid) { swrInvalidate('myAssignments', uid); swrInvalidate('wrongStats', uid); swrInvalidate('wrongNote', uid); }
      WRONG_STATS = [];
      flushAttemptQueue();
    })
    .withFailureHandler(err => onFail(err))
    .logAttempt(item);
}

// 저장 대기 중인 답안이 서버에 반영될 때까지 기다립니다. (실패해도 최대 20초 후 진행)
function whenAttemptsSaved() {
  if (!hasPendingAttempts()) return Promise.resolve(true);
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    ATTEMPT_WAITERS.push(finish);
    setTimeout(() => finish(false), 20000);
    if (ATTEMPT_RETRY_TIMER) { clearTimeout(ATTEMPT_RETRY_TIMER); ATTEMPT_RETRY_TIMER = null; }
    flushAttemptQueue();
  });
}

// 과제 목록·결과처럼 방금 제출한 답안이 반영되어야 하는 화면은 저장 완료 후 엽니다.
function runAfterAttemptsSaved(fn) {
  if (!hasPendingAttempts()) return fn();
  const loadEl = document.getElementById('loadingOverlay');
  if (loadEl) {
    loadEl.querySelector('.loading-text').innerHTML = '제출한 답안을 저장하는 중...';
    loadEl.classList.add('active');
  }
  whenAttemptsSaved().then(() => {
    if (loadEl) loadEl.classList.remove('active');
    fn();
  });
}

// 화면 좌측 하단 저장 상태 표시
function updateAttemptSaveBadge(state) {
  const pending = _readAttemptQueue().length;
  let badge = document.getElementById('attemptSaveBadge');
  if (!pending) { if (badge) badge.style.display = 'none'; return; }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'attemptSaveBadge';
    badge.className = 'no-print';
    badge.style.cssText = 'position:fixed; left:16px; bottom:80px; z-index:9998; padding:8px 12px; border-radius:999px; font-size:13px; font-weight:bold; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.15); pointer-events:none;';
    document.body.appendChild(badge);
  }
  badge.style.display = 'block';
  if (state === 'fail') { badge.style.background = '#dc2626'; badge.textContent = '⚠️ 답안 저장 대기 중 (' + pending + ')'; }
  else if (state === 'retry') { badge.style.background = '#d97706'; badge.textContent = '↻ 답안 재전송 중...'; }
  else { badge.style.background = '#2b6cb0'; badge.textContent = '💾 답안 저장 중...'; }
}

// 저장 전에 창을 닫으려 하면 경고 (남은 답안은 다음 접속 때 자동 재전송됩니다)
window.addEventListener('beforeunload', function (e) {
  if (ATTEMPT_SAVING || hasPendingAttempts()) { e.preventDefault(); e.returnValue = ''; }
});
// 이전 접속에서 못 보낸 답안 재전송
setTimeout(flushAttemptQueue, 1500);


/* ===================== 학생 '문제 범위 선택' 필터 =====================
 * 학년별 년도/월(교재)/세부항목, 난이도, 유형 칩을 서버 필터 목록(getSourceFiltersAndTypes)으로 채웁니다.
 * 문제 메타는 학생과 무관한 공통 데이터라 'global' 저장본을 공유합니다.
 */
const STUDENT_GRADE_IDS = ['m1', 'm2', 'm3', 'h1', 'h2', 'h3'];
/* 학생 문제 범위: 학년 버튼 · 난이도(3열×5단계) · 유형(스크롤 체크 목록) */
const SF = { grades: new Set(), diffs: new Set(), types: new Set() };
const SF_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

function renderStudentFilterChips(res) {
  if (!res) return;
  SOURCE_FILTERS_CACHE = res;
  const gBox = document.getElementById('sfGrades');
  if (gBox) {
    gBox.innerHTML = SF_GRADES.map(g => `<button type="button" class="sf-grade${SF.grades.has(g) ? ' on' : ''}" data-g="${g}">${g}</button>`).join('');
  }
  const dBox = document.getElementById('sfDiffs');
  if (dBox) {
    const have = new Set((res.difficulties || []).map(String));
    let html = '';
    [[1, 5, '기본'], [6, 10, '중급'], [11, 15, '심화']].forEach(([a, b, name]) => {
      html += `<div class="sf-diff-col"><div class="sf-diff-head">${name} <span>${a}~${b}</span></div>`;
      for (let d = a; d <= b; d++) {
        const v = String(d);
        html += `<button type="button" class="sf-diff${SF.diffs.has(v) ? ' on' : ''}${have.size && !have.has(v) ? ' empty' : ''}" data-d="${v}">${d}단계</button>`;
      }
      html += '</div>';
    });
    dBox.innerHTML = html;
  }
  const tBox = document.getElementById('sfTypes');
  if (tBox) {
    const types = res.types || [];
    tBox.innerHTML = types.length ? types.map(t => `<label class="sf-type"><input type="checkbox" value="${escapeHTML(t)}"${SF.types.has(t) ? ' checked' : ''}><span>${escapeHTML(t)}</span></label>`).join('')
      : '<div class="sf-empty">유형 정보가 없습니다.</div>';
  }
  _sfUpdateLabels();
}

function _sfUpdateLabels() {
  const tc = document.getElementById('sfTypeCount');
  if (tc) tc.textContent = SF.types.size ? `${SF.types.size}개 선택` : '전체';
  const dc = document.getElementById('sfDiffCount');
  if (dc) dc.textContent = SF.diffs.size ? `${SF.diffs.size}개 선택` : '전체';
  const gc = document.getElementById('sfGradeCount');
  if (gc) gc.textContent = SF.grades.size ? Array.from(SF.grades).join(', ') : '선택 안 함';
}

function _sfChanged() {
  _sfUpdateLabels();
  if (typeof SP !== 'undefined' && SP.mode === 'pick') spRenderPick();
}

(function bindStudentFilters() {
  const g = document.getElementById('sfGrades');
  if (g) g.addEventListener('click', e => {
    const b = e.target.closest('button[data-g]'); if (!b) return;
    const v = b.dataset.g;
    if (SF.grades.has(v)) SF.grades.delete(v); else SF.grades.add(v);
    b.classList.toggle('on', SF.grades.has(v));
    _sfChanged();
  });
  const d = document.getElementById('sfDiffs');
  if (d) d.addEventListener('click', e => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    const v = b.dataset.d;
    if (SF.diffs.has(v)) SF.diffs.delete(v); else SF.diffs.add(v);
    b.classList.toggle('on', SF.diffs.has(v));
    _sfChanged();
  });
  const t = document.getElementById('sfTypes');
  if (t) t.addEventListener('change', e => {
    const c = e.target; if (!c || c.type !== 'checkbox') return;
    if (c.checked) SF.types.add(c.value); else SF.types.delete(c.value);
    _sfChanged();
  });
  document.querySelectorAll('#selectPage [data-sf]').forEach(btn => btn.addEventListener('click', () => {
    const [what, kind] = btn.dataset.sf.split(':');
    if (kind === 'diff') { SF.diffs.clear(); document.querySelectorAll('#sfDiffs .sf-diff').forEach(x => x.classList.remove('on')); }
    if (kind === 'type') {
      SF.types.clear();
      document.querySelectorAll('#sfTypes input').forEach(x => { x.checked = what === 'all'; if (x.checked) SF.types.add(x.value); });
    }
    _sfChanged();
  }));
})();

function loadStudentFilters() {
  let shown = false;
  swrLoad({
    key: 'sourceFilters', scope: 'global', func: 'getSourceFiltersAndTypes', args: [],
    onData: res => { shown = true; renderStudentFilterChips(res); },
    onError: (err, info) => {
      if (!info.hadCache) showSelectWarning('문제 범위 목록을 불러오지 못했습니다: ' + err);
    }
  });
  // '골라서 풀기' 화면이면 방금 푼 결과가 반영되도록 상태를 다시 받습니다.
  if (typeof SP !== 'undefined' && SP.mode === 'pick') spLoadPickData(true);
  if (!shown) {
    const box = document.getElementById('sfTypes');
    if (box) box.innerHTML = '<span style="font-size:13px; color:#6b7280;">⏳ 범위 목록을 불러오는 중...</span>';
  }
}

/* ===================== 온라인 문제: 골라서 풀기 =====================
 * 위의 범위(학년·연도·월)·난이도·유형 칩으로 걸러진 문항을 목록으로 보여 주고,
 * 학생이 원하는 문항만 골라 풉니다. 문항 목록은 브라우저에 저장된 문항 색인(loadQuestionMeta)을,
 * 풀이 상태는 오답노트와 같은 기록(getWrongNote)을 씁니다.
 */
const SP = {
  mode: 'random',             // random | pick
  rows: [],                   // 전체 문항 (색인 + 내 풀이 상태)
  status: 'all',              // all | new | wrong | done
  q: '',
  sort: 'source',
  sel: new Set(),
  loaded: false,
  loading: false
};
const SP_MAX_ROWS = 300;      // 한 번에 그리는 최대 줄 수 (랜덤 고르기는 걸러진 전체에서)
const SP_GRADES = [
  { id: 'm1', name: '중1' }, { id: 'm2', name: '중2' }, { id: 'm3', name: '중3' },
  { id: 'h1', name: '고1' }, { id: 'h2', name: '고2' }, { id: 'h3', name: '고3' }
];

function _spNum(extId, qid) {
  const m = String(extId || '').match(/(\d+)\s*$/);
  return m ? m[1] : String(extId || qid || '');
}

function _spStatusOf(item) {
  if (!item || !item.a) return 'new';
  const wrongEver = item.a.some(x => x[1] === 0);
  if (!item.lastCorrect) return 'wrong';
  return wrongEver ? 'fixed' : 'done';
}

function spSetMode(mode) {
  SP.mode = mode;
  document.querySelectorAll('#spModeTabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  const r = document.getElementById('spRandomBox'), p = document.getElementById('spPickBox');
  if (r) r.style.display = mode === 'random' ? '' : 'none';
  if (p) p.style.display = mode === 'pick' ? '' : 'none';
  if (mode === 'pick') spLoadPickData();
}

function spLoadPickData(force) {
  if (!CURRENT_USER) return;
  if (SP.user !== CURRENT_USER.id) { SP.user = CURRENT_USER.id; SP.loaded = false; SP.rows = []; SP.sel.clear(); }
  if (SP.loading) return;
  if (SP.loaded && !force) { spRenderPick(); return; }
  const user = CURRENT_USER;
  const list = document.getElementById('spList');
  if (list && !SP.loaded) list.innerHTML = `<tr class="sp-msg"><td colspan="6">⏳ 문항 목록을 불러오는 중...</td></tr>`;
  SP.loading = true;
  const cachedNote = swrRead('wrongNote', user.id);
  const notePromise = swrFetch('wrongNote', user.id, 'getWrongNote', [user])
    .catch(() => (cachedNote ? cachedNote.v : null));
  Promise.all([loadQuestionMeta(), notePromise]).then(([meta, note]) => {
    SP.loading = false;
    if (CURRENT_USER !== user) return;
    const byQid = new Map(((note && note.items) || []).map(it => [String(it.qid), it]));
    SP.rows = (meta || []).map(m => {
      const qid = String(m[0]), extId = m[7] || '', linked = m[8] || '';
      const it = byQid.get(qid);
      return {
        qid: qid, grade: m[1], year: String(m[2] || ''), month: m[3], detail: m[4] || '', type: m[5] || '',
        difficulty: m[6], number: _spNum(extId, qid), group: String(linked || qid),
        status: _spStatusOf(it), last: it ? it.last : 0
      };
    });
    SP.groupSize = new Map();
    SP.rows.forEach(r => SP.groupSize.set(r.group, (SP.groupSize.get(r.group) || 0) + 1));
    SP.loaded = true;
    spRenderPick();
  }).catch(err => {
    SP.loading = false;
    if (list) list.innerHTML = `<tr class="sp-msg"><td colspan="6" style="color:#dc2626;">문항 목록을 불러오지 못했습니다: ${escapeHTML(String(err && err.message || err))}</td></tr>`;
  });
}

// 위쪽 학년·난이도·유형과 같은 기준으로 거르기
function _spInScope(r) {
  if (!SF.grades.has(r.grade)) return false;
  if (SF.types.size && !SF.types.has(r.type)) return false;
  if (SF.diffs.size && !SF.diffs.has(String(parseInt(r.difficulty, 10)))) return false;
  return true;
}
function _spHasScope() { return SF.grades.size > 0; }

function _spFiltered() {
  const words = SP.q.toLowerCase().split(/\s+/).filter(Boolean);
  return SP.rows.filter(r => {
    if (!_spInScope(r)) return false;
    if (SP.status === 'new' && r.status !== 'new') return false;
    if (SP.status === 'wrong' && r.status !== 'wrong') return false;
    if (SP.status === 'done' && !(r.status === 'done' || r.status === 'fixed')) return false;
    if (words.length) {
      const hay = [r.grade, r.year, r.month, r.detail, r.number, r.type].join(' ').toLowerCase();
      if (!words.every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

const SP_GRADE_ORDER = { '중1': 1, '중2': 2, '중3': 3, '고1': 4, '고2': 5, '고3': 6 };
function _spN(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 9999 : n; }
function _spSrcCmp(a, b) {
  const ka = [SP_GRADE_ORDER[a.grade] || 9, _spN(a.year), _spN(a.month), String(a.month), String(a.detail), _spN(a.number)];
  const kb = [SP_GRADE_ORDER[b.grade] || 9, _spN(b.year), _spN(b.month), String(b.month), String(b.detail), _spN(b.number)];
  for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
  return 0;
}

function spRenderPick() {
  const list = document.getElementById('spList');
  if (!list || !SP.loaded) return;
  document.querySelectorAll('#spStatus button').forEach(b => b.classList.toggle('on', b.dataset.s === SP.status));

  if (!_spHasScope()) {
    list.innerHTML = `<tr class="sp-msg"><td colspan="6">위에서 <b>학년</b>을 먼저 골라 주십시오.<br><span>난이도·유형도 고르면 함께 걸러집니다.</span></td></tr>`;
    _spRenderSummary([]);
    return;
  }
  const rows = _spFiltered();
  if (SP.sort === 'source') rows.sort(_spSrcCmp);
  else if (SP.sort === 'diffAsc') rows.sort((a, b) => (_spN(a.difficulty) - _spN(b.difficulty)) || _spSrcCmp(a, b));
  else if (SP.sort === 'diffDesc') rows.sort((a, b) => (_spN(b.difficulty) - _spN(a.difficulty)) || _spSrcCmp(a, b));
  else if (SP.sort === 'type') rows.sort((a, b) => String(a.type).localeCompare(String(b.type)) || _spSrcCmp(a, b));

  _spRenderSummary(rows);
  if (!rows.length) {
    list.innerHTML = `<tr class="sp-msg"><td colspan="6">조건에 맞는 문항이 없습니다.</td></tr>`;
    _spUpdateSel();
    return;
  }
  const label = { new: ['미풀이', 'new'], wrong: ['틀림', 'wrong'], fixed: ['고침', 'fixed'], done: ['맞힘', 'done'] };
  const shown = rows.slice(0, SP_MAX_ROWS);
  list.innerHTML = shown.map(r => {
    const on = SP.sel.has(r.qid);
    const st = label[r.status] || label.new;
    const isSet = (SP.groupSize.get(r.group) || 0) > 1;
    const src = [r.grade, r.year, r.month, r.detail].filter(Boolean).join(' ');
    return `<tr class="sp-row${on ? ' selected' : ''}" data-qid="${escapeHTML(r.qid)}">
      <td class="c-chk"><input type="checkbox" class="sp-check"${on ? ' checked' : ''}></td>
      <td class="c-src">${escapeHTML(src)}${isSet ? ' <span class="sp-set" title="같은 지문 문항은 함께 선택됩니다">세트</span>' : ''}</td>
      <td class="c-num">${escapeHTML(String(r.number))}</td>
      <td class="c-type">${escapeHTML(r.type || '-')}</td>
      <td class="c-diff"><span class="sp-diff">${escapeHTML(String(r.difficulty || '-'))}</span></td>
      <td class="c-stat"><span class="sp-st ${st[1]}">${st[0]}</span></td>
    </tr>`;
  }).join('') + (rows.length > SP_MAX_ROWS
    ? `<tr class="sp-msg sp-more"><td colspan="6">${rows.length}문항 중 ${SP_MAX_ROWS}개만 보여 줍니다. 범위를 좁히거나 검색해 주십시오. (랜덤 고르기는 전체에서 고릅니다)</td></tr>` : '');
  _spUpdateSel();
}

function _spRenderSummary(rows) {
  const box = document.getElementById('spSummary');
  if (!box) return;
  if (!rows.length) { box.innerHTML = ''; return; }
  const c = { new: 0, wrong: 0, done: 0 };
  rows.forEach(r => { if (r.status === 'new') c.new++; else if (r.status === 'wrong') c.wrong++; else c.done++; });
  box.innerHTML = `범위 안 <b>${rows.length}</b>문항 · 미풀이 <b>${c.new}</b> · 틀림 <b class="sp-red">${c.wrong}</b> · 맞힘/고침 <b class="sp-green">${c.done}</b>`;
}

function _spToggle(qid, on) {
  const row = SP.rows.find(r => r.qid === qid);
  const g = row ? row.group : qid;
  SP.rows.forEach(r => { if (r.group === g || r.qid === qid) { if (on) SP.sel.add(r.qid); else SP.sel.delete(r.qid); } });
}

function _spUpdateSel() {
  const n = SP.sel.size;
  const c = document.getElementById('spSelCount'); if (c) c.textContent = n;
  const play = document.getElementById('spPlay'); if (play) play.disabled = n === 0;
  const all = document.getElementById('spCheckAll');
  if (all) {
    const vis = Array.from(document.querySelectorAll('#spList tr.sp-row'));
    all.checked = vis.length > 0 && vis.every(tr => SP.sel.has(tr.dataset.qid));
  }
}

function spPlaySelected() {
  if (!SP.sel.size) { showCustomAlert('풀 문항을 골라 주십시오.'); return; }
  if (!hasGsRun()) { showCustomAlert('서버 연결에 문제가 있습니다.'); return; }
  // 출처 순서대로, 같은 지문 세트는 붙여서 출제
  const picked = SP.rows.filter(r => SP.sel.has(r.qid)).sort(_spSrcCmp).map(r => r.qid);
  const go = () => {
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) loadingEl.classList.add('active');
    CURRENT_FILTERS = null;
    google.script.run
      .withSuccessHandler(qs => {
        if (loadingEl) loadingEl.classList.remove('active');
        if (Array.isArray(qs)) {
          const order = new Map(picked.map((q, i) => [q, i]));
          qs = qs.filter(q => q && q.question && String(q.question).trim() !== '')
                 .sort((a, b) => (order.get(String(a.qid)) || 0) - (order.get(String(b.qid)) || 0));
        }
        if (!qs || !qs.length) { showCustomAlert('선택한 문항을 불러오지 못했습니다.'); return; }
        SP.sel.clear();
        renderQuestions(qs);
      })
      .withFailureHandler(err => {
        if (loadingEl) loadingEl.classList.remove('active');
        showCustomAlert('문항 불러오기 오류: ' + err);
      })
      .getQuestionsByQids(picked);
  };
  if (picked.length > 40) showCustomConfirm(`${picked.length}문항을 한 번에 풉니다. 계속하시겠습니까?`, go);
  else go();
}

(function bindStudentPick() {
  const page = document.getElementById('selectPage');
  if (!page) return;
  const tabs = document.getElementById('spModeTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]'); if (b) spSetMode(b.dataset.mode);
  });
  const status = document.getElementById('spStatus');
  if (status) status.addEventListener('click', e => {
    const b = e.target.closest('button[data-s]'); if (!b) return;
    SP.status = b.dataset.s; spRenderPick();
  });
  const search = document.getElementById('spSearch');
  let t = null;
  if (search) search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { SP.q = search.value.trim(); spRenderPick(); }, 200); });
  const sort = document.getElementById('spSort');
  if (sort) sort.addEventListener('change', () => { SP.sort = sort.value; spRenderPick(); });
  const list = document.getElementById('spList');
  if (list) list.addEventListener('click', e => {
    const tr = e.target.closest('tr.sp-row'); if (!tr) return;
    const qid = tr.dataset.qid;
    const on = e.target.classList.contains('sp-check') ? e.target.checked : !SP.sel.has(qid);
    _spToggle(qid, on);
    list.querySelectorAll('tr.sp-row').forEach(r => {
      const s = SP.sel.has(r.dataset.qid);
      r.classList.toggle('selected', s);
      const cb = r.querySelector('.sp-check'); if (cb) cb.checked = s;
    });
    _spUpdateSel();
  });
  const all = document.getElementById('spCheckAll');
  if (all) all.addEventListener('change', () => {
    document.querySelectorAll('#spList tr.sp-row').forEach(tr => _spToggle(tr.dataset.qid, all.checked));
    spRenderPick();
  });
  const clear = document.getElementById('spClear');
  if (clear) clear.addEventListener('click', () => { SP.sel.clear(); spRenderPick(); });
  const rand = document.getElementById('spRandom');
  if (rand) rand.addEventListener('click', () => {
    const n = Math.max(1, Math.min(100, parseInt(document.getElementById('spRandN').value, 10) || 10));
    const rows = _spFiltered();
    if (!rows.length) { showToast('지금 범위에 문항이 없습니다.', 'error'); return; }
    // 지문 세트 단위로 섞어서 n문항을 넘지 않게
    const groups = new Map();
    rows.forEach(r => { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group).push(r); });
    const keys = Array.from(groups.keys());
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    SP.sel.clear();
    let total = 0;
    keys.forEach(k => { const g = groups.get(k); if (total + g.length <= n) { g.forEach(r => SP.sel.add(r.qid)); total += g.length; } });
    spRenderPick();
    showToast(`${total}문항을 골랐습니다.`);
  });
  const play = document.getElementById('spPlay');
  if (play) play.addEventListener('click', spPlaySelected);
})();
