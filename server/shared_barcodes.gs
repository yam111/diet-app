/** @OnlyCurrentDoc */
// 食光 共用條碼食物庫（Google Apps Script，綁在試算表「食光 共用條碼食物庫」上）
// 部署：部署 → 新增部署作業 → 網頁應用程式，執行身分「我」、存取權「所有人」
// 大家掃條碼、照包裝存好的食物會 POST 到這裡（只有條碼、品名、營養數字，沒有任何個人資料）
// App 用 GET 讀回：同一個條碼取最新一筆；「停用」打勾的那筆不給（有人亂填就在試算表打勾）
const SHEET = '條碼食物';
const HEAD = ['時間', '條碼', '名稱', '每份克', '液體', '每100熱量', '每100蛋白質', '每100碳水', '每100脂肪', '停用'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET, 0);
    s.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    s.setFrozenRows(1);
    s.getRange('B:B').setNumberFormat('@');
  }
  return s;
}

function clean_(d) {
  const bc = String(d.barcode || '').replace(/\D/g, '');
  if (bc.length < 8 || bc.length > 14) return null;
  const name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/^[=+\-@]+/, '').trim().slice(0, 40);
  if (!name) return null;
  const num = (v, lo, hi) => { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? Math.round(v * 10) / 10 : NaN; };
  const g = num(d.g, 1, 3000), k = num(d.kcal, 0, 950), p = num(d.p, 0, 100), c = num(d.c, 0, 100), f = num(d.f, 0, 100);
  if ([g, k, p, c, f].some(isNaN)) return null;
  if (p + c + f > 100.5) return null;
  // 有填三大營養素的話，算出來的熱量要跟填的熱量差不多（膳食纖維、糖醇會有點差，留寬一點）
  if (p + c + f > 0 && Math.abs(4 * p + 4 * c + 9 * f - k) > Math.max(40, k * 0.3)) return null;
  return [bc, name, g, d.liq ? 1 : 0, k, p, c, f];
}

function doPost(e) {
  let d; try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: 0, err: 'json' }); }
  const row = clean_(d || {}); if (!row) return out_({ ok: 0, err: 'bad' });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const s = sheet_(), n = s.getLastRow();
    // 跟這個條碼最新一筆一模一樣就不重複寫
    if (n > 1) {
      const v = s.getRange(2, 2, n - 1, 8).getValues();
      for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === row[0]) { if (v[i].every((x, j) => String(x) === String(row[j]))) return out_({ ok: 1, same: 1 }); break; }
    }
    s.appendRow([new Date(), "'" + row[0]].concat(row.slice(1)).concat([false]));
    s.getRange(s.getLastRow(), HEAD.length).insertCheckboxes();
    return out_({ ok: 1 });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const s = sheet_(), n = s.getLastRow(), want = String((e && e.parameter && e.parameter.bc) || '').replace(/\D/g, '');
  const m = {};
  if (n > 1) for (const r of s.getRange(2, 1, n - 1, HEAD.length).getValues()) {
    const bc = String(r[1]).replace(/\D/g, ''); if (!bc || r[9] === true || (want && bc !== want)) continue;
    m[bc] = [bc, String(r[2]), +r[3], r[4] ? 1 : 0, +r[5], +r[6], +r[7], +r[8]];
  }
  return out_({ ok: 1, items: Object.values(m) });
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
