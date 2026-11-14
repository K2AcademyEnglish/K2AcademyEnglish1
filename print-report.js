/* [수정] 출력 버튼 클릭 시 실행되는 함수 */

/* [수정됨] 모의고사 스타일 인쇄 렌더링 함수 */
/* [긴급 수정] 인쇄 레이아웃 시작선 완전 일치 및 선택지 그리드 최적화 */
/* [완전 해결] 인쇄 레이아웃 정렬 및 선택지 계단 현상 수정 */
// 학원 사이트 첫 화면으로 가는 QR (예전 그림 파일 대신 그 자리에서 만듭니다)
function siteQrSrc() {
  try { if (window.QR) return QR.dataUrl(window.location.origin + window.location.pathname, { ecc: 'M', border: 1 }); } catch (e) { /* 아래 그림으로 */ }
  return 'https://' + 'i.imgur.com/R9QpYH9.jpeg';
}
// qrQids: 과제 문항 목록. 주면 바닥글에 그 과제 OMR로 가는 QR(출력일부터 7일)을 넣습니다.
// opts.weekly: 주간평가 전용 양식(머리글·번호 모양이 다르고, 문항 출처·난이도를 찍지 않습니다)
function renderQuestionsForPrint(qs, pageTitle, dateInput, studentName, qrQids, opts){
  const isWeekly = !!(opts && opts.weekly);
  // 문항 위 작은 줄(출처 · Lv). 주간평가지는 학부모가 보므로 출처를 숨깁니다.
  const idLine = (displayId, q) => isWeekly ? '' : `<div class="exam-q-id"><span>${escapeHTML(displayId)}</span><span style="font-weight: bold;">${q.difficulty ? `Lv. ${q.difficulty}` : ''}</span></div>`;
  const printZone = document.getElementById('printSection');
  printZone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  printZone.innerHTML = '';

  const controlsHTML = `
    <div class="print-controls no-print" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
      <div style="font-size: 16px; font-weight: bold;">🖥️ 리포트 미리보기</div>
      <div style="display:flex; gap:10px;">
        <button id="btnPrintAnswers" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">📑 정답지 보기</button>
        <button id="btnPrintAction" disabled style="background: #9ca3af; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: not-allowed; font-weight: bold; font-size: 14px; white-space: nowrap;">⏳ 이미지 대기중...</button>
        <button onclick="closePrintPreview()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height: 60px;"></div>
  `;

  let dateStr = "";
  if (dateInput) {
      const d = new Date(dateInput);
      dateStr = isNaN(d.getTime()) ? String(dateInput).substring(0, 10) : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  } else {
                  const today = new Date();
                  dateStr = (today.getMonth() + 1) + '월 ' + today.getDate() + '일';
              }

              // [글자 수 기반 폰트 크기 계산]
              const rawTitle = pageTitle ? pageTitle : '문제 제목';
              // 색 태그(<red>, <rainbow> 등)는 글자 수에서 빼고 실제로 보이는 글자만 셉니다.
              const titleLen = String(rawTitle).replace(/<[^>]*>/g, '').length;
              let titleFontSize = 18;
              if (titleLen > 85) titleFontSize = 10;
              else if (titleLen > 70) titleFontSize = 12;
              else if (titleLen > 60) titleFontSize = 14;
              else if (titleLen > 50) titleFontSize = 16;

              const headerHTML = `
                <div class="exam-header" style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px; position: relative;">
                  <div style="flex: 1; margin-right: 15px; height: 50px; display: flex; align-items: flex-end;">
                    <div style="font-size: ${titleFontSize}px; font-weight: bold; text-align: left; line-height: 1.3; width: 100%; word-break: keep-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                      ${sanitizeInlineHTML(rawTitle)}
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; justify-content: space-between; height: 50px; text-align: right; font-size: 17px; font-weight: bold; line-height: 1.1; position: relative; z-index: 10; flex-shrink: 0;">
                    <div>${dateStr}</div>
                    <div>${studentName ? sanitizeInlineHTML(studentName) : '이름: _________'}</div>
                  </div>
                </div>
              `;
              // [주간평가] 전용 머리글: 남색 띠 + 이름/날짜/문항/점수 칸
              const wkWeek = (String(rawTitle).match(/\d+월\s*\d+주차/) || [''])[0];
              const wkLv = (String(rawTitle).match(/Lv\.?\s*(\d+)/i) || [])[1] || '';
              const wkName = studentName ? sanitizeInlineHTML(String(studentName).replace(/\([^)]*\)\s*$/, '')) : '';
              // 머리글(1쪽): 색 띠 + 제목 줄 + 이름/날짜/문항 칸. 주간평가는 남색, 일반 과제는 파란색으로 구별합니다.
              // 제목 줄은 흰 바탕이라 <red>·<rainbow> 같은 색 태그가 그대로 보이고, 길면 글자 크기를 줄여 두 줄까지 씁니다.
              const autoWeeklyTitle = /^.+\s주간평가\(Lv\.\d+\)\s*-\s*\d+월\s*\d+주차$/.test(String(rawTitle).trim());
              const showTitleRow = true; // 주간평가도 띠 아래에 과제 제목 줄을 항상 둡니다
              const bandRightHTML = isWeekly
                ? `<div class="wk-band-title">주간평가${wkLv ? `<span class="wk-lv">Level ${escapeHTML(wkLv)}</span>` : ''}</div>`
                : '';
              const infoName = isWeekly ? wkName : (studentName ? sanitizeInlineHTML(studentName) : '');
              const BAND_MM = 7, TITLE_MM = showTitleRow ? 13 : 0, INFO_MM = 8;
              const spacerMm = Math.max(0, BAND_MM + TITLE_MM + INFO_MM + 1 + 5 - 18); // 본문 기본 윗여백 18mm를 넘는 만큼
              const wkHeaderHTML = `
                <div class="exam-header wk-header">
                  <div class="wk-band" style="height:${BAND_MM}mm;">
                    <div class="wk-brand"><span class="wk-k2">K2</span> ${isWeekly ? 'WEEKLY TEST' : 'ASSIGNMENT'}</div>
                    ${bandRightHTML}
                  </div>
                  ${showTitleRow ? `<div class="k2-title-row" style="height:${TITLE_MM}mm;"><div class="k2-title" style="font-size:${titleFontSize}px;">${sanitizeInlineHTML(rawTitle)}</div></div>` : ''}
                  <table class="wk-info" style="height:${INFO_MM}mm;"><tr>
                    <th>이름</th><td class="wk-name">${infoName}</td>
                    <th>날짜</th><td>${dateStr}</td>
                    <th>문항</th><td>${qs.length}문항</td>
                  </tr></table>
                </div>
              `;
              // 2쪽부터 위쪽에 반복되는 제목 줄: 기존 규칙 그대로 과제 제목(색 태그 포함)을 씁니다.
              const runningTitle = sanitizeInlineHTML(rawTitle);
              let bodyHTML = '<div class="exam-columns">';
  const symbols = ['①','②','③','④','⑤'];
  const groups = new Map();
  qs.forEach((q, idx)=>{
    // groupHash가 있을 때만 연계로 묶고, 없으면 지문 내용이 같아도 개별 분리
    let key = q.groupHash ? q.groupHash : 'ID:' + (q.extId || q.qid || idx);
    if(!groups.has(key)) groups.set(key, { passage: [q.box1,q.box2,q.box3,q.box4], items: [] });
    groups.get(key).items.push({ q, idx: idx + 1 });
  });

  let qNum = 0;
  // 오답만 다시 출력할 때: 원래 과제의 문항 번호(q._printNum)를 그대로 사용합니다. 없으면 1번부터 차례대로.
  const numOf = (q, fallback) => (q && q._printNum) ? q._printNum : fallback;
      groups.forEach((group) => {
        bodyHTML += `<div class="exam-q-block">`;
        
        const p1 = group.passage[0] ? sanitizeInlineHTML(group.passage[0]) : '';
        const p2 = group.passage[1] ? sanitizeInlineHTML(group.passage[1]) : '';
        const p3 = group.passage[2] ? sanitizeInlineHTML(group.passage[2]) : '';
        const p4 = group.passage[3] ? sanitizeInlineHTML(group.passage[3]) : '';
        
        // 지문 통합 로직 추가
        const combinedPassage = [p1, p2, p3, p4].filter(p => p.trim() !== '').join('<div style="height:6px;"></div>');

        const isMulti = group.items.length > 1;
        const makePBox = (html) => html ? `<div class="exam-passage ${isMulti ? 'boxed' : ''}">${html}</div>` : '';
        // [수정] 지문이 길 경우 단(Column) 분할은 허용(auto)하고, 페이지 분할만 방지합니다.
        // 문항 한 덩어리(지문+발문+선택지). 쪽 나누기는 인쇄 직전에 k2PaginateExam()이 높이를 재서 직접 정합니다.
        const wrapAvoid = (html) => html ? `<div class="exam-chunk">${html}</div>` : '';

        if (isMulti) {
            // 연계 문제 분절 로직
            const nums = group.items.map((it, k) => numOf(it.q, qNum + k + 1));
            const isSeq = nums.every((n, k) => k === 0 || Number(n) === Number(nums[k - 1]) + 1);
            const rangeLabel = isSeq ? `${nums[0]} ~ ${nums[nums.length - 1]}` : nums.join(', ');
            const rangeHTML = `<div class="exam-q-range-title">[${rangeLabel}] 다음 글을 읽고, 물음에 답하시오.</div>`;
            
            // 첫 번째 문항과 공통 지문을 하나로 묶어 페이지 갈라짐 방지
            let firstItemHtml = '';
            const firstItem = group.items[0];
            if (firstItem) {
                qNum++; const q = firstItem.q;
                let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
                let displayId = q.extId ? q.extId : (q.qid ? q.qid : '');
                
                let extractedBox = '';
                const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
                const boxMatch = preservedHTML.match(boxRegex);
                if (boxMatch) {
                    extractedBox = boxMatch[0];
                    preservedHTML = preservedHTML.replace(boxRegex, '');
                }
                let finalQText = toOneLine(preservedHTML).trim();
                
                firstItemHtml += idLine(displayId, q);
                firstItemHtml += `<div class="exam-q-title-row"><span class="exam-q-num">${numOf(q, qNum)}</span><span class="exam-q-text">${finalQText}</span></div>`;
                if (extractedBox) firstItemHtml += extractedBox;
                
                if(q.options && q.options.some(o=>o.trim())) {
                   let maxVisualLen = 0;
                   q.options.forEach(opt => {
                       const cleanOpt = String(opt).replace(/<[^>]*>?/gm, '');
                       let visualLen = 0;
                       for (let j = 0; j < cleanOpt.length; j++) {
                           visualLen += (cleanOpt.charCodeAt(j) > 127) ? 3 : 1;
                       }
                       if (visualLen > maxVisualLen) maxVisualLen = visualLen;
                   });
                   let gridClass = maxVisualLen <= 5 ? ' grid-5' : (maxVisualLen <= 10 ? ' grid-3' : (maxVisualLen <= 20 ? ' grid-2' : ' grid-1'));
                   
                   let optHtml = `<div class="exam-options${gridClass}">`;
                   q.options.forEach((opt, optIdx)=>{ 
                      if(opt.trim()) optHtml += `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[optIdx]}</span><span class="exam-opt-text">${sanitizeInlineHTML(opt)}</span></div>`; 
                   });
                   optHtml += `</div>`;
                   firstItemHtml += optHtml;
                }
            }

            // 범위 타이틀 + 공통 지문 + 첫 번째 문항을 하나의 묶음(wrapAvoid)으로 처리
            let multiFirstChunk = rangeHTML;
            if (combinedPassage) multiFirstChunk += makePBox(combinedPassage);
            multiFirstChunk += firstItemHtml;
            bodyHTML += wrapAvoid(multiFirstChunk);
            
            // 두 번째 문항부터 순차 루프
            group.items.forEach((item, i) => {
                if (i === 0) return; // 첫 번째 문항은 위에서 처리했으므로 건너뜀
                qNum++; const q = item.q;
                let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
                let displayId = q.extId ? q.extId : (q.qid ? q.qid : '');
                
                let extractedBox = '';
                const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
                const boxMatch = preservedHTML.match(boxRegex);
                if (boxMatch) {
                    extractedBox = boxMatch[0];
                    preservedHTML = preservedHTML.replace(boxRegex, '');
                }
                let finalQText = toOneLine(preservedHTML).trim();
                
                let qHtml = idLine(displayId, q);
                qHtml += `<div class="exam-q-title-row"><span class="exam-q-num">${numOf(q, qNum)}</span><span class="exam-q-text">${finalQText}</span></div>`;
                if (extractedBox) qHtml += extractedBox;
                
                if(q.options && q.options.some(o=>o.trim())) {
                   let maxVisualLen = 0;
                   q.options.forEach(opt => {
                       const cleanOpt = String(opt).replace(/<[^>]*>?/gm, '');
                       let visualLen = 0;
                       for (let j = 0; j < cleanOpt.length; j++) {
                           visualLen += (cleanOpt.charCodeAt(j) > 127) ? 3 : 1;
                       }
                       if (visualLen > maxVisualLen) maxVisualLen = visualLen;
                   });
                   let gridClass = maxVisualLen <= 5 ? ' grid-5' : (maxVisualLen <= 10 ? ' grid-3' : (maxVisualLen <= 20 ? ' grid-2' : ' grid-1'));
                   
                   qHtml += `<div class="exam-options${gridClass}">`;
                   q.options.forEach((opt, optIdx)=>{ 
                      if(opt.trim()) qHtml += `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[optIdx]}</span><span class="exam-opt-text">${sanitizeInlineHTML(opt)}</span></div>`; 
                   });
                   qHtml += `</div>`;
                }
                bodyHTML += wrapAvoid(qHtml);
                if(i < group.items.length - 1) bodyHTML += `<div style="height:8px;"></div>`;
            });
        } else {
            // 단일 문제 분절 로직
            group.items.forEach((item, i) => {
                qNum++; const q = item.q;
                let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
                let displayId = q.extId ? q.extId : (q.qid ? q.qid : '');
                
                let extractedBox = '';
                const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
                const boxMatch = preservedHTML.match(boxRegex);
                if (boxMatch) {
                    extractedBox = boxMatch[0];
                    preservedHTML = preservedHTML.replace(boxRegex, '');
                }
                let finalQText = toOneLine(preservedHTML).trim();
                
                let chunk1 = idLine(displayId, q);
                chunk1 += `<div class="exam-q-title-row"><span class="exam-q-num">${numOf(q, qNum)}</span><span class="exam-q-text">${finalQText}</span></div>`;
                if (extractedBox) chunk1 += extractedBox;
                if (combinedPassage) chunk1 += makePBox(combinedPassage);
                
                if(q.options && q.options.some(o=>o.trim())) {
                   let maxVisualLen = 0;
                   q.options.forEach(opt => {
                       const cleanOpt = String(opt).replace(/<[^>]*>?/gm, '');
                       let visualLen = 0;
                       for (let j = 0; j < cleanOpt.length; j++) {
                           visualLen += (cleanOpt.charCodeAt(j) > 127) ? 3 : 1;
                       }
                       if (visualLen > maxVisualLen) maxVisualLen = visualLen;
                   });
                   let gridClass = maxVisualLen <= 5 ? ' grid-5' : (maxVisualLen <= 10 ? ' grid-3' : (maxVisualLen <= 20 ? ' grid-2' : ' grid-1'));
                   
                   let optHtml = `<div class="exam-options${gridClass}">`;
                   q.options.forEach((opt, optIdx)=>{ 
                      if(opt.trim()) optHtml += `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[optIdx]}</span><span class="exam-opt-text">${sanitizeInlineHTML(opt)}</span></div>`; 
                   });
                   optHtml += `</div>`;
                   chunk1 += optHtml;
                }
                bodyHTML += wrapAvoid(chunk1);
            });
        }
        bodyHTML += `</div>`;
      });
  bodyHTML += '</div>';

              // [수정] 테이블 충돌 없이 매 페이지 상단 헤더(제목+QR), 하단 로고, 1페이지 메인 헤더 배치
  let qrUrl = siteQrSrc();
  let qrCap = '';
  if (qrQids && window.QR && typeof qrAssignUrl === 'function') {
    try {
      qrUrl = QR.dataUrl(qrAssignUrl(qrQids), { ecc: 'L', border: 1 });
      const ex = qrAssignExpiry();
      qrCap = isWeekly
        ? `<span class="running-qr-cap wk-qr-cap"><b>QR 찍고 정답 입력</b><br>${ex.getMonth() + 1}/${ex.getDate()}까지</span>`
        : `<span class="running-qr-cap">휴대폰으로 찍어<br>OMR 답 입력<br>(~${ex.getMonth() + 1}/${ex.getDate()})</span>`;
    } catch (e) { /* QR을 못 만들면 기존 그림 */ }
  }
  const logoUrl = 'https://' + 'i.imgur.com/NVHBqH2.png';

  const pageLayoutHTML = `
    <div class="k2-mode ${isWeekly ? 'wk-mode' : 'as-mode'}" style="position: relative; width: 100%; height: auto; --k2c: ${isWeekly ? '#1e3a5f' : '#2b6cb0'}; --k2l: ${isWeekly ? '#e8eef5' : '#e6f0fa'};">
      <div class="print-running-header no-print-img-bug">
        <span class="running-title-txt">${runningTitle}</span>
      </div>

      ${wkHeaderHTML}

      <div class="exam-body-wrap">
        <div class="wk-first-spacer" style="--sp:${spacerMm}mm;"></div>
        ${bodyHTML}
      </div>

      <div class="print-running-footer no-print-img-bug">
        <div class="running-qr-wrap"><img class="running-qr-img" src="${qrUrl}" alt="QR">${qrCap}</div>
        <img class="running-logo-img" src="${logoUrl}" alt="Logo">
      </div>
    </div>
  `;

  printZone.innerHTML = controlsHTML + pageLayoutHTML;

  const printStyle = document.createElement('style');
  printStyle.innerHTML = `
    /* 출력용 강력한 색상 보존 */
    #printSection .txt-red { color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .txt-blue { color: #2b6cb0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .txt-green { color: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .txt-orange { color: #d97706 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .exam-passage, .exam-q-box {
        font-family: "Times New Roman", serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        text-align: justify !important;
        background: transparent !important;
    }

    .exam-q-box {
        border: 1px solid #000 !important;
        padding: 10px !important;
        margin: 10px 0 !important;
        display: block !important;
    }

    /* 미리보기에서도 이미지를 미리 디코딩하도록 display:none 대신 투명 처리 */
    .print-running-header {
        display: flex;
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 12mm;
        padding: 0 20mm; /* 좌우 2cm 여백 */
        box-sizing: border-box;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
    }
    .running-title-txt {
        flex: 1;
        font-size: 10pt;
        font-weight: bold;
        color: #6b7280;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .print-running-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0;
        width: 100%;
        box-sizing: border-box;
    }
    #printSection .running-qr-wrap { display: flex; align-items: center; gap: 2mm; }
    #printSection .running-qr-cap { font-size: 7pt; line-height: 1.25; color: #374151; font-family: 'Malgun Gothic', sans-serif; }
    #printSection .running-qr-img,
    #printSection .running-logo-img {
        height: 11mm !important;
        max-height: 11mm !important;
        width: auto !important;
        margin: 0 !important;
        border: none !important;
        display: block !important;
        object-fit: contain !important;
    }

    @media print {
      @page { size: A4; margin: 10mm 15mm 10mm 15mm !important; }
      
      html, body { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; display: block !important; background: #fff !important; }
      #printSection { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }

      /* 매 페이지 상단 반복 헤더 (2페이지부터 노출, 좌우 2cm 여백 적용) */
      .print-running-header {
          display: flex !important;
          position: fixed !important;
          top: 0 !important;
          bottom: auto !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: 12mm !important;
          padding: 0 20mm !important;
          opacity: 1 !important;
          background: #ffffff !important;
          justify-content: center !important;
          align-items: center !important;
          border-bottom: 1px solid #ccc !important;
          z-index: 500 !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }

      /* 매 페이지 최하단 좌측 QR / 우측 학원 로고 고정 (하단 여백 최대 사이즈 11mm) */
      .print-running-footer {
          display: flex !important;
          position: fixed !important;
          top: auto !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: 11mm !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
          justify-content: space-between !important;
          align-items: flex-end !important;
          z-index: 500 !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }

      /* 1페이지 메인 헤더 */
      #printSection .exam-header {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 8px !important;
          background: #ffffff !important;
          z-index: 1000 !important;
          border-bottom: 2px solid #000 !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }

      /* 매 페이지 상단(18mm) 및 하단(12mm) 본문 여백 자동 확보 */
      .exam-body-wrap {
          display: block !important;
          width: 100% !important;
          padding-top: 18mm !important;
          padding-bottom: 12mm !important;
          -webkit-box-decoration-break: clone !important;
          box-decoration-break: clone !important;
          box-sizing: border-box !important;
      }

      .exam-columns {
          column-count: 2 !important;
          column-gap: 10mm !important;
          column-rule: 0.5px solid #ccc !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          height: auto !important;
          break-inside: auto !important;
          display: block !important;
      }

      .exam-q-block:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; border-bottom: none !important; }
      .no-print-img-bug img { max-height: 11mm !important; }

      .exam-q-block { 
          position: relative !important;
          margin-bottom: 12px !important;
          padding-left: 0 !important; 
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
      }

      .exam-q-range-title {
          font-family: "Malgun Gothic", sans-serif !important;
          font-weight: 800 !important;
          font-size: 14px !important;
          margin-left: 0 !important; 
          margin-bottom: 10px !important;
          display: block !important;
      }

      .exam-q-title-row {
          display: flex !important;
          align-items: baseline !important;
          min-height: 24px !important;
          margin-bottom: 2px !important;
          break-inside: avoid-column !important;
          page-break-inside: avoid !important;
      }

      .exam-q-num {
          margin-right: 10px !important;
          flex-shrink: 0 !important;
          text-align: left !important;
          font-family: "Malgun Gothic", sans-serif !important;
          font-weight: 800 !important;
          font-size: 20px !important;
      }

      .exam-q-text {
          font-size: 12px !important;
          display: block !important;
          line-height: 1.3 !important;
          margin-left: 0 !important;
          flex: 1 !important;
          word-break: keep-all !important;
          overflow-wrap: break-word !important;
      }

      .exam-q-id {
          display: flex !important;
          justify-content: space-between !important;
          font-size: 8px !important; color: #666 !important; margin-bottom: 2px !important;
      }

      .exam-passage, .exam-q-box, .exam-options {
          margin-left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
      }

      .exam-options {
          display: grid !important;
          gap: 4px 10px !important;
          margin-top: 8px !important;
          break-inside: avoid-column !important;
          page-break-inside: avoid !important;
      }
      .exam-options.grid-5 { grid-template-columns: repeat(5, 1fr) !important; }
      .exam-options.grid-3 { grid-template-columns: repeat(3, 1fr) !important; }
      .exam-options.grid-2 { grid-template-columns: repeat(2, 1fr) !important; }
      .exam-options.grid-1 { grid-template-columns: 1fr !important; }

      .exam-opt-row { 
          display: flex !important; 
          align-items: baseline !important;
          break-inside: avoid !important;
      }
      .exam-opt-num { 
          font-weight: bold !important; 
          margin-right: 5px !important;
          flex-shrink: 0 !important;
          font-family: "Malgun Gothic", sans-serif !important;
      }
      .exam-opt-text { 
          font-size: 12px !important;
          font-family: "Times New Roman", serif !important;
          line-height: 1.2 !important;
          word-break: keep-all !important;
          overflow-wrap: break-word !important;
      }
    }

    /* ===== K2 시험지 양식 (주간평가=남색 / 일반 과제=파란색, 색은 --k2c·--k2l) ===== */
    #printSection .wk-header { display: block; border: 2px solid var(--k2c); border-bottom: 2px solid var(--k2c); padding: 0; margin-bottom: 18px; background: #fff; }
    #printSection .wk-band { display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; background: var(--k2c); padding: 0 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .wk-band, #printSection .wk-band * { color: #fff !important; }
    #printSection .k2-title-row { display: flex; align-items: center; box-sizing: border-box; padding: 0 14px; border-bottom: 1px solid var(--k2c); overflow: hidden; }
    #printSection .k2-title { width: 100%; font-family: 'Malgun Gothic', sans-serif; font-weight: 800; line-height: 1.3; word-break: keep-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    #printSection .wk-brand { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; opacity: .85; }
    #printSection .wk-k2 { display: inline-block; background: #fff; color: var(--k2c) !important; padding: 0 5px; border-radius: 3px; letter-spacing: 0; margin-right: 2px; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .wk-band-title { font-family: 'Malgun Gothic', sans-serif; font-size: 14px; line-height: 1; font-weight: 900; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px; }
    #printSection .wk-lv { font-size: 10px; line-height: 1.2; font-weight: 700; border: 1px solid #fff; border-radius: 10px; padding: 0 7px; letter-spacing: 0; }
    #printSection .wk-info { width: 100%; border-collapse: collapse; table-layout: fixed; font-family: 'Malgun Gothic', sans-serif; }
    #printSection .wk-info th, #printSection .wk-info td { border-left: 1px solid var(--k2c); padding: 0 4px; font-size: 13px; text-align: center; height: 20px; }
    #printSection .wk-info th { width: 10%; background: var(--k2l); font-weight: 700; color: var(--k2c) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .wk-info tr > *:first-child { border-left: none; }
    #printSection .wk-info td { font-weight: 700; }
    #printSection .wk-info td.wk-name { width: 34%; font-size: 15px; }
    #printSection .k2-mode .exam-q-num {
        display: inline-flex !important; align-items: center !important; justify-content: center !important;
        min-width: 24px !important; height: 24px !important; padding: 0 4px !important; box-sizing: border-box !important;
        background: var(--k2c) !important; color: #fff !important; border-radius: 4px !important;
        font-size: 14px !important; font-weight: 800 !important; margin-right: 8px !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    #printSection .wk-qr-cap { font-size: 8pt !important; color: #1e3a5f !important; }
    /* 선택지 번호(①~⑤)를 본문보다 작게 */
    #printSection .k2-mode .exam-opt-num { font-size: 10.5px !important; font-weight: normal !important; width: auto !important; margin-right: 4px !important; }
    #printSection .k2-mode .exam-q-range-title { border-left: 4px solid var(--k2c); padding-left: 8px; }
    #printSection .k2-mode .exam-q-block { padding-top: 4px; }
    @media print {
      #printSection .k2-mode .exam-header.wk-header { border: 2px solid var(--k2c) !important; padding-bottom: 0 !important; background: #fff !important; }
      #printSection .k2-mode .exam-columns { column-rule: 1px solid var(--k2c) !important; }
      #printSection .k2-mode .running-title-txt { font-family: 'Malgun Gothic', sans-serif; }
      /* 1쪽: 머리글이 기본 양식보다 높아서 본문 시작을 그만큼 내립니다 */
      #printSection .k2-mode .wk-first-spacer { height: var(--sp, 7mm); }
    }
    /* ===== 쪽 나누기 (k2PaginateExam) =====
       한 쪽 = 위 18mm(반복 머리글) + 2단 본문 + 아래 12mm(QR·로고). 문항은 단 사이로는 나뉠 수 있지만 쪽 사이로는 넘기지 않습니다. */
    @media print {
      #printSection .exam-body-wrap.k2-paged { padding: 0 !important; -webkit-box-decoration-break: slice !important; box-decoration-break: slice !important; }
      #printSection .k2-paged .wk-first-spacer { display: none !important; }
      #printSection .exam-page { width: 180mm; height: 276mm; box-sizing: border-box; padding: 18mm 0 12mm; break-after: page; page-break-after: always; overflow: visible; position: relative; }
      #printSection .exam-page:last-child { break-after: auto; page-break-after: auto; }
      #printSection .exam-page.first { padding-top: calc(18mm + var(--sp, 0mm)); }
      #printSection .exam-page > .exam-columns { height: 100% !important; column-fill: auto !important; }
      #printSection .k2-measuring .exam-page > .exam-columns { height: calc(100% - 4mm) !important; } /* 잴 때는 4mm 여유를 둡니다 */
      #printSection .exam-page.oversize { height: auto; }
      #printSection .exam-page.oversize > .exam-columns { height: auto !important; column-fill: balance !important; }
      #printSection .exam-chunk { break-inside: auto !important; }
      #printSection .exam-chunk .exam-passage, #printSection .exam-chunk .exam-q-box,
      #printSection .exam-chunk .exam-options, #printSection .exam-chunk .exam-q-title-row { break-inside: avoid-column !important; }
    }
    /* 화면 미리보기: 쪽 경계를 점선으로 표시 (인쇄에는 영향 없음) */
    @media screen { #printSection .exam-page + .exam-page { border-top: 1px dashed #cbd5e1; margin-top: 10px; padding-top: 10px; } }
    #printSection .k2-mode .exam-q-id { margin-bottom: 3px !important; }
  `;
  printZone.appendChild(printStyle);

  // 정답지 및 이미지 처리 로직 (기존과 동일)
  const answerBtn = document.getElementById('btnPrintAnswers');
  if(answerBtn) answerBtn.onclick = () => renderAnswerSheetForPrint(qs, pageTitle, dateInput, studentName, qrQids, opts);
  const printBtn = document.getElementById('btnPrintAction');
  if (printBtn) {
      const images = printZone.querySelectorAll('img');
      let loadedCount = 0;
      const totalImages = images.length;
      const checkAllLoaded = () => {
          if (loadedCount >= totalImages) {
              k2PaginateExam(printZone);
              printBtn.disabled = false;
              printBtn.style.background = '#2563eb';
              printBtn.style.cursor = 'pointer';
              printBtn.innerHTML = '🖨️ 인쇄하기';
              printBtn.onclick = () => { setTimeout(() => { window.print(); }, 500); };
          }
      };
      if (totalImages === 0) checkAllLoaded();
      else {
          images.forEach(img => {
              if (img.complete) { loadedCount++; } 
              else {
                  img.addEventListener('load', () => { loadedCount++; checkAllLoaded(); }, { once: true });
                  img.addEventListener('error', () => { loadedCount++; checkAllLoaded(); }, { once: true });
              }
          });
          checkAllLoaded();
      }
  }
}

/* ===================== 시험지 쪽 나누기 =====================
 * 크롬은 2단 인쇄에서 "단 사이로는 나눠도 되고 쪽 사이로는 나누지 마라"를 CSS만으로 지켜 주지 않아서,
 * 인쇄 직전에 인쇄용 스타일을 잠깐 화면에 적용해 높이를 재고, 쪽(.exam-page)을 직접 만듭니다.
 *  1) 문항 묶음(연계 세트 포함)이 현재 쪽 남은 공간(왼쪽 단 남은 칸 + 오른쪽 단)에 들어가면 그 쪽에 둡니다.
 *     이때 단 사이로는 상자(지문·보기 상자·선택지) 단위로 나뉩니다.
 *  2) 안 들어가면 다음 쪽으로 넘깁니다.
 *  3) 묶음이 한 쪽보다 크면(긴 연계 세트) 문항 하나씩 같은 규칙으로 놓고,
 *     문항 하나가 한 쪽보다 크면 그 문항만 크롬이 알아서 나누게 둡니다.
 */
function _k2PrintOnlyCss() {
  let css = '';
  Array.from(document.styleSheets).forEach(sh => {
    let rules; try { rules = sh.cssRules; } catch (e) { return; }
    if (!rules) return;
    Array.from(rules).forEach(r => {
      if (r.type === CSSRule.MEDIA_RULE && /(^|[\s,])print([\s,]|$)/i.test(r.media.mediaText) && !/screen/i.test(r.media.mediaText)) {
        Array.from(r.cssRules).forEach(ir => { if (ir.type !== CSSRule.PAGE_RULE) css += ir.cssText + '\n'; });
      }
    });
  });
  return css;
}
function k2PaginateExam(printZone) {
  try {
    const wrap = printZone && printZone.querySelector('.exam-body-wrap');
    if (!wrap) return;
    // 처음 그린 상태(문항 묶음 목록)를 보관해 두고, 매번 거기서 다시 나눕니다.
    if (!wrap._k2Pristine) {
      const cols0 = wrap.querySelector(':scope > .exam-columns');
      if (!cols0) return;
      wrap._k2Pristine = Array.from(cols0.children).map(b => b.cloneNode(true));
    }
    // 나누는 동안 묶음을 쪼개 옮기므로, 매번 보관본을 복사해서 씁니다.
    const blocks = wrap._k2Pristine.map(b => b.cloneNode(true));
    const spacer = wrap.querySelector('.wk-first-spacer');
    const sp = spacer ? (spacer.style.getPropertyValue('--sp') || '0mm') : '0mm';

    // 인쇄용 스타일을 잠깐 화면에 적용 (같은 동기 실행 안에서 지우므로 화면에는 보이지 않습니다)
    const measure = document.createElement('style');
    measure.textContent = _k2PrintOnlyCss();
    document.head.appendChild(measure);
    wrap.classList.add('k2-paged', 'k2-measuring');

    // 기존 쪽/단 비우기
    Array.from(wrap.querySelectorAll(':scope > .exam-page, :scope > .exam-columns')).forEach(n => n.remove());

    const pages = [];
    let page = null, cols = null;
    const newPage = () => {
      page = document.createElement('div');
      page.className = 'exam-page' + (pages.length === 0 ? ' first' : '');
      if (pages.length === 0) page.style.setProperty('--sp', sp);
      cols = document.createElement('div');
      cols.className = 'exam-columns';
      page.appendChild(cols);
      wrap.appendChild(page);
      pages.push(page);
    };
    const overflow = () => cols.scrollWidth > cols.clientWidth + 2;
    newPage();
    if (cols.clientWidth < 50) { // 화면에 그릴 수 없는 상태 → 쪽 나누기를 하지 않고 원래 흐름으로
      wrap.classList.remove('k2-paged', 'k2-measuring');
      pages.forEach(p => p.remove());
      const c = document.createElement('div'); c.className = 'exam-columns';
      blocks.forEach(b => c.appendChild(b)); wrap.appendChild(c);
      measure.remove();
      return;
    }
    // 한 단보다 긴 상자(긴 지문 등)는 '단 안에 통째로' 규칙을 풀어 줍니다. 안 그러면 크롬이 어디에도 못 놓습니다.
    {
      const colH = cols.clientHeight;
      const colW = (cols.clientWidth - 38) / 2; // 단 너비 (단 간격 10mm ≈ 38px)
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:' + colW + 'px;';
      wrap.appendChild(probe);
      blocks.forEach(b => {
        probe.appendChild(b);
        b.querySelectorAll('.exam-passage, .exam-q-box, .exam-options').forEach(box => {
          if (box.offsetHeight > colH - 30) box.style.setProperty('break-inside', 'auto', 'important');
        });
        probe.removeChild(b);
      });
      probe.remove();
    }
    const pageEmpty = () => cols.children.length === 0;
    const makeOversize = () => { page.classList.add('oversize'); newPage(); };

    blocks.forEach(block => {
      // 1) 묶음 통째로
      cols.appendChild(block);
      if (!overflow()) return;
      cols.removeChild(block);
      if (!pageEmpty()) {
        newPage();
        cols.appendChild(block);
        if (!overflow()) return;
        cols.removeChild(block);
      }
      // 2) 한 쪽보다 큰 묶음 → 문항(조각) 하나씩
      const parts = Array.from(block.children);
      let shell = null;
      const freshShell = () => { shell = block.cloneNode(false); cols.appendChild(shell); };
      freshShell();
      parts.forEach(part => {
        shell.appendChild(part);
        if (!overflow()) return;
        shell.removeChild(part);
        if (shell.children.length === 0 && cols.children.length === 1) {
          // 빈 쪽에도 안 들어가는 문항: 이 쪽만 크롬이 자연스럽게 나누게 둡니다.
          shell.appendChild(part);
          makeOversize(); freshShell();
          return;
        }
        if (shell.children.length === 0) cols.removeChild(shell);
        newPage(); freshShell();
        shell.appendChild(part);
        if (overflow()) { makeOversize(); freshShell(); }
      });
      if (shell && shell.children.length === 0 && shell.parentNode) shell.parentNode.removeChild(shell);
    });
    // 빈 마지막 쪽 정리
    while (pages.length > 1 && pages[pages.length - 1].querySelector('.exam-columns').children.length === 0) pages.pop().remove();

    wrap.classList.remove('k2-measuring');
    measure.remove();
  } catch (e) {
    console.warn('쪽 나누기 실패, 기본 흐름으로 인쇄합니다.', e);
  }
}
// 인쇄 직전에 한 번 더 (이미지가 늦게 뜬 경우 등)
if (!window.__k2PaginateHooked) {
  window.__k2PaginateHooked = true;
  window.addEventListener('beforeprint', () => {
    const z = document.getElementById('printSection');
    if (z && z.querySelector('.exam-body-wrap')) k2PaginateExam(z);
  });
}

/* 정답지 출력용 렌더링 함수 추가 */
function renderAnswerSheetForPrint(qs, pageTitle, dateInput, studentName, qrQids, opts) {
  const printZone = document.getElementById('printSection');
  printZone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  printZone.innerHTML = '';

  // [보조 함수] 인쇄용 정답 태그 변환
  const formatPrintAns = (ans) => {
    if (!ans) return '-';
    
    // [추가] 정답지에서도 색상 태그가 렌더링되도록 변환
    let processed = ans
        .replace(/<red>/gi, '<span class="txt-red">').replace(/<\/red>/gi, '</span>')
        .replace(/<blue>/gi, '<span class="txt-blue">').replace(/<\/blue>/gi, '</span>')
        .replace(/<green>/gi, '<span class="txt-green">').replace(/<\/green>/gi, '</span>')
        .replace(/<orange>/gi, '<span class="txt-orange">').replace(/<\/orange>/gi, '</span>');

    // || 구분자가 없는 단일 문장은 기호([]) 포함 그대로 출력
    if (!processed.includes('||')) return processed;
    
    // 서술형 (A) (B) 칸이 나뉜 경우에만 줄바꿈 처리
    const labels = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)'];
    return processed.split('||').map((v, i) => `<div style="margin-top:3px;"><b>${labels[i]}</b> ${v.trim()}</div>`).join('');
  };

  const controlsHTML = `
    <div class="print-controls no-print" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
      <div style="font-size: 16px; font-weight: bold;">🖥️ 정답지 미리보기</div>
      <div style="display:flex; gap:10px;">
        <button id="btnBackToQuestions" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">📄 문제지 보기</button>
        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">🖨️ 인쇄하기</button>
        <button onclick="closePrintPreview()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height: 60px;"></div>
  `;

  // 헤더 및 테이블 구조 (기존 유지하되 내용물 가공)
              let dateStr = dateInput ? dateInput : (new Date().getMonth() + 1) + '월 ' + new Date().getDate() + '일';
              
              // [글자 수 기반 폰트 크기 계산]
              const rawTitle = pageTitle ? pageTitle : '문제 제목';
              const titleLen = (rawTitle + " (정답지)").length;
              let titleFontSize = 18;
              if (titleLen > 85) titleFontSize = 10;
              else if (titleLen > 70) titleFontSize = 12;
              else if (titleLen > 60) titleFontSize = 14;
              else if (titleLen > 50) titleFontSize = 16;

              const headerHTML = `
                <div class="exam-header" style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px;">
                  <div style="flex: 1; margin-right: 15px; height: 50px; display: flex; align-items: flex-end;">
                    <div style="font-size: ${titleFontSize}px; font-weight: bold; text-align: left; line-height: 1.3; width: 100%; word-break: keep-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                      ${sanitizeInlineHTML(rawTitle)} (정답지)
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; justify-content: space-between; height: 50px; text-align: right; margin-right: 15px; font-size: 17px; font-weight: bold; line-height: 1.1;">
                    <div>${dateStr}</div>
                    <div>${studentName ? sanitizeInlineHTML(studentName) : '이름: _________'}</div>
                  </div>
                  <div style="font-size:0; height: 50px; width: 50px;"></div>
                </div>
              `;

              let bodyHTML = '<table style="width:100%; border-collapse: collapse; font-size:13px;"><tbody><tr>';
  
  qs.forEach((q, idx) => {
    if (idx > 0 && idx % 5 === 0) bodyHTML += '</tr><tr>'; // 정답이 길어질 수 있으므로 한 행에 4개로 조정 (기존 5개)
    
    const displayAns = formatPrintAns(String(q.answer || '').trim());
    
    bodyHTML += `<td style="padding: 18px 5px; border-bottom: 1px solid #eee; width: 20%; vertical-align: top; word-break: keep-all; overflow-wrap: break-word;">
              <div style="display: flex; align-items: flex-start;">
                <!-- 번호가 들어가는 곳: 25px 너비 고정 -->
                <span style="font-weight:bold; min-width:25px; color:#374151; font-size:13px;">${(q && q._printNum) ? q._printNum : idx + 1}.</span> 
                
                <!-- 정답이 들어가는 곳: 나머지 공간(flex:1)을 다 쓰면서 자동 줄바꿈 -->
                <span style="color:#dc2626; font-weight:bold; font-size:13px; line-height: 1.4; flex: 1;">${displayAns}</span>
              </div>
            </td>`;
  });

  bodyHTML += '</tr></tbody></table>';

              // [테이블 반복 기법 적용] 정답지도 표(Table)로 감싸고 1페이지 가림막 삽입
              const tableWrapperHTML = `
                <div style="position: relative; width: 100%; height: auto;">
                    <div class="first-page-cover"></div>
                    <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 0;">
                        <thead>
                            <tr>
                                <td style="padding: 0; border: none; height: 12mm;">
                                    <div class="print-table-header no-print-img-bug">
                                        <span style="flex: 1; font-size: 10pt; font-weight: bold; color: #6b7280; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitizeInlineHTML(rawTitle)} (정답지)</span>
                                    </div>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 0; border: none;">
                                    ${headerHTML}
                                    ${bodyHTML}
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style="padding: 0; border: none; height: 12mm;">
                                    <div class="print-table-footer no-print-img-bug">
                                        <img src="${siteQrSrc()}" style="height: 11mm !important; width: auto !important; max-height: 11mm !important; object-fit: contain; margin: 0 !important;" alt="QR">
                                        <img src="https://i.imgur.com/NVHBqH2.png" style="height: 11mm !important; width: auto !important; max-height: 11mm !important; object-fit: contain; margin: 0 !important;" alt="Logo">
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              `;
              printZone.innerHTML = controlsHTML + tableWrapperHTML;

              // [테이블 반복 기법 적용] 정답지용 CSS
              const ansPrintStyle = document.createElement('style');
              ansPrintStyle.innerHTML = `
                .print-table-header {
                    display: flex; align-items: center; justify-content: center; height: 12mm; padding: 0 20mm; box-sizing: border-box; overflow: hidden; border-bottom: 1px solid #ccc;
                }
                .print-table-footer {
                    display: flex; justify-content: space-between; align-items: flex-end; height: 11mm; overflow: hidden;
                }
                @media print {
                  @page { margin: 10mm 15mm 10mm 15mm !important; }
                  /* 빈 페이지 방지용 높이/여백 강제 초기화 */
                  html, body { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; display: block !important; }
                  #printSection { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
                  table { page-break-after: avoid !important; page-break-inside: auto !important; margin-bottom: 0 !important; border-spacing: 0 !important; width: 100% !important; }
                  tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                  
                  /* 빈 페이지 버그 방지: height: max-content 강제 할당 제거 */
                  .exam-columns { margin-bottom: 0 !important; padding-bottom: 0 !important; break-inside: auto !important; display: block !important; }
                  .exam-q-block:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; border-bottom: none !important; }
                  
                  /* 테이블 내 헤더/푸터 스타일 */
                  .print-table-header {
                      display: flex !important; align-items: center !important; justify-content: center !important; height: 12mm !important; padding: 0 20mm !important; box-sizing: border-box !important; overflow: hidden !important; border-bottom: 1px solid #ccc !important;
                  }
                  .print-table-footer {
                      display: flex !important; justify-content: space-between !important; align-items: flex-end !important; height: 11mm !important; overflow: hidden !important;
                  }
                  
                  /* 1페이지 상단 테이블 헤더 가림막 */
                  .first-page-cover {
                      position: absolute; top: 0; left: 0; right: 0;
                      height: 13mm; background: white !important;
                      -webkit-print-color-adjust: exact; print-color-adjust: exact;
                      z-index: 110;
                  }

                  /* 1페이지 메인 헤더 */
                  .exam-header {
                      position: relative !important; background: transparent !important; z-index: 120 !important;
                      margin-top: -12mm !important; padding-top: 0 !important;
                      -webkit-print-color-adjust: exact; print-color-adjust: exact;
                  }
                  .no-print-img-bug img { max-height: 11mm !important; }
                }
              `;
              printZone.appendChild(ansPrintStyle);
              document.getElementById('btnBackToQuestions').onclick = () => renderQuestionsForPrint(qs, pageTitle, dateInput, studentName, qrQids, opts);
}

/* 닫기 버튼용 함수 */
function closePrintPreview(){
  const printZone = document.getElementById('printSection');
  printZone.style.display = 'none';
  printZone.innerHTML = '';
}

// 혹시 모르니 window 객체에 등록
window.closePrintPreview = closePrintPreview;

/* ===================== [신규] 주간평가 리포트 로직 ===================== */
let chartRadarInst = null;
let chartLineInst = null;

function fitReportToOnePage() {
    const paper = document.getElementById('reportPaper');
    const inner = document.getElementById('rpInner');
    if (!paper || !inner) return;
    inner.style.transform = ''; inner.style.width = '';
    const cs = getComputedStyle(paper);
    const avail = paper.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const need = inner.scrollHeight;
    if (need <= avail) return;
    const k = Math.max(0.6, avail / need);
    inner.style.width = (100 / k) + '%';
    inner.style.transform = `scale(${k})`;
}

function openWeeklyReport(assignmentId, isSharedMode = false) {
    const printZone = document.getElementById('printSection');
// 로딩 표시
    const loadEl = document.getElementById('loadingOverlay');
if(loadEl) { 
        loadEl.querySelector('.loading-text').innerHTML = '학습 리포트를 생성 중입니다...';
        loadEl.classList.add('active');
}

    google.script.run.withSuccessHandler(res => {
        if(loadEl) loadEl.classList.remove('active');
        if(res.error) { showCustomAlert(res.error); return; }
        
        // 1. 인쇄 영역(printSection) 보이기 및 스타일 초기화
        printZone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#f3f4f6; z-index:9999; overflow-y:auto;";
        
        // 2. 상단 컨트롤 바 (공유 모드일 때는 버튼 숨김, 관리자일 때는 카톡 버튼 추가)
        let controlsHTML = '';
        if (isSharedMode) {
            controlsHTML = `
              <div class="print-controls no-print" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                <div style="font-size: 16px; font-weight: bold;">📊 케이투학원 주간평가 리포트</div>
              </div>
              <div class="print-controls no-print" style="height: 60px;"></div>
            `;
        } else {
            const btnStyle = "width: 88px; padding: 6px 0; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; white-space: nowrap; flex-shrink: 0; text-align: center; box-sizing: border-box;";
            controlsHTML = `
              <div class="print-controls no-print" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                <div style="font-size: 16px; font-weight: bold;">🖥️ 리포트 미리보기</div>
                <div style="display:flex; gap:6px;">
                  <button onclick="shareKakao(${jsArgAttr(assignmentId)}, ${jsArgAttr(res.meta.name)}, ${jsArgAttr(res.meta.score)})" style="background: #FEE500; color: #000; ${btnStyle}">💬 카톡 공유</button>
                  <button onclick="downloadReportImage(${jsArgAttr(res.meta.title)}, ${jsArgAttr(res.meta.name)}, this)" style="background: #10b981; color: white; ${btnStyle}">🖼️ 이미지 저장</button>
                  <button onclick="window.print()" style="background: #2563eb; color: white; ${btnStyle}">🖨️ 인쇄</button>
                  <button onclick="closePrintPreview()" style="background: #dc2626; color: white; ${btnStyle}">닫기</button>
                </div>
              </div>
              <div class="print-controls no-print" style="height: 60px;"></div>
            `;
        }

// [추가] 과제 제목에서 'N월 N주차' 정보만 추출
        const weekMatch = String(res.meta.title).match(/\d+월\s*\d+주차/);

        // [신규] 과제 제목에서 'Lv.N' 정보 추출 및 난이도 UI 동적 생성
        const levelMatch = String(res.meta.title).match(/Lv\.(\d+)/i);
        const levelVal = levelMatch ? parseInt(levelMatch[1], 10) : 0;
        let levelUIHtml = '';
        
        if (levelVal > 0) {
            const safeLevel = Math.max(1, Math.min(15, levelVal));
            // 1~15단계를 0% ~ 100% 백분율로 매핑 (점 위치 계산)
            const percent = ((safeLevel - 1) / 14) * 100;
            
            // 5단계 명칭 매핑
            let stageName = '';
            if (safeLevel <= 3) stageName = 'Essential';
            else if (safeLevel <= 6) stageName = 'Intermediate';
            else if (safeLevel <= 9) stageName = 'Advanced';
            else if (safeLevel <= 12) stageName = 'Expert';
            else stageName = 'Mastery';
            
            levelUIHtml = `
              <div style="margin: 38px 0 26px 0;">
                  <div style="position: relative; width: 100%; height: 12px; border-radius: 6px; background: linear-gradient(to right, #3b82f6, #10b981, #f59e0b, #ef4444); box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);">
                      
                      <div style="position: absolute; left: ${percent}%; top: 50%; transform: translate(-50%, -50%); z-index: 10; display: flex; flex-direction: column; align-items: center;">
                          <div class="rp-dark" style="position: absolute; bottom: 18px; background: #111827; color: #fff; font-size: 13px; font-weight: bold; padding: 6px 10px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                              목표 난이도: Lv.${safeLevel} (${stageName})
                              <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #111827;"></div>
                          </div>
                          <div style="width: 22px; height: 22px; background: #fff; border: 5px solid #111827; border-radius: 50%; box-sizing: border-box; box-shadow: 0 0 0 2px rgba(255,255,255,0.8);"></div>
                      </div>
                  </div>
                  <div style="position: relative; margin-top: 12px; height: 15px; font-size: 11px; font-weight: bold; color: #6b7280;">
                      <div style="position: absolute; left: 0%; transform: translateX(0%);">Essential</div>
                      <div style="position: absolute; left: 25%; transform: translateX(-50%);">Intermediate</div>
                      <div style="position: absolute; left: 50%; transform: translateX(-50%);">Advanced</div>
                      <div style="position: absolute; left: 75%; transform: translateX(-50%);">Expert</div>
                      <div style="position: absolute; left: 100%; transform: translateX(-100%);">Mastery</div>
                  </div>
              </div>
            `;
        }

        // [유형별 결과] 이번 시험에 실제로 나온 유형만 보여 줍니다(시험마다 유형 구성이 다르므로 고정 축을 쓰지 않습니다).
        // 누적 = 최근 주간평가(이번 포함, 최대 5회)에서 같은 유형을 합산한 정답률. 서버가 주지 않으면(옛 Code.gs) 이번 시험만 씁니다.
        const prev = res.prev || null;
        let typeStats = res.typeStats;
        if (!typeStats) {
            typeStats = {};
            res.questions.forEach(q => { const t = q.type || '기타'; (typeStats[t] = typeStats[t] || { total: 0, correct: 0 }).total++; if (q.isCorrect) typeStats[t].correct++; });
        }
        const typeCum = res.typeCum || null;
        const cumCount = res.cumCount || 0;
        const TYPE_ORDER = ['목적','심경','주장','함축','요지','주제','제목','도표','내용일치','실용문','어법','어휘','빈칸','무관','흐름','순서','삽입','요약','장문'];
        const typeRank = t => { if (/장문/.test(t)) return TYPE_ORDER.length - 1; const i = TYPE_ORDER.findIndex(k => String(t).indexOf(k) >= 0); return i < 0 ? 99 : i; };
        const typeLabels = Object.keys(typeStats).sort((a, b) => typeRank(a) - typeRank(b) || a.localeCompare(b));
        const pct = s => (s && s.total ? Math.round(s.correct / s.total * 100) : null);
        const barColor = v => v >= 80 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444';

        let prevScoreHtml = '';
        if (prev) {
            const d = res.meta.score - prev.score;
            const col = d > 0 ? '#059669' : d < 0 ? '#dc2626' : '#6b7280';
            const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '-';
            prevScoreHtml = `<div class="rp-prev">지난 평가(${escapeHTML(prev.date)}) ${prev.score}점 <strong style="color:${col};">${arrow}${d ? Math.abs(d) : ''}</strong></div>`;
        }

        const showCum = typeCum && cumCount > 1;
        const typeRowsHtml = typeLabels.map(t => {
            const s = typeStats[t], v = pct(s);
            const cs = showCum ? typeCum[t] : null, cv = pct(cs);
            const cumHtml = showCum ? `<span class="rp-cum">${cv == null ? '-' : cv + '%'}</span>` : '';
            const cumMark = (showCum && cv != null) ? `<i class="rp-cum-mark" style="left:${cv}%;" title="누적 ${cv}%"></i>` : '';
            return `<div class="rp-type-row">
                <span class="rp-type-name">${escapeHTML(t)}</span>
                <span class="rp-bar"><b style="width:${Math.max(v, 2)}%; background:${barColor(v)};"></b>${cumMark}</span>
                <span class="rp-type-cnt"><b>${s.correct}</b>/${s.total}</span>
                ${cumHtml}
            </div>`;
        }).join('');
        const typeHeadHtml = `<div class="rp-type-row rp-type-head"><span class="rp-type-name">유형</span><span style="flex:1;">이번 평가 정답률</span><span class="rp-type-cnt" style="color:#6b7280;">맞힘</span>${showCum ? '<span class="rp-cum" style="color:#6b7280; font-weight:600;">누적</span>' : ''}</div>`;
        const typeLegendHtml = `<div class="rp-legend">이번 평가에 나온 유형만 표시합니다. 막대 = 이번 평가 정답률${showCum ? ` · <i class="rp-cum-mark rp-cum-mark-inline"></i> 및 오른쪽 % = 최근 ${cumCount}회 누적 정답률` : ''}</div>`;

        // 잘한 유형 / 보완할 유형 자동 요약 (이번 평가 기준)
        const strong = typeLabels.filter(t => typeStats[t].total && typeStats[t].correct === typeStats[t].total);
        const weak = typeLabels.filter(t => { const v = pct(typeStats[t]); return v != null && v < 50; });
        const listOrDash = arr => arr.length ? arr.map(t => `<span class="rp-tag">${escapeHTML(t)}</span>`).join(' ') : '<span style="color:#9ca3af;">-</span>';
        const summaryHtml = `
            <div class="rp-sum-row"><div class="rp-sum-k" style="color:#059669;">잘한 유형</div><div>${listOrDash(strong)}</div></div>
            <div class="rp-sum-row"><div class="rp-sum-k" style="color:#dc2626;">보완할 유형</div><div>${listOrDash(weak)}</div></div>
            <div class="rp-sum-note">보완할 유형은 다음 주 수업과 과제에서 집중적으로 다룹니다.</div>`;

        // 문항별 결과: 좌우 두 칸으로 나눠 한 장에 들어가게 합니다.
        const qRow = q => `<tr class="${q.isCorrect ? '' : 'rp-wrong'}">
            <td>${q.no}</td><td style="text-align:left; padding-left:8px;">${escapeHTML(q.type)}</td><td>${escapeHTML(String(q.difficulty))}</td>
            <td>${q.isCorrect ? '<span class="rp-o">O</span>' : '<span class="rp-x">X</span>'}</td></tr>`;
        const half = Math.ceil(res.questions.length / 2);
        const qTable = list => `<table class="rp-qtable"><thead><tr><th style="width:14%;">번호</th><th>유형</th><th style="width:18%;">난이도</th><th style="width:16%;">결과</th></tr></thead><tbody>${list.map(qRow).join('')}</tbody></table>`;

        // 4. 리포트 본문 HTML 구성 (A4 한 장)
        const reportHTML = `
          <style>
             #reportPaper { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; }
             #reportPaper .rp-sec { font-size:15px; font-weight:800; color:#1e3a5f; margin:0 0 8px; display:flex; align-items:baseline; gap:8px; }
             #reportPaper .rp-sec:before { content:''; display:inline-block; width:4px; height:14px; background:#1e3a5f; border-radius:2px; transform:translateY(2px); }
             #reportPaper .rp-score { background:#f1f5f9; border-radius:10px; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
             #reportPaper .rp-prev { font-size:13px; color:#4b5563; white-space:nowrap; }
             #reportPaper .rp-types { display:grid; grid-template-columns:1fr 1fr; gap:6px 28px; }
             #reportPaper .rp-type-head { font-size:10.5px; color:#6b7280; height:14px; border-bottom:1px solid #e5e7eb; padding-bottom:3px; }
             #reportPaper .rp-type-head .rp-type-name { font-weight:600; color:#6b7280; }
             #reportPaper .rp-type-row { display:flex; align-items:center; gap:8px; font-size:12.5px; height:20px; }
             #reportPaper .rp-type-name { width:74px; flex-shrink:0; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
             #reportPaper .rp-bar { flex:1; height:10px; background:#e5e7eb; border-radius:5px; position:relative; overflow:visible; }
             #reportPaper .rp-bar > b { display:block; height:100%; border-radius:5px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
             #reportPaper .rp-cum-mark { position:absolute; top:-3px; width:3px; height:16px; background:#1e3a5f; border-radius:1px; transform:translateX(-50%); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
             #reportPaper .rp-cum-mark-inline { position:relative; display:inline-block; top:3px; height:12px; transform:none; }
             #reportPaper .rp-type-cnt { width:34px; text-align:right; color:#6b7280; flex-shrink:0; }
             #reportPaper .rp-type-cnt b { color:#111827; }
             #reportPaper .rp-cum { width:36px; text-align:right; color:#1e3a5f; font-size:11px; font-weight:700; flex-shrink:0; }
             #reportPaper .rp-legend { font-size:10.5px; color:#6b7280; margin-top:8px; }
             #reportPaper .rp-box { border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; box-sizing:border-box; }
             #reportPaper .rp-tag { display:inline-block; border:1px solid #d1d5db; border-radius:10px; padding:0 7px; margin:0 2px 4px 0; font-size:11.5px; background:#f9fafb; }
             #reportPaper .rp-sum-row { display:flex; gap:10px; margin-bottom:8px; font-size:12px; }
             #reportPaper .rp-sum-k { width:70px; flex-shrink:0; font-weight:800; padding-top:2px; }
             #reportPaper .rp-sum-note { font-size:11px; color:#6b7280; border-top:1px dashed #e5e7eb; padding-top:8px; margin-top:4px; }
             #reportPaper .rp-qtable { width:100%; border-collapse:collapse; font-size:12px; text-align:center; }
             #reportPaper .rp-qtable thead tr { background:#f1f5f9; border-top:2px solid #1e3a5f; border-bottom:1px solid #1e3a5f; height:26px; }
             #reportPaper .rp-qtable tbody tr { border-bottom:1px solid #eee; height:22px; }
             #reportPaper .rp-qtable tr.rp-wrong { background:#fef2f2; }
             #reportPaper .rp-o { color:#059669; font-weight:900; }
             #reportPaper .rp-x { color:#dc2626; font-weight:900; }
             @media print {
                 @page { size: A4; margin: 10mm; }
                 body, html { margin: 0; padding: 0; }
                 #printSection { overflow: hidden !important; }
                 #reportPaper { margin: 0 !important; box-shadow: none !important; width: 190mm !important; height: 277mm !important; padding: 0 !important; overflow: hidden !important; page-break-after: avoid; page-break-inside: avoid; }
                 /* print.css가 모든 글자를 검정으로 바꾸므로 어두운 바탕 위 글자는 흰색으로 되돌립니다 */
                 #printSection #reportPaper .rp-head-band, #printSection #reportPaper .rp-head-band *,
                 #printSection #reportPaper .rp-dark, #printSection #reportPaper .rp-dark * { color: #fff !important; }
                 #printSection #reportPaper * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                 #printSection #reportPaper .rp-o { color: #059669 !important; }
                 #printSection #reportPaper .rp-x { color: #dc2626 !important; }
             }
          </style>
          <div id="reportPaper" style="background:#fff; width:210mm; height:297mm; padding:10mm; margin:20px auto; box-shadow:0 0 20px rgba(0,0,0,0.2); position:relative; box-sizing:border-box; color:#111827; overflow:hidden;">
            <div id="rpInner" style="transform-origin:top left;">

              <div class="rp-head-band" style="background:#1e3a5f; border-radius:10px; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; color:#fff;">
                  <div>
                      <div style="font-size:11px; font-weight:700; letter-spacing:3px; opacity:.8;">K2 WEEKLY REPORT</div>
                      <div style="font-size:25px; font-weight:900; letter-spacing:-1px; margin-top:2px;">주간 학습 리포트${weekMatch ? ` <span style="font-size:17px; font-weight:700; opacity:.85;">${escapeHTML(weekMatch[0])}</span>` : ''}</div>
                  </div>
                  <div style="text-align:right;">
                      <div style="font-size:11px; opacity:.8;">${escapeHTML(res.meta.date || '')}</div>
                      <div style="font-size:25px; font-weight:900;">${escapeHTML(res.meta.name)}</div>
                  </div>
              </div>

              ${levelUIHtml || '<div style="height:18px;"></div>'}

              <div class="rp-score">
                  <div style="font-size:17px; font-weight:800; color:#1e3a5f;">이번 주 성취도</div>
                  <div style="display:flex; align-items:baseline; gap:16px;">
                      <div style="font-size:14px; color:#4b5563;">맞은 개수 <strong style="color:#111827;">${res.meta.correctCount}</strong> / ${res.meta.totalCount}</div>
                      <div style="font-size:30px; font-weight:900; color:#2563eb;">${res.meta.score}<span style="font-size:16px;">점</span></div>
                      ${prevScoreHtml}
                  </div>
              </div>

              <div style="margin-bottom:18px;">
                  <div class="rp-sec">유형별 결과</div>
                  <div class="rp-box">
                      <div class="rp-types">${typeHeadHtml}${typeLabels.length > 1 ? typeHeadHtml : ''}${typeRowsHtml}</div>
                      ${typeLegendHtml}
                  </div>
              </div>

              <div style="display:flex; gap:16px; margin-bottom:18px; align-items:stretch;">
                  <div class="rp-box" style="width:55%;">
                      <div class="rp-sec" style="margin-bottom:4px;">최근 성적 변화</div>
                      <div style="height:150px; position:relative;"><canvas id="chartLine"></canvas></div>
                  </div>
                  <div class="rp-box" style="width:45%;">
                      <div class="rp-sec">이번 주 한눈에 보기</div>
                      ${summaryHtml}
                  </div>
              </div>

              <div>
                  <div class="rp-sec">문항별 결과</div>
                  <div style="display:flex; gap:16px; align-items:flex-start;">
                      <div style="flex:1;">${qTable(res.questions.slice(0, half))}</div>
                      <div style="flex:1;">${qTable(res.questions.slice(half))}</div>
                  </div>
              </div>
            </div>
          </div>
        `;

        // 5. 생성한 HTML을 화면(printSection)에 투입
        printZone.innerHTML = controlsHTML + reportHTML;

        // 6. 최근 성적 변화 그래프
        if(chartRadarInst) { chartRadarInst.destroy(); chartRadarInst = null; }
        if(chartLineInst) chartLineInst.destroy();
        const ctxLine = document.getElementById('chartLine').getContext('2d');
        chartLineInst = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: res.trend.map(t => t.label),
                datasets: [{
                    label: '점수',
                    data: res.trend.map(t => t.score),
                    borderColor: '#1e3a5f', backgroundColor: '#1e3a5f', borderWidth: 2, tension: 0.1, pointRadius: 4
                }]
            },
            options: { animation: false, responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { borderDash: [2, 2] } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
        });

        // 7. 한 장 맞춤: 유형·문항이 많아 A4(여백 제외 277mm)를 넘으면 내용 전체를 비율대로 줄입니다.
        fitReportToOnePage();

    }).withFailureHandler(err => {
        if(loadEl) loadEl.classList.remove('active');
        showCustomAlert('리포트 생성 실패: ' + err);
    }).getWeeklyReportData(assignmentId);
}


// [추가] 카카오톡 공유 API 실행 함수
function shareKakao(assignmentId, studentName, score) {
    const KAKAO_KEY = '여기에_발급받을_자바스크립트_키를_넣으세요'; // 추후 변경 필요
    
    if (KAKAO_KEY === '여기에_발급받을_자바스크립트_키를_넣으세요') {
        showCustomAlert('카카오 API 키가 아직 설정되지 않았습니다.\n코드를 수정한 뒤 다시 시도해 주십시오.');
        return;
    }

    if (!Kakao.isInitialized()) {
        Kakao.init(KAKAO_KEY);
    }

    google.script.url.getLocation(function(location) {
        // 현재 배포된 웹앱 주소에서 파라미터 부분을 제외한 순수 Base URL 추출
        const baseUrl = location.href.split('?')[0]; 
        const shareUrl = baseUrl + '?report=' + assignmentId;

        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: '케이투학원 주간 학습 리포트',
            description: studentName + ' 학생의 이번 주 평가 결과가 도착했습니다. (점수: ' + score + '점)',
            imageUrl: 'https://i.imgur.com/aXAiKUV.jpeg', // 현재 난이도 가이드용 이미지를 임시 썸네일로 사용
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
          buttons: [
            {
              title: '결과 리포트 확인하기',
              link: {
                mobileWebUrl: shareUrl,
                webUrl: shareUrl,
              },
            },
          ],
        });
    });
}

function downloadReportImage(title, studentName, btnEl) {
    const target = document.getElementById('reportPaper');
    if (!target) return;

    const btn = btnEl || (window.event && window.event.currentTarget);
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ 처리 중...';
    btn.disabled = true;

    const weekMatch = String(title).match(/(\d+)주차/);
    const weekStr = weekMatch ? weekMatch[1] + '주차' : '';

    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = yy + mm + dd;

    const fileName = `${weekStr}주간평가리포트_${studentName}(${dateStr}).png`;

    html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        btn.innerHTML = originalText;
        btn.disabled = false;
    }).catch(err => {
        showCustomAlert('이미지 렌더링 중 오류가 발생했습니다.');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}
