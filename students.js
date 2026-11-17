/* ===================== 👥 학생 관리 (관리자) =====================
 * 목록(검색·담당·상태 필터) · 추가(한 명 / 여러 명 붙여넣기) · 정보 변경 · 휴원 · 담당 일괄 변경 · 삭제
 * 서버: adminListStudents / adminAddStudents / adminUpdateStudent / adminUpdateStudents /
 *       adminStudentDataSummary / adminDeleteStudent  (Code.gs [학생 관리])
 * - ID는 바꾸지 않습니다. 풀이 기록·과제·포인트·단어장이 모두 ID로 이어져 있습니다.
 */
window.STM = (function () {
  const S = { data: null, q: '', mgr: 'mine', status: '재원', sel: new Set(), busy: false, bound: false };
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const me = () => (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER : null;
  const auth = () => { const u = me(); return { id: u ? u.id : '', token: u ? (u.token || '') : '' }; };
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(esc(m), t || 'info'); };
  const alertMsg = m => { if (typeof showCustomAlert === 'function') showCustomAlert(esc(m)); else alert(m); };
  const ID_RE = /^[0-9A-Za-z가-힣_.\-]{2,30}$/;

  function call(fn, args) {
    return gsCall(fn, args).catch(err => {
      let m = String(err && err.message ? err.message : err).replace(/^Error:\s*/, '');
      if (typeof isMissingServerFunction === 'function' && isMissingServerFunction(m)) m = '구글 스크립트(Code.gs)를 새 버전으로 배포해야 학생 관리를 쓸 수 있습니다.';
      throw new Error(m);
    });
  }
  function busy(btn, p) {
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '처리 중...'; }
    return p.finally(() => { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; } });
  }
  const mgrName = id => { const m = S.data && S.data.managers.find(x => x.id === id); return m ? m.name : (id ? id : ''); };

  /* ---------- 화면 틀 ---------- */
  function shell() {
    const page = $('studentsPage');
    if (!page || page.dataset.ready) return;
    page.dataset.ready = '1';
    page.innerHTML = `
      <div class="stm-head">
        <h2>👥 학생 관리</h2>
        <div class="stm-head-btns">
          <button type="button" class="stm-btn" data-stm="reload" title="새로 고침">↻</button>
          <button type="button" class="stm-btn" data-stm="paste">📋 여러 명 추가</button>
          <button type="button" class="stm-btn stm-primary" data-stm="add">＋ 학생 추가</button>
        </div>
      </div>
      <div class="stm-filters">
        <input type="search" id="stmQ" placeholder="이름·ID·메모 검색" autocomplete="off">
        <select id="stmMgr" aria-label="담당 선생님"></select>
        <select id="stmStatus" aria-label="상태">
          <option value="재원">재원</option><option value="휴원">휴원</option><option value="">전체</option>
        </select>
        <span id="stmCount" class="stm-muted"></span>
      </div>
      <div id="stmBulk" class="stm-bulk" hidden></div>
      <div id="stmTable" class="stm-table-wrap"><div class="stm-empty">불러오는 중...</div></div>
      <div id="stmModal" class="stm-modal" hidden><div class="stm-modal-box" role="dialog" aria-modal="true"></div></div>`;
    bind(page);
  }
  function open() {
    shell();
    load();
  }
  function load() {
    $('stmTable').innerHTML = '<div class="stm-empty">⏳ 학생 목록을 불러오는 중...</div>';
    return call('adminListStudents', [auth()]).then(d => {
      S.data = d;
      // 처음에는 내 학생, 내 학생이 없으면 전체
      if (S.mgr === 'mine' && !d.students.some(s => s.managerId === d.me.id)) S.mgr = '';
      renderFilters(); render(); syncManaged();
    }).catch(e => { $('stmTable').innerHTML = `<div class="stm-empty stm-err">${esc(e.message)}</div>`; });
  }
  // 과제출제·주간평가의 학생 고르기 목록도 새 목록으로 맞춥니다.
  function syncManaged() {
    const d = S.data, u = me();
    if (!d || !u || typeof MANAGED_STUDENTS === 'undefined') return;
    MANAGED_STUDENTS = d.students.filter(s => s.managerId === u.id && s.status === '재원').map(s => ({ id: s.id, name: s.name }));
    const html = '<option value="">학생 선택</option>' + MANAGED_STUDENTS.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.id)})</option>`).join('');
    ['targetStudentSelect', 'weeklyStudentSelect'].forEach(id => {
      const el = $(id); if (!el) return;
      const keep = el.value; el.innerHTML = html; el.value = keep;
    });
  }
  function renderFilters() {
    const d = S.data;
    const opts = [['mine', '내 학생'], ['', '전체 선생님']].concat(d.managers.filter(m => m.id !== d.me.id).map(m => [m.id, m.name + ' 선생님'])).concat([['-', '담당 없음']]);
    $('stmMgr').innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
    $('stmMgr').value = S.mgr;
    $('stmStatus').value = S.status;
  }
  function visible() {
    const d = S.data;
    const q = S.q.trim().toLowerCase();
    return d.students.filter(s => {
      if (S.status && s.status !== S.status) return false;
      if (S.mgr === 'mine' && s.managerId !== d.me.id) return false;
      if (S.mgr === '-' && s.managerId) return false;
      if (S.mgr && S.mgr !== 'mine' && S.mgr !== '-' && s.managerId !== S.mgr) return false;
      if (q && (s.name + ' ' + s.id + ' ' + s.memo).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }
  function render() {
    const d = S.data;
    if (!d) return;
    const list = visible();
    [...S.sel].forEach(id => { if (!d.students.some(s => s.id === id)) S.sel.delete(id); });
    $('stmCount').textContent = `${list.length}명` + (list.length !== d.students.length ? ` / 전체 ${d.students.length}명` : '');
    if (!list.length) {
      $('stmTable').innerHTML = `<div class="stm-empty">${d.students.length ? '조건에 맞는 학생이 없습니다.' : '등록된 학생이 없습니다. [＋ 학생 추가]로 넣어 주세요.'}</div>`;
      renderBulk(); return;
    }
    const allOn = list.every(s => S.sel.has(s.id));
    $('stmTable').innerHTML = `<table class="stm-table"><thead><tr>
        <th class="stm-c"><input type="checkbox" data-stm-all ${allOn ? 'checked' : ''} aria-label="모두 선택"></th>
        <th>이름</th><th>ID</th><th>담당</th><th>상태</th><th class="stm-r">포인트</th><th class="stm-r">과제</th><th>최근 과제</th><th>메모</th><th></th>
      </tr></thead><tbody>` + list.map(s => `
      <tr class="${s.status === '휴원' ? 'is-off' : ''}">
        <td class="stm-c"><input type="checkbox" data-stm-pick="${esc(s.id)}" ${S.sel.has(s.id) ? 'checked' : ''} aria-label="${esc(s.name)} 선택"></td>
        <td><b>${esc(s.name)}</b></td>
        <td class="stm-mono">${esc(s.id)}</td>
        <td>${s.managerId ? esc(mgrName(s.managerId)) : '<span class="stm-muted">없음</span>'}</td>
        <td>${s.status === '휴원' ? '<span class="stm-chip stm-chip-off">휴원</span>' : '<span class="stm-chip">재원</span>'}</td>
        <td class="stm-r">${Number(s.points || 0).toLocaleString()}</td>
        <td class="stm-r">${s.asgTotal ? `${s.asgDone}/${s.asgTotal}` : '<span class="stm-muted">-</span>'}</td>
        <td>${s.lastAsg ? esc(s.lastAsg.slice(2)) : '<span class="stm-muted">-</span>'}</td>
        <td class="stm-memo" title="${esc(s.memo)}">${esc(s.memo)}</td>
        <td class="stm-acts"><button type="button" class="stm-btn stm-sm" data-stm="edit" data-id="${esc(s.id)}">수정</button>
          <button type="button" class="stm-btn stm-sm stm-danger" data-stm="del" data-id="${esc(s.id)}">삭제</button></td>
      </tr>`).join('') + '</tbody></table>';
    renderBulk();
  }
  function renderBulk() {
    const bar = $('stmBulk');
    const n = S.sel.size;
    bar.hidden = !n;
    if (!n) return;
    const d = S.data;
    bar.innerHTML = `<b>${n}명 선택</b>
      <span class="stm-sep"></span>
      <label>담당 바꾸기 <select id="stmBulkMgr"><option value="">(담당 없음)</option>${d.managers.map(m => `<option value="${esc(m.id)}"${m.id === d.me.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <button type="button" class="stm-btn stm-sm" data-stm="bulk-mgr">적용</button>
      <span class="stm-sep"></span>
      <button type="button" class="stm-btn stm-sm" data-stm="bulk-off">휴원으로</button>
      <button type="button" class="stm-btn stm-sm" data-stm="bulk-on">재원으로</button>
      <button type="button" class="stm-btn stm-sm stm-ghost" data-stm="bulk-clear">선택 해제</button>`;
  }

  /* ---------- 대화상자 ---------- */
  function modal(html) {
    const m = $('stmModal');
    m.querySelector('.stm-modal-box').innerHTML = html;
    m.hidden = false;
    const f = m.querySelector('input:not([type=checkbox]):not([readonly]), textarea');
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal() { $('stmModal').hidden = true; }
  function mgrOptions(sel) {
    return '<option value="">(담당 없음)</option>' + S.data.managers.map(m => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.name)} (${esc(m.id)})</option>`).join('');
  }
  function editDialog(id) {
    const d = S.data;
    const s = id ? d.students.find(x => x.id === id) : { id: '', name: '', managerId: d.me.id, status: '재원', memo: '' };
    if (!s) return;
    modal(`
      <div class="stm-modal-head"><b>${id ? '학생 정보 변경' : '학생 추가'}</b><button type="button" class="stm-x" data-stm="close" aria-label="닫기">×</button></div>
      <div class="stm-form">
        <label>ID ${id ? '<span class="stm-muted">(바꿀 수 없음 — 모든 기록이 ID로 이어져 있습니다)</span>' : '<span class="stm-muted">(로그인할 때 쓰는 값 · 2~30자, 한글·영문·숫자·_ . -)</span>'}
          <input type="text" id="stmFId" value="${esc(s.id)}" ${id ? 'readonly' : ''} autocomplete="off" spellcheck="false"></label>
        <label>이름 <input type="text" id="stmFName" value="${esc(s.name)}" maxlength="20" autocomplete="off"></label>
        <label>담당 선생님 <select id="stmFMgr">${mgrOptions(s.managerId)}</select></label>
        <div class="stm-radio">상태
          <label><input type="radio" name="stmFSt" value="재원" ${s.status !== '휴원' ? 'checked' : ''}> 재원</label>
          <label><input type="radio" name="stmFSt" value="휴원" ${s.status === '휴원' ? 'checked' : ''}> 휴원 <span class="stm-muted">(로그인·출제·공지 대상에서 빠지고 기록은 남습니다)</span></label>
        </div>
        <label>메모 <textarea id="stmFMemo" rows="3" maxlength="500" placeholder="학교·학년·연락처 등">${esc(s.memo)}</textarea></label>
        <div id="stmFErr" class="stm-err"></div>
      </div>
      <div class="stm-modal-foot"><button type="button" class="stm-btn" data-stm="close">취소</button>
        <button type="button" class="stm-btn stm-primary" data-stm="save" data-id="${esc(id || '')}">${id ? '저장' : '추가'}</button></div>`);
  }
  function saveDialog(btn) {
    const isNew = !btn.dataset.id;
    const s = {
      id: $('stmFId').value.trim(), name: $('stmFName').value.trim(), managerId: $('stmFMgr').value,
      status: (document.querySelector('input[name="stmFSt"]:checked') || {}).value || '재원', memo: $('stmFMemo').value
    };
    const err = m => { $('stmFErr').textContent = m; };
    if (isNew) {
      if (!ID_RE.test(s.id)) return err('ID는 2~30자의 한글·영문·숫자·_ . - 로 적어 주세요.');
      if (S.data.students.concat(S.data.managers).some(x => x.id.toLowerCase() === s.id.toLowerCase())) return err('이미 있는 ID입니다.');
    }
    if (!s.name) return err('이름을 적어 주세요.');
    const p = isNew ? call('adminAddStudents', [auth(), [s]]).then(r => { if (r.skipped.length) throw new Error(r.skipped[0].reason); })
      : call('adminUpdateStudent', [auth(), s]);
    busy(btn, p).then(() => { closeModal(); toast(isNew ? `${s.name} 학생을 추가했습니다.` : '저장했습니다.'); load(); })
      .catch(e => err(e.message));
  }

  /* ---------- 여러 명 붙여넣기 ---------- */
  function pasteDialog() {
    modal(`
      <div class="stm-modal-head"><b>여러 명 추가</b><button type="button" class="stm-x" data-stm="close" aria-label="닫기">×</button></div>
      <div class="stm-form">
        <div class="stm-muted">엑셀에서 <b>ID · 이름 · 담당(선택) · 메모(선택)</b> 순서의 칸을 복사해 붙여 넣으세요. 한 줄에 한 명입니다.
          담당을 비우면 아래 기본 담당으로 들어갑니다. 담당 칸에는 선생님 ID나 이름을 적을 수 있습니다.</div>
        <textarea id="stmPaste" rows="9" spellcheck="false" placeholder="kim01	김민준	ms_lee	고2 대일고&#10;park02	박서연"></textarea>
        <label>기본 담당 <select id="stmPasteMgr">${mgrOptions(S.data.me.id)}</select></label>
        <div id="stmPastePrev" class="stm-paste-prev"></div>
      </div>
      <div class="stm-modal-foot"><button type="button" class="stm-btn" data-stm="close">취소</button>
        <button type="button" class="stm-btn stm-primary" data-stm="paste-add" disabled>추가</button></div>`);
  }
  function parsePaste() {
    const d = S.data;
    const def = $('stmPasteMgr').value;
    const seen = new Set(d.students.concat(d.managers).map(x => x.id.toLowerCase()));
    const rows = [];
    $('stmPaste').value.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      // 엑셀 복사(탭)면 칸 그대로, 아니면 쉼표나 띄어쓰기로 나눕니다. (네 번째 칸부터는 메모)
      let cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.indexOf(',') >= 0 ? line.split(',') : line.trim().split(/\s+/);
      cells = cells.map(c => c.trim());
      if (/^(id|아이디)$/i.test(cells[0])) return;          // 머리글 줄
      const [id, name, mgr] = cells, memo = cells.slice(3).join(' ').trim();
      const r = { id: id || '', name: name || '', managerId: def, memo: memo || '', status: '재원', err: '' };
      if (mgr) {
        const m = d.managers.find(x => x.id === mgr || x.name === mgr || x.name + '선생님' === mgr.replace(/\s/g, ''));
        if (m) r.managerId = m.id; else r.err = `담당 "${mgr}"을 찾을 수 없음`;
      }
      if (!ID_RE.test(r.id)) r.err = 'ID 형식이 맞지 않음';
      else if (seen.has(r.id.toLowerCase())) r.err = '이미 있는 ID';
      else if (!r.name) r.err = '이름 없음';
      if (!r.err) seen.add(r.id.toLowerCase());
      rows.push(r);
    });
    return rows;
  }
  function renderPaste() {
    const rows = parsePaste();
    const ok = rows.filter(r => !r.err);
    $('stmPastePrev').innerHTML = rows.length ? `<table class="stm-table stm-mini"><thead><tr><th>ID</th><th>이름</th><th>담당</th><th>메모</th><th></th></tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.err ? 'is-err' : ''}"><td class="stm-mono">${esc(r.id)}</td><td>${esc(r.name)}</td><td>${esc(mgrName(r.managerId) || '없음')}</td><td>${esc(r.memo)}</td><td>${r.err ? '⚠ ' + esc(r.err) : '✓'}</td></tr>`).join('') +
      '</tbody></table>' : '';
    const b = document.querySelector('#stmModal [data-stm="paste-add"]');
    b.disabled = !ok.length;
    b.textContent = ok.length ? `${ok.length}명 추가` + (rows.length > ok.length ? ` (${rows.length - ok.length}줄 제외)` : '') : '추가';
  }
  function pasteAdd(btn) {
    const ok = parsePaste().filter(r => !r.err).map(r => ({ id: r.id, name: r.name, managerId: r.managerId, memo: r.memo, status: '재원' }));
    if (!ok.length) return;
    busy(btn, call('adminAddStudents', [auth(), ok])).then(r => {
      closeModal(); load();
      if (r.skipped.length) alertMsg(`${r.added.length}명을 추가했습니다.\n추가하지 못한 학생:\n` + r.skipped.map(x => `· ${x.id}: ${x.reason}`).join('\n'));
      else toast(`${r.added.length}명을 추가했습니다.`);
    }).catch(e => alertMsg(e.message));
  }

  /* ---------- 삭제 ---------- */
  const KIND_LABEL = [
    ['logs', '문제 풀이 기록', '줄'], ['assignments', '과제', '개'], ['results', '과제 결과표', '줄'], ['vocabWords', '단어장 단어', '개'],
    ['vocabLogs', '단어 학습 기록', '줄'], ['points', '포인트 내역', '줄'], ['exchanges', '교환권 신청', '건'], ['notices', '받은 개인 알림', '건'], ['reads', '알림 읽음 표시', '줄']
  ];
  function deleteDialog(id) {
    const s = S.data.students.find(x => x.id === id);
    if (!s) return;
    modal(`
      <div class="stm-modal-head"><b>학생 삭제 — ${esc(s.name)} (${esc(s.id)})</b><button type="button" class="stm-x" data-stm="close" aria-label="닫기">×</button></div>
      <div class="stm-form" id="stmDelBody"><div class="stm-empty">⏳ 이 학생의 기록을 세는 중...</div></div>
      <div class="stm-modal-foot"><button type="button" class="stm-btn" data-stm="close">취소</button></div>`);
    call('adminStudentDataSummary', [auth(), id]).then(sum => {
      if ($('stmModal').hidden) return;
      const c = sum.counts;
      const total = KIND_LABEL.reduce((a, [k]) => a + (c[k] || 0), 0);
      $('stmDelBody').innerHTML = `
        <div class="stm-muted">이 학생이 가진 기록입니다.</div>
        <ul class="stm-data">${KIND_LABEL.map(([k, t, u]) => `<li><span>${t}</span><b>${Number(c[k] || 0).toLocaleString()}${u}</b></li>`).join('')}
          <li><span>포인트 잔액</span><b>${Number(sum.balance || 0).toLocaleString()}pt</b></li></ul>
        ${s.status !== '휴원' ? '<div class="stm-tip">💡 잠시 쉬는 학생이면 삭제 대신 <b>휴원</b>으로 바꾸세요. 기록이 그대로 남고, 다시 재원으로 바꾸면 이어서 씁니다.</div>' : ''}
        <div class="stm-del-choice">
          <label class="stm-opt"><input type="radio" name="stmDelMode" value="member" checked>
            <span><b>멤버에서만 삭제</b><br><span class="stm-muted">로그인할 수 없게 되고 목록에서 사라집니다. 기록은 시트에 남습니다. (같은 ID로 다시 추가하면 기록이 다시 이어집니다)</span></span></label>
          <label class="stm-opt stm-opt-danger"><input type="radio" name="stmDelMode" value="all" ${total ? '' : 'disabled'}>
            <span><b>기록까지 모두 삭제</b><br><span class="stm-muted">위 기록을 모든 시트에서 지웁니다. <b>되돌릴 수 없습니다.</b></span></span></label>
        </div>
        <label id="stmDelConfirm" hidden>확인을 위해 학생 이름 <b>${esc(s.name)}</b>을(를) 입력하세요
          <input type="text" id="stmDelName" autocomplete="off"></label>
        <div id="stmDelErr" class="stm-err"></div>`;
      document.querySelector('#stmModal .stm-modal-foot').innerHTML = `<button type="button" class="stm-btn" data-stm="close">취소</button>
        <button type="button" class="stm-btn stm-danger-fill" data-stm="del-run" data-id="${esc(s.id)}">삭제</button>`;
    }).catch(e => { $('stmDelBody').innerHTML = `<div class="stm-err">${esc(e.message)}</div>`; });
  }
  function deleteRun(btn) {
    const s = S.data.students.find(x => x.id === btn.dataset.id);
    const all = ((document.querySelector('input[name="stmDelMode"]:checked') || {}).value === 'all');
    const name = all ? $('stmDelName').value.trim() : '';
    if (all && name !== s.name) { $('stmDelErr').textContent = '입력한 이름이 학생 이름과 다릅니다.'; return; }
    if (all) btn.closest('.stm-modal-box').querySelector('[data-stm="close"]').disabled = true;
    busy(btn, call('adminDeleteStudent', [auth(), s.id, { withData: all, confirmName: name }])).then(r => {
      closeModal();
      S.sel.delete(s.id);
      toast(all ? `${s.name} 학생과 기록을 모두 삭제했습니다.` : `${s.name} 학생을 멤버에서 삭제했습니다. (기록은 남아 있습니다)`);
      load();
    }).catch(e => { $('stmDelErr').textContent = e.message + (all ? ' — 일부만 지워졌을 수 있습니다. 다시 [삭제]를 누르면 남은 기록을 지웁니다.' : ''); })
      .finally(() => { const c = document.querySelector('#stmModal [data-stm="close"]'); if (c) c.disabled = false; });
  }

  /* ---------- 일괄 변경 ---------- */
  function bulk(btn, patch, label) {
    const ids = [...S.sel];
    if (!ids.length) return;
    busy(btn, call('adminUpdateStudents', [auth(), ids, patch])).then(r => {
      toast(`${r.updated}명을 ${label}.`); S.sel.clear(); load();
    }).catch(e => alertMsg(e.message));
  }

  /* ---------- 이벤트 ---------- */
  function bind(page) {
    if (S.bound) return;
    S.bound = true;
    page.addEventListener('input', e => {
      if (e.target.id === 'stmQ') { S.q = e.target.value; render(); }
      if (e.target.id === 'stmPaste') renderPaste();
    });
    page.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'stmMgr') { S.mgr = t.value; render(); }
      if (t.id === 'stmStatus') { S.status = t.value; render(); }
      if (t.id === 'stmPasteMgr') renderPaste();
      if (t.dataset.stmPick != null) { t.checked ? S.sel.add(t.dataset.stmPick) : S.sel.delete(t.dataset.stmPick); render(); }
      if (t.dataset.stmAll != null) { visible().forEach(s => t.checked ? S.sel.add(s.id) : S.sel.delete(s.id)); render(); }
      if (t.name === 'stmDelMode') { const on = t.value === 'all'; $('stmDelConfirm').hidden = !on; if (on) $('stmDelName').focus(); $('stmDelErr').textContent = ''; }
    });
    page.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('stmModal').hidden) closeModal();
      if (e.key === 'Enter' && e.target.matches('#stmFId, #stmFName')) { e.preventDefault(); const b = document.querySelector('#stmModal [data-stm="save"]'); if (b) saveDialog(b); }
    });
    page.addEventListener('click', e => {
      if (e.target.id === 'stmModal') { closeModal(); return; }
      const b = e.target.closest('[data-stm]');
      if (!b || b.disabled) return;
      const a = b.dataset.stm;
      if (a === 'reload') load();
      else if (a === 'add') editDialog('');
      else if (a === 'edit') editDialog(b.dataset.id);
      else if (a === 'save') saveDialog(b);
      else if (a === 'paste') pasteDialog();
      else if (a === 'paste-add') pasteAdd(b);
      else if (a === 'del') deleteDialog(b.dataset.id);
      else if (a === 'del-run') deleteRun(b);
      else if (a === 'close') closeModal();
      else if (a === 'bulk-mgr') { const v = $('stmBulkMgr').value; bulk(b, { managerId: v }, `${v ? mgrName(v) + ' 선생님' : '담당 없음'}으로 옮겼습니다`); }
      else if (a === 'bulk-off') bulk(b, { status: '휴원' }, '휴원으로 바꿨습니다');
      else if (a === 'bulk-on') bulk(b, { status: '재원' }, '재원으로 바꿨습니다');
      else if (a === 'bulk-clear') { S.sel.clear(); render(); }
    });
  }

  // 다른 관리자로 다시 로그인하면 화면을 비웁니다.
  function reset() { S.data = null; S.sel.clear(); S.mgr = 'mine'; S.q = ''; const p = $('studentsPage'); if (p) { p.innerHTML = ''; delete p.dataset.ready; } }
  return { open: open, reset: reset };
})();
