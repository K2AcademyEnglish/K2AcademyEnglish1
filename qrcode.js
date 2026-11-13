/* ==========================================================================
 * qrcode.js — 외부 서비스 없이 QR 코드를 만드는 작은 모듈
 *   - 바이트 모드(UTF-8), 오류 정정 L/M, 버전 1~10 (주소 약 270자까지)
 *   - 알고리즘은 Project Nayuki의 QR Code generator(MIT)를 따랐습니다.
 *   사용: QR.svg('https://…', { ecc: 'M', border: 2 }) → <svg> 문자열
 *        QR.dataUrl('https://…') → <img src>에 넣을 data: 주소
 * ========================================================================== */
(function (global) {
  'use strict';
  const ECL = { L: { ord: 0, fmt: 1 }, M: { ord: 1, fmt: 0 } };
  // [오류 정정 수준][버전] (버전 1~10)
  const ECC_PER_BLOCK = [[-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]];
  const NUM_BLOCKS = [[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]];
  const MAX_VER = 10;

  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function rawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = (ver, e) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e.ord][ver] * NUM_BLOCKS[e.ord][ver];

  // GF(2^8) 곱셈 (다항식 0x11D)과 리드-솔로몬 오류 정정
  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = gfMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    data.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); });
    return r;
  }
  function utf8(s) {
    const out = [];
    const str = unescape(encodeURIComponent(String(s)));
    for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i));
    return out;
  }

  function encode(text, eccName) {
    const e = ECL[eccName] || ECL.M;
    const bytes = utf8(text);
    let ver = 1, cap = 0;
    for (; ver <= MAX_VER; ver++) {
      const ccBits = ver <= 9 ? 8 : 16;
      cap = dataCodewords(ver, e) * 8;
      if (4 + ccBits + bytes.length * 8 <= cap) break;
    }
    if (ver > MAX_VER) throw new Error('QR에 담기에는 글이 너무 깁니다.');
    // 비트열: 모드(0100) + 글자 수 + 데이터 + 끝 표시 + 채움
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    return build(ver, e, interleave(ver, e, data));
  }

  function interleave(ver, e, data) {
    const nb = NUM_BLOCKS[e.ord][ver], el = ECC_PER_BLOCK[e.ord][ver];
    const raw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(el);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) out.push(b[i]); });
    return out;
  }

  function build(ver, e, codewords) {
    const size = ver * 4 + 17;
    const mod = [], fn = [];
    for (let y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const setF = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };

    // 타이밍·위치 찾기·정렬 무늬
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
      }
    });
    const al = [];
    if (ver > 1) {
      const n = Math.floor(ver / 7) + 2;
      const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      al.push(6);
      for (let pos = size - 7; al.length < n; pos -= step) al.splice(1, 0, pos);
    }
    al.forEach((ay, i) => al.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = mask => {
      const d = (e.fmt << 3) | mask;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i));
      setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i));
      setF(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, bit(b, i)); setF(c, a, bit(b, i)); }
    }
    // 데이터 배치 (오른쪽 아래부터 지그재그)
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y][x] && k < codewords.length * 8) { mod[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
      }
    }
    // 마스크 8가지 중 벌점이 가장 낮은 것
    const maskFn = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
    ];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) {
        let rx = 1, ry = 1;
        for (let x = 0; x < size; x++) {
          if (mod[y][x]) dark++;
          if (x > 0) {
            if (mod[y][x] === mod[y][x - 1]) { rx++; if (rx === 5) p += 3; else if (rx > 5) p++; } else rx = 1;
            if (mod[x][y] === mod[x - 1][y]) { ry++; if (ry === 5) p += 3; else if (ry > 5) p++; } else ry = 1;
          }
          if (x > 0 && y > 0 && mod[y][x] === mod[y][x - 1] && mod[y][x] === mod[y - 1][x] && mod[y][x] === mod[y - 1][x - 1]) p += 3;
        }
      }
      const total = size * size;
      p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const p = penalty();
      if (p < bestP) { bestP = p; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size, modules: mod, version: ver, mask: best };
  }

  function svg(text, opts) {
    opts = opts || {};
    const q = encode(text, opts.ecc || 'M');
    const b = opts.border == null ? 2 : opts.border, n = q.size + b * 2;
    let d = '';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + b},${y + b}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  const dataUrl = (text, opts) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(text, opts));

  global.QR = { encode, svg, dataUrl };
})(typeof window !== 'undefined' ? window : globalThis);
