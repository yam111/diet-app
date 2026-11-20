/** @OnlyCurrentDoc */
// 食光 共用條碼食物庫（Google Apps Script，綁在試算表「食光 共用條碼食物庫」上）
// 部署：部署 → 新增部署作業 → 網頁應用程式，執行身分「我」、存取權「所有人」
// 大家掃條碼、照包裝存好的食物會 POST 到這裡（只有條碼、品名、營養數字，沒有任何個人資料）
// 沒條碼的自訂食物也收（條碼欄空白，用品名當鍵）
// App 用 GET 讀回：同一個條碼（沒條碼就同一個品名）取最新一筆；「停用」打勾的那筆不給（有人亂填就在試算表打勾）
const SHEET = '條碼食物';
const HEAD = ['時間', '條碼', '名稱', '每份克', '液體', '每100熱量', '每100蛋白質', '每100碳水', '每100脂肪', '停用', '每100糖', '每100鈉mg', '每100飽和脂肪', '每100反式脂肪', '每100膳食纖維'];
// 糖、鈉…是後來加的，接在「停用」後面，舊資料不用搬；沒填＝空白（不知道）
const NXK = ['sug', 'na', 'sat', 'tr', 'fib'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET, 0);
    s.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    s.setFrozenRows(1);
    s.getRange('B:B').setNumberFormat('@');
  }
  if (s.getLastColumn() < HEAD.length) s.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
  return s;
}

function clean_(d) {
  const bc = String(d.barcode || '').replace(/\D/g, '');
  if (bc && (bc.length < 8 || bc.length > 14)) return null;
  const name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/^[=+\-@]+/, '').trim().slice(0, 40);
  if (!name) return null;
  const num = (v, lo, hi) => { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? Math.round(v * 10) / 10 : NaN; };
  const g = num(d.g, 1, 3000), k = num(d.kcal, 0, 950), p = num(d.p, 0, 100), c = num(d.c, 0, 100), f = num(d.f, 0, 100);
  if ([g, k, p, c, f].some(isNaN)) return null;
  if (p + c + f > 100.5) return null;
  // 熱量跟三大營養素不用對得起來（喉糖的糖醇、膳食纖維會不一樣），包裝怎麼寫就收
  // 其他營養素：數字怪的就當沒填（不擋整筆）
  const lim = { sug: c + 0.5, na: 40000, sat: f + 0.5, tr: f + 0.5, fib: 100 };
  const nx = NXK.map(key => { if (d[key] == null || d[key] === '') return ''; const v = Number(d[key]); if (!isFinite(v) || v < 0 || v > lim[key]) return ''; return key === 'na' ? Math.round(v) : Math.round(v * 100) / 100; });
  if (nx[2] !== '' && nx[3] !== '' && nx[2] + nx[3] > f + 0.5) nx[3] = '';
  return [bc, name, g, d.liq ? 1 : 0, k, p, c, f].concat(nx);
}

function doPost(e) {
  let d; try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: 0, err: 'json' }); }
  const row = clean_(d || {}); if (!row) return out_({ ok: 0, err: 'bad' });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const s = sheet_(), n = s.getLastRow();
    // 跟這個條碼最新一筆一模一樣就不重複寫
    if (n > 1) {
      const v = s.getRange(2, 2, n - 1, HEAD.length - 1).getValues().map(r => r.slice(0, 8).concat(r.slice(9, 14)));
      const key = r => String(r[0]).replace(/\D/g, '') || 'n:' + String(r[1]), k0 = key(row);
      for (let i = v.length - 1; i >= 0; i--) if (key(v[i]) === k0) { if (v[i].every((x, j) => String(x) === String(row[j]))) return out_({ ok: 1, same: 1 }); break; }
    }
    s.appendRow([new Date(), row[0] ? "'" + row[0] : ''].concat(row.slice(1, 8)).concat([false]).concat(row.slice(8)));
    s.getRange(s.getLastRow(), 10).insertCheckboxes();
    return out_({ ok: 1 });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const s = sheet_(), n = s.getLastRow(), want = String((e && e.parameter && e.parameter.bc) || '').replace(/\D/g, '');
  const m = {};
  if (n > 1) for (const r of s.getRange(2, 1, n - 1, HEAD.length).getValues()) {
    const bc = String(r[1]).replace(/\D/g, ''), name = String(r[2]); if (!name || r[9] === true || (want && bc !== want)) continue;
    m[bc || 'n:' + name] = [bc, String(r[2]), +r[3], r[4] ? 1 : 0, +r[5], +r[6], +r[7], +r[8]].concat(r.slice(10, 15).map(x => x === '' || x == null ? null : +x));
  }
  return out_({ ok: 1, items: Object.values(m) });
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
