// 搜尋＋「聽懂一句話」解析器（純本機，不連網）
(function () {
  let foods = [];
  let nameMap = new Map();   // 多字名稱 → 食物
  let singleMap = new Map(); // 單字別名 → 食物
  let maxLen = 2;

  function setFoods(list) {
    foods = list;
    nameMap = new Map(); singleMap = new Map(); maxLen = 2;
    const put = (k, f, primary) => {
      k = k.toLowerCase();
      const m = k.length === 1 ? singleMap : nameMap;
      if (primary || !m.has(k)) m.set(k, f);
      if (k.length > maxLen) maxLen = k.length;
    };
    for (const f of list) for (const a of f.alias) put(a, f, false);
    for (const f of list) put(f.name, f, true);
  }

  // ---------- 搜尋：打「蝦」就找得到「蝦仁蛋炒飯」 ----------
  function search(q, limit = 40) {
    q = (q || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return [];
    const qs = [...q];
    const out = [];
    for (const f of foods) {
      let best = 0;
      const names = [f.name, ...f.alias];
      for (let i = 0; i < names.length; i++) {
        const n = names[i].toLowerCase();
        const base = i === 0 ? 0 : -8; // 別名稍微排後面
        let s = 0;
        const idx = n.indexOf(q);
        if (n === q) s = 120;
        else if (idx === 0) s = 100;
        else if (idx > 0) s = 85 - Math.min(idx, 10);
        else {
          // 每個字照順序都出現（蝦炒飯 → 蝦仁蛋炒飯）
          let pos = 0, ok = true;
          for (const ch of qs) { const j = n.indexOf(ch, pos); if (j < 0) { ok = false; break; } pos = j + 1; }
          if (ok) s = 55;
          else if (qs.length > 1 && qs.every(ch => n.includes(ch))) s = 35; // 字都有但順序不同
        }
        if (s && s + base > best) best = s + base;
      }
      if (!best && f.cat && f.cat.includes(q)) best = 20;
      if (best) out.push({ f, s: best });
    }
    out.sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length);
    return out.slice(0, limit).map(o => o.f);
  }

  // ---------- 中文數字 ----------
  const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  function cnNum(str) {
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
    if (str === '半') return 0.5;
    let total = 0, cur = 0, lastUnit = 1, half = 0;
    for (const ch of str) {
      if (ch in CN) cur = CN[ch];
      else if (ch === '十') { total += (cur || 1) * 10; cur = 0; lastUnit = 10; }
      else if (ch === '百') { total += (cur || 1) * 100; cur = 0; lastUnit = 100; }
      else if (ch === '千') { total += (cur || 1) * 1000; cur = 0; lastUnit = 1000; }
      else if (ch === '半') half = 0.5;
    }
    // 「三百五」＝350、「一千二」＝1200
    if (cur && lastUnit >= 100 && !/[零〇]/.test(str)) total += cur * lastUnit / 10;
    else total += cur;
    return total + half;
  }

  const UNITS = ['大碗', '小碗', '大杯', '中杯', '小杯', '大份', '小份', '大盤', '小盤', '公克', '公斤', '毫升', '湯匙', '茶匙', '大匙', '小匙', 'c\\.c\\.', 'kg', 'ml', 'cc', 'g', '克',
    '碗', '杯', '顆', '個', '粒', '片', '塊', '條', '根', '隻', '支', '份', '盤', '匙', '瓶', '罐', '盒', '包', '把', '球', '貫', '捲', '串', '朵', '尾', '口', '客', '碟', '套', '鍋'];
  const QTY_RE = new RegExp('(\\d+(?:\\.\\d+)?|[零〇一二兩三四五六七八九十百千半]+)(' + UNITS.join('|') + ')?(半)?', 'g');
  const GRAM_UNITS = { 公克: 1, 克: 1, g: 1, 公斤: 1000, kg: 1000, 毫升: 1, ml: 1, cc: 1, 'c.c.': 1 };
  const SYN = [['個', '顆', '粒'], ['條', '根', '支', '隻', '尾'], ['片', '塊'], ['份', '盤', '客', '套'], ['瓶', '罐'], ['盒', '包'], ['匙', '湯匙', '大匙']];
  const GENERIC = { 匙: 15, 湯匙: 15, 大匙: 15, 茶匙: 5, 小匙: 5, 碗: 200, 杯: 300, 盤: 300, 口: 15, 把: 20 };

  // 數量＋單位 → 克數
  const SIZE = { 大: 1.3, 中: 1, 小: 0.7 };
  function toGrams(food, n, unit) {
    // 「小碗」「大杯」：資料庫有這個單位就照用，沒有就用碗／杯再乘大小
    if (unit && unit.length === 2 && unit[0] in SIZE && !food.units.some(x => x.n === unit)) {
      const r = toGrams(food, n, unit[1]); return { g: r.g * SIZE[unit[0]], est: r.est };
    }
    if (unit && unit in GRAM_UNITS) return { g: n * GRAM_UNITS[unit], est: false };
    const def = food.units[0];
    if (!unit) return { g: n * def.g, est: false, unit: def.n };
    let u = food.units.find(x => x.n === unit);
    if (u) return { g: n * u.g, est: false };
    const grp = SYN.find(g => g.includes(unit));
    if (grp) { u = food.units.find(x => grp.includes(x.n)); if (u) return { g: n * u.g, est: false }; }
    if (unit in GENERIC) return { g: n * GENERIC[unit], est: true };
    return { g: n * def.g, est: true };
  }

  const MEALS = [
    [/下午茶|點心|宵夜|消夜|零食|小食|下午/g, 'snack'],
    [/早餐|早上|早飯|早點/g, 'breakfast'],
    [/午餐|中餐|中午|午飯/g, 'lunch'],
    [/晚餐|晚上|晚飯|昨晚/g, 'dinner'],
  ];
  function mealByHour(h) {
    if (h >= 4 && h < 10.5) return 'breakfast';
    if (h >= 10.5 && h < 14.5) return 'lunch';
    if (h >= 17 && h < 21) return 'dinner';
    return 'snack';
  }

  // 甜度：手搖飲的糖大約佔碳水的 85%，照甜度扣
  const SUGAR = [['一分糖', 0.1], ['二分糖', 0.2], ['三分糖', 0.3], ['全糖', 1], ['正常糖', 1], ['少糖', 0.7], ['半糖', 0.5], ['微糖', 0.3], ['無糖', 0], ['不加糖', 0]];
  const ICE = ['正常冰', '少冰', '微冰', '去冰', '常溫', '溫的', '熱的', '冰的'];
  const STOP = [...SUGAR.map(x => x[0]), ...ICE, '我今天', '今天', '剛剛', '剛才', '昨天', '昨日', '前天', '吃了', '喝了', '吃掉', '還有', '然後', '以及', '加上', '另外', '大概', '大約', '左右', '差不多', '一些', '一點', '搭配', '外加', '幫我', '記錄', '紀錄', '總共', '這樣', '而已', '時候', '那個', '這個', '再來', '接著', '之後', '份量', '重量',
    '我', '吃', '喝', '了', '和', '跟', '與', '加', '再', '又', '約', '的', '是', '有', '配', '記', '共', '就', '也', '都', '在', '嗯', '啊', '喔', '呃', '當', '作', '為', '用', '各', '點', '個'];
  const M = '█'; // 已辨識的位置用這個字遮起來

  function parse(text, hour) {
    const s = (text || '').toLowerCase().replace(/\s+/g, '').replace(/颗/g, '顆').replace(/个/g, '個')
      .replace(/(^|[^\d零〇一二兩三四五六七八九十百千半.])([大中小](?:碗|杯|份|盤))/g, '$1一$2'); // 「滷肉飯小碗」＝一小碗
    const n = s.length;
    const t = [...s]; // 遮罩用（這裡的食物名不含補充字元，直接用索引）
    const tokens = [];
    const mask = (a, b) => { for (let i = a; i < b; i++) t[i] = M; };

    // 1. 多字食物名：最長的先對
    for (let i = 0; i < n;) {
      let hit = null;
      for (let L = Math.min(maxLen, n - i); L >= 2; L--) {
        const f = nameMap.get(s.substr(i, L));
        if (f) { hit = { type: 'food', start: i, end: i + L, food: f, said: s.substr(i, L) }; break; }
      }
      if (hit) { tokens.push(hit); mask(hit.start, hit.end); i = hit.end; } else i++;
    }
    // 2. 餐別
    for (const [re, meal] of MEALS) {
      re.lastIndex = 0; let m;
      const cur = t.join('');
      while ((m = re.exec(cur))) { tokens.push({ type: 'meal', start: m.index, end: m.index + m[0].length, meal }); mask(m.index, m.index + m[0].length); }
    }
    // 2.5 甜度冰塊（半糖、少冰…）先遮起來，「一杯半糖」的「半」才不會被當成半杯
    for (const w of [...SUGAR.map(x => x[0]), ...ICE]) { let j = t.join('').indexOf(w); while (j >= 0) { mask(j, j + w.length); j = t.join('').indexOf(w, j + w.length); } }
    // 3. 單字食物（蛋、飯…）：後面要是結尾、數量或連接詞才算
    for (let i = 0; i < n; i++) {
      if (t[i] === M) continue;
      const f = singleMap.get(t[i]);
      if (!f) continue;
      const rest = t.slice(i + 1).join('');
      if (/^($|[█，,、。．.；;和跟與加及還然再又大約\d零一二兩三四五六七八九十半])/.test(rest)) {
        tokens.push({ type: 'food', start: i, end: i + 1, food: f, said: t[i] }); t[i] = M;
      }
    }
    // 4. 數量
    {
      const cur = t.join(''); QTY_RE.lastIndex = 0; let m;
      while ((m = QTY_RE.exec(cur))) {
        const end = m.index + m[0].length;
        if (!m[2] && cur[end] !== M) continue; // 沒單位的數字，後面要緊接食物才算
        if (!m[2] && !/^\d/.test(m[1]) && m[1].length > 1 && !/^[一二兩三四五六七八九十半]+$/.test(m[1])) continue;
        let num = cnNum(m[1]); if (m[3]) num += 0.5;
        if (!(num > 0)) continue;
        tokens.push({ type: 'qty', start: m.index, end, num, unit: m[2] || '', gram: !!(m[2] && m[2] in GRAM_UNITS) });
      }
      for (const q of tokens) if (q.type === 'qty') mask(q.start, q.end);
    }
    tokens.sort((a, b) => a.start - b.start);

    // 5. 數量配給哪個食物
    const foodsT = tokens.filter(x => x.type === 'food');
    const qtys = tokens.filter(x => x.type === 'qty');
    const SI_RE = new RegExp([...SUGAR.map(x => x[0]), ...ICE].join('|'), 'g');
    const gap = (a, b) => s.slice(a, b).replace(SI_RE, '');
    const FL_PREV = /^(大概|大約|約|差不多|有|吃了|喝了|吃|喝|是|共|總共|[，,、])*$/;
    const FL_NEXT = /^(的|左右的?)?$/;
    for (const q of qtys) {
      const prev = [...foodsT].reverse().find(f => f.end <= q.start);
      const next = foodsT.find(f => f.start >= q.end);
      const fp = !!prev && FL_PREV.test(gap(prev.end, q.start));
      const fn = !!next && FL_NEXT.test(gap(q.end, next.start));
      let target = null, side = 'post';
      if (fn && !fp) { target = next; side = 'pre'; }
      else if (fp && !fn) target = prev;
      else if (fp && fn) {
        const after = qtys.find(x => x.start >= next.end);
        const nextHasPost = after && FL_PREV.test(gap(next.end, after.start)) && !foodsT.some(f => f.start >= next.end && f.end <= after.start);
        if (nextHasPost) target = prev;
        else if (prev.pre || prev.post) { target = next; side = 'pre'; }
        else if (q.gram) target = prev;
        else { target = next; side = 'pre'; }
      } else if (prev && !prev.post) target = prev;
      else if (next && !next.pre) { target = next; side = 'pre'; }
      if (target) { const o = target[side];
        if (!o) target[side] = q;
        else if (q.gram && !o.gram) target[side] = q;
        else if (q.unit.length === 2 && q.unit[0] in SIZE && o.unit === q.unit[1]) target[side] = { ...q, num: o.num }; // 「一杯大杯拿鐵」→ 1 大杯
      }
    }

    // 6. 餐別：食物前面最近的那個餐別；整句只講一次就全部用它；都沒講看現在幾點
    const mealsT = tokens.filter(x => x.type === 'meal');
    const fallback = mealsT.length ? mealsT[0].meal : mealByHour(hour == null ? new Date().getHours() + new Date().getMinutes() / 60 : hour);
    const items = foodsT.map(ft => {
      const qs = [ft.pre, ft.post].filter(Boolean);
      const q = qs.find(x => x.gram) || qs[0];
      const before = [...mealsT].reverse().find(m => m.end <= ft.start);
      const meal = before ? before.meal : fallback;
      let grams, label, est = false;
      if (q) {
        const r = toGrams(ft.food, q.num, q.unit);
        grams = r.g; est = r.est;
        label = q.gram ? Math.round(grams) + ' 克' : fmt(q.num) + ' ' + (q.unit || r.unit);
      } else {
        const d = ft.food.units[0];
        grams = d.g; est = true; label = '1 ' + d.n + '（預設份量）';
      }
      // 甜度：先看食物後面（珍奶半糖），沒有再看前面（半糖珍奶）
      let sugar = null;
      if (ft.food.cat === '飲料' && ft.food.c > 2) {
        const i = foodsT.indexOf(ft), nx = foodsT[i + 1], pv = foodsT[i - 1];
        const find = seg => { const h = SUGAR.find(x => seg.includes(x[0])); return h ? { n: h[0], k: h[1] } : null; };
        sugar = find(s.slice(ft.end, nx ? nx.start : n)) || find(s.slice(pv ? pv.end : 0, ft.start));
      }
      return { food: ft.food, grams: Math.round(grams * 10) / 10, label, meal, est, said: ft.said, sugar };
    });
    const dayOffset = /前天/.test(s) ? -2 : /昨天|昨晚|昨日/.test(s) ? -1 : 0;

    // 7. 沒認出來的字
    let rest = t.join('');
    for (const w of STOP) rest = rest.split(w).join(M);
    const unknown = rest.split(/[█，,、。．.；;!！?？:：~\-\d]+/).filter(x => x.length >= 2);
    return { items, unknown, mealSaid: mealsT.length > 0, dayOffset };
  }

  // 甜度版本的飲料：id 用「原本id@半糖」，之後改份量也找得回來
  function sugarVariant(food, n) {
    const h = SUGAR.find(x => x[0] === n); if (!h || h[1] === 1) return food;
    const cut = food.c * 0.85 * (1 - h[1]);
    return { ...food, id: food.id + '@' + n, name: food.name + '（' + n + '）', c: Math.round((food.c - cut) * 10) / 10, kcal: Math.round(food.kcal - cut * 4), alias: [] };
  }

  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  globalThis.NL = { setFoods, search, parse, cnNum, toGrams, mealByHour, sugarVariant };
})();
