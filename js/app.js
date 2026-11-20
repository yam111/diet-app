// 食光 — 主程式（資料全部存在手機本機 localStorage）
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r0 = n => Math.round(n);
  const r1 = n => Math.round(n * 10) / 10;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { setTimeout(() => toast('手機的瀏覽器儲存空間滿了，這次沒存到。請到「我的」匯出備份，再清一些瀏覽器資料'), 0); } };
  const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => dkey(new Date());
  const addDays = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dkey(d); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const MEALS = [
    { k: 'breakfast', n: '早餐', ic: '<path d="M12 3v2M5.6 5.6 7 7M3 12h2M19 12h2M17 7l1.400-1.400M7 16a5 5 0 0 1 10 0M3 20h18"/>' },
    { k: 'lunch', n: '午餐', ic: '<circle cx="12" cy="12" r="4.200"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300 7 7M17 17l1.700 1.700M5.300 18.700 7 17M17 7l1.700-1.700"/>' },
    { k: 'dinner', n: '晚餐', ic: '<path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z"/>' },
    { k: 'snack', n: '小食／其他', ic: '<path d="M6 9h12l-1 11H7zM9 9V6.500a3 3 0 0 1 6 0V9"/>' },
  ];
  const mealName = k => (MEALS.find(m => m.k === k) || MEALS[3]).n;
  const ACTS = [[1.2, '久坐（幾乎不運動）'], [1.375, '輕度（每週運動 1–3 天）'], [1.55, '中度（每週運動 3–5 天）'], [1.725, '高度（每週運動 6–7 天）'], [1.9, '極高（勞力工作＋天天練）']];
  const GOALS = { cut: { n: '減脂', paces: [[-0.10, '溫和 −10%'], [-0.20, '標準 −20%'], [-0.25, '積極 −25%']] }, keep: { n: '維持', paces: [[0, '']] }, bulk: { n: '增重', paces: [[0.10, '溫和 +10%'], [0.15, '標準 +15%'], [0.20, '積極 +20%']] } };
  const PLANS = [
    { k: 'balanced', n: '均衡飲食', d: '國民飲食指標的基本比例', p: 20, c: 50, f: 30 },
    { k: 'highp', n: '高蛋白', d: '減脂保肌肉、增肌常用', p: 30, c: 40, f: 30 },
    { k: 'med', n: '地中海飲食', d: '好油、魚、全穀、蔬果為主', p: 20, c: 45, f: 35 },
    { k: 'keto', n: '生酮飲食', d: '極低碳、以脂肪當燃料', p: 20, c: 5, f: 75 },
    { k: 'lowc', n: '低碳飲食', d: '少澱粉、多蛋白質與油脂', p: 30, c: 20, f: 50 },
    { k: 'dash', n: '得舒飲食', d: '高纖低脂、顧血壓', p: 18, c: 55, f: 27 },
    { k: 'gain', n: '增肌高碳', d: '練得兇、要吃得夠', p: 25, c: 50, f: 25 },
    { k: 'custom', n: '自訂比例', d: '自己調碳水和脂肪的比例', p: 30, c: 40, f: 30 },
  ];

  const S = {
    profile: load('SG_PROFILE', null),
    log: load('SG_LOG', {}),
    custom: load('SG_CUSTOM', []),
    recipes: load('SG_RECIPES', []), // 我的食譜：[{ id, name, alias, yields, items:[{ fid, name, grams, unit, amount, kcal,p,c,f（每100克） }] }]
    recent: load('SG_RECENT', []),
    weight: load('SG_WEIGHT', {}), // { '2026-11-19': 68.4 }
    date: today(), tab: 'today', q: '', meal: null, cat: '', lastBatch: null
  };
  const saveLog = () => save('SG_LOG', S.log);
  let ALL = [];
  let RFOODS = [];
  function rebuildFoods() { ALL = S.custom.concat(FOODS); RFOODS = S.recipes.map(recipeFood).filter(Boolean); ALL = RFOODS.concat(ALL); NL.setFoods(ALL); }
  // 食材：資料庫找得到就用最新的數值，找不到（自訂食物被刪了）就用存食譜當下的數值
  function ingFood(it) { return foodById(it.fid) || { id: it.fid, name: it.name, alias: [], kcal: it.kcal, p: it.p, c: it.c, f: it.f, units: [{ n: '份', g: it.grams }], cat: '' }; }
  function recipeSum(r) {
    const t = { g: 0, kcal: 0, p: 0, c: 0, f: 0 };
    for (const it of r.items) { const v = calc(ingFood(it), it.grams); t.g += it.grams; t.kcal += v.kcal; t.p += v.p; t.c += v.c; t.f += v.f; }
    return t;
  }
  // 食譜在搜尋、語音裡就是一個「食物」：一份＝全部食材 ÷ 做一次可以吃幾份
  function recipeFood(r) {
    const t = recipeSum(r); if (!(t.g > 0)) return null;
    const x = 100 / t.g;
    return { id: r.id, name: r.name, alias: r.alias || [], kcal: r1(t.kcal * x), p: r1(t.p * x), c: r1(t.c * x), f: r1(t.f * x), units: [{ n: '份', g: r1(t.g / (r.yields || 1)) }], cat: '我的食譜', brand: [], recipe: true, anyUnit: true };
  }
  const foodById = id => { const [b, sg] = String(id).split('@'); const f = ALL.find(x => x.id === b) || EXTMAP.get(b); return f && sg ? NL.sugarVariant(f, sg) : f; };
  // 衛福部食品營養成分資料庫完整版（約 1800 種，開啟後背景載入，只用在搜尋）
  let EXT = [], EXTMAP = new Map();
  fetch('data/tfda.json').then(r => r.json()).then(a => {
    EXT = a.map(([id, name, al, k, p, c, f, cat, st]) => ({ id: 't_' + id, name, alias: al ? al.split(',') : [], kcal: k, p, c, f, units: [{ n: '份', g: 100 }], cat, st, ext: 1 }));
    EXTMAP = new Map(EXT.map(x => [x.id, x]));
    for (const x of BEXT) EXTMAP.set(x.id, x);
    if ($('#results')) renderResults();
  }).catch(() => { });
  // 超商・連鎖店品項（全家官網營養標示等，約上千項，開啟後背景載入，只用在搜尋）
  let BEXT = [];
  fetch('data/brands.json').then(r => r.json()).then(a => {
    BEXT = a.map(([id, name, al, k, p, c, f, units, cat, brand, src]) => ({ id: 'b_' + id, name, alias: al ? al.split(',') : [], kcal: k, p, c, f, units: units.split(',').map(u => { const [n, g] = u.split(':'); return { n, g: +g }; }), cat, brand: brand ? brand.split(',') : [], st: src, ext: 1 }));
    for (const x of BEXT) EXTMAP.set(x.id, x);
    NL.setBrandFoods(BEXT); // 語音／打字講了店名（全家、7-11…）也用這份
    if ($('#results')) renderResults();
  }).catch(() => { });
  rebuildFoods();

  // ---------- 計算 ----------
  function planOf(p) { const pl = PLANS.find(x => x.k === p.plan) || PLANS[0]; return pl.k === 'custom' && p.custom ? { ...pl, ...p.custom } : pl; }
  // 蛋白質照體重算（每公斤幾克），剩下的熱量照飲食計畫分給碳水和脂肪
  const PKG = { cut: 1.8, keep: 1.4, bulk: 1.6 };
  const pkgOf = p => p.pkg > 0 ? p.pkg : PKG[p.goal] || 1.6;
  const protW = p => p.goalW > 0 ? p.goalW : p.weight; // 體重過重的人用目標體重算
  function macros(kcal, p, pl) {
    let pg = pkgOf(p) * protW(p); const pcap = pg * 4 > kcal * 0.4; if (pcap) pg = kcal * 0.4 / 4; // 蛋白質最多佔四成熱量
    const rem = kcal - pg * 4; let fg = rem * pl.f / (pl.c + pl.f) / 9;
    if (fg * 9 < kcal * 0.2) fg = kcal * 0.2 / 9; // 脂肪至少兩成，荷爾蒙需要
    const cg = Math.max(0, (rem - fg * 9) / 4);
    const pct = v => r0(v / kcal * 100);
    return { p: r0(pg), c: r0(cg), f: r0(fg), pcap, pct: { p: pct(pg * 4), c: pct(cg * 4), f: pct(fg * 9) } };
  }
  function targets(p = S.profile) {
    const calc = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161); // Mifflin-St Jeor
    const bmr = p.bmrMode === 'manual' && p.bmrIn > 0 ? p.bmrIn : calc; // 自己填（InBody 等量到的）優先
    const tdeeCalc = bmr * p.act;
    // 有足夠的體重＋飲食紀錄，就用「實際」消耗；跟公式差太多（±25%）就封頂，避免漏記把目標拉歪
    const ad = p === S.profile && p.adapt !== false ? adaptive(tdeeCalc) : null;
    const adapted = !!(ad && ad.ok);
    const tdee = adapted ? Math.min(tdeeCalc * 1.25, Math.max(tdeeCalc * 0.75, ad.tdee)) : tdeeCalc;
    let kcal = tdee * (1 + (p.goal === 'keep' ? 0 : p.pace));
    const floor = p.sex === 'm' ? 1500 : 1200;
    const floored = kcal < floor; if (floored) kcal = floor;
    const pl = planOf(p);
    kcal = r0(kcal);
    return { bmr: r0(bmr), tdee: r0(tdee), tdeeCalc: r0(tdeeCalc), adapted, ad, kcal, floored, plan: pl, ...macros(kcal, p, pl) };
  }
  // 體重變化反推實際消耗：最近 28 天，體重用回歸線看趨勢（不怕單天水分起伏），熱量用有好好記的那幾天平均
  const KCAL_PER_KG = 7700;
  function adaptive(tdeeCalc) {
    const start = addDays(today(), -28), yest = addDays(today(), -1);
    const ks = Object.keys(S.weight).filter(k => k >= start && k <= today()).sort();
    const t0 = new Date(start + 'T12:00:00');
    const pts = ks.map(k => ({ x: (new Date(k + 'T12:00:00') - t0) / 864e5, y: +S.weight[k] }));
    const span = pts.length ? pts[pts.length - 1].x - pts[0].x : 0;
    let days = 0, logged = 0, sum = 0;
    if (ks.length) for (let k = ks[0]; k <= yest; k = addDays(k, 1)) { days++; const t = totals(k); if (t.n && t.kcal >= tdeeCalc * 0.4) { logged++; sum += t.kcal; } } // 吃不到四成的天多半是沒記完，不算
    const need = [];
    if (pts.length < 5) need.push('再量 ' + (5 - pts.length) + ' 次體重');
    if (span < 14) need.push('體重紀錄再拉長 ' + Math.ceil(14 - span) + ' 天');
    const needLog = Math.ceil(Math.max(days, 14) * 0.7);
    if (days < 14 || logged < needLog) need.push('飲食記滿 ' + needLog + ' 天（目前 ' + logged + ' 天）');
    if (need.length) return { ok: false, need, n: pts.length, logged };
    const mx = pts.reduce((a, q) => a + q.x, 0) / pts.length, my = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    const slope = pts.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0) / pts.reduce((a, q) => a + (q.x - mx) ** 2, 0); // 公斤／天
    const avg = sum / logged;
    return { ok: true, tdee: avg - slope * KCAL_PER_KG, avg, week: slope * 7, days, logged, n: pts.length };
  }
  function saveWeight(v) {
    const n = parseFloat(v); if (!(n >= 25 && n <= 250)) return toast('體重請填 25～250 公斤');
    S.weight[today()] = r1(n); save('SG_WEIGHT', S.weight);
    S.profile.weight = r1(n); save('SG_PROFILE', S.profile); // 基礎代謝跟著最新體重算
    toast('已記錄體重 ' + r1(n) + ' 公斤'); render();
  }
  const shortDate = k => k === today() ? '今天' : k === addDays(today(), -1) ? '昨天' : (+k.slice(5, 7)) + '/' + (+k.slice(8));
  function weightCard() {
    const start = addDays(today(), -29);
    const ks = Object.keys(S.weight).filter(k => k >= start).sort();
    const W = 320, H = 110, t0 = new Date(start + 'T12:00:00');
    let svg = '';
    if (ks.length) {
      const ys = ks.map(k => S.weight[k]); const lo = Math.min(...ys) - 0.6, hi = Math.max(...ys) + 0.6;
      const X = k => 30 + (new Date(k + 'T12:00:00') - t0) / 864e5 / 29 * (W - 38), Y = v => 8 + (hi - v) / (hi - lo) * (H - 16);
      let ema = null; const tr = ks.map(k => { ema = ema == null ? S.weight[k] : ema + 0.25 * (S.weight[k] - ema); return X(k).toFixed(1) + ',' + Y(ema).toFixed(1); });
      svg = `<svg class="wchart" viewBox="0 0 ${W} ${H}"><text x="0" y="14">${r1(hi - 0.6)}</text><text x="0" y="${H - 4}">${r1(lo + 0.6)}</text>
        ${ks.length > 1 ? `<polyline points="${tr.join(' ')}"/>` : ''}${ks.map(k => `<circle cx="${X(k).toFixed(1)}" cy="${Y(S.weight[k]).toFixed(1)}" r="3"/>`).join('')}</svg>
        <p class="note" style="margin:2px 0 0">點是每天量的，線是去掉水分起伏後的趨勢（最近 30 天）</p>`;
    }
    const last = ks.length ? S.weight[ks[ks.length - 1]] : null;
    const recent = Object.keys(S.weight).sort().reverse().slice(0, 4);
    const tw = S.weight[today()];
    return `<div class="card"><h3>體重<em>${last != null ? last + ' kg' : ''}</em></h3>
      ${svg || '<p class="note" style="margin:0 0 4px">每天早上起床、上完廁所、吃東西前量最準。量體重＋記飲食滿兩週，就會用你實際的體重變化校正每日目標。</p>'}
      <div class="typebox" style="margin-top:10px"><input id="wt" type="number" inputmode="decimal" step="0.1" placeholder="今天的體重（公斤）" value="${tw != null ? tw : ''}" enterkeyhint="done"><button data-act="wsave">${tw != null ? '更新' : '記錄'}</button></div>
      ${recent.length ? `<div class="wlist">${recent.map(k => `<span>${shortDate(k)} <b>${S.weight[k]}</b><button data-act="wdel" data-k="${esc(k)}" aria-label="刪除">×</button></span>`).join('')}</div>` : ''}</div>`;
  }
  function adaptCard(T) {
    if (S.profile.adapt === false) return `<div class="card"><h3>實際消耗校正<em>已關閉</em></h3><p class="note" style="margin:0">目前只用公式算 TDEE。要打開請到「我的」。</p></div>`;
    const a = T.ad;
    if (!a || !a.ok) return `<div class="card"><h3>實際消耗校正<em>資料累積中</em></h3><p class="note" style="margin:0">公式算的 TDEE 可能差到一兩百大卡。量體重＋記飲食滿兩週後，會照你實際的體重變化算出真正的消耗，自動改每日目標。還需要：${(a ? a.need : ['開始量體重']).join('、')}。</p></div>`;
    const wk = a.week, cap = r0(a.tdee) !== T.tdee;
    return `<div class="card"><h3>實際消耗校正<em>已套用</em></h3>
      <div class="stat2" style="margin-bottom:10px"><div><small>平均吃</small><span class="num">${r0(a.avg)}</span></div><div><small>體重每週</small><span class="num">${(wk > 0 ? '+' : '') + r1(wk)}<u style="font-size:12px;text-decoration:none"> kg</u></span></div><div class="g"><small>實際 TDEE</small><span class="num">${T.tdee}</span></div></div>
      <p class="note" style="margin:0">最近 ${a.days} 天（有記飲食 ${a.logged} 天、量體重 ${a.n} 次）。公式算 ${T.tdeeCalc}，每日目標已改照實際消耗算${cap ? '（跟公式差太多，先以 ±25% 為限）' : ''}。飲食有漏記的話，這個數字會偏低。</p></div>`;
  }
  function day(k) { return S.log[k] || (S.log[k] = { breakfast: [], lunch: [], dinner: [], snack: [] }); }
  function totals(k) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, n: 0 }; const d = S.log[k]; if (!d) return t;
    for (const m of MEALS) for (const e of d[m.k] || []) { t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; t.n++; }
    return t;
  }
  // 液體（飲料、湯…）用毫升顯示，其他用克；計算都以克（1 毫升≈1 克）
  const gu = f => NL.gu(f || {});
  const isAmt = l => /克|毫升/.test(l);
  const entryLiq = e => e.liq != null ? !!e.liq : NL.isLiquid(foodById(e.fid) || { name: e.name });
  const eu = e => entryLiq(e) ? '毫升' : '克';
  const eLabel = e => entryLiq(e) ? String(e.label).replace(/(\d) 克/g, '$1 毫升') : e.label;
  function calc(food, grams) { const x = grams / 100; return { kcal: r0(food.kcal * x), p: r1(food.p * x), c: r1(food.c * x), f: r1(food.f * x) }; }
  // 吃了食譜 k 份：每樣食材照比例分開記（之後每樣都能單獨改）
  function logRecipe(r, k, meal, date = S.date) {
    const s = k / (r.yields || 1);
    const out = r.items.map(it => { const food = ingFood(it), g = it.grams * s;
      const extra = it.unit ? { unit: it.unit, amount: Math.round(it.amount * s * 100) / 100 } : {};
      return addEntry(food, g, r.name + '・' + (it.unit ? extra.amount + ' ' + it.unit : r0(g) + ' ' + gu(food)), meal, { ...extra, recipe: r.name }, date); });
    S.recent = [r.id, ...S.recent.filter(x => x !== r.id)].slice(0, 12); save('SG_RECENT', S.recent);
    return out;
  }
  function addEntry(food, grams, label, meal, extra = {}, date = S.date) {
    const e = { id: uid(), fid: food.id, name: food.name, grams: r1(grams), label, ...calc(food, grams), ...extra, ...(NL.isLiquid(food) ? { liq: 1 } : {}) };
    day(date)[meal].push(e); saveLog();
    const rid = food.id.split('@')[0];
    S.recent = [rid, ...S.recent.filter(x => x !== rid)].slice(0, 12); save('SG_RECENT', S.recent);
    return e;
  }
  // ---------- 常吃的一鍵再記 ----------
  // 往前 7 天找最近一次有記的同一餐
  function prevMeal(meal, date = S.date) {
    for (let i = 1; i <= 7; i++) { const k = addDays(date, -i), l = S.log[k] && S.log[k][meal]; if (l && l.length) return { k, list: l }; }
    return null;
  }
  function copyMeal(meal, date = S.date) {
    const pm = prevMeal(meal, date); if (!pm) return null;
    const list = day(date)[meal], added = pm.list.map(e => { const n = { ...e, id: uid() }; list.push(n); return n; });
    saveLog(); return { pm, added };
  }
  // 這樣食物最近一次記的份量（不管哪天哪餐）
  function lastEntry(rid) {
    for (const k of Object.keys(S.log).sort().reverse()) { const d = S.log[k];
      for (const m of ['snack', 'dinner', 'lunch', 'breakfast']) { const l = d[m] || []; for (let i = l.length - 1; i >= 0; i--) if (String(l[i].fid).split('@')[0] === rid) return l[i]; } }
    return null;
  }
  function quickLog(rid, meal) {
    const e = lastEntry(rid); const food = e && foodById(e.fid); if (!food) return null;
    return addEntry(food, e.grams, e.unit ? e.amount + ' ' + e.unit : r0(e.grams) + ' ' + gu(food), meal, e.unit ? { unit: e.unit, amount: e.amount } : {});
  }
  function findEntry(id, date = S.date) { const d = day(date); for (const m of MEALS) { const i = d[m.k].findIndex(e => e.id === id); if (i >= 0) return { meal: m.k, i, e: d[m.k][i] }; } return null; }
  function removeEntry(id, date = S.date) { const f = findEntry(id, date); if (f) { day(date)[f.meal].splice(f.i, 1); saveLog(); } }

  // ---------- 畫面 ----------
  const view = $('#view');
  // 同一頁、同一天重畫（刪除、改份量、復原…）不重跑進場動畫、圓環直接停在新位置、捲動位置不動
  let lastView = '', quiet = false, ringAt = null;
  function render() {
    const key = S.tab + '|' + S.date + '|' + !!S.profile; quiet = key === lastView; lastView = key;
    const y = view.scrollTop;
    document.body.classList.toggle('onboard', !S.profile);
    if (!S.profile) return renderOnboard();
    document.querySelectorAll('#tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
    ({ today: renderToday, trend: renderTrend, me: renderMe })[S.tab]();
    if (quiet) { const r = view.querySelector('.rise'); if (r) r.classList.remove('rise'); view.scrollTop = y; }
  }
  function dateLabel(k) {
    const t = today(); const d = new Date(k + 'T12:00:00');
    const md = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (k === t) return '今天 · ' + md; if (k === addDays(t, -1)) return '昨天 · ' + md;
    return md + ' 週' + '日一二三四五六'[d.getDay()];
  }
  function stack(p, c, f, cls = '', labels = true) {
    const sum = p + c + f || 1; const seg = (v, k) => `<i class="${k}" style="flex-basis:${v / sum * 100}%;background:var(--k)">${labels && v / sum > 0.09 ? r0(v / sum * 100) + '%' : ''}</i>`;
    return `<div class="stack ${cls}">${seg(p, 'kp')}${seg(c, 'kc')}${seg(f, 'kf')}</div>`;
  }

  function renderToday() {
    const T = targets(), t = totals(S.date), d = day(S.date);
    const left = T.kcal - t.kcal, over = left < 0;
    const C = 2 * Math.PI * 78, pct = Math.min(1, t.kcal / T.kcal);
    const macro = (k, n, eat, tar) => { const l = tar - eat; return `<div class="macro k${k}"><small>${n}</small><span class="num">${r0(eat)}<u> / ${tar} g</u></span><div class="bar"><i style="width:${tar > 0 ? Math.min(100, eat / tar * 100) : (eat > 0 ? 100 : 0)}%"></i></div><em class="${l < 0 ? 'over' : ''}">${l < 0 ? '超過 ' + r0(-l) + ' g' : '還差 ' + r0(l) + ' g'}</em></div>`; };
    const pk = t.p * 4, ck = t.c * 4, fk = t.f * 9;
    view.innerHTML = `<div class="rise">
      <div class="top"><div class="brand">食<i>光</i></div>
        <div class="datebar"><button data-act="day" data-n="-1">‹</button><label class="dpick"><b>${dateLabel(S.date)}</b><input type="date" id="dpick" max="${today()}" value="${S.date}" aria-label="選日期"></label><button data-act="day" data-n="1" ${S.date >= today() ? 'disabled' : ''}>›</button></div></div>
      <div class="card hero"><div class="ringwrap">
        <div class="ring ${over ? 'over' : ''}"><svg viewBox="0 0 176 176"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1dcae"/><stop offset="1" stop-color="#b8935a"/></linearGradient></defs>
          <circle class="bg" cx="88" cy="88" r="78"/><circle class="fg" cx="88" cy="88" r="78" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-to="${C * (1 - pct)}"/></svg>
          <div class="mid"><small>${over ? '已 超 過' : '還 可 以 吃'}</small><span class="num">${Math.abs(left)}</span><span>大卡</span></div></div>
        <div class="herostats"><div class="g"><small>已攝取</small><span class="num">${r0(t.kcal)}<u>kcal</u></span></div><div><small>每日目標</small><span class="num">${T.kcal}<u>kcal</u></span></div><div><small>${GOALS[S.profile.goal].n} · ${esc(T.plan.n)}</small><span class="num">${T.tdee}<u>TDEE</u></span></div></div>
      </div></div>
      <div class="macros">${macro('p', '蛋白質', t.p, T.p)}${macro('c', '碳水', t.c, T.c)}${macro('f', '脂肪', t.f, T.f)}</div>
      <div class="card ratio"><h3>營養素比例<em>${esc(T.plan.n)}</em></h3>
        <div class="row"><span>實際</span>${t.kcal ? stack(pk, ck, fk) : '<div class="stack"></div>'}</div>
        <div class="row"><span>目標</span>${stack(T.p * 4, T.c * 4, T.f * 9, 'ghost')}</div>
        <div class="legend"><b class="kp">蛋白質</b><b class="kc">碳水</b><b class="kf">脂肪</b></div></div>
      ${MEALS.map(m => { const list = d[m.k] || []; const sum = list.reduce((a, e) => a + e.kcal, 0);
        return `<div class="card meal" data-meal="${m.k}"><header><span class="ic"><svg viewBox="0 0 24 24">${m.ic}</svg></span><b>${m.n}</b>${sum ? `<span class="num msum">${sum}<u>kcal</u>${T.kcal > 0 ? `<em>佔全天 ${Math.round(sum / T.kcal * 100)}%</em>` : ''}</span>` : ''}<button class="add" data-act="addto" data-meal="${m.k}" aria-label="新增到${m.n}">+</button></header>
        ${list.length ? mealSum(list, sum, T) : ''}
        ${list.length ? list.map(swipeRow).join('') : sameRow(m)}</div>`; }).join('')}
      <p class="note" style="text-align:center">按下方金色麥克風，說一句「午餐吃了一盤蝦仁蛋炒飯」就會自動記錄</p>
    </div>`;
    // 圓環：重畫時從剛剛的位置滑到新位置，不從零重轉
    const fg = $('.ring .fg');
    if (fg && quiet && ringAt != null) { fg.style.transition = 'none'; fg.style.strokeDashoffset = ringAt; fg.getBoundingClientRect(); fg.style.transition = ''; }
    if (fg) { ringAt = fg.dataset.to; requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = fg.dataset.to; })); }
  }
  // 這一餐吃了多少：三大營養素克數＋佔全天目標幾成，一眼知道下一餐怎麼分
  function mealSum(list, kcal, T) {
    const g = k => list.reduce((a, e) => a + (e[k] || 0), 0);
    const it = (k, n, v) => `<span class="k${k}"><i></i>${n}<b class="num">${r0(v)}</b>g</span>`;
    return `<div class="mealsum">${it('p', '蛋白質', g('p'))}${it('c', '碳水', g('c'))}${it('f', '脂肪', g('f'))}</div>`;
  }
  function sameRow(m) {
    const pm = prevMeal(m.k); if (!pm) return '<div class="empty">還沒有紀錄</div>';
    const names = [...new Set(pm.list.map(e => e.recipe || e.name))], kc = pm.list.reduce((a, e) => a + e.kcal, 0);
    return `<button class="same" data-act="copymeal" data-meal="${m.k}"><span class="ic2"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.500h-4.500"/><path d="M20 12a8 8 0 0 1-13.7 5.600L4 15.500"/><path d="M4 20v-4.500h4.500"/></svg></span>
      <span class="n"><b>同${pm.k === addDays(S.date, -1) ? '昨天' : ' ' + shortDate(pm.k) + ' '}的${m.n}</b><small>${esc(names.slice(0, 3).join('、'))}${names.length > 3 ? ' 等 ' + names.length + ' 樣' : ''}</small></span><span class="k">${kc}<small>kcal</small></span></button>`;
  }
  function swipeRow(e) { return `<div class="sw" data-id="${esc(e.id)}"><button class="swdel" data-act="swdel" data-id="${esc(e.id)}" tabindex="-1">刪除</button>${entryRow(e)}</div>`; }
  function entryRow(e) {
    return `<button class="entry" data-act="edit" data-id="${esc(e.id)}"><span class="n"><b>${esc(e.name)}</b><small>${esc(eLabel(e))}${isAmt(e.label) ? '' : ' · ' + r0(e.grams) + ' ' + eu(e)}</small></span><span class="k">${e.kcal}<small>蛋 ${r0(e.p)} · 碳 ${r0(e.c)} · 脂 ${r0(e.f)}</small></span></button>`;
  }

  // ---------- 搜尋 ----------
  const CATS = ['主食', '飯麵', '早餐', '蛋白質', '蛋豆', '便當菜', '蔬菜', '水果', '小吃', '速食', '超商', '連鎖餐廳', '好事多', '異國', '飲料', '手搖飲', '咖啡', '湯', '點心', '油脂堅果', '調味料'];
  // 搜尋是從下方跳出的視窗（按各餐的＋或下方「搜尋」），不是另一頁
  function openSearch(meal, q = '') {
    S.meal = meal || S.meal || NL.mealByHour(new Date().getHours() + new Date().getMinutes() / 60); S.q = q; S.cat = '';
    sheet(searchHTML(), null, 'srch'); renderResults();
    if (!q) setTimeout(() => { const i = $('#q'); if (i) i.focus(); }, 380);
  }
  function backToSearch() { sheet(searchHTML(), null, 'srch'); renderResults(); }
  function searchHTML() {
    return `<div class="shead"><div class="sttl"><h2>加到${S.date === today() ? '' : shortDate(S.date) + '的'}<span id="smn">${mealName(S.meal)}</span></h2><button class="xbtn" data-act="close" aria-label="關閉">×</button></div>
      <div class="searchbox"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/></svg><input id="q" type="search" placeholder="搜尋食物…" value="${esc(S.q)}" autocomplete="off" enterkeyhint="search"><button data-act="clearq" ${S.q ? '' : 'hidden'}>×</button><button class="bcbtn" data-act="scan" aria-label="掃條碼"><svg viewBox="0 0 24 24"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8"/></svg></button></div>
      <div class="seg sm" id="smeals">${MEALS.map(m => `<button data-act="smeal" data-meal="${m.k}" class="${S.meal === m.k ? 'on' : ''}">${m.k === 'snack' ? '小食' : m.n}</button>`).join('')}</div></div>
      <div id="results" class="sbody"></div>`;
  }
  function hl(name, q) { if (!q) return esc(name); const set = new Set([...q.toLowerCase()]); return [...name].map(ch => set.has(ch.toLowerCase()) ? '<mark>' + esc(ch) + '</mark>' : esc(ch)).join(''); }
  function foodRow(f, q) { const u = f.units[0], k = r0(f.kcal * u.g / 100); return `<button class="food" data-act="pick" data-fid="${esc(f.id)}"><span class="n"><b>${hl(f.name, q)}</b><small>1 ${esc(u.n)}（${u.g} ${gu(f)}）· ${esc(f.cat || '自訂')}${f.st ? '・' + esc(f.st) : ''}${f.brand && f.brand.length ? ' · ' + esc(f.brand.slice(0, 3).join('、')) : ''}</small></span><span class="k">${k}<small>kcal</small></span><span class="plus">+</span></button>`; }
  function recentRow(f) {
    const e = lastEntry(f.id), vf = e && foodById(e.fid); if (!vf) return foodRow(f);
    const amt = e.unit ? e.amount + ' ' + e.unit + '（' + r0(e.grams) + ' ' + gu(vf) + '）' : r0(e.grams) + ' ' + gu(vf);
    return `<div class="food rc"><button class="rmain" data-act="pick" data-fid="${esc(f.id)}" data-last="1"><span class="n"><b>${esc(vf.name)}</b><small>上次 ${esc(amt)}</small></span><span class="k">${calc(vf, e.grams).kcal}<small>kcal</small></span></button><button class="plus" data-act="quick" data-fid="${esc(f.id)}" aria-label="照上次份量再記一次${esc(vf.name)}">+</button></div>`;
  }
  function renderResults() {
    const box = $('#results'); if (!box) return; const q = S.q.trim();
    let html = '';
    if (q) {
      const res = NL.search(q, 50), ext = NL.searchList(q, EXT, 60), seen = new Set(res.map(f => f.name)), br = NL.searchBrand(q, BEXT, 60).filter(f => !seen.has(f.name));
      html = res.length ? `<div class="sec">${res.length} 筆結果 · 記到${mealName(S.meal)}</div>` + res.map(f => f.recipe ? recipeRow(S.recipes.find(x => x.id === f.id)) : foodRow(f, q)).join('') : ext.length || br.length ? '' : `<div class="nores">找不到「${esc(q)}」</div>`;
      if (br.length) html += `<div class="sec">超商・連鎖店 · ${br.length >= 60 ? '60+' : br.length} 筆<em>每筆標明官網標示或估算</em></div>` + br.map(f => foodRow(f, q)).join('');
      if (ext.length) html += `<div class="sec">衛福部食品營養成分資料庫 · ${ext.length >= 60 ? '60+' : ext.length} 筆<em>每 100 克／毫升</em></div>` + ext.map(f => foodRow(f, q)).join('');
      html += `<button class="btn ghost" style="margin-top:18px" data-act="newfood">＋ 新增自訂食物${res.length || ext.length ? '' : '「' + esc(q) + '」'}</button>`;
    } else {
      html = `<div class="chips">${CATS.map(c => `<button class="chip ${S.cat === c ? 'on' : ''}" data-act="cat" data-cat="${c}">${c}</button>`).join('')}</div>`;
      if (S.cat) html += ALL.filter(f => f.cat === S.cat).map(f => foodRow(f)).join('');
      else {
        const rec = S.recent.map(foodById).filter(f => f && !f.recipe);
        html += `<div class="sec sech">我的食譜<button data-act="rnew">＋ 新增</button></div>` + (S.recipes.length ? S.recipes.map(recipeRow).join('') : '<div class="rempty">常煮的菜存成食譜（例如雞胸肉＋橄欖油＋高麗菜），以後說菜名就會照食材分開算。</div>');
        if (S.custom.length) html += '<div class="sec">我的自訂食物</div>' + S.custom.map(f => foodRow(f)).join('');
        if (rec.length) html += `<div class="sec">最近吃過<em>按 ＋ 照上次份量直接記</em></div>` + rec.map(recentRow).join('');
        else html += '<div class="sec">常見</div>' + ['白飯', '雞蛋', '雞胸肉', '無糖豆漿', '地瓜', '蝦仁蛋炒飯', '香蕉', '拿鐵'].map(n => foodById('f_' + n)).filter(Boolean).map(f => foodRow(f)).join('');
        html += `<button class="btn ghost" style="margin-top:18px" data-act="newfood">＋ 新增自訂食物</button>`;
      }
    }
    box.innerHTML = html;
  }

  // ---------- 份量面板（新增／修改共用） ----------
  let Q = null;
  function openQty(food, opt = {}) {
    Q = { food, meal: opt.meal || S.meal || NL.mealByHour(new Date().getHours()), editId: opt.editId || null, fromSearch: !!opt.fromSearch, unit: 0, amount: 1, ing: opt.ing == null ? null : opt.ing };
    if (opt.entry) {
      const e = opt.entry; const ui = food.units.findIndex(u => e.unit === u.n);
      if (e.unit && ui >= 0) { Q.unit = ui; Q.amount = e.amount; } else { Q.unit = -1; Q.amount = r0(e.grams); }
    }
    drawQty();
  }
  function qGrams() { const a = parseFloat(Q.amount) || 0; return Q.unit < 0 ? a : a * Q.food.units[Q.unit].g; }
  function drawQty() {
    const f = Q.food;
    sheet(`${Q.fromSearch ? '<button class="backbtn" data-act="sback">‹ 回搜尋</button>' : ''}<h2>${esc(f.name)}</h2><div class="sub">每 100 ${gu(f)} ${f.kcal} 大卡 · 蛋白質 ${f.p}・碳水 ${f.c}・脂肪 ${f.f}</div>
      <div class="chips" style="margin:0 -20px 6px;padding:0 20px">${f.units.map((u, i) => `<button class="chip ${Q.unit === i ? 'on' : ''}" data-act="qunit" data-i="${i}">${esc(u.n)}</button>`).join('')}<button class="chip ${Q.unit < 0 ? 'on' : ''}" data-act="qunit" data-i="-1">${gu(f)}</button></div>
      <div class="qbig"><input id="qamt" type="number" inputmode="decimal" step="any" value="${Q.amount}"><span>${Q.unit < 0 ? gu(f) : esc(f.units[Q.unit].n)}</span></div>
      <div class="qg" id="qg"></div>
      ${Q.ing != null ? '' : `<div class="seg sm">${MEALS.map(m => `<button data-act="qmeal" data-meal="${m.k}" class="${Q.meal === m.k ? 'on' : ''}">${m.k === 'snack' ? '小食' : m.n}</button>`).join('')}</div>`}
      <div class="qsum"><div><small>熱量</small><span class="num" id="qk"></span></div><div><small>蛋白質</small><span class="num" id="qp"></span></div><div><small>碳水</small><span class="num" id="qc"></span></div><div><small>脂肪</small><span class="num" id="qf"></span></div></div>
      ${f.recipe ? `<div class="rlist" id="qings"></div>` : ''}
      ${Q.ing != null ? `<div class="btnrow"><button class="btn ghost" style="flex:.6" data-act="rback">返回</button><button class="btn" data-act="qsave">${Q.ing >= 0 ? '更新食材' : '加到食譜'}</button></div>`
        : Q.editId ? `<div class="btnrow"><button class="btn danger" style="flex:.6" data-act="qdel">刪除</button><button class="btn" data-act="qsave">儲存</button></div>` : `<button class="btn" data-act="qsave">加入${mealName(Q.meal)}</button>`}
      ${f.recipe ? `<button class="linkbtn" data-act="redit" data-rid="${esc(f.id)}">編輯這個食譜</button>` : ''}
      ${Q.ing == null && !Q.editId && S.custom.some(x => x.id === f.id) ? `<button class="linkbtn" data-act="cfedit" data-fid="${esc(f.id)}">數字不對？修改這個食物${f.barcode ? '（條碼 ' + esc(f.barcode) + '）' : ''}</button>` : ''}`);
    updQty();
  }
  function updQty() { const g = qGrams(), v = calc(Q.food, g); $('#qk').textContent = v.kcal; $('#qp').textContent = v.p; $('#qc').textContent = v.c; $('#qf').textContent = v.f; $('#qg').textContent = Q.unit < 0 ? '' : '約 ' + r0(g) + ' ' + gu(Q.food);
    const box = $('#qings'); if (box) { const r = S.recipes.find(x => x.id === Q.food.id); if (r) box.innerHTML = '<div class="rhead">會分開記成 ' + r.items.length + ' 樣</div>' + scaledRows(r, g / Q.food.units[0].g); } }
  function saveQty() {
    const g = qGrams(); if (!(g > 0)) return toast('請輸入份量');
    const a = parseFloat(Q.amount), u = Q.unit < 0 ? null : Q.food.units[Q.unit];
    if (Q.ing != null) { // 食譜編輯：加／改一樣食材
      const it = { fid: Q.food.id, name: Q.food.name, grams: r1(g), kcal: Q.food.kcal, p: Q.food.p, c: Q.food.c, f: Q.food.f, ...(u ? { unit: u.n, amount: a } : {}) };
      if (Q.ing >= 0) RE.items[Q.ing] = it; else { RE.items.push(it); RE.q = ''; }
      return drawRecipe();
    }
    if (Q.food.recipe) { const r = S.recipes.find(x => x.id === Q.food.id);
      if (r) { logRecipe(r, g / Q.food.units[0].g, Q.meal); closeSheet(); toast('已拆成 ' + r.items.length + ' 樣加入' + mealName(Q.meal)); goMeal(Q.meal); return; } }
    if (g > 3000 && !confirm(`份量是 ${r0(g)} ${gu(Q.food)}，確定沒有多打一個 0 嗎？`)) return;
    const old = Q.editId ? findEntry(Q.editId) : null;
    const label = u ? a + ' ' + u.n : r0(g) + ' ' + gu(Q.food); const extra = { ...(u ? { unit: u.n, amount: a } : {}), ...(old && old.e.recipe ? { recipe: old.e.recipe } : {}) };
    if (old) removeEntry(Q.editId);
    const ne = addEntry(Q.food, g, label, Q.meal, extra);
    if (old && old.meal === Q.meal) { const list = day(S.date)[Q.meal]; list.splice(list.indexOf(ne), 1); list.splice(old.i, 0, ne); saveLog(); } // 改份量不要跳到最下面
    closeSheet(); toast(Q.editId ? '已更新' : '已加入' + mealName(Q.meal));
    if (Q.editId && old && old.meal === Q.meal) render(); else goMeal(Q.meal, ne.id);
  }
  // 回今日頁、捲到那一餐、剛加的那筆亮一下
  function goMeal(meal, eid) {
    S.tab = 'today'; S.pendingMeal = null; render();
    const card = $(`.card.meal[data-meal="${meal}"]`); if (!card) return;
    const top = card.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop - 70;
    view.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    const row = eid ? card.querySelector(`.sw[data-id="${eid}"]`) : card; if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1600); }
  }

  // ---------- 自訂食物 ----------
  let NFBC = ''; // 正在新增的自訂食物的條碼（掃了查不到時）
  let NFED = null; // 正在修改的自訂食物（掃到的開放資料不準、自己填錯了）
  let NFLIQ = false; // 這個自訂食物是液體（每份填毫升）
  function openNewFood(name = '', barcode = '', edit = null) {
    NFBC = barcode; NFED = edit; NFLIQ = NL.isLiquid(edit || { name });
    const u = edit && edit.units[0], per = v => edit ? r1(v * u.g / 100) : '';
    sheet(`${barcode && !edit ? '<button class="backbtn" data-act="scan">‹ 重新掃描</button>' : ''}<h2>${edit ? '修改自訂食物' : '新增自訂食物'}</h2><div class="sub">${edit ? '照包裝上的「每一份量」營養標示改。之後記的都用新的數字，已經記過的紀錄不會變。' : barcode ? `條碼 ${esc(barcode)} 還沒有資料。照包裝背面的營養標示填一次，下次掃這個條碼就直接帶出來。` : '照包裝上的「每一份量」營養標示填就可以'}</div>
      <div class="field"><label>名稱</label><input id="nf-n" type="text" style="font-family:var(--sans);font-size:16px;width:190px" value="${esc(edit ? edit.name : name)}" placeholder="例如：公司樓下雞肉飯"></div>
      <div class="seg sm" id="nf-liq" style="margin:4px 0 2px"><button data-act="nfliq" data-v="0" class="${NFLIQ ? '' : 'on'}">吃的（克）</button><button data-act="nfliq" data-v="1" class="${NFLIQ ? 'on' : ''}">喝的（毫升）</button></div>
      <div class="field"><label id="nf-gl">${NFLIQ ? '每份容量' : '每份重量'}</label><input id="nf-g" type="number" inputmode="decimal" value="${edit ? u.g : 100}"><span class="u" id="nf-gu">${NFLIQ ? '毫升' : '克'}</span></div>
      <div class="field"><label>每份熱量</label><input id="nf-k" type="number" inputmode="decimal" placeholder="0" value="${per(edit && edit.kcal)}"><span class="u">大卡</span></div>
      <div class="field"><label>蛋白質</label><input id="nf-p" type="number" inputmode="decimal" placeholder="0" value="${per(edit && edit.p)}"><span class="u">克</span></div>
      <div class="field"><label>碳水化合物</label><input id="nf-c" type="number" inputmode="decimal" placeholder="0" value="${per(edit && edit.c)}"><span class="u">克</span></div>
      <div class="field"><label>脂肪</label><input id="nf-f" type="number" inputmode="decimal" placeholder="0" value="${per(edit && edit.f)}"><span class="u">克</span></div>
      <p class="note">熱量沒填的話，會用三大營養素自動算（蛋白質、碳水每克 4 大卡，脂肪每克 9 大卡）。</p>
      ${edit ? `<div class="btnrow"><button class="btn danger" style="flex:.6" data-act="cfdel">刪除</button><button class="btn" data-act="nfsave">儲存</button></div>` : '<button class="btn" data-act="nfsave">儲存並加入紀錄</button>'}`);
  }
  function saveNewFood() {
    const v = id => parseFloat($(id).value) || 0; const name = $('#nf-n').value.trim(); const g = v('#nf-g');
    if (!name) return toast('請輸入名稱'); if (!(g > 0)) return toast(NFLIQ ? '請輸入每份容量' : '請輸入每份重量');
    const p = v('#nf-p'), c = v('#nf-c'), f = v('#nf-f'); const k = v('#nf-k') || p * 4 + c * 4 + f * 9;
    if (!(k > 0)) return toast('請輸入熱量或營養素');
    const x = 100 / g, ed = NFED; let bc = ed ? ed.barcode || '' : NFBC;
    // 同名的舊自訂食物會被換掉；它有條碼的話留下來，不然下次掃那個條碼就找不到了
    const same = S.custom.find(o => o.name === name && o !== ed && o.barcode); if (!bc && same) bc = same.barcode;
    const food = { id: ed ? ed.id : 'c_' + uid(), name, alias: [], kcal: r1(k * x), p: r1(p * x), c: r1(c * x), f: r1(f * x), units: [{ n: ed && ed.units[0].n || '份', g }], cat: ed ? ed.cat : '自訂', liq: NFLIQ ? 1 : 0, ...(bc ? { barcode: bc } : {}) };
    const at = ed ? S.custom.findIndex(o => o.id === ed.id) : -1;
    S.custom = S.custom.filter(o => o.id !== food.id && o.name !== name && !(bc && o.barcode === bc));
    if (at >= 0) S.custom.splice(Math.min(at, S.custom.length), 0, food); else S.custom.unshift(food);
    save('SG_CUSTOM', S.custom); rebuildFoods(); NFBC = ''; NFED = null;
    if (ed) toast('已更新「' + name + '」');
    openQty(food, { fromSearch: true });
  }
  function deleteCustom(id) {
    const f = S.custom.find(o => o.id === id); if (!f || !confirm('刪除「' + f.name + '」？已經記過的紀錄不會變。')) return;
    S.custom = S.custom.filter(o => o.id !== id); S.recent = S.recent.filter(x => x !== id);
    save('SG_CUSTOM', S.custom); save('SG_RECENT', S.recent); rebuildFoods(); NFED = null;
    toast('已刪除「' + f.name + '」'); backToSearch();
  }

  // ---------- 掃條碼：先找自己存過的，再查 Open Food Facts 開放資料庫，都沒有就照包裝標示填一次 ----------
  let scanStop = null;
  const loadScript = src => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  function openScan() {
    sheet(`<button class="backbtn" data-act="sback">‹ 回搜尋</button><h2>掃包裝條碼</h2><div class="sub">把條碼對準框框，會自動辨識</div>
      <div class="scanbox"><video id="scv" playsinline muted autoplay></video><i></i></div>
      <p class="note" id="scmsg">開啟相機中…</p>
      <div class="field"><label>或輸入條碼數字</label><input id="bc-in" type="text" inputmode="numeric" autocomplete="off" style="width:160px" placeholder="例如 4710…"></div>
      <button class="btn" data-act="bcgo">查詢</button>`, stopScan, 'scan');
    startScan();
  }
  async function startScan() {
    const v = $('#scv'), msg = t => { const m = $('#scmsg'); if (m) m.textContent = t; }; let done = false;
    const hit = code => { if (done) return; done = true; if (navigator.vibrate) navigator.vibrate(60); stopScan(); lookupBarcode(code); };
    const FMT = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw 0;
      let native = false; try { native = 'BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('ean_13'); } catch (e) { }
      if (native) {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!$('#scv')) return st.getTracks().forEach(t => t.stop());
        let alive = true; scanStop = () => { alive = false; st.getTracks().forEach(t => t.stop()); };
        v.srcObject = st; await v.play(); msg('對準條碼…');
        const bd = new BarcodeDetector({ formats: FMT });
        const loop = async () => { if (!alive) return; try { const r = await bd.detect(v); if (r[0]) return hit(r[0].rawValue); } catch (e) { } setTimeout(loop, 180); }; loop();
      } else {
        await loadScript('js/vendor/zxing.min.js'); if (!$('#scv')) return;
        const hints = new Map(); hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
        const rd = new ZXing.BrowserMultiFormatReader(hints); scanStop = () => rd.reset();
        await rd.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, v, res => { if (res) hit(res.getText()); });
        if ($('#scv')) msg('對準條碼…');
      }
    } catch (e) { stopScan(); msg('沒辦法開相機（要允許「相機」權限），也可以直接輸入條碼數字。'); }
  }
  function stopScan() { if (scanStop) { const f = scanStop; scanStop = null; try { f(); } catch (e) { } } }
  async function lookupBarcode(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length < 8) return toast('條碼是 8～13 位數字');
    const mine = S.custom.find(f => f.barcode === code); if (mine) return openQty(mine, { fromSearch: true });
    const m = $('#scmsg'); if (m) m.textContent = '查詢條碼 ' + code + '…';
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_zh,brands,nutriments,serving_quantity,serving_size,quantity`);
      const j = await r.json(), p = j.product || {}, n = p.nutriments || {};
      const k = n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : n.energy_100g != null ? n.energy_100g / 4.184 : null;
      if (j.status === 1 && k != null && k >= 0) {
        let name = (p.product_name_zh || p.product_name || '').trim() || '條碼 ' + code; const br = (p.brands || '').split(',')[0].trim();
        if (br && !name.toLowerCase().includes(br.toLowerCase())) name = br + ' ' + name;
        const sq = parseFloat(p.serving_quantity);
        const food = { id: 'c_' + uid(), name, alias: [], kcal: r1(k), p: r1(+n.proteins_100g || 0), c: r1(+n.carbohydrates_100g || 0), f: r1(+n.fat_100g || 0), units: [{ n: '份', g: sq > 0 && sq < 2000 ? r1(sq) : 100 }], cat: '條碼', barcode: code, liq: /\d\s*(ml|cl|l|毫升|公升|cc)\b/i.test((p.serving_size || '') + ' ' + (p.quantity || '')) || NL.isLiquid({ name }) ? 1 : 0 };
        S.custom = S.custom.filter(o => o.barcode !== code); S.custom.unshift(food); save('SG_CUSTOM', S.custom); rebuildFoods();
        toast('找到了（Open Food Facts 開放資料，可以點進去對一下包裝）'); return openQty(food, { fromSearch: true });
      }
    } catch (e) { if (!navigator.onLine) toast('沒有網路，先照包裝標示填一次'); }
    openNewFood('', code);
  }

  // ---------- 我的食譜 ----------
  // RE＝正在編輯的食譜（存之前都放這裡，切去調食材份量再回來不會不見）
  let RE = null;
  const fmtN = n => String(Math.round(n * 100) / 100);
  const ingLabel = it => it.unit ? fmtN(it.amount) + ' ' + it.unit : r0(it.grams) + ' ' + gu(ingFood(it));
  const recipeKcal = r => { const f = RFOODS.find(x => x.id === r.id); return f ? r0(f.kcal * f.units[0].g / 100) : 0; };
  const recipeDesc = r => r.items.length + ' 樣食材' + ((r.yields || 1) !== 1 ? ' · 一次 ' + fmtN(r.yields) + ' 份' : '') + ' · ' + r.items.slice(0, 3).map(x => x.name).join('、') + (r.items.length > 3 ? '…' : '');
  function scaledRows(r, k) {
    const s = k / (r.yields || 1);
    return r.items.map(it => { const v = calc(ingFood(it), it.grams * s); const l = it.unit ? fmtN(it.amount * s) + ' ' + it.unit : r0(it.grams * s) + ' ' + gu(ingFood(it));
      return `<div class="ri"><span>${esc(it.name)}</span><em>${esc(l)}</em><b class="num">${v.kcal}</b></div>`; }).join('');
  }
  function openRecipe(id, preset) {
    const r = id && S.recipes.find(x => x.id === id);
    RE = r ? { id: r.id, name: r.name, alias: (r.alias || []).join('、'), yields: r.yields || 1, items: r.items.map(x => ({ ...x })), q: '' }
      : { id: null, name: '', alias: '', yields: 1, items: preset || [], q: '' };
    RE.fs = !!$('.sheet.srch');
    drawRecipe();
  }
  function drawRecipe() {
    Q = null;
    const t = recipeSum(RE), y = RE.yields || 1;
    sheet(`<h2>${RE.id ? '編輯食譜' : '新增食譜'}</h2><div class="sub">存起來以後，搜尋或用講的說菜名，就會照食材分開記</div>
      <div class="field"><label>菜名</label><input id="re-n" type="text" class="tx" value="${esc(RE.name)}" placeholder="例如：番茄炒蛋"></div>
      <div class="field"><label>做一次可以吃幾份</label><input id="re-y" type="number" inputmode="decimal" value="${y}"><span class="u">份</span></div>
      <div class="field"><label>其他叫法<small>選填</small></label><input id="re-a" type="text" class="tx" value="${esc(RE.alias)}" placeholder="例如：番茄蛋"></div>
      <div class="sec">食材${RE.items.length ? ' · ' + RE.items.length + ' 樣 · 全部 ' + r0(t.kcal) + ' 大卡' : ''}</div>
      <div class="rlist">${RE.items.length ? RE.items.map((it, i) => { const v = calc(ingFood(it), it.grams);
        return `<div class="ri ed"><button class="rb" data-act="reing" data-i="${i}"><span>${esc(it.name)}</span><em>${esc(ingLabel(it))}${it.unit ? ' · ' + r0(it.grams) + ' ' + gu(ingFood(it)) : ''}</em><b class="num">${v.kcal}</b></button><button class="x" data-act="redel" data-i="${i}" aria-label="移除">×</button></div>`; }).join('')
        : '<div class="rempty">還沒有食材。可以一樣一樣搜尋，也可以整句打：<br>「雞胸肉200克 橄欖油一匙 高麗菜150克」</div>'}</div>
      <div class="typebox"><input id="re-q" type="text" value="${esc(RE.q)}" placeholder="搜尋食材，或整句打完按加入" autocomplete="off" enterkeyhint="done"><button data-act="readd">加入</button></div>
      <div id="re-res"></div>
      <div id="re-sum">${reSum()}</div>
      ${RE.id ? `<div class="btnrow"><button class="btn danger" style="flex:.6" data-act="rerm">刪除食譜</button><button class="btn" data-act="resave">儲存</button></div>` : `<button class="btn" data-act="resave" style="margin-top:16px">儲存食譜</button>`}`);
    reResults();
  }
  function reSum() {
    if (!RE.items.length) return '';
    const t = recipeSum(RE), y = RE.yields > 0 ? RE.yields : 1;
    return `<div class="sec">每份營養${y !== 1 ? '（全部 ÷ ' + fmtN(y) + '）' : ''}</div>
      <div class="qsum"><div><small>熱量</small><span class="num">${r0(t.kcal / y)}</span></div><div><small>蛋白質</small><span class="num">${r1(t.p / y)}</span></div><div><small>碳水</small><span class="num">${r1(t.c / y)}</span></div><div><small>脂肪</small><span class="num">${r1(t.f / y)}</span></div></div>`;
  }
  function reKeep() { // 打到一半的欄位先記住，畫面重畫才不會不見
    if (!RE || !$('#re-n')) return;
    RE.name = $('#re-n').value; RE.alias = $('#re-a').value; RE.yields = parseFloat($('#re-y').value) || 1; RE.q = $('#re-q').value;
  }
  function reResults() {
    const box = $('#re-res'); if (!box) return; const q = RE.q.trim();
    if (!q) { box.innerHTML = ''; return; }
    const res = NL.search(q, 30).filter(f => !f.recipe).slice(0, 6);
    box.innerHTML = res.map(f => foodRow(f, q).replace('data-act="pick"', 'data-act="reing" data-i="-1"')).join('');
  }
  function reAddText() {
    reKeep(); const text = RE.q.trim(); if (!text) return toast('先打食材名稱');
    const r = NL.parse(text); let n = 0;
    for (const it of r.items) {
      const food = it.sugar ? NL.sugarVariant(it.food, it.sugar.n) : it.food;
      const rec = food.recipe && S.recipes.find(x => x.id === food.id);
      if (rec) { const s = it.grams / food.units[0].g / (rec.yields || 1); for (const x of rec.items) { RE.items.push({ ...x, grams: r1(x.grams * s), ...(x.unit ? { amount: Math.round(x.amount * s * 100) / 100 } : {}) }); n++; } continue; }
      const a = parseFloat(it.label), u = !isAmt(it.label) && a > 0 ? food.units.find(u => Math.abs(u.g * a - it.grams) < 0.6) : null;
      RE.items.push({ fid: food.id, name: food.name, grams: it.grams, kcal: food.kcal, p: food.p, c: food.c, f: food.f, ...(u ? { unit: u.n, amount: a } : {}) }); n++;
    }
    if (!n) return toast('找不到「' + text + '」，點下面的搜尋結果試試');
    RE.q = ''; drawRecipe(); toast('加了 ' + n + ' 樣' + (r.unknown.length ? '，「' + r.unknown.join('、') + '」沒認出來' : ''));
  }
  function saveRecipe() {
    reKeep();
    const name = RE.name.trim().replace(/\s+/g, '');
    if (name.length < 2) return toast('菜名至少兩個字');
    if (!RE.items.length) return toast('還沒有食材');
    const alias = RE.alias.split(/[、,，\s]+/).map(x => x.trim()).filter(x => x.length >= 2 && x !== name);
    const r = { id: RE.id || 'r_' + uid(), name, alias, yields: Math.max(0.1, RE.yields || 1), items: RE.items };
    const i = S.recipes.findIndex(x => x.id === r.id);
    if (i >= 0) S.recipes[i] = r; else S.recipes.unshift(r);
    S.recipes = S.recipes.filter(x => x.id === r.id || x.name !== name); // 同名的舊食譜換掉
    const fs = RE.fs; save('SG_RECIPES', S.recipes); rebuildFoods(); RE = null;
    toast(i >= 0 ? '已更新食譜' : '存好了，下次說「' + name + '」就好'); if (fs) backToSearch(); else { closeSheet(); render(); }
  }
  function removeRecipe() {
    if (!RE || !RE.id) return;
    S.recipes = S.recipes.filter(x => x.id !== RE.id); S.recent = S.recent.filter(x => x !== RE.id);
    save('SG_RECIPES', S.recipes); save('SG_RECENT', S.recent); rebuildFoods(); RE = null;
    closeSheet(); toast('已刪除食譜（記過的紀錄不受影響）'); render();
  }
  function recipeRow(r) {
    return `<button class="food rcp" data-act="pick" data-fid="${esc(r.id)}"><span class="n"><b>${esc(r.name)}</b><small>${esc(recipeDesc(r))}</small></span><span class="k">${recipeKcal(r)}<small>kcal／份</small></span><span class="plus">+</span></button>`;
  }

  // ---------- 語音 ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, heard = '';
  const MIC = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.500 11a6.500 6.500 0 0 0 13 0M12 17.500V21"/></svg>';
  function openVoice() {
    heard = '';
    sheet(`<div class="voice"><h2>說說你吃了什麼</h2><div class="sub">例：「早餐吃了兩顆水煮蛋、一杯無糖豆漿，還有地瓜大概 150 克」</div>
      <button class="orb ${SR ? '' : 'off'}" id="orb" data-act="mic">${MIC}</button>
      <div class="heard ph" id="heard">${SR ? '點一下麥克風開始說' : '這個瀏覽器不支援語音辨識，請用下面的打字（鍵盤上的麥克風也可以用講的）'}</div>
      <div class="typebox"><input id="vtext" type="text" placeholder="或直接打字：雞胸肉150克 白飯一碗" enterkeyhint="done"><button data-act="vsend">記錄</button></div></div>`, stopRec);
    if (SR) startRec();
  }
  function startRec() {
    stopRec();
    try {
      rec = new SR(); rec.lang = 'zh-TW'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let fin = '';
      rec.onstart = () => { const o = $('#orb'); if (o) o.classList.add('live'); const h = $('#heard'); if (h && !heard) { h.textContent = '正在聽…'; } };
      rec.onresult = ev => { let it = ''; fin = ''; for (const r of ev.results) (r.isFinal ? (fin += r[0].transcript) : (it += r[0].transcript)); heard = fin + it; const h = $('#heard'); if (h) { h.classList.remove('ph'); h.textContent = heard; } };
      rec.onerror = ev => { const h = $('#heard'); if (!h) return; h.classList.add('ph');
        h.textContent = ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? '麥克風沒有開放權限，請到瀏覽器設定允許，或用下面打字' : ev.error === 'no-speech' ? '沒聽到聲音，再點一下麥克風試試' : '語音辨識暫時不能用（' + ev.error + '），可以先用打字'; };
      rec.onend = () => { const o = $('#orb'); if (o) o.classList.remove('live'); rec = null; if (heard.trim() && $('#orb')) submitText(heard); };
      rec.start();
    } catch (e) { rec = null; }
  }
  function stopRec() { if (rec) { try { rec.onend = null; rec.abort(); } catch (e) { } rec = null; } }
  function submitText(text) {
    text = (text || '').trim(); if (!text) return toast('還沒有內容');
    stopRec();
    const r = NL.parse(text);
    // 記住用的單位（盤／杯…），之後點進去改份量才會是「2 盤」而不是「2 克」
    const unitOf = it => { const a = parseFloat(it.label); if (!(a > 0) || isAmt(it.label)) return {}; const u = it.food.units.find(u => Math.abs(u.g * a - it.grams) < 0.6); return u ? { unit: u.n, amount: a } : {}; };
    // 說了「今天／昨天／前天」就記到那天（從今天往回算），沒說就記到現在看的這天
    const date = r.dayOffset != null ? addDays(today(), r.dayOffset) : S.date;
    const added = r.items.flatMap(it => { const food = it.sugar ? NL.sugarVariant(it.food, it.sugar.n) : it.food;
      const rec = food.recipe && S.recipes.find(x => x.id === food.id);
      if (rec) return logRecipe(rec, it.grams / food.units[0].g, it.meal, date).map(e => ({ e, it: { meal: it.meal, est: false } }));
      return [{ e: addEntry(food, it.grams, it.label.replace('（預設份量）', ''), it.meal, unitOf(it), date), it }]; });
    S.lastBatch = added.map(a => a.e.id); S.batchDate = date;
    if (date !== S.date && added.length) S.date = date; // 跳到那天，回到今日畫面就看得到剛記的
    drawResult(text, added, r.unknown); render();
  }
  function drawResult(text, added, unknown) {
    const sum = added.reduce((a, x) => a + x.e.kcal, 0);
    const meals = [...new Set(added.map(a => mealName(a.it.meal)))].join('、');
    sheet(`<div class="result">${added.length ? `<div class="okmark"><svg viewBox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg></div>
      <h2 style="text-align:center">已記錄 ${added.length} 項 · ${sum} 大卡</h2><div class="sub" style="text-align:center">記到${S.date !== today() ? dateLabel(S.date) + ' 的' : ''}${meals}「${esc(text)}」</div>`
      : `<h2>沒有認出食物</h2><div class="sub">「${esc(text)}」</div>`}
      <div id="rlist">${added.map(a => `<div class="entry" data-rid="${a.e.id}"><span class="n"><b>${esc(a.e.name)}${a.it.est ? '<span class="badge">估算份量</span>' : ''}</b><small>${mealName(a.it.meal)} · ${esc(eLabel(a.e))}${isAmt(a.e.label) ? '' : ' · ' + r0(a.e.grams) + ' ' + eu(a.e)}</small></span><span class="k">${a.e.kcal}<small>蛋 ${r0(a.e.p)} · 碳 ${r0(a.e.c)} · 脂 ${r0(a.e.f)}</small></span><button class="x" data-act="rdel" data-id="${a.e.id}" aria-label="移除">×</button></div>`).join('')}</div>
      ${unknown.length ? `<div class="unk">這幾個資料庫裡找不到，點一下可以搜尋或自己新增：<br>${unknown.map(u => `<button data-act="unk" data-q="${esc(u)}">${esc(u)}</button>`).join('')}</div>` : ''}
      <div class="btnrow" style="margin-top:16px"><button class="btn ghost" data-act="voice">再說一次</button><button class="btn" data-act="close">完成</button></div>
      ${added.length > 1 ? '<button class="linkbtn" data-act="rfrom">把這幾樣存成食譜，下次說菜名就好</button>' : ''}
      ${added.length ? '<p class="note" style="text-align:center;margin-top:12px">份量不對？回到今日點那一筆就能改</p>' : ''}</div>`);
  }

  // ---------- 趨勢 ----------
  function renderTrend() {
    const T = targets(); const days = []; for (let i = 6; i >= 0; i--) { const k = addDays(today(), -i); days.push({ k, t: totals(k) }); }
    const max = Math.max(T.kcal * 1.15, ...days.map(d => d.t.kcal)); const logged = days.filter(d => d.t.n);
    const avg = k => logged.length ? logged.reduce((a, d) => a + d.t[k], 0) / logged.length : 0;
    const ak = avg('kcal'), ap = avg('p'), ac = avg('c'), af = avg('f');
    view.innerHTML = `<div class="rise"><h1 class="page">趨勢</h1><p class="sub">體重與最近 7 天的攝取狀況</p>
      ${weightCard()}${adaptCard(T)}
      <div class="card"><h3>每日熱量<em>目標 ${T.kcal}</em></h3><div class="chart"><div class="tl" style="bottom:${T.kcal / max * 132 + 24}px"><span>目標</span></div>
        ${days.map(d => `<div class="col ${d.t.kcal > T.kcal * 1.05 ? 'over' : ''} ${d.t.n ? '' : 'zero'} ${d.k === today() ? 'today' : ''}" data-act="goday" data-k="${d.k}"><em>${d.t.n ? r0(d.t.kcal) : ''}</em><i style="height:${d.t.kcal / max * 132}px"></i><small>${d.k === today() ? '今天' : '週' + '日一二三四五六'[new Date(d.k + 'T12:00:00').getDay()]}</small></div>`).join('')}</div></div>
      <div class="stat2"><div class="g"><small>平均熱量</small><span class="num">${r0(ak)}</span></div><div><small>有記錄</small><span class="num">${logged.length}<span style="font-size:13px;color:var(--dim)"> / 7 天</span></span></div><div><small>與目標差</small><span class="num">${logged.length ? (ak - T.kcal > 0 ? '+' : '') + r0(ak - T.kcal) : '—'}</span></div></div>
      <div class="card ratio"><h3>平均營養素比例<em>${esc(T.plan.n)}</em></h3>
        <div class="row"><span>實際</span>${logged.length ? stack(ap * 4, ac * 4, af * 9) : '<div class="stack"></div>'}</div>
        <div class="row"><span>目標</span>${stack(T.p * 4, T.c * 4, T.f * 9, 'ghost')}</div>
        <div class="legend"><b class="kp">蛋白質 ${r0(ap)} g</b><b class="kc">碳水 ${r0(ac)} g</b><b class="kf">脂肪 ${r0(af)} g</b></div></div>
      <p class="note" style="text-align:center">點任何一天的長條可以回去看那天的紀錄</p></div>`;
  }

  // ---------- 我的／開場設定 ----------
  let draft = null;
  function formHTML(p) {
    const T = targets(p), g = GOALS[p.goal], pl = planOf(p);
    return `<div class="card"><h3>基本資料</h3>
        <div class="seg" style="margin-bottom:6px"><button data-set="sex" data-v="m" class="${p.sex === 'm' ? 'on' : ''}">男</button><button data-set="sex" data-v="f" class="${p.sex === 'f' ? 'on' : ''}">女</button></div>
        <div class="field"><label>年齡</label><input data-f="age" type="number" inputmode="numeric" value="${p.age}"><span class="u">歲</span></div>
        <div class="field"><label>身高</label><input data-f="height" type="number" inputmode="decimal" value="${p.height}"><span class="u">公分</span></div>
        <div class="field"><label>體重</label><input data-f="weight" type="number" inputmode="decimal" value="${p.weight}"><span class="u">公斤</span></div>
        <div class="field"><label>活動量</label><select data-f="act">${ACTS.map(a => `<option value="${a[0]}" ${+p.act === a[0] ? 'selected' : ''}>${a[1]}</option>`).join('')}</select></div>
        <div class="field"><label>基礎代謝</label><div class="seg sm nowrap" style="flex:0 0 auto"><button data-set="bmrMode" data-v="calc" class="${p.bmrMode !== 'manual' ? 'on' : ''}">用公式算</button><button data-set="bmrMode" data-v="manual" class="${p.bmrMode === 'manual' ? 'on' : ''}">自己填</button></div></div>
        ${p.bmrMode === 'manual' ? `<div class="field"><label>BMR</label><input data-f="bmrIn" type="number" inputmode="numeric" value="${p.bmrIn || ''}" placeholder="例如 1500"><span class="u">大卡</span></div>
        <p class="note" style="margin:0">填 InBody 或體脂計量到的基礎代謝，會直接用它乘活動量算 TDEE。</p>` : ''}
        ${p === S.profile ? `<div class="field"><label>用體重校正</label><div class="seg sm nowrap" style="flex:0 0 auto"><button data-set="adapt" data-v="on" class="${p.adapt !== false ? 'on' : ''}">自動校正</button><button data-set="adapt" data-v="off" class="${p.adapt === false ? 'on' : ''}">只用公式</button></div></div>` : ''}</div>
      <div class="card"><h3>目標</h3>
        <div class="seg">${Object.keys(GOALS).map(k => `<button data-set="goal" data-v="${k}" class="${p.goal === k ? 'on' : ''}">${GOALS[k].n}</button>`).join('')}</div>
        ${p.goal !== 'keep' ? `<div class="seg sm" style="margin-top:8px">${g.paces.map(x => `<button data-set="pace" data-v="${x[0]}" class="${+p.pace === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>` : ''}</div>
      <div class="stat2"><div><small>BMR 基礎代謝</small><span class="num">${T.bmr}</span></div><div><small>${T.adapted ? 'TDEE 實際校正' : 'TDEE 每日消耗'}</small><span class="num">${T.tdee}</span></div><div class="g"><small>每日目標</small><span class="num">${T.kcal}</span></div></div>
      ${T.floored ? '<p class="note">算出來的熱量太低，已經幫你拉到安全下限（男 1500／女 1200 大卡）。</p>' : ''}
      <div class="card"><h3>飲食計畫<em>${esc(pl.n)}</em></h3><div class="macros" style="margin-bottom:12px"><div class="macro kp"><small>蛋白質 ${T.pct.p}%</small><span class="num">${T.p}<u> g</u></span></div><div class="macro kc"><small>碳水 ${T.pct.c}%</small><span class="num">${T.c}<u> g</u></span></div><div class="macro kf"><small>脂肪 ${T.pct.f}%</small><span class="num">${T.f}<u> g</u></span></div></div>
        <div class="slider kp"><span>蛋白質</span><input type="range" min="1.2" max="2.4" step="0.1" value="${pkgOf(p)}" data-pk="1"><b id="rpk">${pkgOf(p).toFixed(1)}</b></div>
        <p class="note" style="margin:0 0 4px" id="pknote">${pkNote(p, T)}</p>
        <div class="field" style="border-top:0;padding-top:4px"><label>用目標體重算</label><input data-f="goalW" type="number" inputmode="decimal" value="${p.goalW || ''}" placeholder="不填＝現在"><span class="u">公斤</span></div>
        <p class="note" style="margin:0 0 14px">體重過重的人填目標體重，蛋白質才不會算太多。</p>
        <div class="plans">${PLANS.map(x => { const v = x.k === 'custom' && p.custom ? { ...x, ...p.custom } : x; const m = macros(T.kcal, p, v).pct; return `<button class="plan ${p.plan === x.k ? 'on' : ''}" data-set="plan" data-v="${x.k}"><b>${x.n}</b><small>${x.d}</small>${stack(m.p, m.c, m.f, '', false)}<div class="pct"><span>蛋 ${m.p}</span><span>碳 ${m.c}</span><span>脂 ${m.f}</span></div></button>`; }).join('')}</div>
        ${p.plan === 'custom' ? `<div style="margin-top:14px">
          <div class="slider kf"><span>脂肪</span><input type="range" min="10" max="90" step="5" value="${cfShare(pl)}" data-r="f"><b id="rf">${cfShare(pl)}%</b></div>
          <p class="note" style="margin:6px 0 0" id="rcf">蛋白質以外的熱量：脂肪 ${cfShare(pl)}%、碳水 ${100 - cfShare(pl)}%（脂肪至少佔全天兩成）</p></div>` : ''}</div>`;
  }
  const cfShare = pl => Math.round(pl.f / (pl.c + pl.f) * 20) * 5;
  function pkNote(p, T) {
    return `每公斤體重 ${pkgOf(p).toFixed(1)} 克 × ${protW(p)} 公斤${p.goalW > 0 ? '（目標體重）' : ''} ＝ ${r0(pkgOf(p) * protW(p))} 克${T.pcap ? `，超過全天熱量四成，先以 ${T.p} 克為限` : ''}。預設減脂 1.8、維持 1.4、增重 1.6；有在練又很精瘦可以往上調。`;
  }
  const DEF = { sex: 'm', age: 30, height: 172, weight: 70, act: 1.375, goal: 'cut', pace: -0.2, plan: 'highp', custom: { p: 30, c: 40, f: 30 } };
  function renderOnboard() {
    if (!draft) draft = { ...DEF };
    const y = view.scrollTop;
    view.innerHTML = `<div class="ob-hero"><div class="brand">食<i>光</i></div><h1>用說的，<br>就記好<i>每一餐</i>。</h1><p>先花 30 秒填基本資料，算出你一天該吃多少、三大營養素怎麼分配。之後都可以在「我的」修改。</p></div>
      ${formHTML(draft)}<button class="btn" data-act="start" style="margin:6px 0 30px">開始使用</button>`;
    view.scrollTop = y;
  }
  function renderMe() {
    draft = S.profile; const y = view.scrollTop;
    view.innerHTML = `<div><h1 class="page">我的</h1><p class="sub">改了會馬上重新計算每日目標</p>${formHTML(S.profile)}
      <div class="card"><h3>我的食譜<em>${S.recipes.length ? S.recipes.length + ' 道' : ''}</em></h3>${S.recipes.length ? S.recipes.map(r => `<button class="entry" data-act="redit" data-rid="${esc(r.id)}"><span class="n"><b>${esc(r.name)}</b><small>${esc(recipeDesc(r))}</small></span><span class="k">${recipeKcal(r)}<small>kcal／份</small></span></button>`).join('') : '<p class="note" style="margin-top:-4px">常煮的菜存成食譜，以後說菜名就會照食材分開記。</p>'}
        <button class="btn ghost" style="margin-top:${S.recipes.length ? 10 : 0}px" data-act="rnew">＋ 新增食譜</button></div>
      <div class="card"><h3>資料</h3><p class="note" style="margin-top:-4px">紀錄只存在這支手機的瀏覽器裡，換手機或清除瀏覽資料前記得先備份。</p>
        <div class="btnrow"><button class="btn ghost" data-act="export">匯出備份</button><button class="btn ghost" data-act="import">匯入備份</button></div><input type="file" id="imp" accept="application/json,.json" hidden></div>
      <p class="note">熱量與營養素為估算值（BMR 沒自己填時用 Mifflin-St Jeor 公式；食物數值參考衛福部食品營養成分資料庫與常見市售標示，料理類依一般做法估算），實際會因做法與份量不同。有疾病或特殊飲食需求請先詢問醫師或營養師。</p></div>`;
    view.scrollTop = y;
  }
  function setProfile(k, v) {
    const p = draft; if (!p) return;
    if (k === 'bmrMode') { p.bmrMode = v; if (v === 'manual' && !p.bmrIn) p.bmrIn = Math.round(10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161)); }
    else if (k === 'bmrIn') { const n = parseFloat(v); if (!(n >= 800 && n <= 4000)) { toast('BMR 請填 800～4000 之間'); return render(); } p.bmrIn = Math.round(n); }
    else if (k === 'adapt') p.adapt = v === 'on';
    else if (k === 'goal') { p.goal = v; p.pace = v === 'cut' ? -0.2 : v === 'bulk' ? 0.15 : 0; delete p.pkg; } // 換目標，蛋白質回到那個目標的預設
    else if (k === 'goalW') { if (String(v).trim() === '') delete p.goalW; else { const n = parseFloat(v); if (!(n >= 25 && n <= 250)) { toast('目標體重請填 25～250 公斤'); return render(); } p.goalW = r1(n); } }
    else if (k === 'pace' || k === 'act') p[k] = parseFloat(v);
    else if (k === 'age' || k === 'height' || k === 'weight') { const n = parseFloat(v); const lim = { age: [10, 100], height: [100, 230], weight: [25, 250] }[k]; if (!(n >= lim[0] && n <= lim[1])) { toast('這個數字好像不太對'); return render(); } p[k] = n; }
    else p[k] = v;
    if (!p.custom) p.custom = { p: 30, c: 40, f: 30 };
    if (S.profile) save('SG_PROFILE', S.profile);
    render();
  }

  // ---------- 面板／提示 ----------
  let onClose = null, skipPop = false;
  function sheet(html, closeFn, cls = '') {
    if (onClose) { const f = onClose; onClose = null; f(); }
    onClose = closeFn || null;
    const had = !!$('#sheets .sheet');
    if (!had && !(history.state && history.state.sg)) history.pushState({ sg: 1 }, '');
    $('#sheets').innerHTML = `<div class="scrim" data-act="scrim" ${had ? 'style="animation:none"' : ''}><div class="sheet ${cls}" ${had ? 'style="animation:none"' : ''}><div class="grab"></div>${html}</div></div>`;
  }
  function closeSheet(fromBack) {
    const open = !!$('#sheets .sheet');
    if (onClose) { const f = onClose; onClose = null; f(); } $('#sheets').innerHTML = ''; if (S.pendingMeal && S.profile) goMeal(S.pendingMeal);
    // 等一下再退回上一頁：關掉之後馬上又開別的視窗（例如沒認出的字→搜尋）就沿用同一筆，不退
    if (!fromBack && open) setTimeout(() => { if (!$('#sheets .sheet') && history.state && history.state.sg) { skipPop = true; history.back(); } }, 0);
  }
  window.addEventListener('popstate', () => { if (skipPop) { skipPop = false; return; } if ($('#sheets .sheet')) closeSheet(true); });
  // undo：給了就在提示旁邊放「復原」，4 秒內可以按
  let tt, tUndo = null; function toast(msg, undo) {
    const t = $('#toast'); tUndo = undo || null; t.textContent = ''; const sp = document.createElement('span'); sp.textContent = msg; t.appendChild(sp); t.classList.toggle('act', !!undo);
    if (undo) { const b = document.createElement('button'); b.textContent = '復原'; b.onclick = () => { const f = tUndo; tUndo = null; t.classList.remove('show'); if (f) { f(); setTimeout(() => toast('已復原'), 250); } }; t.appendChild(b); }
    t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => { t.classList.remove('show'); tUndo = null; }, undo ? 4000 : 1900); }

  // ---------- 事件 ----------
  document.addEventListener('click', ev => {
    const tab = ev.target.closest('[data-tab]'); if (tab) { if (tab.dataset.tab === 'search') { if (S.tab !== 'today') { S.tab = 'today'; render(); } return openSearch(null); } S.tab = tab.dataset.tab; view.scrollTop = 0; return render(); }
    if (ev.target.closest('.dpick')) { const i = $('#dpick'); try { if (i && i.showPicker) { i.showPicker(); ev.preventDefault(); } } catch (e) { } return; }
    const set = ev.target.closest('[data-set]'); if (set) return setProfile(set.dataset.set, set.dataset.v);
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    if (a === 'scrim') { if (ev.target === el) closeSheet(); return; }
    switch (a) {
      case 'day': S.date = addDays(S.date, +el.dataset.n); if (S.date > today()) S.date = today(); render(); break;
      case 'goday': S.date = el.dataset.k; S.tab = 'today'; view.scrollTop = 0; render(); break;
      case 'addto': openSearch(el.dataset.meal); break;
      case 'smeal': S.meal = el.dataset.meal; document.querySelectorAll('#smeals button').forEach(b => b.classList.toggle('on', b.dataset.meal === S.meal)); $('#smn').textContent = mealName(S.meal); if (S.q) renderResults(); break;
      case 'sback': backToSearch(); break;
      case 'cat': S.cat = S.cat === el.dataset.cat ? '' : el.dataset.cat; renderResults(); break;
      case 'clearq': S.q = ''; $('#q').value = ''; el.hidden = true; renderResults(); $('#q').focus(); break;
      case 'pick': { let f = foodById(el.dataset.fid); if (!f) break; const le = el.dataset.last && lastEntry(f.id), lf = le && foodById(le.fid);
        if (lf) openQty(lf, { meal: S.meal, entry: le, fromSearch: true }); else openQty(f, { meal: S.meal, fromSearch: true }); break; }
      case 'quick': { const m = S.meal || NL.mealByHour(new Date().getHours()), ne = quickLog(el.dataset.fid, m); if (!ne) break;
        S.pendingMeal = m; renderResults(); const fl = $(`#results [data-fid="${CSS.escape(el.dataset.fid)}"].plus`); if (fl) fl.classList.add('done');
        const d = S.date; toast(`${ne.name} ${ne.label} 已記到${mealName(m)}`, () => { removeEntry(ne.id, d); renderResults(); }); break; }
      case 'copymeal': { const d = S.date, r = copyMeal(el.dataset.meal, d); if (!r) break; render();
        toast(`已記上${shortDate(r.pm.k) === '昨天' ? '昨天' : ' ' + shortDate(r.pm.k) + ' '}的${mealName(el.dataset.meal)} ${r.added.length} 樣`, () => { r.added.forEach(e => removeEntry(e.id, d)); render(); }); break; }
      case 'edit': { const f = findEntry(el.dataset.id); if (!f) break; const e = f.e; const food = foodById(e.fid) || { id: e.fid, name: e.name, alias: [], kcal: e.kcal / e.grams * 100, p: e.p / e.grams * 100, c: e.c / e.grams * 100, f: e.f / e.grams * 100, units: [{ n: '份', g: e.grams }] }; openQty(food, { meal: f.meal, editId: e.id, entry: e }); break; }
      case 'qunit': { const i = +el.dataset.i; if (i === Q.unit) break; const g = qGrams(); Q.unit = i; Q.amount = i < 0 ? r0(g) || 100 : 1; drawQty(); break; }
      case 'qmeal': Q.meal = el.dataset.meal; Q.amount = $('#qamt').value; drawQty(); break;
      case 'qsave': Q.amount = $('#qamt').value; saveQty(); break;
      case 'swdel': { const d = S.date, f = findEntry(el.dataset.id, d); if (!f) break; const row = el.closest('.sw');
        const done = () => { removeEntry(f.e.id, d); render(); toast(`已刪除 ${f.e.name}`, () => { day(d)[f.meal].splice(f.i, 0, f.e); saveLog(); render(); }); };
        if (row) { row.classList.add('gone'); setTimeout(done, 220); } else done(); break; }
      case 'qdel': { const d = S.date, f = findEntry(Q.editId, d); removeEntry(Q.editId, d); closeSheet(); render(); if (f) toast(`已刪除 ${f.e.name}`, () => { day(d)[f.meal].splice(f.i, 0, f.e); saveLog(); render(); }); break; }
      case 'newfood': openNewFood(S.q.trim()); break;
      case 'scan': openScan(); break;
      case 'bcgo': lookupBarcode($('#bc-in').value); break;
      case 'nfsave': saveNewFood(); break;
      case 'nfliq': NFLIQ = el.dataset.v === '1'; document.querySelectorAll('#nf-liq button').forEach(b => b.classList.toggle('on', b === el)); $('#nf-gl').textContent = NFLIQ ? '每份容量' : '每份重量'; $('#nf-gu').textContent = NFLIQ ? '毫升' : '克'; break;
      case 'cfedit': { const f = S.custom.find(o => o.id === el.dataset.fid); if (f) openNewFood('', '', f); break; }
      case 'cfdel': if (NFED) deleteCustom(NFED.id); break;
      case 'rnew': openRecipe(null); break;
      case 'redit': openRecipe(el.dataset.rid); break;
      case 'rfrom': { const d = S.batchDate || S.date; const items = (S.lastBatch || []).map(id => findEntry(id, d)).filter(Boolean).map(({ e }) => { const f = foodById(e.fid), x = 100 / e.grams;
          return { fid: e.fid, name: e.name, grams: e.grams, kcal: f ? f.kcal : r1(e.kcal * x), p: f ? f.p : r1(e.p * x), c: f ? f.c : r1(e.c * x), f: f ? f.f : r1(e.f * x), ...(e.unit ? { unit: e.unit, amount: e.amount } : {}) }; });
        openRecipe(null, items); setTimeout(() => { const n = $('#re-n'); if (n) n.focus(); }, 80); break; }
      case 'reing': { reKeep(); const i = +el.dataset.i; if (i >= 0) { const it = RE.items[i]; openQty(ingFood(it), { ing: i, entry: it }); } else { const f = foodById(el.dataset.fid); if (f) openQty(f, { ing: -1 }); } break; }
      case 'redel': reKeep(); RE.items.splice(+el.dataset.i, 1); drawRecipe(); break;
      case 'readd': reAddText(); break;
      case 'rback': drawRecipe(); break;
      case 'resave': saveRecipe(); break;
      case 'rerm': removeRecipe(); break;
      case 'voice': openVoice(); break;
      case 'mic': if (!SR) break; if (rec) { try { rec.stop(); } catch (e) { } } else startRec(); break;
      case 'vsend': submitText($('#vtext').value); break;
      case 'rdel': removeEntry(el.dataset.id, S.batchDate || S.date); el.closest('.entry').remove(); render(); if (!$('#rlist .entry')) closeSheet(); break;
      case 'unk': closeSheet(); S.tab = 'today'; render(); openSearch(null, el.dataset.q); break;
      case 'close': closeSheet(); break;
      case 'start': S.profile = draft; save('SG_PROFILE', S.profile); S.tab = 'today'; view.scrollTop = 0; render(); toast('設定完成，開始記錄吧'); break;
      case 'wsave': saveWeight($('#wt').value); break;
      case 'wdel': delete S.weight[el.dataset.k]; save('SG_WEIGHT', S.weight); toast('已刪除那天的體重'); render(); break;
      case 'export': exportData(); break;
      case 'import': $('#imp').click(); break;
    }
  });
  // ---------- 左滑刪除 ----------
  // 品名留在原位、右邊長出刪除鈕（不是整列推出去）；手指偏橫就算左滑，並鎖住上下捲動
  const SWW = 84; let SW = null, swOpen = null, swEat = 0;
  function swSet(row, x, anim) { // x：往左露出的寬度（0～列寬）
    const en = row.querySelector('.entry'), del = row.querySelector('.swdel'), w = row.offsetWidth;
    const tr = anim ? 'width .22s cubic-bezier(.2,.9,.2,1)' : 'none';
    en.style.transition = tr; del.style.transition = tr;
    en.style.width = x ? `${Math.max(0, w - x)}px` : ''; del.style.width = x ? `${Math.max(0, x - 8)}px` : '';
    row.classList.toggle('open', x > 0); }
  function swClose() { if (swOpen) { swSet(swOpen, 0, true); swOpen = null; } }
  function swStart(target, x, y) {
    const row = target.closest('.sw'); if (swOpen && swOpen !== row) { swClose(); swEat = Date.now(); }
    if (!row || target.closest('.swdel')) { SW = null; return; }
    SW = { row, x0: x, y0: y, base: row === swOpen ? SWW : 0, x: 0, on: false, no: false };
  }
  // 回傳 true＝這一下是左滑（要擋住頁面捲動）
  function swMove(x, y) {
    if (!SW || SW.no) return false; const dx = x - SW.x0, dy = y - SW.y0;
    if (!SW.on) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return true; // 還沒判定前先別讓頁面動
      if (Math.abs(dx) > Math.abs(dy) * 0.6 && (dx < 0 || SW.base)) SW.on = true; else { SW.no = true; return false; }
    }
    const w = SW.row.offsetWidth; SW.x = Math.min(w, Math.max(0, SW.base - dx)); swSet(SW.row, SW.x, false);
    SW.row.classList.toggle('far', SW.x > w * 0.55); return true;
  }
  const swEnd = () => {
    if (!SW) return; const { row, on, x } = SW; SW = null; if (!on) return; swEat = Date.now(); row.classList.remove('far');
    if (x > row.offsetWidth * 0.55) { swSet(row, row.offsetWidth, true); swOpen = null; setTimeout(() => row.querySelector('.swdel').click(), 160); }
    else if (x > SWW / 2) { swSet(row, SWW, true); swOpen = row; } else { swSet(row, 0, true); if (swOpen === row) swOpen = null; }
  };
  view.addEventListener('touchstart', ev => { const t = ev.touches[0]; if (ev.touches.length === 1) swStart(ev.target, t.clientX, t.clientY); else SW = null; }, { passive: true });
  view.addEventListener('touchmove', ev => { const t = ev.touches[0]; if (swMove(t.clientX, t.clientY) && ev.cancelable) ev.preventDefault(); }, { passive: false });
  view.addEventListener('touchend', swEnd); view.addEventListener('touchcancel', swEnd);
  // 電腦用滑鼠拖
  view.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse' && !ev.button) swStart(ev.target, ev.clientX, ev.clientY); });
  view.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') swMove(ev.clientX, ev.clientY); });
  view.addEventListener('pointerup', ev => { if (ev.pointerType === 'mouse') swEnd(); });
  // 剛滑完的那一下不要當成「點進去編輯」
  view.addEventListener('click', ev => { if (Date.now() - swEat < 450) { swEat = 0; if (!ev.target.closest('.swdel')) { ev.stopPropagation(); ev.preventDefault(); } } }, true);
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 're-q') { RE.q = t.value; reResults(); }
    else if (t.id === 're-y') { RE.yields = parseFloat(t.value) || 1; $('#re-sum').innerHTML = reSum(); }
    else if (t.id === 'q') { S.q = t.value; const b = $('[data-act=clearq]'); if (b) b.hidden = !S.q; renderResults(); }
    else if (t.id === 'qamt') { Q.amount = t.value; updQty(); }
    else if (t.dataset.r) {
      const p = draft; const f = +t.value; p.custom = { c: 100 - f, f };
      $('#rf').textContent = f + '%'; $('#rcf').textContent = '蛋白質以外的熱量：脂肪 ' + f + '%、碳水 ' + (100 - f) + '%（脂肪至少佔全天兩成）';
    }
    else if (t.dataset.pk) { const p = draft; p.pkg = +t.value; $('#rpk').textContent = p.pkg.toFixed(1); $('#pknote').textContent = pkNote(p, targets(p)); }
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.f) setProfile(t.dataset.f, t.value);
    else if (t.dataset.r || t.dataset.pk) { if (S.profile) save('SG_PROFILE', S.profile); render(); }
    else if (t.id === 'dpick') { const v = t.value; if (isDay(v) && v <= today()) { S.date = v; render(); } }
    else if (t.id === 'imp' && t.files[0]) { importData(t.files[0]); t.value = ''; } // 清掉，同一個檔案再選一次也有反應
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'vtext') submitText(ev.target.value);
    else if (ev.target.id === 're-q') reAddText();
    else if (ev.target.id === 'qamt') { Q.amount = ev.target.value; saveQty(); }
    else if (ev.target.id === 'q') ev.target.blur();
    else if (ev.target.id === 'wt') saveWeight(ev.target.value);
    else if (ev.target.id === 'bc-in') lookupBarcode(ev.target.value);
  });

  function exportData() {
    const json = JSON.stringify({ app: 'shiguang', v: 1, at: new Date().toISOString(), profile: S.profile, log: S.log, custom: S.custom, recipes: S.recipes, recent: S.recent, weight: S.weight });
    const blob = new Blob([json], { type: 'application/json' }); const fname = '食光備份_' + today() + '.json';
    // 手機（尤其 iPhone 加到主畫面時）下載檔案常常沒反應，能用分享就用分享：可以存到「檔案」或傳 LINE
    try { const file = new File([blob], fname, { type: 'application/json' });
      if (matchMedia('(pointer:coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: fname }).then(() => toast('已匯出備份檔')).catch(() => { }); return; } } catch (e) { }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('已匯出備份檔');
  }
  // 備份檔的內容一律重新整理：數字就是數字、文字就是文字、日期要像日期
  const numv = (v, d = 0) => { const n = +v; return isFinite(n) ? n : d; };
  const strv = (v, max = 120) => String(v == null ? '' : v).slice(0, max);
  const idv = v => strv(v, 80); // 畫面上用到 id 的地方都有跳脫
  const isDay = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
  const cleanEntry = e => e && typeof e === 'object' && numv(e.grams) > 0 ? { id: idv(e.id) || uid(), fid: idv(e.fid), name: strv(e.name), grams: numv(e.grams), label: strv(e.label), kcal: r0(numv(e.kcal)), p: numv(e.p), c: numv(e.c), f: numv(e.f),
    ...(e.unit ? { unit: strv(e.unit, 10), amount: numv(e.amount, 1) } : {}), ...(e.recipe ? { recipe: strv(e.recipe) } : {}), ...(e.liq ? { liq: 1 } : {}) } : null;
  const cleanFood = f => { if (!f || typeof f !== 'object' || !strv(f.name).trim()) return null; const units = (Array.isArray(f.units) ? f.units : []).map(u => ({ n: strv(u && u.n, 10) || '份', g: numv(u && u.g) })).filter(u => u.g > 0);
    return { id: idv(f.id) || 'c_' + uid(), name: strv(f.name), alias: (Array.isArray(f.alias) ? f.alias : []).map(x => strv(x, 40)), kcal: numv(f.kcal), p: numv(f.p), c: numv(f.c), f: numv(f.f), units: units.length ? units : [{ n: '份', g: 100 }], cat: strv(f.cat, 20) || '自訂',
      ...(f.barcode ? { barcode: strv(f.barcode, 14).replace(/\D/g, '') } : {}), ...(f.liq != null ? { liq: f.liq ? 1 : 0 } : {}) }; };
  const cleanRecipe = r => { if (!r || typeof r !== 'object' || !strv(r.name).trim()) return null; const items = (Array.isArray(r.items) ? r.items : []).filter(it => it && numv(it.grams) > 0).map(it => ({ fid: idv(it.fid), name: strv(it.name), grams: numv(it.grams), kcal: numv(it.kcal), p: numv(it.p), c: numv(it.c), f: numv(it.f), ...(it.unit ? { unit: strv(it.unit, 10), amount: numv(it.amount, 1) } : {}) }));
    return items.length ? { id: idv(r.id) || 'r_' + uid(), name: strv(r.name), alias: (Array.isArray(r.alias) ? r.alias : []).map(x => strv(x, 40)), yields: Math.max(0.1, numv(r.yields, 1)), items } : null; };
  function cleanBackup(d) {
    const P = d.profile, p = { ...DEF, custom: { ...DEF.custom } };
    p.sex = P.sex === 'f' ? 'f' : 'm';
    for (const k of ['age', 'height', 'weight', 'act', 'pace']) p[k] = numv(P[k], DEF[k]);
    if (GOALS[P.goal]) p.goal = P.goal; if (PLANS.some(x => x.k === P.plan)) p.plan = P.plan;
    if (P.bmrMode === 'manual') { p.bmrMode = 'manual'; p.bmrIn = numv(P.bmrIn); }
    if (P.adapt === false) p.adapt = false;
    for (const k of ['goalW', 'pkg']) if (numv(P[k]) > 0) p[k] = numv(P[k]);
    if (P.custom && typeof P.custom === 'object') p.custom = { c: numv(P.custom.c, 40), f: numv(P.custom.f, 30) };
    const log = {};
    for (const k of Object.keys(d.log || {})) { if (!isDay(k)) continue; const day0 = d.log[k] || {}; log[k] = {}; for (const m of MEALS) log[k][m.k] = (Array.isArray(day0[m.k]) ? day0[m.k] : []).map(cleanEntry).filter(Boolean); }
    const weight = {}; for (const k of Object.keys(d.weight || {})) { const w = numv(d.weight[k]); if (isDay(k) && w >= 25 && w <= 250) weight[k] = w; }
    return { profile: p, log, weight, custom: (Array.isArray(d.custom) ? d.custom : []).map(cleanFood).filter(Boolean), recipes: (Array.isArray(d.recipes) ? d.recipes : []).map(cleanRecipe).filter(Boolean), recent: (Array.isArray(d.recent) ? d.recent : []).map(idv).filter(Boolean).slice(0, 12) };
  }
  function importData(file) {
    const fr = new FileReader();
    fr.onload = () => { try { const raw = JSON.parse(fr.result); if (!raw || raw.app !== 'shiguang' || !raw.profile || typeof raw.profile !== 'object' || !raw.log) throw 0;
      const d = cleanBackup(raw), nd = Object.keys(d.log).length, cur = Object.keys(S.log).filter(k => totals(k).n).length;
      if (!confirm(`備份檔裡有 ${nd} 天的紀錄${raw.at ? '（' + strv(raw.at, 10) + ' 匯出）' : ''}。\n匯入會「取代」這支手機目前的資料${cur ? '（' + cur + ' 天的紀錄）' : ''}，確定要匯入嗎？`)) return;
      S.profile = d.profile; S.log = d.log; S.custom = d.custom; S.recipes = d.recipes; S.recent = d.recent; S.weight = d.weight; S.date = today();
      save('SG_PROFILE', S.profile); saveLog(); save('SG_CUSTOM', S.custom); save('SG_RECIPES', S.recipes); save('SG_RECENT', S.recent); save('SG_WEIGHT', S.weight); rebuildFoods(); render(); toast('已匯入備份'); } catch (e) { toast('這個檔案不是食光的備份'); } };
    fr.readAsText(file);
  }

  // 過了午夜回到 app 時，自動跳到新的一天
  let lastToday = today();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== lastToday) { if (S.date === lastToday) S.date = today(); lastToday = today(); render(); } });

  // 請瀏覽器不要自動清掉紀錄（Safari 對很久沒開的網站會清本機資料）
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  render();
})();
