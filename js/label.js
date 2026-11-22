// 拍營養標示：手機上用免費文字辨識（Tesseract.js，第一次用才下載，之後瀏覽器會留著）把照片讀成字，
// 再照台灣營養標示的格式（每一份量／熱量／蛋白質…，一行一項：每份、每100公克或每日參考值%）找出數字
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  // 辨識常見錯字：全形數字、O 當 0、l／I 當 1、數字中間多空白、「公 克」
  function norm(t) {
    return String(t || '')
      .replace(/[０-９．]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/(?<=\d)[Oo]|[Oo](?=\d)|(?<=\d\s?[.,])[Oo]/g, '0')
      .replace(/(?<=\d)[lI|](?=\d|\s?[.%公毫克大])|(?<=[\s:：])[lI|](?=\.?\d)/g, '1')
      .replace(/(\d)\s*[.,·]\s*(\d)/g, '$1.$2')
      .replace(/公\s+克/g, '公克').replace(/毫\s+[克克]/g, '毫克').replace(/大\s+卡/g, '大卡')
      .replace(/[ \t]+/g, ' ');
  }
  // 每一行是哪一項（順序重要：「飽和脂肪」要先於「脂肪」、「碳水化合物」先於「糖」）
  const KEYS = [['sat', /飽和/], ['tr', /反式/], ['fib', /纖維/], ['c', /碳水|化合物|醣類/], ['p', /蛋白/], ['k', /熱量|熱\s*量|大卡/], ['na', /[鈉納]/], ['sug', /糖/], ['f', /脂肪|脂\s*肪/]];
  function parse(text) {
    const t = norm(text), out = { sv: {}, h: {} };
    const s = /每\s*一?\s*份\s*量?[^\d\n]{0,6}(\d+(?:\.\d+)?)\s*(公克|克|g|毫升|ml|公升|l)(?![a-z])/i.exec(t);
    if (s) { const v = parseFloat(s[1]); out.g = /公升|^l$/i.test(s[2]) ? v * 1000 : v; out.liq = /毫升|ml|公升|^l$/i.test(s[2]) ? 1 : 0; }
    const has100 = /每\s*100\s*(公克|克|g|毫升|ml)/i.test(t), pct = /參考值|百分比|%/.test(t);
    if (has100 && /每\s*100\s*(毫升|ml)/i.test(t) && out.liq == null) out.liq = 1;
    // 只有每 100 克一欄（沒有「每份」）的標示
    const only100 = has100 && !/每\s*份(?!量)/.test(t.replace(/每\s*一?\s*份\s*量/g, ''));
    for (const line of t.split(/\n/)) {
      if (/每\s*一?\s*份\s*量|本包裝|每日參考值\s*$/.test(line) && !/熱量|蛋白|脂肪|碳水|鈉|糖/.test(line)) continue;
      const kv = KEYS.find(([, re]) => re.test(line)); if (!kv) continue; const k = kv[0];
      const m = kv[1].exec(line), rest = line.slice(m.index + m[0].length);
      const nums = [...rest.matchAll(/(\d+(?:\.\d+)?)\s*(%|毫克|mg|公克|克|g|大卡|kcal)?/gi)].map(x => ({ v: parseFloat(x[1]), u: (x[2] || '').toLowerCase() })).filter(x => x.u !== '%');
      if (!nums.length) continue;
      const fix = x => k === 'na' && /公克|^克$|^g$/.test(x.u) ? x.v * 1000 : k !== 'na' && k !== 'k' && /毫克|mg/.test(x.u) ? x.v / 1000 : x.v;
      if (only100) { if (out.h[k] == null) out.h[k] = fix(nums[0]); continue; }
      if (out.sv[k] == null) out.sv[k] = fix(nums[0]);
      if (has100 && !pct && nums[1] && out.h[k] == null) out.h[k] = fix(nums[1]);
      else if (has100 && pct && nums[1] && out.h[k] == null && nums.length >= 2) out.h[k] = fix(nums[1]); // 三欄（每份／每100／%）：% 已經濾掉
    }
    // 每份那欄讀到了就用每份（跟包裝第一欄一樣）；沒有每份欄才用每 100 克
    out.basis = Object.keys(out.sv).length ? 0 : Object.keys(out.h).length ? 1 : null;
    out.vals = out.basis === 1 ? out.h : out.sv;
    return out;
  }
  // 照片縮小、轉灰階拉對比（辨識比較快也比較準）
  async function prep(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const sc = Math.min(1, 1800 / Math.max(img.width, img.height)), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h), a = d.data;
      for (let i = 0; i < a.length; i += 4) { let g = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114; g = Math.max(0, Math.min(255, (g - 128) * 1.4 + 128)); a[i] = a[i + 1] = a[i + 2] = g; }
      x.putImageData(d, 0, 0); return cv;
    } finally { URL.revokeObjectURL(url); }
  }
  let worker = null;
  async function read(file, onMsg) {
    if (!W.Tesseract) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    if (!worker) {
      onMsg && onMsg('第一次使用，下載辨識檔中（約 3 MB，之後就不用）…');
      worker = await W.Tesseract.createWorker('chi_tra', 1, { logger: m => { if (onMsg && m.status === 'recognizing text') onMsg('辨識中… ' + Math.round(m.progress * 100) + '%'); } });
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    }
    onMsg && onMsg('辨識中…');
    const { data } = await worker.recognize(await prep(file));
    return data.text;
  }
  W.LabelOCR = { parse, norm, read };
})();
