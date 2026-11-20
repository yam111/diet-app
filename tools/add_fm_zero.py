# 補回全家官網「每份 0 大卡」的無糖飲料（當初 build_brands.py 把熱量 0 的濾掉了）
import json, re
D = 'C:/Users/raymond/diet-app/'
det = json.load(open('C:/tmp/nut7/fm_det.json', encoding='utf-8'))
B = json.load(open(D + 'data/brands.json', encoding='utf-8'))
F = open(D + 'js/foods.js', encoding='utf-8').read()
taken = {x[1].lower() for x in B} | {x[1].lower() for x in B if x[1]}
ids = {x[0] for x in B}
r1 = lambda v: round(v * 10) / 10
add = []
for cm, x in det.items():
    note, nu = x.get('note') or '', x.get('nut') or {}
    if not re.search(r'每份熱量0大卡', note): continue
    if x['cat'] not in ('一般飲料', '現做飲料'): continue  # 冰塊、蔬菜不收
    mg = re.search(r'每份規格([\d.]+)(公克|毫升|克|ml|g)', note, re.I); ms = re.search(r'含([\d.]+)份', note)
    if not mg: continue
    p, c, f = (nu.get(k) or 0 for k in ('PROTEIN', 'CARBOHYDRATE', 'TOTALFAT'))
    if p + c + f > 0.5: continue  # 標 0 卡但有營養素的不收
    name = re.sub(r'\s+', '', x['name']).strip()
    if name.lower() in taken or ('fm' + cm) in ids: continue
    taken.add(name.lower())
    g = float(mg.group(1)); n = float(ms.group(1)) if ms else 1
    u = '瓶' if re.search(r'瓶|罐', name) or x['cat'] == '一般飲料' else '杯'
    units = f'{u}:{r1(g):g}' if n <= 1.05 else f'份:{r1(g):g},瓶:{r1(g * n):g}'
    na = nu.get('SODIUM'); su = nu.get('SUGAR')
    nx = [r1(su / g * 100) if su is not None else None, r1(na / g * 100) if na is not None else None, 0, 0, None]
    add.append(['fm' + cm, name, '', 0, 0, 0, 0, units, '超商', '全家', '官網標示', nx])
B.extend(add)
json.dump(B, open(D + 'data/brands.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('加', len(add)); print('、'.join(a[1] for a in add))
