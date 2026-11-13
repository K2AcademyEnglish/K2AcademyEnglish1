/* ===== QB_PARSER_START: 붙여넣기 분석기 (화면과 무관한 순수 함수) ===== */
// 모의고사 18~45번 기본 유형 (최근 원문 시트 기준)
const QB_STD_TYPES = {
  18: '목적', 19: '심경, 분위기', 20: '주장', 21: '함축의미', 22: '요지', 23: '주제', 24: '제목', 25: '도표',
  26: '설명문', 27: '실용문', 28: '실용문', 29: '어법', 30: '어휘', 31: '빈칸', 32: '빈칸', 33: '빈칸', 34: '빈칸',
  35: '흐름', 36: '순서', 37: '순서', 38: '삽입', 39: '삽입', 40: '요약',
  41: '장문(41-42)', 42: '장문(41-42)', 43: '장문(43-45)', 44: '장문(43-45)', 45: '장문(43-45)'
};
// ①~⑤가 지문 안에 들어 있고 선택지 칸은 비우는 유형 (기존 문제은행 저장 방식)
const QB_INLINE_TYPES = ['도표', '어법', '어휘', '흐름', '삽입'];
const QB_CIRCLED = ['①', '②', '③', '④', '⑤'];

function qbGuessType(stem, num) {
  const s = String(stem || '');
  if (/목적/.test(s)) return '목적';
  if (/심경|분위기/.test(s)) return '심경, 분위기';
  if (/주장/.test(s)) return '주장';
  if (/밑줄\s*친.*(의미|뜻)/.test(s)) return '함축의미';
  if (/요지/.test(s)) return '요지';
  if (/주제/.test(s)) return '주제';
  if (/제목/.test(s)) return '제목';
  if (/도표|그래프/.test(s)) return '도표';
  if (/안내문|광고문?/.test(s) && /일치/.test(s)) return '실용문';
  if (/일치하지\s*않는|적절하지\s*않은/.test(s) && /내용/.test(s)) return num === 26 ? '설명문' : '불일치';
  if (/일치하는/.test(s)) return '일치';
  if (/어법/.test(s)) return '어법';
  if (/(낱말|어휘)/.test(s) && /쓰임|적절하지/.test(s)) return '어휘';
  if (/가리키는\s*대상/.test(s)) return '지칭';
  if (/요약/.test(s)) return '요약';
  if (/빈칸/.test(s)) return '빈칸';
  if (/주어진\s*문장이\s*들어가기/.test(s)) return '삽입';
  if (/순서/.test(s)) return '순서';
  if (/흐름과\s*(관계\s*없는|무관한)|관계\s*없는\s*문장/.test(s)) return '흐름';
  return (num && QB_STD_TYPES[num]) || '';
}

// 질문 문구를 문제은행 저장 방식에 맞춥니다: "다음 글의" → "글의", "[3점]" 삭제, "윗글의" 정리
// 줄바꿈 때문에 붙어 버린 질문 속 낱말을 띄어 줍니다. (예: "내용과일치하지" → "내용과 일치하지")
const QB_STEM_WORDS = ['일치하지', '일치하는', '적절한', '적절하지', '가장', '것은', '것을', '것으로', '고르시오', '글의', '글에서', '다음', '밑줄', '부분', '어법상', '문맥상', '낱말의', '쓰임이', '배열한', '순서에', '맞게', '주어진', '가리키는', '대상이', '나머지', '넷과', '다른', '의미하는', '들어갈', '말로', '내용으로', '관한', '않은', '않는', '틀린', '없는', '흐름과', '관계', '요약하고자', '빈칸', '안내문의', '도표의', '글을', '곳은', '곳을', '문장은', '문장이', '내용과', '내용을'];
function qbFixKoSpacing(s) {
  let out = String(s || '');
  QB_STEM_WORDS.forEach(w => { out = out.replace(new RegExp('([가-힣)])(' + w + ')(?=[\\s?.,]|$)', 'g'), (m, a, b, off, all) => {
    // '의미하는'처럼 낱말 안쪽이면 그대로 둡니다: 앞 글자까지 합친 말이 낱말 목록에 있으면 붙어 있는 게 맞습니다.
    return QB_STEM_WORDS.some(x => x !== w && x.endsWith(a + w)) ? m : a + ' ' + b;
  }); });
  return out;
}
function qbNormalizeStem(stem) {
  let s = String(stem || '').replace(/\s*\[\s*\d\s*점\s*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // 함축의미: "밑줄 친 <u>live in …</u>가 다음 글에서" → "밑줄 친 부분이 글에서" (밑줄은 지문에 있습니다)
  s = s.replace(/밑줄\s*친\s*(?:<u>)?\s*[A-Za-z][^가-힣]*?(?:<\/u>)?\s*(?:이|가)\s*(?:<\/u>)?\s+(?:다음\s+)?글에서/, '밑줄 친 부분이 글에서');
  // 질문에는 기울임만 남기고 밑줄 등 서식 태그는 뺍니다 (문제은행 질문 칸 형식)
  s = s.replace(/<\/?(u|b|red|blue|green|orange)>/gi, '');
  s = qbFixKoSpacing(s).replace(/낱\s+말/g, '낱말').replace(/[～∼]/g, '~');
  s = s.replace(/^\d{1,2}\s*[.．]\s*/, '');
  s = s.replace(/(^|\s)다음\s+(?=(글|도표|빈칸|안내문|광고|대화|그래프|표|밑줄))/g, '$1');
  // "윗글의 제목으로" → "글의 제목으로", "윗글의 Dorothy에 관한" → "Dorothy에 관한"
  s = s.replace(/^윗\s*글(의|에|을|에서)?\s*(?=[A-Za-z‘'"“(])/, '').replace(/^윗\s*글/, '글');
  return s.trim();
}

// PDF에서 복사해 줄이 중간에 끊긴 글을 문단으로 다시 잇습니다.
// - 다른 줄보다 눈에 띄게 짧은 줄(문단 끝·제목·인사말)과 150자 넘는 긴 줄(이미 한 문단인 줄) 뒤에서만 줄을 바꿉니다.
// 이어진 각주 줄(*, **, *** …)은 <r> 하나로 묶습니다. (줄바꿈은 안에 그대로)
function qbMergeFootnotes(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let group = null;
  const isFoot = l => /^\s*(<r>\s*)?\*/.test(l);
  lines.forEach(l => {
    if (isFoot(l)) {
      const t = l.trim().replace(/^<r>\s*/, '').replace(/\s*<\/r>$/, '');
      if (group) group.push(t); else { group = [t]; out.push(group); }
    } else { group = null; out.push(l); }
  });
  return out.map(x => Array.isArray(x) ? '<r>' + x.join('\n') + '</r>' : x).join('\n');
}
function qbJoinLines(text, joinPdf) {
  return qbMergeFootnotes(qbJoinLines0(text, joinPdf));
}
function qbJoinLines0(text, joinPdf) {
  const lines = String(text || '').split('\n').map(l => l.replace(/\s+$/, ''));
  if (!joinPdf) return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const lens = lines.map(l => l.trim().length).filter(n => n > 0).sort((a, b) => a - b);
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
  const out = [];
  let cur = '';
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if ((/^[•·\-▪■□◦‣]\s/.test(line) || /^(<r>)?\*/.test(line)) && cur) flush();             // 글머리표는 새 줄
    if (!cur) cur = line;
    else if (/[A-Za-z]-$/.test(cur)) cur += line;                     // 줄 끝 하이픈: 붙여 씀 (self-\nesteem → self-esteem)
    else cur += ' ' + line;
    const next = (lines[i + 1] || '').trim();
    const short = median >= 40 && line.length < median * 0.72;
    const long = line.length > 150;
    const bullet = /^[•·\-▪■□◦‣]\s/.test(next) || /^(<r>)?\*/.test(next);
    if (!next || short || long || bullet || median < 40) flush();
  });
  flush();
  return out.join('\n');
}

// 페이지 머리말·쪽 번호 같은 군더더기 줄 제거
// 마지막 쪽 아래 "※ 확인 사항 ◦답안지의 해당란에 … 확인하시오." 안내를 지웁니다.
function qbStripFooter(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const k = l.search(/(<r>)?\s*[*※]?\s*확인\s*사항\s*(<\/r>)?\s*$/);
    if (k >= 0 && /확인\s*사항/.test(l) && (i + 1 >= lines.length || /답안지|기입|표기/.test(lines[i + 1]) || /답안지/.test(l))) {
      const keep = l.slice(0, k).replace(/\s+$/, '');
      if (keep) out.push(keep);
      // 이어지는 안내 줄들(답안지… / 했는지 확인하시오.)도 뺍니다.
      while (i + 1 < lines.length && /답안지|기입\(표기\)|했는지\s*확인|확인\s*하시오|^\s*하시오\.?\s*$/.test(lines[i + 1])) i++;
      continue;
    }
    if (/답안지의\s*해당란/.test(l)) { const keep = l.replace(/\s*[◦○•]?\s*답안지의\s*해당란.*$/, '').replace(/\s*(<r>)?\s*[*※]?\s*확인\s*사항\s*(<\/r>)?\s*$/, ''); if (keep.trim()) out.push(keep); continue; }
    out.push(l);
  }
  return out.join('\n');
}
function qbStripNoise(text) {
  return qbStripFooter(text).split('\n').filter(l => !/^\s*(\d+\s*\/\s*\d+|\d{1,2}|영어\s*영역|홀수형|짝수형|제\s*\d\s*교시|\d+\s*쪽|\d+\s*page)\s*$/i.test(l)).join('\n');
}

// "18 ④ 19 ② …", "18.④", "18-4" 같은 정답표를 {18:'4', 19:'2'}로
function qbParseAnswerKey(text) {
  const out = {};
  const re = /(\d{1,2})\s*번?\s*[.:)\-]?\s*([①②③④⑤]|[1-5](?!\d))/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const n = Number(m[1]);
    const a = QB_CIRCLED.indexOf(m[2]) >= 0 ? String(QB_CIRCLED.indexOf(m[2]) + 1) : m[2];
    if (n > 0 && !(n in out)) out[n] = a;
  }
  return out;
}

// 끝에서부터 ① ② ③ ④ ⑤가 차례로 나오는 마지막 묶음을 선택지로 떼어 냅니다.
function qbSplitOptions(text) {
  const t = String(text || '');
  let start = t.lastIndexOf('①');
  while (start >= 0) {
    let pos = start, ok = true;
    const cuts = [start];
    for (let k = 1; k < 5; k++) {
      const p = t.indexOf(QB_CIRCLED[k], pos + 1);
      if (p < 0) { ok = false; break; }
      cuts.push(p); pos = p;
    }
    if (ok) {
      const opts = cuts.map((c, i) => t.slice(c + 1, i < 4 ? cuts[i + 1] : t.length).replace(/\s+/g, ' ').trim());
      return { body: t.slice(0, start).replace(/\s+$/, ''), options: opts };
    }
    start = t.lastIndexOf('①', start - 1);
  }
  return { body: t, options: [] };
}

function qbCleanOption(opt, type) {
  let o = String(opt || '').trim();
  if (type === '순서' || type === '장문(43-45)') o = o.replace(/\s*[-–—~]\s*/g, '-');
  if (type === '요약') {
    const parts = o.split(/\s*(?:…+|\.{3,}|·{2,}|\s{3,}|\t+)\s*/).filter(Boolean);
    if (parts.length === 2 && !/^\(A\)/.test(o)) o = '(A) ' + parts[0] + '   (B) ' + parts[1];
  }
  return o;
}

// (A) (B) (C) (D)로 시작하는 줄을 기준으로 나눕니다. → { head: 앞부분, parts: ['(A) …', '(B) …'] }
function qbSplitLettered(text) {
  const t = String(text || '');
  const re = /(^|\n)\s*\(([A-D])\)\s*/g;
  const marks = [];
  let m;
  while ((m = re.exec(t))) marks.push({ at: m.index + m[1].length, letter: m[2], end: re.lastIndex });
  if (!marks.length) return { head: t.trim(), parts: [] };
  const head = t.slice(0, marks[0].at).trim();
  const parts = marks.map((mk, i) => '(' + mk.letter + ') ' + t.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : t.length).trim());
  return { head: head, parts: parts };
}

/**
 * 시험지 텍스트 → 문항 목록
 * 반환: [{ num, type, v: [17칸], link: {head, rows} | null, warnings: [] }]
 *   v 칸 순서: 0 ID, 1 출처, 2 유형, 3 연계, 4 난이도, 5 질문, 6~9 Box1~4, 10~14 선택지, 15 정답, 16 해설
 */
function qbParsePaste(text, keyText, opts) {
  opts = opts || {};
  const joinPdf = opts.joinPdf !== false;
  let src = String(text || '').replace(/\r\n?/g, '\n').replace(/ |　/g, ' ').replace(/[​﻿]/g, '');
  // 붙여 넣은 글 끝에 정답표가 있으면 떼어 냅니다.
  let key = String(keyText || '');
  const keyAt = src.search(/\n\s*(\[?\s*(빠른\s*)?정답(\s*표)?\s*\]?)\s*(\n|$)/);
  if (keyAt >= 0) { key += '\n' + src.slice(keyAt); src = src.slice(0, keyAt); }
  src = qbStripNoise(src);
  const answers = qbParseAnswerKey(key);

  const lines = src.split('\n');
  // 1) 문항 시작 줄·묶음 머리말([41~42]) 찾기
  const marks = [];
  let lastNum = 0;
  let openGroup = null;   // [31~34] 다음 빈칸에 … 처럼 질문을 묶음 머리말에 한 번만 적은 경우
  lines.forEach((line, i) => {
    const g = line.match(/^\s*\[\s*(\d{1,2})\s*[~∼～\-–]\s*(\d{1,2})\s*\]\s*(.*)$/);
    if (g) {
      const from = Number(g[1]), to = Number(g[2]);
      let instr = g[3].trim();
      for (let k = i + 1; k < lines.length && k < i + 3 && instr && !/시오\.?$|[?？]$/.test(instr); k++) {
        const nx = lines[k].trim();
        if (!/^[가-힣(]/.test(nx) || /^\d{1,2}\s*[.．]/.test(nx)) break;
        instr += ' ' + nx;
      }
      const shared = /읽고/.test(instr) ? '' : instr;          // "다음 글을 읽고, 물음에 답하시오"는 지문 묶음
      openGroup = { from, to, shared };
      marks.push({ kind: 'group', line: i, from, to, shared });
      return;
    }
    const q = line.match(/^\s*(\d{1,2})\s*[.．]\s*(.*)$/);
    if (!q) return;
    const n = Number(q[1]), rest = q[2];
    if (!rest.trim() && !(openGroup && openGroup.shared && n >= openGroup.from && n <= openGroup.to)) return;
    if (n <= lastNum || (lastNum && n > lastNum + 15)) return;
    const inShared = openGroup && openGroup.shared && n >= openGroup.from && n <= openGroup.to;
    // 질문 줄은 한글이 들어 있어야 합니다(영어 지문 속 "1. In the …"과 구분). 묶음 머리말에 질문이 있으면 예외.
    if (!/[가-힣]/.test(rest) && !inShared) return;
    marks.push({ kind: 'q', line: i, num: n, rest: rest, shared: inShared ? openGroup.shared : '' });
    lastNum = n;
  });

  const blockText = (from, to) => lines.slice(from, to).join('\n');
  const groups = [];
  const items = [];
  marks.forEach((mk, idx) => {
    const end = idx + 1 < marks.length ? marks[idx + 1].line : lines.length;
    if (mk.kind === 'group') {
      if (!mk.shared) groups.push({ from: mk.from, to: mk.to, passage: blockText(mk.line + 1, end) });
      return;
    }
    if (mk.shared) {
      // 질문은 머리말, 번호 줄부터는 지문
      items.push({ num: mk.num, stemRaw: mk.shared, raw: blockText(mk.line, end).replace(/^\s*\d{1,2}\s*[.．]\s*/, '').replace(/^\s*\n/, ''), group: null });
      return;
    }
    // 질문이 두 줄로 이어진 경우 (첫 줄이 ?나 '시오.'로 끝나지 않으면 다음 한글 줄을 붙임)
    let stem = mk.rest, bodyFrom = mk.line + 1;
    for (let k = 0; k < 2 && !/[?？]|시오\.?\s*(\[\s*\d\s*점\s*\])?\s*$/.test(stem) && bodyFrom < end; k++) {
      const nx = lines[bodyFrom].trim();
      if (!nx || !/[가-힣]/.test(nx) || /①/.test(nx)) break;
      stem += ' ' + nx; bodyFrom++;
    }
    const group = groups.find(g => mk.num >= g.from && mk.num <= g.to) || null;
    items.push({ num: mk.num, stemRaw: stem, raw: blockText(bodyFrom, end), group: group });
  });

  const minNum = Number(opts.minNum) || 0;
  return items.filter(it => it.num >= minNum).map(it => {
    const v = new Array(17).fill('');
    const warnings = [];
    const num = it.num;
    const stem = qbNormalizeStem(it.stemRaw);
    const g = it.group;
    let type;
    if (g && g.from === 41 && g.to === 42) type = '장문(41-42)';
    else if (g && g.from === 43 && g.to === 45) type = '장문(43-45)';
    else type = qbGuessType(stem, num);
    v[2] = type; v[5] = stem;

    const inline = !g && QB_INLINE_TYPES.indexOf(type) >= 0;
    const raw = it.raw.replace(/\s*\[\s*\d\s*점\s*\]/g, '');      // 지문 끝에 붙은 배점 표시
    const sp = inline ? { body: raw, options: [] } : qbSplitOptions(raw);
    let body = sp.body;
    if (type === '요약') body = body.replace(/\n\s*\(A\)\s*\(B\)\s*$/, '');
    if (sp.options.length) sp.options.forEach((o, i) => { v[10 + i] = qbCleanOption(o, type); });
    else if (!inline && type !== '서술형') {
      if (/[①②③④⑤]/.test(it.raw)) warnings.push('선택지 ①~⑤를 다 찾지 못했습니다.');
      else { v[2] = type = (type ? type : '서술형'); if (type !== '서술형') warnings.push('선택지가 없습니다. 서술형이면 유형을 서술형으로 바꿔 주세요.'); }
    }

    // 지문(Box) 나누기
    const isHead = g && num === g.from;
    let link = null;
    if (g && !isHead) {
      // 묶음의 둘째·셋째 문항: 지문은 첫 문항 칸을 수식으로 가져옵니다(기존 시트와 같은 방식).
      link = { head: g.from, rows: g.from === 43 ? [3, 6, 7, 8, 9, 16] : [3, 6, 16] };
      if (body.trim()) warnings.push('묶음 문항인데 지문이 따로 있어 Box1에 넣었습니다.');
      if (body.trim()) { v[6] = qbJoinLines(body, joinPdf); link.rows = [3]; }
    } else {
      const passage = isHead ? (g.passage + '\n' + body) : body;
      if (type === '장문(43-45)') {
        const sl = qbSplitLettered(passage);
        sl.parts.slice(0, 4).forEach((p, i) => { v[6 + i] = qbJoinLines(p, joinPdf); });
        if (sl.head) v[6] = qbJoinLines(sl.head + '\n' + v[6], joinPdf);
        if (sl.parts.length < 4) warnings.push('(A)~(D) 단락을 다 찾지 못했습니다.');
      } else if (type === '순서') {
        const sl = qbSplitLettered(passage);
        v[6] = qbJoinLines(sl.head, joinPdf);
        sl.parts.slice(0, 3).forEach((p, i) => { v[7 + i] = qbJoinLines(p, joinPdf); });
        if (sl.parts.length < 3) warnings.push('(A)~(C) 단락을 다 찾지 못했습니다.');
      } else if (type === '요약') {
        const arrow = passage.search(/\n\s*[↓⇩⬇▼]\s*(\n|$)/);
        if (arrow >= 0) {
          v[6] = qbJoinLines(passage.slice(0, arrow), joinPdf);
          v[7] = '<c>⇩</c>';
          v[8] = qbJoinLines(passage.slice(arrow).replace(/^\s*\n?\s*[↓⇩⬇▼]\s*/, ''), joinPdf);
        } else {
          const paras = qbJoinLines(passage, joinPdf).split('\n');
          const k = paras.map((p, i) => (/\(A\)/.test(p) && /\(B\)/.test(p) && /_{3,}|<u>/.test(p)) ? i : -1).filter(i => i > 0).pop();
          if (k != null && k > 0) {
            v[6] = paras.slice(0, k).filter(p => !/^<r>/.test(p) || true).join('\n');
            v[7] = '<c>⇩</c>';
            v[8] = paras.slice(k).join('\n').replace(/\n\s*\(A\)\s*\(B\)\s*$/, '');
          } else { v[6] = paras.join('\n'); warnings.push('요약문(↓ 아래 문장)을 찾지 못해 지문에 함께 넣었습니다.'); }
        }
      } else if (type === '삽입') {
        // 주어진 문장은 맨 앞의 한 문장입니다. 줄이 나뉘어 붙여졌으면 첫 줄바꿈, 아니면 첫 문장 끝에서 나눕니다.
        const joined = qbJoinLines(passage, joinPdf);
        const mark = joined.search(/\(\s*①\s*\)/);
        const pre = mark > 0 ? joined.slice(0, mark) : '';
        let cut = pre.indexOf('\n');
        if (cut < 0) {
          const m = /[.!?]["”’)]?(?=\s+["“‘(]?[A-Z0-9])/.exec(pre);
          cut = m ? m.index + m[0].length : -1;
        }
        if (cut > 0) { v[6] = joined.slice(0, cut).trim(); v[7] = joined.slice(cut).trim(); }
        else { v[6] = joined; warnings.push('주어진 문장과 지문을 나누지 못했습니다. 주어진 문장은 Box1, 지문은 Box2에 넣어 주세요.'); }
      } else if (type === '도표') {
        v[7] = qbJoinLines(passage, joinPdf);
        warnings.push('도표 이미지를 Box1에 넣어 주세요. (예: <c>이미지 주소</c>)');
      } else {
        v[6] = qbJoinLines(passage, joinPdf);
      }
    }
    if (!v[6] && !link) warnings.push('지문이 비어 있습니다.');
    if (!opts.noAnswers) { if (answers[num]) v[15] = answers[num]; else warnings.push('정답이 없습니다.'); }
    // PDF 파일로 가져와 밑줄이 살아 있으면 안내하지 않습니다.
    if (['함축의미', '어법', '어휘', '장문(41-42)', '장문(43-45)', '지칭'].indexOf(type) >= 0 && !/<u>/.test(String(text))) warnings.push('밑줄은 복사되지 않으니 <u> 태그로 다시 표시해 주세요.');
    return { num: num, type: type, v: v, link: link, warnings: warnings };
  });
}
/* ===== QB_PARSER_END ===== */

/* ===== QB_PDF_START: PDF 파일에서 시험지 글 꺼내기 =====
 * 복사·붙여넣기는 기울임·밑줄·문단 정보를 버리지만, PDF 파일 안에는 남아 있습니다.
 *  - 기울임: 글자 모양 행렬의 기울기(transform[2])가 0이 아님 → <i>
 *  - 밑줄: 글자 바로 아래에 그려진 가는 가로선 → <u> (단어 단위로 맞춤)
 *  - 문단: 첫 줄 들여쓰기·짧은 줄 끝 → 줄바꿈 / 나머지 줄은 이어 붙임
 *  - 좌우 2단: 가운데 세로선(없으면 페이지 가운데) 기준으로 왼쪽 단 → 오른쪽 단 순서
 *  - 머리말·쪽 번호는 본문 영역(가운데 세로선의 위아래 끝) 밖이라 뺍니다.
 *  - 작은 글씨로 *로 시작하는 줄(각주) → <r>*…</r>
 */
const QB_PDFJS_VER = '6.2.108';
function qbPdfJsBase() { return window.QB_PDFJS_BASE || ('https://cdn.jsdelivr.net/npm/pdfjs-dist@' + QB_PDFJS_VER + '/build/'); }
let _qbPdfJs = null;
function qbLoadPdfJs() {
  if (_qbPdfJs) return _qbPdfJs;
  const base = qbPdfJsBase();
  _qbPdfJs = import(base + 'pdf.min.mjs').then(lib => { lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs'; return lib; })
    .catch(err => { _qbPdfJs = null; throw new Error('PDF 읽기 도구를 불러오지 못했습니다(인터넷 연결 확인): ' + (err.message || err)); });
  return _qbPdfJs;
}

// PDF 열기: 한글 글꼴(CMap)·표준 글꼴 자료 위치를 함께 알려 줍니다.
function qbPdfOpen(pdfjs, data) {
  const base = typeof window !== 'undefined' ? qbPdfJsBase() : (globalThis.QB_PDFJS_BASE || '');
  const root = base.replace(/build\/?$/, '');
  const o = { data: data, disableFontFace: true, isEvalSupported: false };
  if (root) { o.cMapUrl = root + 'cmaps/'; o.cMapPacked = true; o.standardFontDataUrl = root + 'standard_fonts/'; o.wasmUrl = root + 'wasm/'; }
  return pdfjs.getDocument(o).promise;
}
// 글꼴 이름에 Italic·Oblique가 있으면 기울임 글꼴
function qbFontStyleFn(page) {
  const memo = {};
  return id => {
    if (id in memo) return memo[id];
    let it = false, bd = false;
    try {
      if (page.commonObjs.has(id)) {
        const f = page.commonObjs.get(id), n = (f && f.name) || '';
        it = !!(f && (f.italic || /italic|oblique/i.test(n)));
        bd = !!(f && (f.bold || f.black || /bold|black|heavy|demi/i.test(n)));
      }
    } catch (e) { /* 모르면 보통 글꼴 */ }
    return (memo[id] = { it, bd });
  };
}
// 행렬 곱 (PDF 변환 행렬 [a b c d e f])
function qbMul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
// 그리기 명령에서 가는 가로선(밑줄 후보)과 긴 세로선(단 구분선)을 모읍니다. 좌표는 PDF 좌표(아래가 0).
function qbPdfSegments(ops, OPS) {
  const hs = [], vs = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const P = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const addLine = (a, b) => {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (y1 - y0 <= 1.6 && x1 - x0 >= 1.5) hs.push({ x0, x1, y: (y0 + y1) / 2 });
    else if (x1 - x0 <= 1.6 && y1 - y0 >= 200) vs.push({ x: (x0 + x1) / 2, y0, y1 });
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = qbMul(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin && args && args[0]) { stack.push(ctm); const m = args[0]; ctm = qbMul(ctm, [0, 1, 2, 3, 4, 5].map(k => Number(m[k]))); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.constructPath) {
      const mm = args && args[2];
      if (!mm || mm.length < 4) continue;
      const p1 = P(mm[0], mm[1]), p2 = P(mm[2], mm[3]);
      const bx0 = Math.min(p1[0], p2[0]), bx1 = Math.max(p1[0], p2[0]), by0 = Math.min(p1[1], p2[1]), by1 = Math.max(p1[1], p2[1]);
      if (by1 - by0 <= 1.6 || bx1 - bx0 <= 1.6) { addLine([bx0, by0], [bx1, by1]); continue; }      // 얇은 선·얇은 사각형
      // 여러 선이 한 묶음인 경로: 열린 꺾은선의 가로 조각만 봅니다. (닫힌 큰 사각형 = 상자 테두리는 뺍니다)
      const d = args[1] && args[1][0];
      if (!d || typeof d.length !== 'number') continue;
      let k = 0, cur = null, start = null, segs = [], closed = false;
      const flushSub = () => { if (!closed) segs.forEach(([a, b]) => addLine(a, b)); segs = []; closed = false; };
      while (k < d.length) {
        const op = d[k];
        if (op === 0) { flushSub(); cur = start = P(d[k + 1], d[k + 2]); k += 3; }
        else if (op === 1) { const nx = P(d[k + 1], d[k + 2]); if (cur) segs.push([cur, nx]); cur = nx; k += 3; }
        else if (op === 2) { cur = P(d[k + 5], d[k + 6]); k += 7; }
        else if (op === 3) { cur = P(d[k + 3], d[k + 4]); k += 5; }
        else if (op === 4) { closed = true; cur = start; k += 1; }
        else break;
      }
      flushSub();
    }
  }
  // 조각난 가로선(점선처럼 짧게 이어 그린 빈칸 밑줄)을 하나로 잇습니다.
  hs.sort((a, b) => (a.y - b.y) || (a.x0 - b.x0));
  const merged = [];
  hs.forEach(h => {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.y - h.y) < 0.4 && h.x0 <= last.x1 + 1.2) last.x1 = Math.max(last.x1, h.x1);
    else merged.push({ x0: h.x0, x1: h.x1, y: h.y });
  });
  return { hs: merged.filter(h => h.x1 - h.x0 >= 6), vs };
}
// 글자 폭 어림값(em 단위): 밑줄이 덮는 글자 범위를 찾을 때만 씁니다. (결과는 단어 경계에 맞춥니다)
function qbGlyphW(ch) {
  if (/[ᄀ-ᇿ　-鿿가-힯＀-￯①-⑳ⓐ-ⓩ]/.test(ch)) return 1;
  if (ch === ' ') return 0.25;
  if (/[iljtfrI.,:;'’‘!|()\[\]]/.test(ch)) return 0.3;
  if (/[mwMW]/.test(ch)) return 0.8;
  if (/[A-Z]/.test(ch)) return 0.68;
  return 0.5;
}
// 한 조각(item) 안에서 밑줄이 덮는 글자 범위들 → [[시작, 끝], …] (단어 단위)
function qbUnderlineRanges(str, x0, width, segs) {
  if (!segs.length || !str.trim()) return [];
  const ws = [...str].map(qbGlyphW);
  const total = ws.reduce((a, b) => a + b, 0) || 1;
  const pos = [];
  let acc = 0;
  ws.forEach(w => { pos.push(x0 + acc / total * width); acc += w; });
  pos.push(x0 + width);
  const words = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(str))) words.push([m.index, m.index + m[0].length]);
  const hit = words.filter(([a, b]) => {
    const cx0 = pos[a], cx1 = pos[b], cw = Math.max(cx1 - cx0, 1);
    return segs.some(s => Math.min(s.x1, cx1) - Math.max(s.x0, cx0) >= cw * 0.5);
  });
  // 붙어 있는 밑줄 단어는 하나로 묶습니다.
  const out = [];
  hit.forEach(([a, b]) => {
    const last = out[out.length - 1];
    if (last && /^\s*$/.test(str.slice(last[1], a))) last[1] = b; else out.push([a, b]);
  });
  return out;
}
const qbTagEsc = s => String(s);

// 그리기 명령을 따라가며 글자마다 위치·크기·기울기를 계산합니다. (PDF 좌표: 아래가 0)
function qbPdfChars(ops, OPS, fontStyle) {
  const chars = [];
  let ctm = [1, 0, 0, 1, 0, 0], tm = [1, 0, 0, 1, 0, 0], tlm = [1, 0, 0, 1, 0, 0];
  let fs = 10, h = 1, cs = 0, ws = 0, lead = 0, fit = false, fbd = false, mode = 0;
  const stack = [];
  const arr6 = a => { const m = (a && a.length === 1 && a[0] && typeof a[0] === 'object') ? a[0] : a; return [0, 1, 2, 3, 4, 5].map(k => Number(m[k])); };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i];
    if (fn === OPS.save) stack.push({ ctm, fs, h, cs, ws, lead, fit, fbd, mode });
    else if (fn === OPS.restore) { const st = stack.pop(); if (st) ({ ctm, fs, h, cs, ws, lead, fit, fbd, mode } = st); }
    else if (fn === OPS.transform) ctm = qbMul(ctm, arr6(a));
    else if (fn === OPS.beginText) { tm = [1, 0, 0, 1, 0, 0]; tlm = tm; }
    else if (fn === OPS.setFont) { fs = Number(a[1]) || fs; const st = fontStyle ? fontStyle(a[0]) : null; fit = !!(st && st.it); fbd = !!(st && st.bd); }
    else if (fn === OPS.setTextRenderingMode) mode = Number(a[0]) || 0;      // 2 = 채우기+윤곽선(가짜 굵게)
    else if (fn === OPS.setHScale) h = (Number(a[0]) || 100) / 100;
    else if (fn === OPS.setCharSpacing) cs = Number(a[0]) || 0;
    else if (fn === OPS.setWordSpacing) ws = Number(a[0]) || 0;
    else if (fn === OPS.setLeading) lead = Number(a[0]) || 0;
    else if (fn === OPS.setTextMatrix) { tm = arr6(a); tlm = tm; }
    else if (fn === OPS.moveText) { tlm = qbMul(tlm, [1, 0, 0, 1, Number(a[0]), Number(a[1])]); tm = tlm; }
    else if (fn === OPS.setLeadingMoveText) { lead = -Number(a[1]); tlm = qbMul(tlm, [1, 0, 0, 1, Number(a[0]), Number(a[1])]); tm = tlm; }
    else if (fn === OPS.nextLine) { tlm = qbMul(tlm, [1, 0, 0, 1, 0, -lead]); tm = tlm; }
    else if (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) {
      if (fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) { tlm = qbMul(tlm, [1, 0, 0, 1, 0, -lead]); tm = tlm; }
      const glyphs = a[a.length - 1] || [];
      let tx = 0;
      for (const g of glyphs) {
        if (typeof g === 'number') { tx -= g / 1000 * fs * h; continue; }
        if (!g) continue;
        const adv = ((Number(g.width) || 0) / 1000 * fs + cs + (g.isSpace ? ws : 0)) * h;
        const M = qbMul(ctm, qbMul(tm, [1, 0, 0, 1, tx, 0]));
        const sx = Math.hypot(M[0], M[1]) || 1, sy = Math.hypot(M[2], M[3]) || 1;
        const u = g.unicode != null ? String(g.unicode) : '';
        if (u) chars.push({ ch: u, x0: M[4], x1: M[4] + adv * sx, y: M[5], size: fs * sy, bold: fbd || mode === 2, italic: fit || (Math.abs(M[2]) > Math.abs(M[0]) * 0.12 && Math.abs(M[1]) < Math.abs(M[0]) * 0.05) });
        tx += adv;
      }
      tm = qbMul(tm, [1, 0, 0, 1, tx, 0]);
    }
  }
  return chars;
}

// 다음 줄이 새 항목(번호·글머리표·굵은 제목·가운데 줄·각주·①)이 아닌 평범한 영어 글인지
function qbPlainNextLine(n, bodySize) {
  const p = n.plain.trim();
  if (!/^[A-Za-z(“‘"'$0-9]/.test(p)) return false;
  if (/^(\d{1,2}\s*[.．]\s*\S|\(\s*[A-E]\s*\)|[\u00ad\-–]\s)/.test(p) || n.wholeBold || n.startsBold) return false;
  const centered = n.x0 > n.colLeft + n.size * 2 && n.x1 < n.colRight - n.size * 2 && Math.abs((n.x0 + n.x1) / 2 - (n.colLeft + n.colRight) / 2) < n.size * 1.5;
  return !centered && !(n.size < bodySize * 0.95);
}
/**
 * PDF(ArrayBuffer) → 시험지 텍스트(태그 포함). 반환: { text, stats, bodySize }
 */
async function qbPdfToText(pdfjs, data, opts) {
  opts = opts || {};
  const doc = await qbPdfOpen(pdfjs, data);
  const stats = { pages: doc.numPages, italic: 0, underline: 0, footnote: 0 };
  const allLines = [];
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn);
    const vp = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const seg = qbPdfSegments(ops, pdfjs.OPS);
    const chars = qbPdfChars(ops, pdfjs.OPS, qbFontStyleFn(page));
    // 단 구분선: 페이지 가운데 근처의 가장 긴 세로선
    const mid = vp.width / 2;
    const gut = seg.vs.filter(v => Math.abs(v.x - mid) < vp.width * 0.12).sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))[0];
    const gx = gut ? gut.x : mid;
    const bodyTop = gut ? gut.y1 + 6 : vp.height * 0.9;
    const bodyBottom = gut ? gut.y0 - 6 : vp.height * 0.05;
    const body = chars.filter(c => c.y <= bodyTop && c.y >= bodyBottom);
    // 밑줄: 글자 바로 아래(기준선 아래 0.2~0.45 글자 크기)에 있는 가는 가로선
    // 빈칸: 글자가 위에 없는 가는 가로선이 같은 줄 글자 옆에 있으면 빈칸 밑줄(______)로 넣습니다.
    const sz = body.map(c => c.size).sort((a, b) => a - b)[Math.floor(body.length / 2)] || 11;
    const minX = Math.min(...body.map(c => c.x0));
    const colW = (vp.width - 2 * minX) / 2;          // 단 하나의 너비
    seg.hs.forEach(s => {
      // 단 너비에 가까운 선은 상자 테두리·표 선이므로 빈칸이 아닙니다.
      if (s.y > bodyTop || s.y < bodyBottom || s.x1 - s.x0 < sz * 2 || s.x1 - s.x0 > colW * 0.98) return;
      const lineChars = body.filter(c => c.y - s.y > 0.3 && c.y - s.y < c.size * 0.5 && c.ch.trim());
      const covered = lineChars.some(c => { const cx = (c.x0 + c.x1) / 2; return cx > s.x0 && cx < s.x1; });
      const near = lineChars.some(c => c.x1 > s.x0 - sz * 3 && c.x0 < s.x1 + sz * 3);
      if (covered || !near) return;
      // 단 너비에 가까운 긴 선은 상자 테두리일 수 있어, 글자가 선 끝에 바로 붙어 있을 때만 빈칸으로 봅니다. (예: "____________ .")
      if (s.x1 - s.x0 > colW * 0.85 && !lineChars.some(c => (c.x0 >= s.x1 - sz * 0.5 && c.x0 <= s.x1 + sz) || (c.x1 <= s.x0 + sz * 0.5 && c.x1 >= s.x0 - sz))) return;
      const y = lineChars.filter(c => c.x1 > s.x0 - sz * 3 && c.x0 < s.x1 + sz * 3)[0].y;
      const n = Math.max(5, Math.min(20, Math.round((s.x1 - s.x0) / (sz * 0.5))));
      body.push({ ch: '_'.repeat(n), x0: s.x0 + 0.5, x1: s.x1 - 0.5, y: y, size: sz, italic: false, blank: true });
      stats.blank = (stats.blank || 0) + 1;
    });
    // 밑줄: 선 위에 놓인 글자 범위보다 선이 훨씬 길면 표·상자 테두리이므로 뺍니다.
    const inBand = (s, c) => s.y < c.y - c.size * 0.02 && s.y > c.y - c.size * 0.45;
    const ulSegs = seg.hs.filter(s => {
      if ((s.x1 - s.x0) >= sz * 60) return false;
      const above = body.filter(c => !c.blank && c.ch.trim() && inBand(s, c) && c.x1 > s.x0 && c.x0 < s.x1);
      if (!above.length) return false;
      const ax0 = Math.min(...above.map(c => c.x0)), ax1 = Math.max(...above.map(c => c.x1));
      if (/^\(?[A-E]\)?[.,;:]?$/.test(above.sort((a, b) => a.x0 - b.x0).map(c => c.ch).join('').replace(/\s/g, ''))) return true;   // 요약문 빈칸 (A)______
      return s.x0 >= ax0 - sz * 1.5 && s.x1 <= ax1 + sz * 1.5;
    });
    body.forEach(c => {
      if (c.blank) { c.ul = false; c.col = (c.x0 + c.x1) / 2 < gx ? 0 : 1; return; }
      const cx = (c.x0 + c.x1) / 2;
      c.ul = c.ch.trim() !== '' && ulSegs.some(s => inBand(s, c) && s.x0 <= cx && s.x1 >= cx);
      c.col = cx < gx ? 0 : 1;
    });
    for (const col of [0, 1]) {
      const cs = body.filter(c => c.col === col).sort((a, b) => (b.y - a.y) || (a.x0 - b.x0));
      const lines = [];
      cs.forEach(c => {
        const ln = lines.find(l => Math.abs(l.y - c.y) < Math.max(1.5, c.size * 0.3));
        if (ln) ln.cs.push(c); else lines.push({ y: c.y, cs: [c] });
      });
      lines.sort((a, b) => b.y - a.y);
      const built = lines.map(l => {
        l.cs.sort((a, b) => a.x0 - b.x0);
        // 글자 → 단어 (공백 글자 또는 글자 사이 틈으로 구분)
        const words = [];
        let w = null, prev = null;
        l.cs.forEach(c => {
          const gap = prev ? c.x0 - prev.x1 : 0;
          if (/\s/.test(c.ch)) { w = null; prev = c; return; }
          if (!w || gap > c.size * 0.2) { w = { cs: [] }; words.push(w); }
          w.cs.push(c); prev = c;
        });
        let html = '', plain = '';
        let openI = false, openU = false, openB = false, nBold = 0;
        words.forEach((wd, wi) => {
          const txt = wd.cs.map(c => c.ch).join('');
          const ital = wd.cs.filter(c => c.italic && /[A-Za-z]/.test(c.ch)).length >= Math.max(1, wd.cs.filter(c => /[A-Za-z]/.test(c.ch)).length * 0.6);
          const und = wd.cs.filter(c => c.ul).length >= wd.cs.length * 0.5;
          const lat = wd.cs.filter(c => /[A-Za-z0-9]/.test(c.ch));
          const bold = lat.length ? lat.filter(c => c.bold).length >= lat.length * 0.6 : (wd.cs.every(c => c.bold) && openB);
          if (bold) nBold++;
          const sep = wi ? ' ' : '';
          // 태그는 단어 사이 공백 바깥에서 열고 닫습니다.
          let pre = '';
          if (openU && !und) { pre += '</u>'; openU = false; }
          if (openI && !ital) { pre += '</i>'; openI = false; }
          if (openB && !bold) { if (openI) { pre += '</i>'; openI = false; } pre += '</b>'; openB = false; }
          html += pre + sep;
          if (bold && !openB) { if (openI) { html += '</i>'; openI = false; } html += '<b>'; openB = true; stats.bold = (stats.bold || 0) + 1; }
          if (ital && !openI) { html += '<i>'; openI = true; stats.italic++; }
          if (und && !openU) { html += '<u>'; openU = true; stats.underline++; }
          html += txt; plain += sep + txt;
        });
        if (openU) html += '</u>';
        if (openI) html += '</i>';
        if (openB) html += '</b>';
        // 글꼴 전용 기호로 된 글머리표(줄 맨 앞) → ∙
        const PUA = /[\uE000-\uF8FF]|[\uDB80-\uDBFF][\uDC00-\uDFFF]/;
        if (words.length > 1 && PUA.test(words[0].cs.map(c => c.ch).join('')) && words[0].cs.length <= 2) { html = html.replace(new RegExp('^((?:<[a-z]+>)*)(?:' + PUA.source + ')+\\s*'), '$1∙'); plain = plain.replace(new RegExp('^(?:' + PUA.source + ')+\\s*'), '∙'); }
        const wholeBold = words.length > 0 && nBold === words.length;
        const startsBold = /^<b>/.test(html);
        const x0 = l.cs[0].x0, x1 = l.cs[l.cs.length - 1].x1;
        const size = l.cs.map(c => c.size).sort((a, b) => a - b)[Math.floor(l.cs.length / 2)];
        const trail = /\s/.test(l.cs[l.cs.length - 1].ch);      // 줄 끝 공백 = 낱말 사이에서 줄이 바뀜
        return { page: pn, col, html, plain, x0, x1, size, trail, wholeBold, startsBold };
      }).filter(l => l.plain.trim());
      // 단의 본문 왼쪽·오른쪽 끝: 가장 흔한 줄 시작·끝 위치
      const mode = arr => { const m = {}; arr.forEach(v => { const k = Math.round(v); m[k] = (m[k] || 0) + 1; }); return Number(Object.keys(m).sort((a, b) => m[b] - m[a])[0]); };
      const left = mode(built.map(l => l.x0));
      const maxR = Math.max(...built.map(l => l.x1));
      const right = mode(built.map(l => l.x1).filter(x => x > left + (maxR - left) * 0.75));   // 짧은 줄(선택지 등)은 빼고 셉니다
      built.forEach(l => { l.colRight = right; l.colLeft = left; });
      allLines.push(...built);
    }
  }
  // 본문 글자 크기(가장 흔한 크기)
  const sizes = {};
  allLines.forEach(l => { const k = Math.round(l.size * 2) / 2; sizes[k] = (sizes[k] || 0) + l.plain.length; });
  const bodySize = Number(Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a])[0]) || 11;

  // 줄 → 문단: 들여쓴 줄·문항 시작 줄에서 새 문단, 단 오른쪽 끝까지 차지 않은 줄 뒤에서 끊기, 나머지는 이어 붙입니다.
  const out = [], outTrail = [];
  let cur = '', curLeft = null, curTrail = false, contPrev = false;
  const flush = () => { if (cur.trim()) { out.push(cur.trim()); outTrail.push(curTrail); } cur = ''; curLeft = null; };
  allLines.forEach((l, idx) => {
    let html = l.html.trim();
    const plain = l.plain.trim();
    html = html.replace(/^<b>(\d{1,2}\s*[.．])<\/b>\s*/, '$1 ').replace(/^<b>(\d{1,2}\s*[.．])\s+/, '$1 <b>').replace(/^<i>(\d{1,2}\s*[.．])<\/i>\s*/, '$1 ').replace(/^<i>(\d{1,2}\s*[.．])\s+/, '$1 <i>').replace(/^(\d{1,2}[.．])\s*<i><\/i>/, '$1');
    if (/^(\[\s*\d{1,2}\s*[~∼～\-–]|\d{1,2}\s*[.．]\s*[가-힣])/.test(plain) || /^[가-힣]/.test(plain)) html = html.replace(/<\/?b>/g, '');   // 문항 머리·한글 줄의 굵게는 뺍니다
    const isFoot = /^\*/.test(plain) && l.size < bodySize * 0.95;
    const startsBlock = /^(\d{1,2}\s*[.．]\s*\S|\[\s*\d{1,2}\s*[~∼～\-–]\s*\d{1,2}\s*\]|[①②③④⑤]|\(\s*[A-D]\s*\)|정답)/.test(plain);
    if (isFoot) { flush(); out.push('<r>' + html + '</r>'); outTrail.push(false); stats.footnote++; return; }
    const indented = curLeft != null && l.x0 > curLeft + bodySize * 0.6;
    // 안내문 같은 글: 글머리표(∙ ※)·가운데 줄·굵은 제목으로 시작하는 줄은 새 줄입니다.
    const bullet = /^([∙•·※▪■□◦‣]|[\u00ad\-–]\s)/.test(plain);
    if (/^\u00ad\s/.test(plain)) html = html.replace(/\u00ad/, '-').replace(/\s\u00ad\s/g, '\n- ');      // 글머리표로 쓴 기호 (한 줄에 여러 개면 나눕니다)
    const centered = l.x0 > l.colLeft + l.size * 2 && l.x1 < l.colRight - l.size * 2 && Math.abs((l.x0 + l.x1) / 2 - (l.colLeft + l.colRight) / 2) < l.size * 1.5;
    const boldHead = (l.wholeBold || l.startsBold) && /[A-Za-z]/.test(plain) && !/^\d{1,2}\s*[.．]/.test(plain);
    if (centered && !startsBlock) { flush(); cur = '<c>' + html + '</c>'; curTrail = !!l.trail; flush(); return; }
    if (startsBlock || (indented && !contPrev) || bullet || boldHead || !cur) {
      flush(); cur = html; curLeft = startsBlock && /^\d/.test(plain) ? null : l.x0;
      if (/^\d{1,2}\s*[.．]/.test(plain) && /[가-힣]/.test(plain)) { flush(); }       // 문항 첫 줄(질문)은 따로 둡니다
    } else {
      if (curLeft == null || l.x0 < curLeft) curLeft = l.x0;
      const tail = cur.replace(/(<\/[a-z]+>)+$/, '');
      if (/­$/.test(tail)) cur = cur.replace(/­((<\/[a-z]+>)*)$/, '-$1') + html;   // 줄 끝 소프트 하이픈 = 하이픈
      else if (/[A-Za-z]-$/.test(tail)) cur += html;                                          // 줄 끝 하이픈: 붙여 씀
      else if (/[가-힣]$/.test(tail) && /^[가-힣]/.test(plain)) cur += (curTrail || /[다요]\.?$/.test(tail) ? ' ' : '') + html;  // 한글 문장이 줄에서 끊김
      else cur += ' ' + html;
    }
    curTrail = !!l.trail;
    const next = allLines[idx + 1];
    const short = l.x1 < l.colRight - bodySize * 1.5;
    if (l.wholeBold && /[A-Za-z]/.test(plain)) { flush(); return; }        // 굵은 제목 줄은 그 줄로 끝
    // 상자 안 안내문처럼 단보다 좁은 글: 영어 소문자·쉼표로 끝나고 다음 줄이 평범한 글이면 이어지는 문장입니다.
    const cont = next && next.col === l.col && next.page === l.page && /[a-z,]$/.test(plain) && (l.x1 - l.x0) > (l.colRight - l.colLeft) * 0.6 && !/[가-힣]/.test(plain) && qbPlainNextLine(next, bodySize);
    contPrev = !!cont && !!cur;
    if ((short && !cont) || !next) { if (!(/^\d{1,2}\s*[.．]/.test(plain) && /[가-힣]/.test(plain))) flush(); }
  });
  flush();
  // 질문이 두 줄에 걸친 경우(예: "… 적절한 것을 고 / 르시오.") 한 줄로 합칩니다.
  const merged = [];
  let mergedTrail = false;
  out.forEach((line, oi) => {
    const prev = merged[merged.length - 1];
    // 문항 질문 줄·묶음 지시문([36~37] …)이 다음 줄로 넘어간 경우
    if (prev && /^(\d{1,2}\s*[.．]|\[\s*\d{1,2}\s*[~∼～\-–])/.test(prev) && /[가-힣]/.test(prev) && !/[?？]|시오\.|\[\s*\d\s*점\s*\]$/.test(prev) && /^[가-힣(]/.test(line) && line.length < 60) merged[merged.length - 1] = prev + (mergedTrail || /[,.)]$/.test(prev) || /^\(/.test(line) ? ' ' : '') + line;
    else merged.push(line);
    mergedTrail = outTrail[oi];
  });
  let text = merged.join('\n').replace(/<(i|u)>\s*<\/\1>/g, '').replace(/[ \t]{2,}/g, ' ');
  text = text
    .replace(/<\/(i|u)>(\s+)<\1>/g, '$2')                                   // 이어진 같은 태그는 하나로
    .replace(/([.,;:!?’”"']+)<\/(i|u)>/g, '</$2>$1')                          // 끝 문장부호는 태그 밖으로
    .replace(/<u>\s*([①②③④⑤]|\([a-e]\))\s*/g, '$1<u>')                  // ①<u>단어</u> 형식
    .replace(/([①②③④⑤]|\([a-e]\))\s+<u>/g, '$1<u>')
    .replace(/<u>([^<]*?[A-Za-z0-9.,’'"”)])\s?(이|가|을|를|은|는|의)<\/u>/g, '<u>$1</u>$2')   // 조사는 밑줄 밖으로
    .replace(/^<u>\s*\(([A-E])\)\s*<\/u>$/gm, '($1)')                          // 상자에 든 단락 표시 (B) (C) (D)
    .replace(/<u>([*\s]+)<\/u>/g, '$1')                                         // 각주 별표의 밑줄
    .replace(/<u>\s*\(([A-E])\)\s*<\/u>/g, '($1)______________')            // 요약문 빈칸 (A)
    .replace(/<(i|u)>\s*<\/\1>/g, '')
    .replace(/^\s*$/gm, '').replace(/\n{2,}/g, '\n').trim();
  text = text.replace(/^(?:<[a-z]+>)*[\uE000-\uF8FF\u{F0000}-\u{FFFFD}]+(?:<\/[a-z]+>)*$/gmu, '↓').replace(/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}]/gu, '');   // 글꼴 전용 기호(요약 화살표 등)
  for (let k = 0; k < 2; k++) text = text.replace(/<(i|u|b|c)>[\s\u00a0]*<\/\1>/g, '');
  text = text.replace(/^\s*$/gm, '').replace(/\n{2,}/g, '\n').trim();
  text = qbMergeFootnotes(qbStripFooter(text));
  return { text: text, stats: stats, bodySize: bodySize };
}
/* ===== QB_PDF_END ===== */

/* ===== QB_KEY_START: 해설지 PDF → 정답·해석·풀이·어휘 =====
 * 두 가지 해설지 형식을 읽습니다.
 *  - 교육청형: 3단, "18. [출제의도] …" 아래 해석 → (어법·어휘 문항은 ①/(a)로 시작하는 풀이) → 한 줄에 하나씩 어휘
 *  - 문항별 표시형: 1단, "18. [출제 의도] …" 아래 [해석] / [풀이] / [Words and Phrases]
 *  - 장문은 [41~42] 아래에 공통 해석·어휘, 41. 42. 아래에 각 문항 풀이가 있습니다.
 *  - 정답표: "1 ③ 2 ② …" 또는 "01. ⑤ 02. ① …"
 * 줄 끝 공백이 있으면 띄어 쓰고, 없으면 낱말이 줄에서 끊긴 것으로 보고 붙여 씁니다.
 */
const QB_CIRC = '①②③④⑤';
const QB_KEY_LABEL = /^\[\s*(해석|본문 해석|풀이|해설|정답 풀이|Words\s*(?:and|&)\s*Phrases|어휘|Vocabulary)\s*\]\s*(.*)$/i;

// PDF → 페이지·단 순서의 줄 목록
async function qbKeyLines(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data: data, disableFontFace: true, isEvalSupported: false }).promise;
  let lines = [];
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn);
    const vp = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const seg = qbPdfSegments(ops, pdfjs.OPS);
    const chars = qbPdfChars(ops, pdfjs.OPS);
    // 단 구분: 길게 그어진 세로선들 (없으면 1단)
    const cuts = [];
    seg.vs.filter(v => v.y1 - v.y0 > vp.height * 0.4 && v.x > vp.width * 0.15 && v.x < vp.width * 0.85)
      .sort((a, b) => a.x - b.x).forEach(v => { if (!cuts.length || v.x - cuts[cuts.length - 1] > 20) cuts.push(v.x); });
    const colOf = x => { let k = 0; while (k < cuts.length && x > cuts[k]) k++; return k; };
    // 단 구분선이 있으면 그 선보다 위(머리말: "2022학년도 7월 전국연합학력평가 … 고3")는 뺍니다.
    const colLines = seg.vs.filter(v => v.y1 - v.y0 > vp.height * 0.4 && v.x > vp.width * 0.15 && v.x < vp.width * 0.85);
    const bodyTop = colLines.length ? Math.max(...colLines.map(v => v.y1)) + 14 : Infinity;
    const bodyBottom = -Infinity;   // 아래쪽은 쪽 번호뿐이라 자르지 않습니다 (본문 마지막 줄이 선보다 아래로 내려가는 경우가 있음)
    for (let col = 0; col <= cuts.length; col++) {
      const cs = chars.filter(c => c.y <= bodyTop && c.y >= bodyBottom && colOf((c.x0 + c.x1) / 2) === col).sort((a, b) => (b.y - a.y) || (a.x0 - b.x0));
      const ls = [];
      cs.forEach(c => {
        const ln = ls.find(l => Math.abs(l.y - c.y) < Math.max(1.5, c.size * 0.3));
        if (ln) ln.cs.push(c); else ls.push({ y: c.y, cs: [c] });
      });
      ls.sort((a, b) => b.y - a.y);
      const built = [];
      ls.forEach(l => {
        l.cs.sort((a, b) => a.x0 - b.x0);
        let s = '', prev = null;
        l.cs.forEach(c => {
          if (prev && !/\s$/.test(s) && !/^\s/.test(c.ch) && c.x0 - prev.x1 > c.size * 0.2) s += ' ';
          s += c.ch; prev = c;
        });
        const vis = l.cs.filter(c => c.ch.trim());
        if (!vis.length) return;
        const text = s.replace(/[\s ]+/g, ' ').trim();
        // 쪽 번호·머리말
        if (/^\d{1,3}$/.test(text) || /^[•·]\s*영어\s*영역\s*[•·]$/.test(text)) return;
        const size = vis.map(c => c.size).sort((a, b) => a - b)[Math.floor(vis.length / 2)];
        built.push({ page: pn, yr: l.y / vp.height, col, text: text.replace(/­/g, '-'), trail: /\s$/.test(s), x0: vis[0].x0, x1: vis[vis.length - 1].x1, size });
      });
      // 이 단의 왼쪽·오른쪽 기준선 (가장 흔한 값)
      const mode = arr => { const m = {}; arr.forEach(v => { const k = Math.round(v); m[k] = (m[k] || 0) + 1; }); return Number(Object.keys(m).sort((a, b) => m[b] - m[a])[0]); };
      const left = mode(built.map(l => l.x0));
      const maxR = Math.max(...built.map(l => l.x1));
      const right = mode(built.map(l => l.x1).filter(x => x > left + (maxR - left) * 0.75));
      built.forEach(l => { l.left = left; l.right = right; l.short = l.x1 < right - l.size * 1.5; });
      lines.push(...built);
    }
  }
  // 여러 쪽에 똑같이 되풀이되는 짧은 줄(시험 이름·학년 같은 머리말)은 뺍니다.
  if (doc.numPages >= 2) {
    const pagesOf = {};
    lines.forEach(l => { if (l.text.length <= 30 && (l.yr > 0.85 || l.yr < 0.08)) (pagesOf[l.text] = pagesOf[l.text] || new Set()).add(l.page); });   // 쪽 맨 위·맨 아래에 있는 줄만
    const rep = new Set(Object.keys(pagesOf).filter(t => pagesOf[t].size >= Math.max(2, Math.ceil(doc.numPages * 0.5)) && !/^\[|^\d{1,2}\s*[.~∼]/.test(t)));
    lines = lines.filter(l => !(rep.has(l.text) && (l.yr > 0.85 || l.yr < 0.08)) && !/^(\d{4}\s*학년도.*|.*전국연합학력평가|정답\s*및\s*해설|고\s*[1-3]|[•·]?\s*영어\s*영역\s*[•·]?)$/.test(l.text));
  }
  return { lines, pages: doc.numPages };
}

// 줄들 → 문단 (줄 끝 공백 규칙으로 이어 붙이기)
function qbKeyParas(ls) {
  const out = [];
  let cur = null;
  ls.forEach(l => {
    const t = l.text;
    const marker = /^([①②③④⑤]|\([A-E]\)\s|[(（][a-e][)）]|[남여]\s*:|[WM]\s*:|\*)/.test(t);
    if (!cur || marker || cur.short || (!cur.trail && /[.?!]$/.test(cur.s) && /^[가-힣※∙•]/.test(t))) {
      if (cur) out.push(cur.s);
      cur = { s: t, short: l.short, trail: l.trail };
    } else {
      const glue = cur.trail ? ' ' : (/[A-Za-z0-9,.;:)]$/.test(cur.s) && /^[A-Za-z(]/.test(t) && !/-$/.test(cur.s) ? ' ' : '');
      cur.s += glue + t; cur.short = l.short; cur.trail = l.trail;
    }
  });
  if (cur) out.push(cur.s);
  return out.map(s => s.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
}

// 어휘 줄들 → "낱말 뜻 / 낱말 뜻"
function qbKeyVocab(ls, oneLineEach) {
  const items = [];
  ls.forEach(l => {
    const t = l.text;
    if (oneLineEach) {
      if (items.length && !qbKeyIsVocabStart(t)) items[items.length - 1] += (items[items.length - 1].endsWith(' ') ? '' : (/[가-힣]$/.test(items[items.length - 1]) && /^[가-힣]/.test(t) ? '' : ' ')) + t;
      else items.push(t);
    } else {
      // 한 줄에 여러 개: 일단 이어 붙인 뒤 아래에서 나눕니다.
      const last = items.length ? items[items.length - 1] : null;
      if (last == null) items.push(t);
      else items[items.length - 1] = last + (/[가-힣]$/.test(last) && /^[가-힣]/.test(t) && !l.prevTrail ? '' : ' ') + t;
    }
  });
  if (!oneLineEach && items.length) {
    // 한글 뜻(또는 괄호) 뒤에 영어 낱말이 오면 새 항목입니다. (예: "기여하다 responsibility 책임")
    const all = items.pop();
    items.push(...all.split(/(?<=[^A-Za-z\s\-–,\/~∼'’])\s+(?=[A-Za-z])/));
  }
  return items.map(s => s.replace(/\s+/g, ' ').trim()).filter(s => /[가-힣]/.test(s) && /[A-Za-z]/.test(s));
}
// "maintenance 유지, 관리" 처럼 영어 낱말 + 띄어쓰기 + 한글 뜻으로 시작하는 줄
function qbKeyIsVocabStart(t) {
  const m = t.match(/^([A-Za-z~∼(][^가-힣]*?)([가-힣(~∼])/);
  if (!m) return false;
  return /[\s~∼]$/.test(m[1]) || /\s$/.test(m[1].replace(/[~∼(]+$/, ''));
}

/**
 * 해설지 PDF 분석. 반환:
 * { answers:{번호:1~5}, items:{번호:{intent, trans, expl, vocab}}, groups:[{from,to,trans,vocab}], pages, format }
 */
async function qbPdfKeyParse(pdfjs, data) {
  const { lines, pages } = await qbKeyLines(pdfjs, data);
  const answers = {};
  lines.forEach(l => {
    const ms = [...l.text.matchAll(/(?:^|[^\d])(\d{1,2})\s*\.?\s*([①②③④⑤])/g)];
    if (ms.length >= 3) ms.forEach(m => { const n = Number(m[1]); if (n >= 1 && n <= 50 && answers[n] == null) answers[n] = QB_CIRC.indexOf(m[2]) + 1; });
  });
  // 덩어리 나누기
  const blocks = [];
  let cur = null;
  lines.forEach(l => {
    const t = l.text;
    let m;
    if ((m = t.match(/^(\d{1,2})\s*[~∼～\-–]\s*(\d{1,2})\s*\.\s*\[\s*출제\s*의도\s*\]\s*(.*)$/))) { cur = { kind: 'group', from: Number(m[1]), to: Number(m[2]), intent: m[3].trim(), ls: [] }; blocks.push(cur); return; }
    if ((m = t.match(/^(\d{1,2})\s*\.\s*\[\s*출제\s*의도\s*\]\s*(.*)$/))) { cur = { kind: 'item', num: Number(m[1]), intent: m[2].trim(), ls: [] }; blocks.push(cur); return; }
    if ((m = t.match(/^\[\s*(\d{1,2})\s*[~∼～\-–]\s*(\d{1,2})\s*\]\s*(.*)$/)) && !/[가-힣]{6,}/.test(m[3])) { cur = { kind: 'group', from: Number(m[1]), to: Number(m[2]), ls: [] }; blocks.push(cur); return; }
    if (cur) cur.ls.push(l);
  });
  const labeled = blocks.some(b => b.ls.some(l => /^\[(해석|풀이|해설|Words and Phrases|어휘)\]$/.test(l.text)));
  const items = {}, groups = [];
  blocks.forEach(b => {
    let trans = [], expl = [], vocab = [];
    if (labeled) {
      let sec = 'trans';
      const bucket = { trans: [], expl: [], vocab: [] };
      // 첫 표시([해석] 등) 앞의 줄은 두 줄로 넘어간 출제의도입니다.
      const firstLabel = b.ls.findIndex(l => QB_KEY_LABEL.test(l.text));
      if (firstLabel > 0 && firstLabel <= 2 && b.ls.slice(0, firstLabel).every(l => !/[.?!]$/.test(l.text) && l.text.length < 40)) { b.intent = (b.intent || '') + ' ' + b.ls.slice(0, firstLabel).map(l => l.text).join(' '); b.ls = b.ls.slice(firstLabel); }
      b.ls.forEach(l => {
        const lb = l.text.match(QB_KEY_LABEL);
        if (lb) {
          sec = /해석|본문/.test(lb[1]) ? 'trans' : /풀이|해설/.test(lb[1]) ? 'expl' : 'vocab';
          if (lb[2] && lb[2].trim()) bucket[sec].push(Object.assign({}, l, { text: lb[2].trim() }));     // "[풀이] 내용…"처럼 표시 뒤에 바로 글이 오는 경우
          return;
        }
        bucket[sec].push(l);
      });
      bucket.vocab.forEach((l, i) => { l.prevTrail = i ? bucket.vocab[i - 1].trail : true; });
      trans = qbKeyParas(bucket.trans); expl = qbKeyParas(bucket.expl); vocab = qbKeyVocab(bucket.vocab, false);
    } else {
      // 표시 없는 형식: 문단 끝 다음에 오는 "영어 낱말 뜻" 줄부터 어휘
      const text = [], vs = [];
      let inVocab = false, prev = null;
      b.ls.forEach(l => {
        if (!inVocab && text.length && prev && qbKeyIsVocabStart(l.text) && (prev.short || (/[.?!’”")]$/.test(prev.text) && l.x1 < l.right - l.size * 3))) inVocab = true;
        else if (inVocab && !qbKeyIsVocabStart(l.text) && !/^[가-힣()\s,~∼·]+$/.test(l.text)) inVocab = false;   // 어휘 뒤에 이어진 글(드묾)
        (inVocab ? vs : text).push(l);
        prev = l;
      });
      const paras = qbKeyParas(text);
      if (b.kind === 'item') {
        // 해석 다음에 ①/(a)로 시작하는 문단부터는 풀이
        const k = paras.findIndex(p => /^([①②③④⑤]|[(（][a-e][)）])/.test(p));
        if (k === 0 && paras.length === 1) expl = paras;
        else if (k >= 0) { trans = paras.slice(0, k); expl = paras.slice(k); }
        else trans = paras;
      } else trans = paras;
      vocab = qbKeyVocab(vs, true);
    }
    if (b.kind === 'item') {
      const it = items[b.num] || (items[b.num] = { intent: b.intent, trans: [], expl: [], vocab: [] });
      it.trans.push(...trans); it.expl.push(...expl); it.vocab.push(...vocab);
    } else groups.push({ from: b.from, to: b.to, trans: trans, expl: expl, vocab: vocab });
  });
  // 표시 없는 형식에서 장문 문항 덩어리에 붙은 어휘는 묶음 쪽으로 옮깁니다.
  groups.forEach(g => {
    for (let n = g.from; n <= g.to; n++) {
      const it = items[n];
      if (!it) continue;
      g.vocab.push(...it.vocab); it.vocab = [];
      if (it.trans.length && !g.trans.length) { g.trans = it.trans; it.trans = []; }
    }
  });
  return { answers, items, groups, pages, format: labeled ? 'labeled' : 'plain' };
}

// 해설칸에 넣을 글. parts: {trans, expl, vocab}
function qbKeyCell(key, num, parts, isGroupHead) {
  const it = key.items[num] || { trans: [], expl: [], vocab: [] };
  const g = key.groups.find(x => num >= x.from && num <= x.to);
  const sec = [];
  const trans = g && g.trans.length ? g.trans : it.trans;
  let expl;
  if (g && isGroupHead) {
    expl = [];
    for (let n = g.from; n <= g.to; n++) { const m = key.items[n]; if (m && m.expl.length) expl.push(n + '번) ' + m.expl.join('\n')); }
    if (!expl.length && g.expl && g.expl.length) expl = [g.expl.join('\n')];
  } else expl = it.expl.length ? [it.expl.join('\n')] : [];
  const vocab = (g && g.vocab.length ? g.vocab : []).concat(it.vocab);
  const want = [];
  if (parts.trans && trans.length) want.push(['해석', trans.join('\n')]);
  if (parts.expl && expl.length) want.push(['풀이', expl.join('\n')]);
  if (parts.vocab && vocab.length) want.push(['어휘', vocab.join(' / ')]);
  if (!want.length) return '';
  if (want.length === 1 && want[0][0] === '해석') return want[0][1];    // 해석만이면 기존 시트처럼 표시 없이
  want.forEach(([h, t]) => sec.push('<b>[' + h + ']</b> ' + t));
  return sec.join('\n');
}
/* ===== QB_KEY_END ===== */

/* ===================== 문제은행 편집기 화면 (관리자) =====================
 * 왼쪽: 시험지(시트) 고르기 · 문항 목록 / 가운데: 항목 입력칸 + 태그 버튼 / 오른쪽: 학생 화면 미리보기
 * - 고친 내용은 문항마다 따로 기억하다가 [저장]을 누르면 바뀐 칸만 시트에 씁니다.
 * - 새 문항은 시트 오른쪽 끝에 붙습니다. (열을 지우거나 끼워 넣지 않아 기존 풀이 기록이 안전합니다)
 * - 장문 42·44·45번처럼 다른 문항 칸을 수식(=Y7)으로 가져오는 칸은 '연결'로 표시합니다.
 */
const QB_FIELDS = [
  { row: 0, key: 'id', label: 'ID' }, { row: 1, key: 'source', label: '출처' }, { row: 2, key: 'type', label: '유형' },
  { row: 3, key: 'link', label: '연계' }, { row: 4, key: 'diff', label: '난이도' }, { row: 5, key: 'q', label: '질문' },
  { row: 6, key: 'b1', label: 'Box1' }, { row: 7, key: 'b2', label: 'Box2' }, { row: 8, key: 'b3', label: 'Box3' }, { row: 9, key: 'b4', label: 'Box4' },
  { row: 10, key: 'o1', label: '①' }, { row: 11, key: 'o2', label: '②' }, { row: 12, key: 'o3', label: '③' }, { row: 13, key: 'o4', label: '④' }, { row: 14, key: 'o5', label: '⑤' },
  { row: 15, key: 'ans', label: '정답' }, { row: 16, key: 'exp', label: '해설' }
];
const QB_TAGS = [
  { t: 'u', label: '<u>밑줄</u>', title: '밑줄 <u>…</u> (Ctrl+U)' },
  { t: 'b', label: '<b>굵게</b>', title: '굵게 <b>…</b> (Ctrl+B)' },
  { t: 'i', label: '<i>기울임</i>', title: '기울임 <i>…</i> (Ctrl+I)' },
  { t: 'red', label: '<span class="txt-red">빨강</span>', title: '빨간 글자 <red>…</red>' },
  { t: 'blue', label: '<span class="txt-blue">파랑</span>', title: '파란 글자 <blue>…</blue>' },
  { t: 'green', label: '<span class="txt-green">초록</span>', title: '초록 글자 <green>…</green>' },
  { t: 'orange', label: '<span class="txt-orange">주황</span>', title: '주황 글자 <orange>…</orange>' },
  { sep: true },
  { t: 'c', label: '가운데', title: '가운데 정렬 <c>…</c>' },
  { t: 'r', label: '오른쪽', title: '오른쪽 정렬·작은 글자 <r>…</r> (출처·각주용)' },
  { t: 'box', label: '▭ 상자', title: '네모 상자 <box>…</box>' },
  { t: 'sup', label: 'x²', title: '위첨자 <sup>…</sup>' },
  { t: 'sub', label: 'x₂', title: '아래첨자 <sub>…</sub>' },
  { sep: true },
  { act: 'table', label: '▦ 표', title: '표 <table> (칸은 | 로, 칸 안 줄바꿈은 ;; 로 구분)' },
  { act: 'blank', label: '빈칸 ___', title: '빈칸 밑줄 넣기' },
  { act: 'arrow', label: '⇩', title: '요약문 화살표 <c>⇩</c>' },
  { act: 'img', label: '🖼 이미지', title: '이미지 주소 또는 구글 드라이브 파일 ID 넣기' },
  { act: 'circ', label: '①~⑤', title: '원문자 넣기' },
  { act: 'strip', label: '태그 지우기', title: '고른 부분의 태그를 모두 지웁니다' }
];

const QB = {
  sheets: [], sheet: null, sel: null, work: {}, drafts: [], seq: 0, busy: false, showAns: true, bound: false, focus: null, prevMode: 'print'
};

/* ---------- 작은 도구 ---------- */
const qbEsc = s => escapeHTML(s == null ? '' : String(s));
const qbAttr = s => escapeAttr(s == null ? '' : String(s));
function qbColLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function qbCall(func, args) {
  return gsCall(func, args || []).catch(err => {
    if (isMissingServerFunction(err)) throw new Error('서버(Code.gs)를 새 버전으로 배포해야 문제은행 편집기를 쓸 수 있습니다.');
    throw err;
  });
}
function qbBusy(on, msg) {
  QB.busy = on;
  const el = document.getElementById('qbBusy');
  if (el) { el.hidden = !on; el.textContent = msg || '처리 중...'; }
  document.querySelectorAll('#qbankPage [data-qb-busy]').forEach(b => { b.disabled = on; });
}
// 한 문항의 작업본: v(값) + f(수식) 17칸. 원본은 sheet.cols에 있습니다.
function qbOrig(key) {
  if (String(key).indexOf('d') === 0) { const d = QB.drafts.find(x => x.key === key); return d ? d.base : null; }
  const c = QB.sheet && QB.sheet.cols.find(x => x.col === Number(key));
  return c ? { v: c.v.slice(), f: c.f.slice() } : null;
}
function qbWork(key) {
  if (!QB.work[key]) { const o = qbOrig(key); if (!o) return null; QB.work[key] = { v: o.v.slice(), f: o.f.slice() }; }
  return QB.work[key];
}
function qbChangedRows(key) {
  const w = QB.work[key], o = qbOrig(key);
  if (!w || !o) return [];
  const rows = [];
  for (let r = 0; r < 17; r++) if ((w.f[r] || w.v[r]) !== (o.f[r] || o.v[r]) || !!w.f[r] !== !!o.f[r]) rows.push(r);
  return rows;
}
const qbIsDraft = key => String(key).indexOf('d') === 0;
const qbIsDirty = key => qbIsDraft(key) || qbChangedRows(key).length > 0;
function qbDirtyKeys() {
  const keys = Object.keys(QB.work).filter(k => !qbIsDraft(k) && qbChangedRows(k).length);
  return keys.concat(QB.drafts.map(d => d.key));
}

/* ---------- 시트 이름 → 기본 출처·ID 규칙 ---------- */
// 시트마다 직접 정한 기본 출처 (예: h3_23_11 → "고3 2024 수능"). 이 브라우저에 기억합니다.
function qbSrcOverrides() { try { return JSON.parse(localStorage.getItem('qb_src_override') || '{}') || {}; } catch (e) { return {}; } }
function qbSetSrcOverride(name, src) {
  const all = qbSrcOverrides();
  if (src) all[name] = src; else delete all[name];
  try { localStorage.setItem('qb_src_override', JSON.stringify(all)); } catch (e) { /* 저장 못 해도 이번 화면에서는 씁니다 */ }
  QB.srcOverride = all;
}
function qbAutoSourceFromName(name) {
  const m = String(name || '').match(/^([hm])([1-3])_(\d{2})_(\d{2})(기출|변형)?$/);
  if (!m) return '';
  return (m[1] === 'h' ? '고' : '중') + m[2] + ' 20' + m[3] + ' ' + m[4] + '월 ' + (m[5] || '원문');
}
function qbDefaultSource(sheetName) {
  const ov = (QB.srcOverride || (QB.srcOverride = qbSrcOverrides()))[sheetName];
  if (ov) return ov;
  const sh = QB.sheet;
  if (sh) {
    const cnt = {};
    sh.cols.forEach(c => { const s = (c.f[1] ? '' : c.v[1]) || c.hiddenSource; if (s) cnt[s] = (cnt[s] || 0) + 1; });
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (best) return best;
  }
  return qbAutoSourceFromName(sheetName);
}
function qbAllIds() {
  const ids = new Set();
  if (QB.sheet) QB.sheet.cols.forEach(c => { const w = QB.work[c.col]; const id = (w ? w.v[0] : c.v[0]); if (id) ids.add(id); });
  QB.drafts.forEach(d => { const w = QB.work[d.key]; if (w && w.v[0]) ids.add(w.v[0]); });
  return ids;
}
function qbSuggestId(num) {
  const name = QB.sheet ? QB.sheet.name : '';
  const ids = [...qbAllIds()];
  const pad = n => (n < 10 ? '0' : '') + n;
  const uniq = id => { if (!ids.includes(id)) return id; let k = 2; while (ids.includes(id + '_' + k)) k++; return id + '_' + k; };
  // 원문 시트: 시트명_번호 (예: h1_26_06_18)
  if (num && ids.some(id => id === name + '_' + pad(Number(String(id).split('_').pop())))) return uniq(name + '_' + pad(num));
  // 기출·변형·교과서 시트: 접두어_번호_글자+일련번호 (예: h1_24_03_21_GC001 → 다음 일련번호)
  const pat = ids.map(id => String(id).match(/^(.*)_(\d{1,2})_([A-Za-z]*)(\d{2,})$/)).filter(Boolean);
  if (pat.length) {
    const last = pat[pat.length - 1];
    const prefix = last[1], letters = last[3], width = last[4].length;
    const n = num ? pad(num) : last[2];
    const same = pat.filter(p => p[1] === prefix && p[2] === n && p[3] === letters).map(p => Number(p[4]));
    const seq = String((same.length ? Math.max(...same) : 0) + 1).padStart(width, '0');
    return uniq(prefix + '_' + n + '_' + letters + seq);
  }
  // 끝 숫자 하나 늘리기
  const tail = ids.map(id => String(id).match(/^(.*?)(\d+)$/)).filter(Boolean).pop();
  if (tail && !num) return uniq(tail[1] + String(Number(tail[2]) + 1).padStart(tail[2].length, '0'));
  return uniq((name || 'Q') + '_' + pad(num || (QB.sheet ? QB.sheet.cols.length + QB.drafts.length + 1 : 1)));
}
// 목록에 보일 짧은 번호 (ID에서 시트 이름 부분을 뺀 나머지)
function qbShortId(id) {
  const s = String(id || '');
  const base = QB.sheet ? QB.sheet.name.replace(/[가-힣]+$/, '') : '';
  return base && s.indexOf(base + '_') === 0 ? s.slice(base.length + 1) : s;
}
// ID에서 문항 번호 읽기: h1_26_09_18 → 18, h1_24_03_21_GC001 → 21, h1_25_CE1YBM(P)_13_002 → 13
function qbNumOf(id) {
  const seg = String(id || '').split('_');
  const last = seg[seg.length - 1] || '', prev = seg[seg.length - 2] || '';
  if (/^\d{1,2}$/.test(last)) return Number(last);
  if ((/^[A-Za-z]+\d+$/.test(last) || /^\d{3,}$/.test(last)) && /^\d{1,2}$/.test(prev)) return Number(prev);
  return 0;
}

/* ---------- 화면 틀 ---------- */
function qbRenderShell() {
  const page = document.getElementById('qbankPage');
  if (!page || page.dataset.ready === '1') return;
  page.dataset.ready = '1';
  page.innerHTML = `
  <div class="qb-top">
    <h2 class="qb-title">🗂 문제은행 편집기</h2>
    <span id="qbBusy" class="qb-busy" hidden>처리 중...</span>
    <span class="qb-top-hint">고친 내용은 [저장]을 눌러야 시트에 들어갑니다. 열을 지우지 않으므로 기존 풀이 기록은 그대로 유지됩니다.</span>
  </div>
  <div class="qb-layout">
    <aside class="qb-side">
      <div class="qb-side-row">
        <select id="qbSheetSelect" aria-label="시험지 선택"><option value="">시험지(시트) 선택</option></select>
        <button type="button" class="qb-btn" data-qb="reload-sheets" data-qb-busy title="시트 목록 새로 받기">↻</button>
      </div>
      <div class="qb-side-row">
        <button type="button" class="qb-btn qb-btn-primary" data-qb="new-sheet" data-qb-busy>＋ 새 시험지</button>
        <button type="button" class="qb-btn" data-qb="add" data-qb-busy>＋ 문항 추가</button>
        <button type="button" class="qb-btn" data-qb="import" data-qb-busy title="문제·정답(해설지)·난이도를 PDF나 글로 가져옵니다">📥 가져오기</button>
      </div>
      <div id="qbSrcBar" class="qb-srcbar" hidden></div>
      <input type="search" id="qbFilter" class="qb-filter" placeholder="문항 찾기 (번호·유형·질문·지문)">
      <div id="qbList" class="qb-list"><div class="qb-empty">왼쪽 위에서 시험지를 고르세요.</div></div>
      <div class="qb-savebar">
        <span id="qbDirtyInfo">저장할 변경 없음</span>
        <button type="button" class="qb-btn qb-btn-primary" data-qb="save-all" data-qb-busy disabled>모두 저장</button>
      </div>
    </aside>
    <section class="qb-main" id="qbMain"><div class="qb-empty">문항을 고르거나 새 문항을 추가하세요.</div></section>
    <section class="qb-prev">
      <div class="qb-prev-head">
        <b>미리보기</b>
        <span class="qb-seg" role="tablist">
          <button type="button" class="qb-seg-btn active" data-qb="prev-print" title="과제 출제 후 인쇄할 때와 같은 단 너비·글자 크기">🖨 인쇄 크기</button>
          <button type="button" class="qb-seg-btn" data-qb="prev-online" title="학생 온라인 풀이 화면">💻 온라인</button>
        </span>
        <label class="qb-check"><input type="checkbox" id="qbShowAns" checked> 정답·해설</label>
      </div>
      <div id="qbPreview" class="qb-prev-body"><div class="qb-empty">문항을 고르면 여기에 보입니다.</div></div>
    </section>
  </div>
  <div id="qbModal" class="qb-modal" hidden><div class="qb-modal-box" role="dialog" aria-modal="true"></div></div>`;
}

/* ---------- 진입 ---------- */
function initQbankPage() {
  qbRenderShell();
  qbBind();
  if (!QB.sheets.length) qbLoadSheets();
}
function qbLoadSheets(keepSel) {
  qbBusy(true, '시트 목록을 받는 중...');
  return qbCall('qbListSheets').then(res => {
    QB.sheets = (res && res.sheets) || [];
    qbRenderSheetSelect(keepSel);
  }).catch(err => showToast('시트 목록을 받지 못했습니다: ' + qbEsc(err.message || err), 'error'))
    .finally(() => qbBusy(false));
}
function qbRenderSheetSelect(keep) {
  const sel = document.getElementById('qbSheetSelect');
  if (!sel) return;
  const groups = {};
  const label = n => { const m = n.match(/^([hm])([1-3])_/); return m ? (m[1] === 'h' ? '고' : '중') + m[2] : '기타'; };
  QB.sheets.forEach(s => { (groups[label(s.name)] = groups[label(s.name)] || []).push(s); });
  const order = ['중1', '중2', '중3', '고1', '고2', '고3', '기타'];
  sel.innerHTML = '<option value="">시험지(시트) 선택</option>' + order.filter(g => groups[g]).map(g =>
    `<optgroup label="${g}">` + groups[g].map(s => `<option value="${qbAttr(s.name)}">${qbEsc(s.name)} (${s.count})</option>`).join('') + '</optgroup>'
  ).join('');
  const want = keep || (QB.sheet && QB.sheet.name) || '';
  if (want) sel.value = want;
}
function qbOpenSheet(name) {
  const go = () => {
    QB.work = {}; QB.drafts = []; QB.sel = null;
    if (!name) { QB.sheet = null; qbRenderList(); qbRenderForm(); return; }
    qbBusy(true, name + ' 시트를 여는 중...');
    qbCall('qbLoadSheet', [name]).then(sh => {
      QB.sheet = sh;
      qbRenderList(); qbRenderForm();
    }).catch(err => showToast('시트를 열지 못했습니다: ' + qbEsc(err.message || err), 'error'))
      .finally(() => qbBusy(false));
  };
  if (qbDirtyKeys().length) {
    // 확인 전까지는 고르기 상자를 지금 시트로 되돌려 둡니다. (취소하면 그대로)
    const sel = document.getElementById('qbSheetSelect');
    sel.value = QB.sheet ? QB.sheet.name : '';
    showCustomConfirm('저장하지 않은 변경이 있습니다.<br>다른 시험지를 열면 <b>변경이 사라집니다.</b> 계속할까요?', () => { sel.value = name; go(); });
  } else go();
}

/* ---------- 문항 목록 ---------- */
// 목록: 시트 열 순서대로. 틀 칸을 채울 새 문항은 그 틀 칸 자리에, 끝에 붙일 새 문항은 맨 아래에 보입니다.
function qbListItems() {
  if (!QB.sheet) return [];
  const items = QB.sheet.cols.map(c => {
    const d = QB.drafts.find(x => x.target === c.col);
    return d ? { key: d.key, draft: d } : { key: String(c.col), col: c };
  });
  QB.drafts.filter(d => d.target == null).forEach(d => items.push({ key: d.key, draft: d }));
  return items;
}
function qbRenderSrcBar() {
  const bar = document.getElementById('qbSrcBar');
  if (!bar) return;
  if (!QB.sheet) { bar.hidden = true; return; }
  const src = qbDefaultSource(QB.sheet.name);
  bar.hidden = false;
  bar.innerHTML = `<span class="qb-muted">출처</span> <b title="새로 넣는 문항에 이 출처가 들어갑니다">${qbEsc(src || '(없음)')}</b>
    <button type="button" class="qb-btn qb-btn-sm" data-qb="src-edit" data-qb-busy>출처 바꾸기</button>`;
}
function qbSrcDialog() {
  if (!QB.sheet) return;
  const cur = qbDefaultSource(QB.sheet.name);
  const items = qbListItems().map(it => qbWork(it.key));
  const same = items.filter(w => !w.f[1] && w.v[1] && w.v[1] === cur).length;
  const other = items.filter(w => !w.f[1] && w.v[1] && w.v[1] !== cur).length;
  const hidden = QB.sheet.cols.filter(c => c.hidden).length;
  qbOpenModal(`
    <div class="qb-modal-head"><b>출처 바꾸기 → ${qbEsc(QB.sheet.name)}</b><button type="button" class="qb-x" data-qb="close-modal" aria-label="닫기">×</button></div>
    <div class="qb-modal-body">
      <div class="qb-muted">지금 출처: <b>${qbEsc(cur || '(없음)')}</b></div>
      <label class="qb-label qb-mt" for="qbSrcNew">새 출처</label>
      <div class="qb-ns-src">
        <input type="text" id="qbSrcNew" value="${qbAttr(cur)}" placeholder="예: 고3 2024 수능">
      </div>
      <label class="qb-check qb-mt"><input type="checkbox" id="qbSrcApply" checked${same ? '' : ' disabled'}> 이미 들어 있는 문항 ${same}개의 출처도 함께 바꾸기</label>
      <div class="qb-muted">학생 출제 목록의 출처 이름이 바뀝니다. 문항 번호(열)는 그대로라 풀이 기록은 유지됩니다.${other ? `<br>출처가 다른 문항 ${other}개는 그대로 둡니다.` : ''}${hidden ? `<br>숨긴 문항 ${hidden}개는 되살릴 때 원래 출처로 돌아옵니다.` : ''}</div>
    </div>
    <div class="qb-modal-foot"><button type="button" class="qb-btn" data-qb="close-modal">취소</button>
      <button type="button" class="qb-btn qb-btn-primary" data-qb="src-apply">바꾸기</button></div>`);
  const el = document.getElementById('qbSrcNew'); el.focus(); el.select();
}
function qbSrcApply() {
  const cur = qbDefaultSource(QB.sheet.name);
  const nv = document.getElementById('qbSrcNew').value.trim();
  if (!nv) { showToast('새 출처를 입력하세요.', 'error'); return; }
  let n = 0;
  if (document.getElementById('qbSrcApply').checked && nv !== cur) {
    qbListItems().forEach(it => { const w = qbWork(it.key); if (!w.f[1] && w.v[1] && w.v[1] === cur) { w.v[1] = nv; n++; } });
  }
  qbSetSrcOverride(QB.sheet.name, nv !== qbAutoSourceFromName(QB.sheet.name) ? nv : '');
  qbCloseModal();
  qbRenderList();
  if (QB.sel != null) qbRenderForm();
  showToast(n ? `${n}문항의 출처를 '${qbEsc(nv)}'(으)로 바꿨습니다. [모두 저장]을 눌러야 시트에 들어갑니다.` : `앞으로 넣는 문항의 출처를 '${qbEsc(nv)}'(으)로 씁니다.`, 'info');
}
function qbRenderList() {
  qbRenderSrcBar();
  const box = document.getElementById('qbList');
  if (!box) return;
  if (!QB.sheet) { box.innerHTML = '<div class="qb-empty">왼쪽 위에서 시험지를 고르세요.</div>'; qbUpdateDirty(); return; }
  const q = (document.getElementById('qbFilter') || {}).value || '';
  const needle = q.trim().toLowerCase();
  const rows = qbListItems().filter(it => {
    if (!needle) return true;
    const w = QB.work[it.key] || (it.col ? it.col : it.draft.base);
    return w.v.join(' ').toLowerCase().indexOf(needle) >= 0;
  }).map(it => {
    const w = QB.work[it.key] || (it.col ? { v: it.col.v, f: it.col.f } : it.draft.base);
    const chips = [];
    if (it.draft) chips.push(`<span class="qb-chip qb-chip-new">${it.draft.target != null ? qbColLetter(it.draft.target + 1) + '열 채움' : '새 문항'}</span>`);
    else {
      if (it.col.hidden) chips.push('<span class="qb-chip qb-chip-hide">숨김</span>');
      else if (!w.v[1] && !w.f[1]) chips.push('<span class="qb-chip qb-chip-off" title="출처가 비어 있어 출제 목록에 나오지 않습니다">빈 칸</span>');
      if (w.f.some(Boolean)) chips.push('<span class="qb-chip qb-chip-link" title="다른 문항 칸을 수식으로 가져옵니다">🔗</span>');
      if (qbChangedRows(it.key).length) chips.push('<span class="qb-chip qb-chip-dirty">수정됨</span>');
    }
    const label = qbShortId(w.v[0]) || (it.col ? qbColLetter(it.col.col + 1) + '열' : '(새 문항)');
    const stem = String(w.v[5] || '').replace(/<[^>]+>/g, '').slice(0, 40);
    return `<button type="button" class="qb-item${QB.sel === it.key ? ' active' : ''}${it.col && it.col.hidden ? ' is-hidden' : ''}" data-qb-item="${qbAttr(it.key)}">
      <span class="qb-item-top"><b>${qbEsc(label)}</b><span class="qb-item-type">${qbEsc(w.v[2] || '유형 없음')}</span>${w.v[4] ? `<span class="qb-item-diff">난이도 ${qbEsc(w.v[4])}</span>` : ''}${chips.join('')}</span>
      <span class="qb-item-stem">${qbEsc(stem || '(질문 없음)')}</span></button>`;
  });
  box.innerHTML = rows.length ? rows.join('') : '<div class="qb-empty">' + (needle ? '찾는 문항이 없습니다.' : '문항이 없습니다. [＋ 문항 추가]나 [📥 가져오기]로 넣으세요.') + '</div>';
  qbUpdateDirty();
}
function qbUpdateDirty() {
  const n = qbDirtyKeys().length;
  const info = document.getElementById('qbDirtyInfo');
  if (info) info.textContent = n ? `저장할 문항 ${n}개` : '저장할 변경 없음';
  const btn = document.querySelector('#qbankPage [data-qb="save-all"]');
  if (btn) btn.disabled = !n || QB.busy;
}

/* ---------- 입력칸 ---------- */
function qbFieldHtml(key, r, w, o) {
  const f = QB_FIELDS[r];
  const formula = w.f[r];
  const changed = o && ((w.f[r] || w.v[r]) !== (o.f[r] || o.v[r]));
  const cls = 'qb-field' + (changed ? ' changed' : '');
  if (formula) {
    // 연결(수식) 칸: 값은 다른 열에서 가져오므로 직접 고치지 않습니다.
    const m = formula.match(/^=\s*\$?([A-Z]{1,3})\$?(\d+)$/);
    const from = m ? QB.sheet && QB.sheet.cols.find(c => qbColLetter(c.col + 1) === m[1]) : null;
    const fromLabel = from ? `${qbShortId(from.v[0]) || m[1] + '열'} 문항의 ${QB_FIELDS[Number(m[2]) - 1] ? QB_FIELDS[Number(m[2]) - 1].label : m[2] + '행'}` : formula;
    const preview = String((qbOrig(key) || { v: [] }).v[r] || '').replace(/<[^>]+>/g, '').slice(0, 120);
    return `<div class="${cls} qb-linked" data-row="${r}"><div class="qb-label">${f.label}</div>
      <div class="qb-link-box"><span class="qb-chip qb-chip-link">🔗 ${qbEsc(fromLabel)}에서 가져옴</span>
        <code>${qbEsc(formula)}</code><span class="qb-link-prev">${qbEsc(preview)}${preview.length >= 120 ? '…' : ''}</span>
        <button type="button" class="qb-btn qb-btn-sm" data-qb="unlink" data-row="${r}" title="연결을 끊고 지금 값을 직접 입력할 수 있게 바꿉니다">직접 입력으로</button></div></div>`;
  }
  const val = qbAttr(w.v[r]);
  if (r === 0 || r === 1 || r === 3) {
    const list = r === 1 ? ' list="qbSourceList"' : '';
    return `<div class="${cls}" data-row="${r}"><label class="qb-label" for="qbF${r}">${f.label}</label><input id="qbF${r}" type="text" data-row="${r}" value="${val}"${list}${r === 3 ? ' placeholder="같은 지문을 쓰는 첫 문항 ID (장문 등)"' : ''}></div>`;
  }
  if (r === 2) return `<div class="${cls}" data-row="2"><label class="qb-label" for="qbF2">유형</label><input id="qbF2" type="text" data-row="2" value="${val}" list="qbTypeList"></div>`;
  if (r === 4) return `<div class="${cls}" data-row="4"><label class="qb-label" for="qbF4">난이도</label><input id="qbF4" type="number" min="1" max="15" data-row="4" value="${val}" placeholder="1~15"></div>`;
  if (r === 15) {
    const btns = [1, 2, 3, 4, 5].map(n => `<button type="button" class="qb-ans${String(w.v[15]).trim() === String(n) ? ' on' : ''}" data-qb="ans" data-n="${n}">${'①②③④⑤'[n - 1]}</button>`).join('');
    return `<div class="${cls}" data-row="15"><label class="qb-label" for="qbF15">정답</label><div class="qb-ans-row">${btns}<input id="qbF15" type="text" data-row="15" value="${val}" placeholder="번호 또는 서술형 답 (예: [A/B])"></div></div>`;
  }
  const rowsN = r === 5 ? 2 : (r >= 10 && r <= 14) ? 1 : r === 16 ? 4 : 5;
  return `<div class="${cls}" data-row="${r}"><label class="qb-label" for="qbF${r}">${f.label}</label><textarea id="qbF${r}" data-row="${r}" rows="${rowsN}" class="qb-ta" spellcheck="false">${qbEsc(w.v[r])}</textarea></div>`;
}
function qbRenderForm() {
  const main = document.getElementById('qbMain');
  if (!main) return;
  const key = QB.sel;
  const w = key != null ? qbWork(key) : null;
  if (!w) { main.innerHTML = '<div class="qb-empty">문항을 고르거나 새 문항을 추가하세요.</div>'; qbRenderPreview(); return; }
  const o = qbIsDraft(key) ? null : qbOrig(key);
  const col = qbIsDraft(key) ? null : QB.sheet.cols.find(c => c.col === Number(key));
  const draft = qbIsDraft(key) ? QB.drafts.find(d => d.key === key) : null;
  const where = col ? `${QB.sheet.name} · ${qbColLetter(col.col + 1)}열 · QID ${qbEsc(col.qid)}` :
    (draft && draft.target != null ? `${QB.sheet.name} · ${qbColLetter(draft.target + 1)}열(빈 칸)에 채움` : `${QB.sheet.name} · 저장하면 오른쪽 끝에 새 열로 추가`);
  const tb = QB_TAGS.map(t => t.sep ? '<span class="qb-tb-sep"></span>' :
    `<button type="button" class="qb-tb" data-qb-tag="${t.t || ''}" data-qb-act="${t.act || ''}" title="${qbAttr(t.title)}">${t.label}</button>`).join('');
  const fields = r => qbFieldHtml(key, r, w, o);
  const showBox = r => w.v[r] || w.f[r] || r === 6 || (w.extraBoxes || 0) >= r - 6;
  const warns = qbValidate(key);
  main.innerHTML = `
    <div class="qb-form-head">
      <div><div class="qb-form-title">${qbEsc(qbShortId(w.v[0]) || '(ID 없음)')} <span class="qb-muted">${qbEsc(w.v[2] || '')}</span></div>
        <div class="qb-muted qb-where">${where}</div></div>
      <div class="qb-form-actions">
        ${col && !col.empty ? `<button type="button" class="qb-btn" data-qb="${col.hidden ? 'unhide' : 'hide'}" data-qb-busy title="${col.hidden ? '출처를 되살려 출제 목록에 다시 나오게 합니다' : '출처를 메모로 옮겨 출제 목록에서 뺍니다 (열은 지우지 않음)'}">${col.hidden ? '되살리기' : '숨기기'}</button>` : ''}
        ${draft ? '<button type="button" class="qb-btn" data-qb="drop-draft">이 새 문항 버리기</button>' : `<button type="button" class="qb-btn" data-qb="revert" ${qbChangedRows(key).length ? '' : 'disabled'}>되돌리기</button>`}
        <button type="button" class="qb-btn qb-btn-primary" data-qb="save-one" data-qb-busy ${qbIsDirty(key) ? '' : 'disabled'}>저장</button>
      </div>
    </div>
    ${col && col.hidden ? `<div class="qb-note">숨긴 문항입니다. 원래 출처: <b>${qbEsc(col.hiddenSource)}</b></div>` : ''}
    ${warns.length ? `<div class="qb-warn">${warns.map(x => '• ' + qbEsc(x)).join('<br>')}</div>` : ''}
    <div class="qb-toolbar" id="qbToolbar">${tb}</div>
    <div id="qbToolPop" class="qb-toolpop" hidden></div>
    <div class="qb-grid4">${fields(0)}${fields(1)}${fields(2)}${fields(4)}</div>
    ${fields(3)}
    ${fields(5)}
    ${[6, 7, 8, 9].map(r => showBox(r) ? fields(r) : '').join('')}
    ${[7, 8, 9].some(r => !showBox(r)) ? '<button type="button" class="qb-btn qb-btn-sm qb-addbox" data-qb="add-box">＋ 상자(Box) 추가</button>' : ''}
    <div class="qb-opts">${[10, 11, 12, 13, 14].map(fields).join('')}</div>
    ${fields(15)}
    ${fields(16)}
    <details class="qb-help"><summary>태그 사용법</summary>
      <div><code>&lt;u&gt;밑줄&lt;/u&gt;</code> <code>&lt;b&gt;굵게&lt;/b&gt;</code> <code>&lt;i&gt;기울임&lt;/i&gt;</code> <code>&lt;red&gt; &lt;blue&gt; &lt;green&gt; &lt;orange&gt;</code> 글자색,
      <code>&lt;c&gt;가운데&lt;/c&gt;</code> <code>&lt;r&gt;오른쪽&lt;/r&gt;</code> <code>&lt;box&gt;상자&lt;/box&gt;</code> <code>&lt;sup&gt;</code> <code>&lt;sub&gt;</code><br>
      표: <code>&lt;table&gt;</code> 다음 줄부터 한 줄에 한 행, 칸은 <code>|</code>로 나눕니다. 칸 안 줄바꿈은 <code>;;</code>, 위 칸과 합치려면 칸을 비워 둡니다.<br>
      이미지: <code>&lt;c&gt;https://…jpg&lt;/c&gt;</code> 또는 <code>drive:구글드라이브파일ID</code><br>
      질문에 <code>&lt;box&gt;…&lt;/box&gt;</code>를 넣으면 질문 아래 네모 상자로 따로 보입니다.</div>
    </details>
    <datalist id="qbTypeList">${qbTypeOptions()}</datalist>
    <datalist id="qbSourceList">${qbSourceOptions()}</datalist>`;
  main.querySelectorAll('textarea.qb-ta').forEach(qbAutoGrow);
  qbRenderPreview();
}
function qbTypeOptions() {
  const set = new Set(Object.values(QB_STD_TYPES).concat(['불일치', '일치', '지칭', '서술형', '영영풀이']));
  if (QB.sheet) QB.sheet.cols.forEach(c => c.v[2] && set.add(c.v[2]));
  return [...set].map(t => `<option value="${qbAttr(t)}"></option>`).join('');
}
function qbSourceOptions() {
  const set = new Set();
  const d = QB.sheet ? qbDefaultSource(QB.sheet.name) : '';
  if (d) set.add(d);
  if (QB.sheet) QB.sheet.cols.forEach(c => c.v[1] && set.add(c.v[1]));
  return [...set].map(t => `<option value="${qbAttr(t)}"></option>`).join('');
}
function qbAutoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(Math.max(ta.scrollHeight + 2, 34), 520) + 'px';
}
function qbValidate(key) {
  const w = QB.work[key] || qbOrig(key);
  if (!w) return [];
  const out = [];
  const val = r => w.f[r] || String(w.v[r] || '').trim();
  if (!val(0)) out.push('ID가 비어 있습니다.');
  else {
    const dup = qbListItems().filter(it => it.key !== String(key)).some(it => { const x = QB.work[it.key] || (it.col ? it.col : it.draft.base); return x.v[0] === w.v[0]; });
    if (dup) out.push('같은 시트에 같은 ID가 있습니다.');
  }
  if (!val(1)) out.push('출처가 비어 있으면 저장해도 출제 목록에 나오지 않습니다.');
  if (!val(2)) out.push('유형이 비어 있습니다.');
  if (!val(4)) out.push('난이도가 비어 있습니다.');
  else if (!w.f[4] && !(Number(w.v[4]) >= 1 && Number(w.v[4]) <= 15)) out.push('난이도는 1~15 사이 숫자로 넣어 주세요.');
  if (!val(15)) out.push('정답이 비어 있습니다.');
  // 태그 짝 확인
  const tags = ['u', 'b', 'i', 'red', 'blue', 'green', 'orange', 'c', 'r', 'box', 'sup', 'sub', 'table'];
  const bad = [];
  for (let r = 5; r <= 16; r++) {
    if (w.f[r]) continue;
    const s = String(w.v[r] || '');
    tags.forEach(t => {
      const open = (s.match(new RegExp('<' + t + '>', 'gi')) || []).length, close = (s.match(new RegExp('</' + t + '>', 'gi')) || []).length;
      if (open !== close) bad.push(QB_FIELDS[r].label + ' <' + t + '>');
    });
  }
  if (bad.length) out.push('여닫는 태그 짝이 맞지 않습니다: ' + bad.slice(0, 4).join(', '));
  const d = QB.drafts.find(x => x.key === key);
  if (d && d.warnings && d.warnings.length) d.warnings.forEach(x => { if (x === '정답이 없습니다.' && val(15)) return; out.push('[분석] ' + x); });
  return out;
}

/* ---------- 칸 값 읽기 (연결 수식은 지금 화면의 값으로 따라갑니다: 저장 전 문항끼리도 연결이 보이게) ---------- */
function qbKeyCol(key) {
  if (!qbIsDraft(key)) return Number(key);
  const d = QB.drafts.find(x => x.key === key);
  if (!d) return null;
  if (d.target != null) return d.target;
  const app = QB.drafts.filter(x => x.target == null);
  return QB.sheet.cols.length + 1 + app.indexOf(d);
}
function qbKeyAtCol(col) { const it = qbListItems().find(it => qbKeyCol(it.key) === col); return it ? it.key : null; }
function qbVal(key, r, depth) {
  depth = depth || 0;
  const w = QB.work[key] || qbOrig(key);
  if (!w) return '';
  const f = w.f[r];
  if (!f) return w.v[r];
  const m = f.match(/^=\s*\$?([A-Z]{1,3})\$?(\d+)$/);
  if (m && depth < 4) {
    let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64;
    const k2 = qbKeyAtCol(n - 1);
    if (k2 != null && k2 !== String(key)) return qbVal(k2, Number(m[2]) - 1, depth + 1);
  }
  const o = qbOrig(key);
  return o ? o.v[r] : '';
}

/* ---------- 미리보기 ---------- */
function qbRenderPreview() {
  const box = document.getElementById('qbPreview');
  if (!box) return;
  const key = QB.sel;
  const w = key != null ? (QB.work[key] || qbOrig(key)) : null;
  if (!w) { box.innerHTML = '<div class="qb-empty">문항을 고르면 여기에 보입니다.</div>'; return; }
  // 연결 칸은 시트에 저장된 계산 값(원본)으로 보여 줍니다.
  const val = r => qbVal(key, r);
  const q = { question: val(5), box1: val(6), box2: val(7), box3: val(8), box4: val(9), options: [10, 11, 12, 13, 14].map(val), type: val(2) };
  let html = '';
  if (QB.prevMode === 'print') {
    let ph = '';
    try { ph = qbPrintHtml(key); } catch (e) { ph = '<div class="qb-warn">인쇄 미리보기를 만들지 못했습니다: ' + qbEsc(e.message) + '</div>'; }
    const ans0 = String(val(15) || '').trim();
    box.innerHTML = `<div class="qb-prev-meta">${qbEsc(val(1) || '출처 없음')} · ${qbEsc(val(2) || '유형 없음')} · 난이도 ${qbEsc(val(4) || '-')}</div>
      <div class="qb-paper-note">A4 2단 시험지의 한 단(85mm)과 같은 너비·글자 크기입니다. 줄이 넘어가는 위치가 인쇄물과 같습니다.</div>
      <div class="qb-paper"><div class="qb-print">${ph}</div></div>` +
      (QB.showAns ? `<div class="qb-prev-ans"><b>정답</b> ${/^[1-5]$/.test(ans0) ? '①②③④⑤'[Number(ans0) - 1] : qbEsc(ans0 || '(없음)')}</div>` +
        (val(16) ? `<div class="qb-prev-exp"><b>해설</b><div>${sanitizeInlineHTML(val(16))}</div></div>` : '') : '');
    return;
  }
  try { html = generateOnlineViewHtml(q).replace(/<div class="op-font-bar">[\s\S]*?<\/div>/, ''); }
  catch (e) { html = '<div class="qb-warn">미리보기를 만들지 못했습니다: ' + qbEsc(e.message) + '</div>'; }
  const ans = String(val(15) || '').trim();
  let foot = '';
  if (QB.showAns) {
    foot = `<div class="qb-prev-ans"><b>정답</b> ${/^[1-5]$/.test(ans) ? '①②③④⑤'[Number(ans) - 1] : qbEsc(ans || '(없음)')}</div>` +
      (val(16) ? `<div class="qb-prev-exp"><b>해설</b><div>${sanitizeInlineHTML(val(16))}</div></div>` : '');
  }
  box.innerHTML = `<div class="qb-prev-meta">${qbEsc(val(1) || '출처 없음')} · ${qbEsc(val(2) || '유형 없음')} · 난이도 ${qbEsc(val(4) || '-')}</div>
    <div class="online-box qb-prev-box">${html}</div>${foot}`;
  if (QB.showAns && /^[1-5]$/.test(ans)) {
    const opt = box.querySelector('.op-opt[data-opt="' + ans + '"]');
    if (opt) opt.classList.add('qb-correct');
  }
}
// 과제 출제 인쇄(print-report.js renderQuestionsForPrint)와 같은 마크업으로 한 문항(장문이면 묶음 전체)을 그립니다.
function qbPrintHtml(key) {
  const cur = QB.work[key] || qbOrig(key);
  const valOf = (k, r) => qbVal(k, r);
  // 같은 지문을 쓰는 묶음(연계): 연계 칸이 가리키는 첫 문항 ID 기준
  const myId = valOf(key, 0), head = String(valOf(key, 3) || '').trim() || myId;
  let members = qbListItems().map(it => it.key).filter(k => {
    const id = valOf(k, 0), link = String(valOf(k, 3) || '').trim();
    return head && (id === head || link === head);
  });
  if (members.indexOf(String(key)) < 0) members = [String(key)];
  const symbols = ['①', '②', '③', '④', '⑤'];
  const gridOf = opts => {
    let max = 0;
    opts.forEach(opt => { const s = String(opt).replace(/<[^>]*>?/gm, ''); let v = 0; for (let j = 0; j < s.length; j++) v += s.charCodeAt(j) > 127 ? 3 : 1; if (v > max) max = v; });
    return max <= 5 ? ' grid-5' : (max <= 10 ? ' grid-3' : (max <= 20 ? ' grid-2' : ' grid-1'));
  };
  const itemHtml = (k, numLabel) => {
    let stem = sanitizeInlineHTML(valOf(k, 5)).replace(/^\d+[\.．]\s*/, '');
    let qbox = '';
    const m = stem.match(/<div class="exam-q-box">([\s\S]*?)<\/div>/i);
    if (m) { qbox = m[0]; stem = stem.replace(m[0], ''); }
    const opts = [10, 11, 12, 13, 14].map(r => valOf(k, r));
    let h = `<div class="exam-q-id"><span>${qbEsc(valOf(k, 0))}</span><span style="font-weight:bold;">${valOf(k, 4) ? 'Lv. ' + qbEsc(valOf(k, 4)) : ''}</span></div>`;
    h += `<div class="exam-q-title-row"><span class="exam-q-num">${numLabel}</span><span class="exam-q-text">${toOneLine(stem).trim()}</span></div>`;
    if (qbox) h += qbox;
    return { head: h, opts: opts.some(o => String(o || '').trim()) ? `<div class="exam-options${gridOf(opts)}">` + opts.map((o, i) => String(o || '').trim() ? `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[i]}</span><span class="exam-opt-text">${sanitizeInlineHTML(o)}</span></div>` : '').join('') + '</div>' : '' };
  };
  const passageOf = k => [6, 7, 8, 9].map(r => valOf(k, r)).filter(x => String(x || '').trim()).map(sanitizeInlineHTML).filter(x => x.trim()).join('<div style="height:6px;"></div>');
  const nums = members.map((k, i) => qbNumOf(valOf(k, 0)) || (i + 1));
  if (members.length > 1) {
    const headKey = members.find(k => valOf(k, 0) === head) || members[0];
    const p = passageOf(headKey);
    let out = `<div class="exam-q-block"><div class="exam-q-range-title">[${nums[0]} ~ ${nums[nums.length - 1]}] 다음 글을 읽고, 물음에 답하시오.</div>`;
    if (p) out += `<div class="exam-passage boxed">${p}</div>`;
    members.forEach((k, i) => {
      const it = itemHtml(k, nums[i]);
      out += `<div class="${k === String(key) ? 'qb-print-cur' : 'qb-print-other'}">${it.head}${it.opts}</div>`;
      if (i < members.length - 1) out += '<div style="height:8px;"></div>';
    });
    return out + '</div>';
  }
  const it = itemHtml(key, qbNumOf(cur.v[0]) || 1);
  const p = passageOf(key);
  return `<div class="exam-q-block">${it.head}${p ? `<div class="exam-passage">${p}</div>` : ''}${it.opts}</div>`;
}

/* ---------- PDF 파일에서 가져오기 ---------- */
function qbPdfPick() {
  const inp = document.getElementById('qbPdfFile');
  if (inp) inp.click();
}
function qbPdfLoad(file) {
  if (!file) return;
  const status = document.getElementById('qbPdfStatus');
  const say = m => { if (status) status.innerHTML = m; };
  say('PDF를 읽는 중... (처음 한 번은 읽기 도구를 받느라 몇 초 걸립니다)');
  file.arrayBuffer().then(buf => qbLoadPdfJs().then(lib => qbPdfToText(lib, new Uint8Array(buf))))
    .then(res => {
      // 해설지를 문제 탭에 넣은 경우: 정답·해설 탭으로 넘겨 읽습니다.
      if ((res.text.match(/\[\s*출제\s*의도\s*\]/g) || []).length >= 3) {
        say('');
        qbImportTab('key');
        showToast('해설지 PDF라서 [✅ 정답·해설] 탭에서 읽습니다.', 'info');
        qbKeyLoad(file);
        return;
      }
      document.getElementById('qbPasteText').value = res.text;
      document.getElementById('qbPasteJoin').checked = false;      // 문단은 이미 정리되어 있습니다
      const st = res.stats;
      say(`✅ ${qbEsc(file.name)} · ${st.pages}쪽 · 기울임 ${st.italic} · 밑줄 ${st.underline} · 빈칸 ${st.blank || 0} · 각주 ${st.footnote}곳을 살렸습니다.`);
      qbPasteParse();
    })
    .catch(err => say('<span style="color:#b91c1c">PDF를 읽지 못했습니다: ' + qbEsc(err.message || err) + '</span>'));
}

let _qbPrevTimer = 0;
function qbSchedulePreview() { clearTimeout(_qbPrevTimer); _qbPrevTimer = setTimeout(qbRenderPreview, 180); }

/* ---------- 태그 넣기 ---------- */
function qbTarget() {
  const el = QB.focus && document.body.contains(QB.focus) ? QB.focus : null;
  return el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && el.dataset.row ? el : null;
}
function qbReplaceSel(el, fn) {
  const s = el.selectionStart, e = el.selectionEnd, v = el.value;
  const res = fn(v.slice(s, e));
  el.focus();
  // 되돌리기(Ctrl+Z)가 되도록 가능하면 브라우저 입력 명령을 씁니다.
  el.setSelectionRange(s, e);
  let ok = false;
  try { ok = document.execCommand && document.execCommand('insertText', false, res.text); } catch (err) { ok = false; }
  if (!ok || el.value.slice(s, s + res.text.length) !== res.text) { el.value = v.slice(0, s) + res.text + v.slice(e); }
  const a = s + (res.selStart != null ? res.selStart : res.text.length), b = s + (res.selEnd != null ? res.selEnd : res.text.length);
  el.setSelectionRange(a, b);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function qbWrapTag(tag) {
  const el = qbTarget();
  if (!el) { showToast('태그를 넣을 칸(질문·지문·선택지·해설)을 먼저 누르세요.', 'error'); return; }
  const open = '<' + tag + '>', close = '</' + tag + '>';
  qbReplaceSel(el, sel => sel
    ? { text: open + sel + close, selStart: 0, selEnd: open.length + sel.length + close.length }
    : { text: open + close, selStart: open.length, selEnd: open.length });
}
function qbToolAct(act, btn) {
  const el = qbTarget();
  if (!el) { showToast('넣을 칸(질문·지문·선택지·해설)을 먼저 누르세요.', 'error'); return; }
  if (act === 'table') {
    qbReplaceSel(el, sel => {
      const body = sel ? sel.split('\n').map(l => l.replace(/\t/g, ' | ')).join('\n') : '제목1 | 제목2 | 제목3\n내용1 | 내용2 | 내용3';
      const t = '\n<table>\n' + body + '\n</table>\n';
      return { text: t, selStart: 9, selEnd: 9 + body.length };
    });
  } else if (act === 'blank') qbReplaceSel(el, () => ({ text: '______________' }));
  else if (act === 'arrow') qbReplaceSel(el, () => ({ text: '<c>⇩</c>' }));
  else if (act === 'strip') qbReplaceSel(el, sel => ({ text: sel.replace(/<\/?[a-zA-Z][^>]*>/g, ''), selStart: 0, selEnd: sel.replace(/<\/?[a-zA-Z][^>]*>/g, '').length }));
  else if (act === 'circ' || act === 'img') qbOpenToolPop(act, btn);
}
function qbOpenToolPop(act, btn) {
  const pop = document.getElementById('qbToolPop');
  if (!pop) return;
  if (!pop.hidden && pop.dataset.act === act) { pop.hidden = true; return; }
  pop.dataset.act = act;
  if (act === 'circ') {
    const chars = ['①', '②', '③', '④', '⑤', '( ① )', '( ② )', '( ③ )', '( ④ )', '( ⑤ )', 'ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ', '(a)', '(b)', '(c)', '(d)', '(e)', '(A)', '(B)', '(C)', '(D)'];
    pop.innerHTML = chars.map(c => `<button type="button" class="qb-tb" data-qb-ins="${qbAttr(c)}">${qbEsc(c)}</button>`).join('');
  } else {
    pop.innerHTML = `<input type="text" id="qbImgInput" placeholder="이미지 주소(https://…jpg) 또는 구글 드라이브 파일 ID">
      <button type="button" class="qb-btn qb-btn-sm qb-btn-primary" data-qb="img-insert">넣기</button>
      <span class="qb-muted">가운데 정렬로 들어갑니다.</span>`;
  }
  pop.hidden = false;
  if (act === 'img') setTimeout(() => { const i = document.getElementById('qbImgInput'); if (i) i.focus(); }, 0);
}
function qbInsertImage() {
  const inp = document.getElementById('qbImgInput');
  const raw = inp ? inp.value.trim() : '';
  if (!raw) return;
  const el = qbTarget();
  if (!el) { showToast('넣을 칸을 먼저 누르세요.', 'error'); return; }
  const src = /^https?:\/\//i.test(raw) ? raw : (/^[A-Za-z0-9_-]{20,}$/.test(raw) ? 'drive:' + raw : raw);
  qbReplaceSel(el, () => ({ text: '<c>' + src + '</c>' }));
  document.getElementById('qbToolPop').hidden = true;
}

/* ---------- 고치기 ---------- */
function qbOnInput(el) {
  const key = QB.sel;
  if (key == null) return;
  const w = qbWork(key);
  const r = Number(el.dataset.row);
  w.v[r] = el.value;
  if (el.tagName === 'TEXTAREA') qbAutoGrow(el);
  const fieldEl = el.closest('.qb-field');
  if (fieldEl && !qbIsDraft(key)) { const o = qbOrig(key); fieldEl.classList.toggle('changed', (w.f[r] || w.v[r]) !== (o.f[r] || o.v[r])); }
  if (r === 15) document.querySelectorAll('#qbMain .qb-ans').forEach(b => b.classList.toggle('on', String(w.v[15]).trim() === b.dataset.n));
  const saveBtn = document.querySelector('#qbMain [data-qb="save-one"]');
  if (saveBtn) saveBtn.disabled = !qbIsDirty(key) || QB.busy;
  const rev = document.querySelector('#qbMain [data-qb="revert"]');
  if (rev) rev.disabled = !qbChangedRows(key).length;
  if (r === 0 || r === 2 || r === 4 || r === 5) qbRefreshListItem(key);
  qbUpdateDirty();
  qbSchedulePreview();
}
let _qbListTimer = 0;
function qbRefreshListItem() { clearTimeout(_qbListTimer); _qbListTimer = setTimeout(qbRenderList, 300); }
function qbSelect(key) {
  QB.sel = key;
  QB.focus = null;
  qbRenderList(); qbRenderForm();
  const main = document.getElementById('qbMain');
  if (main) main.scrollTop = 0;
}

/* ---------- 새 문항 · 붙여넣기 초안 ---------- */
function qbNewDraft(v, opts) {
  opts = opts || {};
  const key = 'd' + (++QB.seq);
  const base = { v: (v || new Array(17).fill('')).slice(), f: new Array(17).fill('') };
  if (!base.v[0]) base.v[0] = qbSuggestId(opts.num);
  if (!base.v[1]) base.v[1] = qbDefaultSource(QB.sheet.name);
  const d = { key: key, base: base, num: opts.num || qbNumOf(base.v[0]), target: opts.target != null ? opts.target : null, link: opts.link || null, warnings: opts.warnings || [] };
  QB.drafts.push(d);
  QB.work[key] = { v: base.v.slice(), f: base.f.slice() };
  return d;
}
function qbAddQuestion() {
  if (!QB.sheet) { showToast('먼저 시험지(시트)를 고르세요.', 'error'); return; }
  // [새 시험지]로 만든 틀 칸(ID만 있고 출처·질문이 빈 칸)이 있으면 그 칸을 먼저 채웁니다.
  // 완전히 빈 열은 예전에 쓰다 지운 열일 수 있어(옛 풀이 기록이 그 열을 가리킴) 채우지 않고 끝에 새로 붙입니다.
  const slot = QB.sheet.cols.find(c => !c.hidden && c.v[0] && !c.v[1] && !c.f[1] && !c.v[5] && !QB.drafts.some(d => d.target === c.col) && !qbChangedRows(String(c.col)).length);
  if (slot) {
    const w = qbWork(String(slot.col));
    if (!w.v[1]) w.v[1] = qbDefaultSource(QB.sheet.name);
    if (!w.v[0]) w.v[0] = qbSuggestId();
    qbSelect(String(slot.col));
    showToast(`비어 있는 ${qbColLetter(slot.col + 1)}열(${qbShortId(slot.v[0]) || '틀'})을 채웁니다.`, 'info');
    return;
  }
  const d = qbNewDraft();
  qbSelect(d.key);
}

/* ---------- 저장 ---------- */
function qbBuildItem(key) {
  const w = QB.work[key];
  const cell = r => (w.f[r] ? { v: w.f[r], f: true } : { v: w.v[r], f: false });
  if (qbIsDraft(key)) {
    const d = QB.drafts.find(x => x.key === key);
    const cells = {};
    for (let r = 0; r < 17; r++) if (w.f[r] || String(w.v[r] || '') !== '') cells[r] = cell(r);
    if (d.target != null) {
      // 비어 있던 틀 칸에 채우기: 원래 칸의 연결 수식은 비어 있는 항목에 한해 그대로 둡니다.
      const o = qbOrig(String(d.target));
      const out = {}, expect = {};
      Object.keys(cells).forEach(r => { if ((o.f[r] || o.v[r]) !== (cells[r].v)) { out[r] = cells[r]; expect[r] = o.f[r] || o.v[r]; } });
      return { col: d.target, cells: out, expect: expect, temp: key };
    }
    return { col: null, cells: cells, temp: key };
  }
  const o = qbOrig(key);
  const cells = {}, expect = {};
  qbChangedRows(key).forEach(r => { cells[r] = cell(r); expect[r] = o.f[r] || o.v[r]; });
  return { col: Number(key), cells: cells, expect: expect };
}
// 붙여넣기로 들어온 장문 묶음(42·44·45)은 첫 문항의 열이 정해진 뒤 연결 수식을 채웁니다.
function qbResolveLinks(keys) {
  const lastCol = QB.sheet.cols.length + 1;   // 0=A열이므로 다음 새 열 번호
  let n = 0;
  const colOf = {};
  keys.forEach(k => {
    if (qbIsDraft(k)) { const d = QB.drafts.find(x => x.key === k); colOf[k] = d.target != null ? d.target : lastCol + (n++); }
    else colOf[k] = Number(k);
  });
  keys.forEach(k => {
    if (!qbIsDraft(k)) return;
    const d = QB.drafts.find(x => x.key === k);
    if (!d.link) return;
    const headKey = keys.find(x => qbIsDraft(x) && QB.drafts.find(y => y.key === x).num === d.link.head) ||
      Object.keys(colOf).find(x => !qbIsDraft(x) && qbNumOf((QB.work[x] || qbOrig(x)).v[0]) === d.link.head);
    let headCol = headKey != null ? colOf[headKey] : null;
    if (headCol == null) { const c = QB.sheet.cols.find(c => qbNumOf(c.v[0]) === d.link.head); if (c) headCol = c.col; }
    if (headCol == null) return;
    const letter = qbColLetter(headCol + 1);
    const w = QB.work[k];
    const slot = d.target != null ? qbOrig(String(d.target)) : null;
    // 연계(4행)는 첫 문항의 ID(1행)를, 지문·해설은 같은 행을 가리킵니다. (기존 시트: =Y1, =Y7, =Y17)
    d.link.rows.forEach(r => { if (!String(w.v[r] || '').trim() && !(slot && slot.f[r])) { w.f[r] = '=' + letter + (r === 3 ? 1 : r + 1); } });
  });
}
function qbSave(keys) {
  if (!QB.sheet || QB.busy) return;
  keys = keys.filter(k => qbIsDirty(k));
  if (!keys.length) return;
  qbResolveLinks(keys);
  const items = keys.map(qbBuildItem).filter(it => it.col == null || Object.keys(it.cells).length);
  if (!items.length) { keys.forEach(k => { if (qbIsDraft(k)) qbDropDraft(k, true); }); qbRenderList(); qbRenderForm(); return; }
  const name = QB.sheet.name;
  const selWasDraft = qbIsDraft(QB.sel) ? QB.sel : null;
  qbBusy(true, `${items.length}문항 저장 중...`);
  qbCall('qbWriteQuestions', [name, items]).then(res => {
    if (!res || res.ok === false) {
      const c = (res && res.conflicts) || [];
      if (res && res.sheet) QB.sheet = res.sheet;
      showCustomAlert('저장하지 못했습니다. 그사이 시트에서 다른 사람이 고친 칸이 있습니다.<br>' +
        c.slice(0, 5).map(x => `• ${qbColLetter(x.col + 1)}열 ${QB_FIELDS[x.row].label}`).join('<br>') +
        '<br><br>지금 화면의 내 변경은 그대로 남아 있습니다. 시트를 다시 열어 비교한 뒤 저장해 주세요.');
      qbRenderList(); qbRenderForm();
      return;
    }
    QB.sheet = res.sheet;
    const savedDrafts = {};
    (res.saved || []).forEach(s => { if (s.temp) savedDrafts[s.temp] = s.col; });
    keys.forEach(k => {
      if (qbIsDraft(k)) { QB.drafts = QB.drafts.filter(d => d.key !== k); delete QB.work[k]; }
      else delete QB.work[k];
    });
    // 저장 안 한 다른 문항의 작업본은 남겨 둡니다.
    if (selWasDraft && savedDrafts[selWasDraft] != null) QB.sel = String(savedDrafts[selWasDraft]);
    else if (selWasDraft) { const d = QB.drafts.find(x => x.key === selWasDraft); if (!d) QB.sel = null; }
    const sh = QB.sheets.find(s => s.name === name);
    if (sh) sh.count = res.sheet.cols.filter(c => c.v[1]).length;
    qbRenderSheetSelect(name);
    qbRenderList(); qbRenderForm();
    showToast(`${items.length}문항을 저장했습니다. 과제출제 목록에도 바로 반영됩니다.`, 'info');
    qbAfterBankChange();
  }).catch(err => showCustomAlert('저장 실패: ' + qbEsc(err.message || err) + '<br>화면의 변경은 그대로 남아 있습니다.'))
    .finally(() => { qbBusy(false); qbUpdateDirty(); const b = document.querySelector('#qbMain [data-qb="save-one"]'); if (b) b.disabled = !(QB.sel != null && qbIsDirty(QB.sel)); });
}
function qbDropDraft(key, silent) {
  QB.drafts = QB.drafts.filter(d => d.key !== key);
  delete QB.work[key];
  if (QB.sel === key) QB.sel = null;
  if (!silent) { qbRenderList(); qbRenderForm(); }
}
function qbSetHidden(hide) {
  const key = QB.sel;
  if (key == null || qbIsDraft(key)) return;
  const col = Number(key);
  const run = () => {
    qbBusy(true, hide ? '숨기는 중...' : '되살리는 중...');
    qbCall('qbSetHidden', [QB.sheet.name, col, !!hide]).then(res => {
      QB.sheet = res.sheet;
      delete QB.work[key];
      qbRenderList(); qbRenderForm();
      qbAfterBankChange();
      showToast(hide ? '숨겼습니다. 출제 목록에서 빠지고, 기존 풀이 기록은 그대로입니다.' : '되살렸습니다.', 'info');
    }).catch(err => showToast(qbEsc(err.message || err), 'error')).finally(() => qbBusy(false));
  };
  if (hide) showCustomConfirm('이 문항을 숨길까요?<br>출제 목록에서 빠지고, 학생 풀이 기록·과제는 그대로 남습니다.<br>언제든 [되살리기]로 돌릴 수 있습니다.', run);
  else run();
}

// 문제은행이 바뀌면 과제출제 화면의 문항 목록·필터 기억을 버려, 다음에 열 때 새로 받게 합니다.
function qbAfterBankChange() {
  try { if (typeof invalidateQuestionMeta === 'function') invalidateQuestionMeta(); } catch (e) {}
  try { if (typeof swrInvalidate === 'function') swrInvalidate('sourceFilters', 'global'); } catch (e) {}
}

/* ---------- 새 시험지 ---------- */
function qbOpenModal(html) {
  const m = document.getElementById('qbModal');
  m.querySelector('.qb-modal-box').innerHTML = html;
  m.hidden = false;
}
function qbCloseModal() { const m = document.getElementById('qbModal'); if (m) m.hidden = true; }
function qbNewSheetDialog() {
  const base = QB.sheet ? QB.sheet.name : '';
  qbOpenModal(`
    <div class="qb-modal-head"><b>새 시험지(시트) 만들기</b><button type="button" class="qb-x" data-qb="close-modal" aria-label="닫기">×</button></div>
    <div class="qb-modal-body">
      <label class="qb-label" for="qbNsName">시트 이름</label>
      <input type="text" id="qbNsName" placeholder="예: h1_26_09, h1_26_09기출, h2_26_E2YBM(P)_3변형" value="">
      <div class="qb-muted">규칙: 학년(h1~h3, m1~m3)_연도2자리_월 (+기출/변형).</div>
      <label class="qb-label qb-mt" for="qbNsSrc">문제 출처 <span class="qb-muted">(시트 이름으로 자동으로 채워지며, 직접 고칠 수 있습니다)</span></label>
      <div class="qb-ns-src">
        <input type="text" id="qbNsSrc" placeholder="예: 고3 2024 수능">
      </div>
      <label class="qb-check qb-mt"><input type="checkbox" id="qbNsFrame" checked> 번호 틀 미리 만들기</label>
      <div class="qb-ns-frame">
        <input type="number" id="qbNsFrom" value="18" min="1" max="99"> ~ <input type="number" id="qbNsTo" value="45" min="1" max="99"> 번
        <label class="qb-check"><input type="checkbox" id="qbNsTypes" checked> 모의고사 기본 유형 넣기</label>
        <label class="qb-check"><input type="checkbox" id="qbNsLink" checked> 장문(41-42, 43-45) 지문 연결</label>
      </div>
      <div class="qb-muted">틀 칸에는 ID·유형만 들어가고 출처는 비어 있어, 내용을 채워 저장하기 전까지 학생 출제 목록에 나오지 않습니다.</div>
    </div>
    <div class="qb-modal-foot"><button type="button" class="qb-btn" data-qb="close-modal">취소</button>
      <button type="button" class="qb-btn qb-btn-primary" data-qb="create-sheet" data-qb-busy>만들기</button></div>`);
  const nameEl = document.getElementById('qbNsName'), srcEl = document.getElementById('qbNsSrc');
  const upd = () => { if (srcEl.dataset.touched !== '1') srcEl.value = qbAutoSourceFromName(nameEl.value.trim()); };
  nameEl.addEventListener('input', upd);
  srcEl.addEventListener('input', () => { srcEl.dataset.touched = srcEl.value.trim() ? '1' : ''; if (!srcEl.value.trim()) upd(); });
  if (base) { const m = base.match(/^([hm][1-3])_/); if (m) nameEl.value = m[1] + '_'; }
  nameEl.focus();
}
function qbCreateSheet() {
  const name = document.getElementById('qbNsName').value.trim();
  if (!/^[0-9A-Za-z가-힣_()\-]{3,60}$/.test(name)) { showToast('시트 이름을 확인하세요 (영문·숫자·한글·_ ( ) -).', 'error'); return; }
  if (QB.sheets.some(s => s.name === name)) { showToast('같은 이름의 시트가 이미 있습니다.', 'error'); return; }
  const frame = document.getElementById('qbNsFrame').checked;
  const from = Number(document.getElementById('qbNsFrom').value), to = Number(document.getElementById('qbNsTo').value);
  if (frame && !(from > 0 && to >= from && to - from < 100)) { showToast('번호 범위를 확인하세요.', 'error'); return; }
  const types = {};
  if (frame && document.getElementById('qbNsTypes').checked) for (let n = from; n <= to; n++) if (QB_STD_TYPES[n]) types[n] = QB_STD_TYPES[n];
  const opts = frame ? { from: from, to: to, types: types, linkLong: document.getElementById('qbNsLink').checked } : {};
  const src = document.getElementById('qbNsSrc').value.trim();
  const go = () => {
    qbBusy(true, '시트를 만드는 중...');
    qbCall('qbCreateSheet', [name, opts]).then(res => {
      qbCloseModal();
      QB.sheets.push({ name: name, count: 0 });
      qbSetSrcOverride(name, src && src !== qbAutoSourceFromName(name) ? src : '');
      QB.work = {}; QB.drafts = []; QB.sel = null;
      QB.sheet = res.sheet;
      qbRenderSheetSelect(name); qbRenderList(); qbRenderForm();
      showToast(`'${qbEsc(name)}' 시트를 만들었습니다. 문항을 골라 채우거나 [📥 가져오기]로 한 번에 넣으세요.`, 'info');
    }).catch(err => showToast('시트를 만들지 못했습니다: ' + qbEsc(err.message || err), 'error')).finally(() => qbBusy(false));
  };
  if (qbDirtyKeys().length) showCustomConfirm('지금 시트에 저장하지 않은 변경이 있습니다.<br>새 시트를 열면 <b>변경이 사라집니다.</b> 계속할까요?', go);
  else go();
}

/* ---------- 붙여넣기 ---------- */
/* ---------- 가져오기 (문제 · 정답·해설 · 난이도) ---------- */
const QB_IMP_TABS = [['q', '📄 문제'], ['key', '✅ 정답·해설'], ['diff', '📊 난이도']];
function qbImportDialog(tab) {
  if (!QB.sheet) { showToast('먼저 가져올 시험지(시트)를 고르거나 새로 만드세요.', 'error'); return; }
  QB_KEY = null; QB_PASTE_RESULT = [];
  qbOpenModal(`
    <div class="qb-modal-head"><b>가져오기 → ${qbEsc(QB.sheet.name)}</b><button type="button" class="qb-x" data-qb="close-modal" aria-label="닫기">×</button></div>
    <div class="qb-imp-tabs" role="tablist">${QB_IMP_TABS.map(([k, t]) => `<button type="button" class="qb-seg-btn" role="tab" data-qb="imp-tab" data-tab="${k}">${t}</button>`).join('')}</div>
    <div class="qb-imp-pane" data-pane="q">${qbPastePaneHtml()}</div>
    <div class="qb-imp-pane" data-pane="key" hidden>${qbKeyPaneHtml()}</div>
    <div class="qb-imp-pane" data-pane="diff" hidden>${qbBulkPaneHtml(4)}</div>`);
  qbImportTab(tab || 'q');
}
function qbImportTab(tab) {
  const box = document.querySelector('#qbModal .qb-modal-box');
  if (!box) return;
  box.dataset.tab = tab;
  box.querySelectorAll('[data-qb="imp-tab"]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  box.querySelectorAll('.qb-imp-pane').forEach(p => { p.hidden = p.dataset.pane !== tab; });
  const f = tab === 'q' ? document.getElementById('qbPasteText') : tab === 'diff' ? box.querySelector('[data-bulk="4"] textarea') : null;
  if (f) f.focus();
}
function qbPastePaneHtml() {
  return `
    <div class="qb-modal-body qb-paste">
      <div class="qb-paste-in">
        <div class="qb-pdf-row">
          <button type="button" class="qb-btn qb-btn-primary" data-qb="pdf-pick">📄 문제 PDF 고르기</button>
          <input type="file" id="qbPdfFile" accept="application/pdf,.pdf" hidden>
          <span class="qb-muted">기울임·밑줄·빈칸·각주·문단까지 살려서 읽습니다 (복사보다 정확).</span>
        </div>
        <div id="qbPdfStatus" class="qb-muted"></div>
        <label class="qb-label" for="qbPasteText">시험지 내용 (PDF 파일이 없으면 한글·PDF에서 복사해 넣기)</label>
        <textarea id="qbPasteText" rows="16" spellcheck="false" placeholder="18. 다음 글의 목적으로 가장 적절한 것은?\nDear Ms. Spadler,\n…\n① 새로 출시한 제품을 홍보하려고\n② …\n\n[41~42] 다음 글을 읽고, 물음에 답하시오.\n…"></textarea>
        <label class="qb-check"><input type="checkbox" id="qbPasteJoin" checked> PDF처럼 줄이 중간에 끊겨 있으면 문단으로 이어 붙이기</label>
        <label class="qb-check"><input type="checkbox" id="qbPasteSkipListen" checked> 듣기 문항(1~17번) 빼기</label>
        <div class="qb-muted">번호(18. 19. …)와 ①~⑤를 기준으로 나눕니다. 정답은 [✅ 정답·해설] 탭에서 해설지로 넣으세요.</div>
      </div>
      <div class="qb-paste-out" id="qbPasteOut"><div class="qb-empty">[분석하기]를 누르면 나눈 결과가 여기에 보입니다.</div></div>
    </div>
    <div class="qb-modal-foot"><button type="button" class="qb-btn" data-qb="close-modal">닫기</button>
      <button type="button" class="qb-btn" data-qb="paste-parse">분석하기</button>
      <button type="button" class="qb-btn qb-btn-primary" data-qb="paste-import" disabled>편집기로 가져오기</button></div>`;
}
let QB_PASTE_RESULT = [];
function qbPasteParse() {
  const text = document.getElementById('qbPasteText').value;
  const out = document.getElementById('qbPasteOut');
  QB_PASTE_RESULT = qbParsePaste(text, '', { noAnswers: true, joinPdf: document.getElementById('qbPasteJoin').checked, minNum: document.getElementById('qbPasteSkipListen').checked ? 18 : 0 });
  const btn = document.querySelector('#qbModal [data-qb="paste-import"]');
  if (!QB_PASTE_RESULT.length) {
    out.innerHTML = '<div class="qb-warn">문항을 찾지 못했습니다. 각 문항이 "18. 다음 글의 …" 처럼 줄 맨 앞의 번호와 한글 질문으로 시작하는지 확인해 주세요.</div>';
    btn.disabled = true; return;
  }
  const slots = qbSlotsByNum();
  out.innerHTML = `<div class="qb-paste-sum">${QB_PASTE_RESULT.length}문항을 찾았습니다. 가져올 문항을 고르세요.</div>` +
    QB_PASTE_RESULT.map((r, i) => {
      const nOpt = r.v.slice(10, 15).filter(Boolean).length;
      const nBox = r.v.slice(6, 10).filter(Boolean).length;
      const dest = slots[r.num] != null ? `${qbColLetter(slots[r.num] + 1)}열 빈 칸에 채움` : '새 열로 추가';
      return `<label class="qb-pr${r.warnings.length ? ' has-warn' : ''}"><input type="checkbox" data-pi="${i}" checked>
        <span class="qb-pr-main"><b>${r.num}번</b> <span class="qb-item-type">${qbEsc(r.type || '유형?')}</span> <span class="qb-muted">${dest}</span><br>
        <span class="qb-pr-stem">${qbEsc(r.v[5])}</span><br>
        <span class="qb-muted">지문 ${nBox}칸 · 선택지 ${nOpt}개${r.link ? ' · 🔗 ' + r.link.head + '번 지문 연결' : ''}</span>
        ${r.warnings.length ? '<span class="qb-pr-warn">' + r.warnings.map(qbEsc).join('<br>') + '</span>' : ''}</span></label>`;
    }).join('');
  btn.disabled = false;
  btn.textContent = `편집기로 가져오기 (${QB_PASTE_RESULT.length}문항)`;
}
// 아직 비어 있는 틀 칸(출처 없음)을 ID 끝 번호로 찾습니다. {번호: 열}
function qbSlotsByNum() {
  const out = {};
  if (!QB.sheet) return out;
  QB.sheet.cols.forEach(c => {
    if (c.hidden || !c.v[0] || c.v[1] || c.f[1] || c.v[5] || qbChangedRows(String(c.col)).length) return;
    if (QB.drafts.some(d => d.target === c.col)) return;
    const n = qbNumOf(c.v[0]);
    if (n && out[n] == null) out[n] = c.col;
  });
  return out;
}
function qbPasteImport() {
  const picks = [...document.querySelectorAll('#qbPasteOut input[data-pi]:checked')].map(x => QB_PASTE_RESULT[Number(x.dataset.pi)]);
  if (!picks.length) { showToast('가져올 문항을 고르세요.', 'error'); return; }
  const slots = qbSlotsByNum();
  let first = null;
  picks.forEach(r => {
    const target = slots[r.num] != null ? slots[r.num] : null;
    const v = r.v.slice();
    let d;
    if (target != null) {
      const o = qbOrig(String(target));
      // 틀 칸의 ID·유형은 살리고 분석 결과가 있는 칸만 채웁니다.
      for (let k = 0; k < 17; k++) if (!v[k] && o.v[k] && !o.f[k]) v[k] = o.v[k];
      if (o.v[2] && r.type !== o.v[2] && !/장문/.test(o.v[2])) r.warnings = r.warnings.concat(['틀의 유형은 "' + o.v[2] + '", 분석 결과는 "' + r.type + '"입니다. 확인해 주세요.']);
      d = qbNewDraft(v, { num: r.num, target: target, link: r.link, warnings: r.warnings });
      // 틀 칸에 이미 있는 연결 수식은 그대로 둡니다.
      o.f.forEach((f, k) => { if (f && !v[k]) QB.work[d.key].f[k] = f; });
      QB.work[d.key].v[0] = QB.work[d.key].v[0] || o.v[0];
    } else {
      v[0] = '';
      d = qbNewDraft(v, { num: r.num, link: r.link, warnings: r.warnings });
    }
    if (!first) first = d.key;
  });
  qbCloseModal();
  qbSelect(first);
  showToast(`${picks.length}문항을 가져왔습니다. 하나씩 확인한 뒤 [모두 저장]을 누르세요.`, 'info');
}

/* ---------- 해설지 PDF → 정답·해설 ---------- */
let QB_KEY = null;
function qbKeyPaneHtml() {
  const variant = /변형$/.test(QB.sheet.name);
  return `
    <div class="qb-modal-body qb-key">
      <div class="qb-pdf-row">
        <button type="button" class="qb-btn qb-btn-primary" data-qb="key-pick">📄 해설지 PDF 고르기</button>
        <input type="file" id="qbKeyFile" accept="application/pdf,.pdf" hidden>
        <span id="qbKeyStatus" class="qb-muted">정답표와 "18. [출제의도] …" 해설을 문항 번호에 맞춰 넣습니다.</span>
      </div>
      ${variant ? '<div class="qb-warn">변형 문항 시트입니다. 원문 해설지와 내용이 다를 수 있어 처음에는 모두 선택 해제해 둡니다.</div>' : ''}
      <div class="qb-key-opts">
        <span class="qb-label">해설칸에 넣을 것</span>
        <label class="qb-check"><input type="checkbox" id="qbKeyTrans" checked> 해석</label>
        <label class="qb-check"><input type="checkbox" id="qbKeyExpl" checked> 풀이</label>
        <label class="qb-check"><input type="checkbox" id="qbKeyVocab"> 어휘</label>
        <label class="qb-check qb-key-over"><input type="checkbox" id="qbKeyOver"> 이미 적힌 정답·해설도 바꾸기</label>
      </div>
      <div id="qbKeyOut" class="qb-key-out"><div class="qb-empty">해설지 PDF를 고르면 문항별로 무엇이 들어갈지 여기에 보입니다.</div></div>
      <details class="qb-key-manual"><summary>해설지가 없을 때: 정답 번호만 붙여넣기</summary>${qbBulkPaneHtml(15, true)}</details>
    </div>
    <div class="qb-modal-foot"><button type="button" class="qb-btn" data-qb="close-modal">닫기</button>
      <button type="button" class="qb-btn qb-btn-primary" data-qb="key-apply" disabled>편집기에 채우기</button></div>`;
}
function qbKeyLoad(file) {
  if (!file) return;
  const status = document.getElementById('qbKeyStatus');
  const say = m => { if (status) status.innerHTML = m; };
  say('해설지를 읽는 중... (처음 한 번은 읽기 도구를 받느라 몇 초 걸립니다)');
  file.arrayBuffer().then(buf => qbLoadPdfJs().then(lib => qbPdfKeyParse(lib, new Uint8Array(buf))))
    .then(key => {
      const nums = Object.keys(key.items).map(Number).filter(n => n >= 18);
      if (!nums.length && !Object.keys(key.answers).length) throw new Error('"18. [출제의도]" 같은 문항 표시나 정답표를 찾지 못했습니다.');
      QB_KEY = key;
      say(`✅ ${qbEsc(file.name)} · ${key.pages}쪽 · 정답 ${Object.keys(key.answers).length}개 · 해설 ${nums.length}문항${key.groups.length ? ' · 장문 묶음 ' + key.groups.filter(g => g.from >= 18).map(g => g.from + '~' + g.to).join(', ') : ''}`);
      qbKeyRender();
    })
    .catch(err => say('<span style="color:#b91c1c">해설지를 읽지 못했습니다: ' + qbEsc(err.message || err) + '</span>'));
}
// 시트 문항마다 무엇을 넣을지 계산합니다.
function qbKeyPlan() {
  if (!QB_KEY) return [];
  const parts = { trans: document.getElementById('qbKeyTrans').checked, expl: document.getElementById('qbKeyExpl').checked, vocab: document.getElementById('qbKeyVocab').checked };
  const over = document.getElementById('qbKeyOver').checked;
  return qbListItems().map(it => {
    const w = qbWork(it.key);
    const num = (it.draft && it.draft.num) || qbNumOf(w.v[0]);
    if (!num) return null;
    const row = { key: it.key, num: num, id: w.v[0] || '', notes: [] };
    const ans = QB_KEY.answers[num];
    const oldAns = String(w.v[15] || '').trim();
    if (ans) {
      if (!oldAns) row.ans = ans;
      else if (oldAns !== String(ans)) { if (over) row.ans = ans; row.notes.push(`정답 다름: 시트 ${oldAns} / 해설지 ${ans}`); }
    }
    if (w.f[16]) row.link = String(w.f[16]).replace(/^=/, '');
    else {
      const g = QB_KEY.groups.find(x => num >= x.from && num <= x.to);
      const text = qbKeyCell(QB_KEY, num, parts, g ? num === g.from : false);
      const has = !!String(w.v[16] || '').trim();
      if (!text) row.miss = true;
      else if (!has || over) { row.expl = text; row.replace = has; }
      else row.kept = true;
    }
    row.todo = row.ans != null || row.expl != null;
    return row;
  }).filter(Boolean);
}
function qbKeyRender() {
  const out = document.getElementById('qbKeyOut');
  const btn = document.querySelector('#qbModal [data-qb="key-apply"]');
  if (!out || !QB_KEY) return;
  const plan = qbKeyPlan();
  const variant = /변형$/.test(QB.sheet.name);
  const prevOff = new Set([...out.querySelectorAll('input[data-ki]:not(:checked):not(:disabled)')].map(x => x.dataset.ki));
  const first = !out.querySelector('input[data-ki]');
  const diff = plan.filter(r => r.notes.some(x => x.indexOf('정답 다름') === 0)).length;
  const head = diff >= 3 ? `<div class="qb-warn" style="margin:8px">정답이 ${diff}문항이나 시트와 다릅니다. <b>다른 시험의 해설지</b>가 아닌지 확인해 주세요.</div>` : '';
  out.innerHTML = plan.length ? head + '<table class="qb-key-table"><thead><tr><th></th><th>문항</th><th>정답</th><th>해설</th></tr></thead><tbody>' + plan.map(r => {
    const on = r.todo && !(first ? variant : prevOff.has(r.key));
    const ansCell = r.ans != null ? `<b>${'①②③④⑤'[r.ans - 1]}</b>` : '<span class="qb-muted">' + (QB_KEY.answers[r.num] ? '그대로' : '해설지에 없음') + '</span>';
    let explCell;
    if (r.link) explCell = `<span class="qb-muted">🔗 ${qbEsc(r.link)} 해설을 함께 씀</span>`;
    else if (r.miss) explCell = '<span class="qb-muted">해설지에 없음</span>';
    else if (r.kept) explCell = '<span class="qb-muted">이미 있음 (그대로)</span>';
    else explCell = `${r.replace ? '<span class="qb-chip qb-chip-dirty">바꿈</span> ' : ''}<span class="qb-key-snip" title="${qbAttr(r.expl.replace(/<[^>]+>/g, ''))}">${qbEsc(r.expl.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 70))}…</span>`;
    return `<tr class="${r.todo ? '' : 'is-skip'}${r.notes.length ? ' has-warn' : ''}"><td><input type="checkbox" data-ki="${qbAttr(r.key)}"${on ? ' checked' : ''}${r.todo ? '' : ' disabled'}></td>
      <td><b>${r.num}번</b><br><span class="qb-muted">${qbEsc(qbShortId(r.id))}</span></td><td>${ansCell}</td>
      <td>${explCell}${r.notes.length ? '<div class="qb-pr-warn">' + r.notes.map(qbEsc).join('<br>') + '</div>' : ''}</td></tr>`;
  }).join('') + '</tbody></table>' : '<div class="qb-warn">이 시트의 문항 ID에서 번호를 읽지 못했습니다.</div>';
  const n = out.querySelectorAll('input[data-ki]:checked').length;
  btn.disabled = !n;
  btn.textContent = `편집기에 채우기 (${n}문항)`;
}
function qbKeyApply() {
  const pick = new Set([...document.querySelectorAll('#qbKeyOut input[data-ki]:checked')].map(x => x.dataset.ki));
  const plan = qbKeyPlan().filter(r => pick.has(r.key) && r.todo);
  if (!plan.length) { showToast('채울 문항을 고르세요.', 'error'); return; }
  plan.forEach(r => {
    const w = qbWork(r.key);
    if (r.ans != null) w.v[15] = String(r.ans);
    if (r.expl != null) w.v[16] = r.expl;
  });
  qbCloseModal();
  qbRenderList();
  if (QB.sel != null) qbRenderForm(); else qbSelect(plan[0].key);
  showToast(`${plan.length}문항에 정답·해설을 채웠습니다. 확인한 뒤 [모두 저장]을 누르세요.`, 'info');
}

/* ---------- 난이도·정답 일괄 입력 ---------- */
// 외부(ChatGPT 등)에서 받은 "8	7	10	6	9" 같은 숫자 줄을 목록 순서대로 채웁니다.
// field 4 = 난이도, 15 = 정답. inner: 다른 탭 안에 넣을 때(바닥 버튼 없이 자체 버튼)
function qbBulkPaneHtml(field, inner) {
  const items = qbListItems();
  let startKey = QB.sel;
  if (startKey == null) { const k = items.find(it => ((it.draft && it.draft.num) || qbNumOf(qbWork(it.key).v[0])) === 18); startKey = k ? k.key : (items[0] && items[0].key); }
  const opts = items.map(it => {
    const w = qbWork(it.key);
    const n = (it.draft && it.draft.num) || qbNumOf(w.v[0]);
    return `<option value="${qbAttr(it.key)}"${startKey === it.key ? ' selected' : ''}>${qbEsc(qbShortId(w.v[0]) || (n ? n + '번' : '(새 문항)'))}${w.v[2] ? ' · ' + qbEsc(w.v[2]) : ''}</option>`;
  }).join('');
  const what = field === 4 ? '난이도 (1~15)' : '정답 번호 (1~5, ①~⑤)';
  const body = `
      <div class="qb-bulk" data-bulk="${field}">
        ${field === 4 ? '<div class="qb-muted">ChatGPT 등에서 받은 난이도 숫자(예: <code>8	7	10	6	9</code>)를 그대로 붙여넣으면 목록 순서대로 채웁니다.</div>' : ''}
        <div class="qb-bulk-opts">
          <label class="qb-label">첫 숫자를 넣을 문항</label>
          <select data-b="start">${opts}</select>
          <label class="qb-check"><input type="checkbox" data-b="skip" checked> 숨긴 문항 건너뛰기</label>
        </div>
        <textarea data-b="text" rows="4" spellcheck="false" aria-label="${what}" placeholder="${field === 4 ? '8	7	10	6	9' : '① ③ 2 5 4'}\n(탭·띄어쓰기·쉼표·줄바꿈 모두 됩니다. \`\`\`text 같은 코드 블록 표시도 알아서 뺍니다.)"></textarea>
        <div data-b="out" class="qb-key-out"><div class="qb-empty">숫자를 붙여넣으면 어느 문항에 들어갈지 여기에 보입니다.</div></div>
        ${inner ? '<div class="qb-bulk-inner-foot"><button type="button" class="qb-btn qb-btn-primary" data-qb="bulk-apply" data-field="15" disabled>정답 채우기</button></div>' : ''}
      </div>`;
  if (inner) return body;
  return `<div class="qb-modal-body">${body}</div>
    <div class="qb-modal-foot"><button type="button" class="qb-btn" data-qb="close-modal">닫기</button>
      <button type="button" class="qb-btn qb-btn-primary" data-qb="bulk-apply" data-field="${field}" disabled>편집기에 채우기</button></div>`;
}
const qbBulkRoot = field => document.querySelector('#qbModal [data-bulk="' + field + '"]');
const qbBulkBtn = field => document.querySelector('#qbModal [data-qb="bulk-apply"][data-field="' + field + '"]');
function qbBulkValues(text, field) {
  const circ = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };
  const body = String(text || '').replace(/```[a-z]*\s*/gi, '').replace(/[①②③④⑤]/g, m => ' ' + circ[m] + ' ');
  return (body.match(/\d+(?:\.\d+)?/g) || []).map(Number).map(n => (field === 4 && n % 1) ? Math.round(n) : n);
}
function qbBulkPlan(field) {
  const root = qbBulkRoot(field);
  const vals = qbBulkValues(root.querySelector('[data-b="text"]').value, field);
  const skipHidden = root.querySelector('[data-b="skip"]').checked;
  const start = root.querySelector('[data-b="start"]').value;
  const items = qbListItems();
  let i = items.findIndex(it => it.key === start);
  if (i < 0) i = 0;
  const plan = [];
  let vi = 0;
  for (; i < items.length && vi < vals.length; i++) {
    const it = items[i];
    if (skipHidden && it.col && it.col.hidden) continue;
    const w = qbWork(it.key);
    const n = vals[vi++];
    const row = { key: it.key, label: qbShortId(w.v[0]) || '(새 문항)', type: w.v[2] || '', old: w.f[field] ? '(수식)' : String(w.v[field] == null ? '' : w.v[field]), val: n, field: field };
    const max = field === 4 ? 15 : 5;
    if (w.f[field]) row.err = '수식으로 연결된 칸이라 건너뜁니다';
    else if (!(n >= 1 && n <= max && n % 1 === 0)) row.err = `1~${max} 사이 숫자가 아닙니다`;
    plan.push(row);
  }
  return { plan, extra: vals.length - vi, count: vals.length, field };
}
function qbBulkRender(field) {
  const root = qbBulkRoot(field);
  if (!root) return;
  const out = root.querySelector('[data-b="out"]'), btn = qbBulkBtn(field);
  const label = field === 15 ? '정답 채우기' : '편집기에 채우기';
  const { plan, extra, count } = qbBulkPlan(field);
  if (!count) { out.innerHTML = '<div class="qb-empty">숫자를 붙여넣으면 어느 문항에 들어갈지 여기에 보입니다.</div>'; btn.disabled = true; btn.textContent = label; return; }
  const ok = plan.filter(r => !r.err).length;
  const fmt = v => field === 15 && /^[1-5]$/.test(String(v)) ? '①②③④⑤'[Number(v) - 1] : qbEsc(v);
  out.innerHTML = `<div class="qb-paste-sum" style="margin:8px">숫자 ${count}개 → ${ok}문항에 넣습니다.${extra > 0 ? ` <b style="color:#b91c1c">남는 숫자 ${extra}개</b>(뒤에 문항이 없음)` : ''}</div>` +
    '<table class="qb-key-table"><thead><tr><th></th><th>문항</th><th>지금</th><th>새 값</th></tr></thead><tbody>' + plan.map((r, k) =>
      `<tr class="${r.err ? 'is-skip has-warn' : ''}"><td>${k + 1}</td><td><b>${qbEsc(r.label)}</b> <span class="qb-muted">${qbEsc(r.type)}</span></td>
       <td class="qb-muted">${r.old === '' ? '-' : fmt(r.old)}</td>
       <td><b>${fmt(r.val)}</b>${r.err ? '<div class="qb-pr-warn">' + qbEsc(r.err) + '</div>' : (r.old !== '' && r.old !== String(r.val) ? ' <span class="qb-chip qb-chip-dirty">바꿈</span>' : '')}</td></tr>`).join('') + '</tbody></table>';
  btn.disabled = !ok;
  btn.textContent = `${label} (${ok}문항)`;
}
function qbBulkApply(field) {
  const { plan } = qbBulkPlan(field);
  const ok = plan.filter(r => !r.err);
  if (!ok.length) return;
  ok.forEach(r => { qbWork(r.key).v[field] = String(r.val); });
  qbCloseModal();
  qbRenderList();
  if (QB.sel != null) qbRenderForm();
  showToast(`${ok.length}문항의 ${field === 4 ? '난이도' : '정답'}를 채웠습니다. 확인한 뒤 [모두 저장]을 누르세요.`, 'info');
}

/* ---------- 이벤트 ---------- */
function qbBind() {
  if (QB.bound) return;
  const page = document.getElementById('qbankPage');
  if (!page) return;
  QB.bound = true;
  page.addEventListener('change', e => {
    if (e.target.id === 'qbSheetSelect') qbOpenSheet(e.target.value);
    if (e.target.id === 'qbShowAns') { QB.showAns = e.target.checked; qbRenderPreview(); }
    if (e.target.id === 'qbPdfFile') { qbPdfLoad(e.target.files && e.target.files[0]); e.target.value = ''; }
    const bk = e.target.closest && e.target.closest('[data-bulk]');
    if (bk && (e.target.dataset.b === 'start' || e.target.dataset.b === 'skip')) qbBulkRender(Number(bk.dataset.bulk));
    if (e.target.id === 'qbKeyFile') { qbKeyLoad(e.target.files && e.target.files[0]); e.target.value = ''; }
    if (/^qbKey(Trans|Expl|Vocab|Over)$/.test(e.target.id) || (e.target.dataset && e.target.dataset.ki != null)) {
      if (e.target.dataset && e.target.dataset.ki != null) { const n = document.querySelectorAll('#qbKeyOut input[data-ki]:checked').length; const b = document.querySelector('#qbModal [data-qb="key-apply"]'); b.disabled = !n; b.textContent = `편집기에 채우기 (${n}문항)`; }
      else qbKeyRender();
    }
  });
  page.addEventListener('input', e => {
    if (e.target.id === 'qbFilter') { qbRenderList(); return; }
    const bk = e.target.closest && e.target.closest('[data-bulk]');
    if (bk && e.target.dataset.b === 'text') { qbBulkRender(Number(bk.dataset.bulk)); return; }
    if (e.target.closest('#qbMain') && e.target.dataset && e.target.dataset.row != null) qbOnInput(e.target);
  });
  page.addEventListener('focusin', e => {
    if (e.target.closest('#qbMain') && e.target.dataset && e.target.dataset.row != null) QB.focus = e.target;
  });
  // 태그 버튼을 눌러도 입력칸의 선택 영역이 풀리지 않게 합니다.
  page.addEventListener('mousedown', e => { if (e.target.closest('.qb-tb')) e.preventDefault(); });
  page.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (QB.sel != null && qbIsDirty(QB.sel)) qbSave([QB.sel]);
      return;
    }
    if (mod && !e.shiftKey && !e.altKey && e.target.matches && e.target.matches('#qbMain textarea.qb-ta')) {
      const k = e.key.toLowerCase();
      if (k === 'u' || k === 'b' || k === 'i') { e.preventDefault(); QB.focus = e.target; qbWrapTag(k); }
    }
    if (e.key === 'Enter' && e.target.id === 'qbImgInput') { e.preventDefault(); qbInsertImage(); }
    if (e.key === 'Escape' && !document.getElementById('qbModal').hidden) qbCloseModal();
  });
  page.addEventListener('click', e => {
    const item = e.target.closest('[data-qb-item]');
    if (item) { qbSelect(item.dataset.qbItem); return; }
    const tag = e.target.closest('.qb-tb');
    if (tag) {
      if (tag.dataset.qbIns) { const el = qbTarget(); if (el) qbReplaceSel(el, () => ({ text: tag.dataset.qbIns })); return; }
      if (tag.dataset.qbTag) qbWrapTag(tag.dataset.qbTag); else if (tag.dataset.qbAct) qbToolAct(tag.dataset.qbAct, tag);
      return;
    }
    if (e.target.id === 'qbModal') { qbCloseModal(); return; }
    const b = e.target.closest('[data-qb]');
    if (!b || b.disabled) return;
    const act = b.dataset.qb;
    const key = QB.sel;
    if (act === 'reload-sheets') qbLoadSheets();
    else if (act === 'new-sheet') qbNewSheetDialog();
    else if (act === 'src-edit') qbSrcDialog();
    else if (act === 'src-apply') qbSrcApply();
    else if (act === 'create-sheet') qbCreateSheet();
    else if (act === 'add') qbAddQuestion();
    else if (act === 'import') qbImportDialog();
    else if (act === 'imp-tab') qbImportTab(b.dataset.tab);
    else if (act === 'paste-parse') qbPasteParse();
    else if (act === 'pdf-pick') qbPdfPick();
    else if (act === 'bulk-apply') qbBulkApply(Number(b.dataset.field));
    else if (act === 'key-pick') { const inp = document.getElementById('qbKeyFile'); if (inp) inp.click(); }
    else if (act === 'key-apply') qbKeyApply();
    else if (act === 'prev-print' || act === 'prev-online') {
      QB.prevMode = act === 'prev-print' ? 'print' : 'online';
      document.querySelectorAll('#qbankPage .qb-seg-btn').forEach(x => x.classList.toggle('active', x.dataset.qb === act));
      qbRenderPreview();
    }
    else if (act === 'paste-import') qbPasteImport();
    else if (act === 'close-modal') qbCloseModal();
    else if (act === 'save-all') qbSave(qbDirtyKeys());
    else if (act === 'save-one' && key != null) qbSave([key]);
    else if (act === 'revert' && key != null) { delete QB.work[key]; qbRenderList(); qbRenderForm(); }
    else if (act === 'drop-draft' && key != null) showCustomConfirm('이 새 문항을 버릴까요? (시트에는 아직 저장되지 않았습니다)', () => qbDropDraft(key));
    else if (act === 'hide') qbSetHidden(true);
    else if (act === 'unhide') qbSetHidden(false);
    else if (act === 'img-insert') qbInsertImage();
    else if (act === 'ans' && key != null) {
      const inp = document.getElementById('qbF15');
      if (inp) { inp.value = b.dataset.n; qbOnInput(inp); }
    } else if (act === 'unlink' && key != null) {
      const r = Number(b.dataset.row), w = qbWork(key), o = qbOrig(key);
      w.f[r] = ''; w.v[r] = o ? o.v[r] : '';
      qbRenderForm(); qbRenderList();
    } else if (act === 'add-box' && key != null) {
      const w = qbWork(key);
      const vis = x => w.v[x] || w.f[x] || (w.extraBoxes || 0) >= x - 6;
      const r = [7, 8, 9].find(x => !vis(x));
      if (r != null) {
        w.extraBoxes = r - 6;
        qbRenderForm();
        const ta = document.getElementById('qbF' + r);
        if (ta) ta.focus();
      }
    }
  });
  window.addEventListener('beforeunload', e => {
    if (qbDirtyKeys().length) { e.preventDefault(); e.returnValue = '저장하지 않은 문제은행 변경이 있습니다.'; }
  });
}
