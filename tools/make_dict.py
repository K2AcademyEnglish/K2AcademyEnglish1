# 단어 엑셀(단어 통합 / 숙어 통합 시트) → dict-ko.json
# 사용법: python make_dict.py 단어엑셀.xlsx ../dict-ko.json
#  - 첫 열 = 영어, 둘째 열부터 = 뜻. 같은 단어가 여러 번 나오면 뜻을 합칩니다(앞 시트 우선).
#  - "correspond to[with]" → "correspond to", "correspond with" 둘 다 찾을 수 있게 넣습니다.
#  - 끝에 붙은 "??" 같은 깨진 글자는 지웁니다.
import sys, re, json, itertools
import openpyxl

def clean(s):
    return re.sub(r'\s+', ' ', str(s)).strip()

def variants(key):
    k = re.sub(r'\?+', '', key).strip()
    k = re.sub(r'\s+', ' ', k)
    out = [k]
    if '[' in k:
        parts = re.split(r'(\S*\[[^\]]*\])', k)
        opts = []
        for p in parts:
            m = re.fullmatch(r'(\S*)\[([^\]]*)\]', p)
            if m:
                alts = [m.group(1)] + [a.strip() for a in re.split(r'[,/]', m.group(2)) if a.strip()]
                opts.append(alts)
            else:
                opts.append([p])
        combos = [''.join(c) for c in itertools.product(*opts)][:8]
        out = [re.sub(r'\s+', ' ', c).strip() for c in combos]
    # "(to/with)" 같은 생략 가능한 부분은 빼고도 찾을 수 있게
    more = []
    for o in out:
        if '(' in o:
            more.append(re.sub(r'\s*\([^)]*\)', '', o).strip())
    return [v for v in dict.fromkeys(out + more) if v]

def main(src, dst):
    wb = openpyxl.load_workbook(src, read_only=True)
    D = {}
    for ws in wb.worksheets:
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row or row[0] is None:
                continue
            word = clean(row[0])
            means = [clean(m) for m in row[1:] if m is not None and clean(m)]
            if not word or not means:
                continue
            for k in variants(word.lower()):
                cur = D.setdefault(k, [])
                for m in means:
                    if m not in cur:
                        cur.append(m)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(D, f, ensure_ascii=False, separators=(',', ':'))
    print(len(D), 'words →', dst)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'dict-ko.json')
