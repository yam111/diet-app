require('../js/foods.js'); require('../js/parser.js');
NL.setFoods(FOODS);
let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fail++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } };
const P = (txt, h = 12) => { const r = NL.parse(txt, h); return r.items.map(i => `${i.food.name}:${i.grams}:${i.meal[0]}`).join(' ') + (r.unknown.length ? ' ?' + r.unknown.join(',') : ''); };

// 搜尋
eq('s蝦', NL.search('蝦').map(f => f.name).includes('蝦仁蛋炒飯'), true);
eq('s蝦first', NL.search('蝦')[0].name, '蝦仁');
eq('s炒飯', NL.search('炒飯').length >= 7, true);
eq('s蝦炒飯', NL.search('蝦炒飯').slice(0,3).map(f=>f.name).includes('蝦仁蛋炒飯'), true);
eq('s雞', NL.search('雞').length >= 10, true);
eq('s珍奶', NL.search('珍奶')[0].name, '珍珠奶茶');
eq('s飯蛋炒', NL.search('飯蛋炒').length > 0, true);
// 數字
eq('n1', NL.cnNum('一百五十'), 150); eq('n2', NL.cnNum('兩百'), 200); eq('n3', NL.cnNum('三百五'), 350);
eq('n4', NL.cnNum('十二'), 12); eq('n5', NL.cnNum('半'), 0.5); eq('n6', NL.cnNum('一千二'), 1200); eq('n7', NL.cnNum('二十'), 20); eq('n8', NL.cnNum('一百零五'), 105);
// 句子
eq('p1', P('我早餐吃了兩顆水煮蛋一杯無糖豆漿還有一個地瓜大概150克'), '雞蛋:110:b 無糖豆漿:400:b 地瓜:150:b');
eq('p2', P('午餐吃蝦仁蛋炒飯一盤'), '蝦仁蛋炒飯:350:l');
eq('p3', P('雞胸肉150克白飯一碗'), '雞胸肉:150:l 白飯:160:l');
eq('p4', P('雞胸肉150克白飯'), '雞胸肉:150:l 白飯:160:l');
eq('p5', P('一碗飯兩顆蛋'), '白飯:160:l 雞蛋:110:l');
eq('p6', P('蛋兩顆飯一碗'), '雞蛋:110:l 白飯:160:l');
eq('p7', P('早餐吃蛋餅跟豆漿，午餐吃雞腿便當，晚餐吃牛肉麵，下午喝了一杯珍奶'), '蛋餅:110:b 無糖豆漿:400:b 雞腿便當:550:l 牛肉麵:700:d 珍珠奶茶:700:s');
eq('p8', P('三杯雞一份和半碗飯'), '三杯雞:150:l 白飯:80:l');
eq('p9', P('吃了一碗半的白飯'), '白飯:240:l');
eq('p10', P('晚餐 鮭魚 一百二十克 花椰菜 一百克 糙米飯 半碗'), '鮭魚:120:d 花椰菜:100:d 糙米飯:80:d');
eq('p11', P('兩片吐司夾一顆荷包蛋配拿鐵', 8), '白吐司:60:b 荷包蛋:50:b 拿鐵:360:b');
eq('p12', P('水餃十顆'), '水餃:250:l');
eq('p13', P('吃了蛋黃酥一個'), ' ?蛋黃酥');
eq('p14', P('喝了500毫升的牛奶', 22), '鮮奶:500:s');
eq('p15', P('2顆茶葉蛋 1根香蕉'), '茶葉蛋:110:l 香蕉:100:l');
eq('p16', P('雞胸肉兩百克，地瓜一條，花椰菜一份'), '雞胸肉:200:l 地瓜:200:l 花椰菜:100:l');
eq('p17', P('一匙橄欖油'), '橄欖油:10:l');
eq('p18', P('五花肉三片'), '五花肉:60:l');
eq('p19', P('兩個半的饅頭'), '饅頭:250:l');
eq('p20', P('乳清一匙加香蕉一根當點心'), '乳清蛋白:30:s 香蕉:100:s');
// 11/19 嚴格檢查補的
eq('q1', P('滷肉飯小碗'), '滷肉飯:175:l');
eq('q2', P('我要一杯大杯拿鐵'), '拿鐵:468:l');
eq('q3', P('早餐一個蛋餅一杯大冰奶'), '蛋餅:110:b 大冰奶:700:b');
eq('q4', P('晚上吃火鍋'), '火鍋:1000:d');
eq('q5', P('晚餐吃了大麥克和中薯'), '大麥克:215:d 薯條:110:d');
eq('q6', P('喝了一杯珍珠奶茶半糖'), '珍珠奶茶:700:l');
eq('q7', NL.parse('喝了一杯珍珠奶茶半糖', 12).items[0].sugar.n, '半糖');
eq('q8', NL.parse('半糖珍奶一杯', 12).items[0].sugar.n, '半糖');
eq('q9', NL.parse('一杯無糖綠茶和一杯珍奶', 12).items.map(i => i.sugar && i.sugar.n), [null, null]);
eq('q10', NL.sugarVariant(FOODS.find(f => f.name === '珍珠奶茶'), '半糖').kcal, 60);
eq('q11', NL.parse('昨天晚餐吃了牛肉麵', 12).dayOffset, -1);
eq('q12', NL.parse('前天早餐吃了稀飯', 12).dayOffset, -2);
eq('q13', NL.parse('昨晚吃了雞腿便當', 12).items[0].meal, 'dinner');
eq('q14', NL.parse('午餐吃了雞腿便當', 12).dayOffset, 0);
eq('q15', P('昨天晚餐吃了牛肉麵和一杯半糖珍奶'), '牛肉麵:700:d 珍珠奶茶:700:d');
eq('q16', P('珍奶半糖少冰兩杯'), '珍珠奶茶:1400:l');
eq('q17', P('一杯微糖去冰紅茶'), '紅茶:500:l');
console.log(fail ? fail + ' FAILED' : 'ALL PASS', '| foods:', FOODS.length);
