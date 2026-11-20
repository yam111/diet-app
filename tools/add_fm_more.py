# 全家「食在購安心」新抓到的品項加進 data/brands.json（規則同 C:/tmp/nut7/build_brands.py 第 1 段＋nut16/apply.py 營養素）
# 另外：每份 0 大卡、三大營養都是 0 的飲料也收（無糖茶），已加過的照官網重算營養素欄
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
D = 'C:/Users/raymond/diet-app/'
det = json.load(open('C:/tmp/nut7/fm_det.json', encoding='utf-8'))
B = json.load(open(D + 'data/brands.json', encoding='utf-8'))
F = open(D + 'js/foods.js', encoding='utf-8').read()
taken = {x[1].lower() for x in B} | {a.lower() for x in B for a in x[2].split(',') if a}
for ln in F.splitlines():
    if '|' in ln: taken |= {a.lower() for a in ln.split('|')[0:2][0:1] + ln.split('|')[1].split(',') if a}
ids = {x[0]: x for x in B}
r1 = lambda v: round(v * 10) / 10

def unit_of(n, ml):
    if ml or re.search(r'茶|咖啡|拿鐵|奶$|乳$|飲|汁|豆漿|可可|水$|歐蕾|美式', n): return '瓶' if re.search(r'瓶|罐', n) else '杯'
    for k, u in [('飯糰', '個'), ('三明治', '個'), ('漢堡', '個'), ('堡', '個'), ('包', '個'), ('饅頭', '個'), ('麵包', '個'), ('可頌', '個'), ('捲', '條'), ('熱狗', '條'), ('蛋糕', '個'), ('布丁', '個'), ('便當', '盒'), ('盒', '盒'), ('丼', '盒'), ('沙拉', '盒'), ('涼麵', '盒'), ('蛋$', '顆')]:
        if re.search(k, n): return u
    return '份'

def nx(nu, g):
    s = 100 / g
    r = lambda key, nd=1: None if nu.get(key) is None else round(nu[key] * s, nd)
    v = [r('SUGAR'), r('SODIUM', 0), r('SATFAT'), r('TRANSFAT', 2), None]
    if v[1] is not None: v[1] = int(v[1])
    return v

add, fixed, bad = [], 0, 0
for cm, x in det.items():
    note, nu = x.get('note') or '', x.get('nut') or {}
    mk = re.search(r'每份熱量([\d.]+)大卡', note); mg = re.search(r'每份規格([\d.]+)(公克|毫升|克|ml|g)', note, re.I); ms = re.search(r'含([\d.]+)份', note)
    p, c, f = nu.get('PROTEIN'), nu.get('CARBOHYDRATE'), nu.get('TOTALFAT')
    if not (mk and mg) or None in (p, c, f): bad += 1; continue
    kc, g = float(mk.group(1)), float(mg.group(1)); n = float(ms.group(1)) if ms else 1
    if g <= 0: bad += 1; continue
    zero = kc == 0
    if zero:
        if p + c + f > 0 or x['cat'] not in ('一般飲料', '現做飲料'): bad += 1; continue
    else:
        est = 4 * p + 4 * c + 9 * f
        if not est or not (0.7 < kc / est < 1.35): bad += 1; continue
    id = 'fm' + cm
    if id in ids:
        if zero: ids[id][11] = nx(nu, g); fixed += 1
        continue
    name = re.sub(r'\s+', '', x['name']).strip()
    if name.lower() in taken: continue
    taken.add(name.lower())
    u = unit_of(name, mg.group(2) in ('毫升', 'ml'))
    units = f'{u}:{r1(g):g}' if n <= 1.05 else f'份:{r1(g):g},{"瓶" if u in ("杯", "瓶") else "包"}:{r1(g * n):g}'
    add.append([id, name, '', r1(kc / g * 100), r1(p / g * 100), r1(c / g * 100), r1(f / g * 100), units, '超商', '全家', '官網標示', nx(nu, g)])
B.extend(add)
json.dump(B, open(D + 'data/brands.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('新加', len(add), '重算零卡', fixed, '不合格', bad)
cats = {}
for cm, x in det.items():
    if 'fm' + cm in {a[0] for a in add}: cats[x['cat']] = cats.get(x['cat'], 0) + 1
print(cats)
print('、'.join(a[1] for a in add))
