// node test/label_test.js：營養標示文字 → 數字（辨識常見錯字也要讀對）
require('../js/label.js'); const P = LabelOCR.parse; let fail = 0;
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fail++; console.log('FAIL', n, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } };
const A = `營養標示
每一份量 30 公克
本包裝含 4 份
        每份      每100公克
熱量    150 大卡   500 大卡
蛋白質  3.0 公克   10.0 公克
脂肪    6.6 公克   22.0 公克
 飽和脂肪 2.1 公克  7.0 公克
 反式脂肪 0 公克    0 公克
碳水化合物 19.5 公克 65.0 公克
 糖     3.2 公克   10.7 公克
鈉      8.5 毫克   28.3 毫克`;
let r = P(A); eq('A g', r.g, 30); eq('A basis', r.basis, 0); eq('A vals', r.vals, { k: 150, p: 3, f: 6.6, sat: 2.1, tr: 0, c: 19.5, sug: 3.2, na: 8.5 }); eq('A h糖鈉', [r.h.sug, r.h.na], [10.7, 28.3]);
// 每日參考值百分比那欄不要當成每 100 克
const B = `營養標示
每一份量 250 毫升
本包裝含 1 份
每份 每日參考值百分比
熱量 120 大卡 6%
蛋白質 8.0 公克 13%
脂肪 4.5 公克 8%
飽和脂肪 3.0 公克 17%
反式脂肪 0 公克 *
碳水化合物 12.0 公克 4%
糖 11.5 公克 *
鈉 105 毫克 5%`;
r = P(B); eq('B', [r.g, r.liq, r.basis, r.vals.sug, r.vals.na, r.vals.k], [250, 1, 0, 11.5, 105, 120]);
// 辨識錯字：O 當 0、全形數字、「公 克」、數字中間空白、鈉讀成納
const C = `每一份量 4O 公 克
熱量 ２１０ 大卡
蛋白質 5 . 2 公克
脂肪 1O.1公克
碳水化合物 24.O公克
糖 3.2公克
納 85 毫克`;
r = P(C); eq('C', [r.g, r.vals.k, r.vals.p, r.vals.f, r.vals.c, r.vals.sug, r.vals.na], [40, 210, 5.2, 10.1, 24, 3.2, 85]);
// 只有每 100 公克一欄
r = P(`營養標示\n每100公克\n熱量 380大卡\n蛋白質 7.5公克\n脂肪 2.0公克\n碳水化合物 82公克\n糖 0.5公克\n鈉 3公克`);
eq('D', [r.basis, r.vals.k, r.vals.na, r.vals.sug], [1, 380, 3000, 0.5]);
console.log(fail ? fail + ' FAIL' : 'ALL PASS');
