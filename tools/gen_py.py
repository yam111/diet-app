# 產生 js/py.js：字 → 讀音（不分聲調），語音講錯同音字（半斤→半筋）用來校正
import json, re, sys
from pypinyin import pinyin, Style
R = 'C:/Users/raymond/diet-app/'
chars = set()
for b1 in range(0xA4, 0xC7):  # Big5 常用字
    for b2 in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
        try: chars.add(bytes([b1, b2]).decode('big5'))
        except Exception: pass
txt = open(R + 'js/foods.js', encoding='utf-8').read() + open(R + 'data/brands.json', encoding='utf-8').read() + open(R + 'data/tfda.json', encoding='utf-8').read()
chars |= set(re.findall(r'[\u4e00-\u9fff]', txt))
chars = {c for c in chars if '\u4e00' <= c <= '\u9fff'}
groups = {}
for c in sorted(chars):
    p = pinyin(c, style=Style.NORMAL, heteronym=False)[0][0]
    if not re.fullmatch(r'[a-z]+', p): continue
    groups.setdefault(p, []).append(c)
s = '|'.join(k + ':' + ''.join(v) for k, v in sorted(groups.items()))
open(R + 'js/py.js', 'w', encoding='utf-8').write('// 字的讀音（tools/gen_py.py 產生）\nglobalThis.PY_TABLE = "' + s + '";\n')
print(len(chars), 'chars', len(s.encode('utf-8')) // 1024, 'KB')
