'use strict';
// ===== נתונים =====
const ITEMS = RAW.map((r, i) => ({ id: r[0] + '|' + r[2], en: r[0], he: r[1], cat: r[2], pos: r[3], lvl: r[4], s: r[5], sh: r[6], note: r[7] || null, d: r[8] || null, i }));
if (typeof S2 !== 'undefined') ITEMS.forEach(w => { if (S2[w.id]) w.s2 = { s: S2[w.id][0], sh: S2[w.id][1] }; });
const CAT_KEYS = Object.keys(CATS);
const INT = [1, 10, 60, 240, 600, 1440, 2880, 4320]; // דקות עד החזרה הבאה, לפי תיבה
const CAP = { meaning: 2, match: 2, category: 3, reverse: 3, sentence: 4, type: 7, typeSentence: 7 }; // תרגיל קל לא מעלה מעבר לתיבה הזו
const DROP = { type: 1, typeSentence: 1, match: 1 }; // כמה תיבות יורדות בטעות (ברירת מחדל 2)
const MASTER = 5;
const PLAN_DAYS = 3;
const KEY = 'amirnet-milim-v1';
// מילים עם כמה משמעויות לא משמשות כמסיחים, כי הן יכולות להתאים לכמה משפטים
const AMBIG = new Set(['as', 'for', 'since', 'while', 'still', 'once', 'so', 'yet', 'like', 'that', 'through', 'even', 'apart from', 'besides', 'also', 'too', 'as well',
  'in fact', 'actually', 'indeed', 'especially', 'mainly', 'overall', 'undoubtedly', 'essentially', 'primarily', 'chiefly', 'notably', 'above all', 'ultimately', 'after all', 'otherwise']);
// מילים שאפשר להחליף זו בזו באותו משפט: מתקבלות בכתיבה, ולא מופיעות יחד כמסיחים או בהתאמה
const SYN_GROUPS = [
  ['although', 'even though', 'though'], ['despite', 'in spite of', 'notwithstanding'],
  ['nevertheless', 'nonetheless', 'even so', 'all the same', 'still', 'yet', 'however'],
  ['whereas', 'while'], ['in contrast', 'on the other hand', 'by contrast'], ['yet', 'but'], ['although', 'despite the fact that'], ['as if', 'as though'],
  ['moreover', 'furthermore', 'in addition', 'additionally', "what's more", 'besides'], ['also', 'too', 'as well'],
  ['in addition to', 'as well as', 'along with', 'coupled with'],
  ['because', 'since', 'as', 'for', 'seeing that', 'inasmuch as', 'given that'],
  ['because of', 'due to', 'owing to', 'on account of', 'as a result of'],
  ['therefore', 'thus', 'consequently', 'as a result', 'accordingly', 'for this reason', 'so'],
  ['in order to', 'so as to'], ['so that', 'in order that'],
  ['provided that', 'providing', 'as long as', 'on condition that', 'only if'],
  ['for example', 'for instance', 'e.g.'], ['that is', 'i.e.', 'in other words', 'namely'], ['such as', 'like', 'including'],
  ['in particular', 'especially', 'notably', 'specifically'], ['mainly', 'chiefly', 'primarily', 'essentially', 'above all'],
  ['in conclusion', 'to sum up', 'in short', 'in brief', 'overall'], ['in fact', 'actually', 'indeed'],
  ['eventually', 'ultimately'], ['similarly', 'likewise', 'in the same way', 'equally', 'correspondingly'], ['similar to', 'like', 'compared to'],
  ['except', 'except for', 'apart from', 'aside from', 'other than', 'besides'], ['instead of', 'rather than'],
  ['hardly', 'barely', 'scarcely'], ['rarely', 'seldom'], ['almost', 'nearly', 'virtually'], ['merely', 'solely'],
  ['regarding', 'concerning', 'as for', 'with regard to', 'in terms of'], ['through', 'via', 'by means of'],
  ['meanwhile', 'in the meantime', 'simultaneously'], ['afterwards', 'subsequently', 'thereafter'], ['previously', 'formerly'], ['prior to', 'before'],
  ['as soon as', 'once', 'when'], ['who', 'that', 'whom'], ['which', 'that'], ['whereby', 'in which'],
];
const SYN = {};
SYN_GROUPS.forEach(g => g.forEach(e => { SYN[e] = SYN[e] || new Set(); g.forEach(x => SYN[e].add(x)); }));
const syn = (a, b) => a === b || !!(SYN[a] && SYN[a].has(b));
const heParts = w => new Set(w.he.split(/[,;]/).map(x => x.replace(/\(.*?\)/g, '').replace(/\.\.\./g, '').trim()).filter(Boolean));
const sameMeaning = (a, b) => syn(a.en, b.en) || [...heParts(a)].some(x => heParts(b).has(x));

// יחידות: לפי רמה, ובתוך כל רמה לפי קבוצה, עד ~8 מילים ביחידה
const UNITS = [];
for (const lvl of [1, 2, 3]) {
  let cur = null;
  const start = UNITS.length;
  for (const c of CAT_KEYS) {
    let its = ITEMS.filter(x => x.lvl === lvl && x.cat === c);
    if (!its.length) continue;
    const chunks = [];
    const n = Math.ceil(its.length / 8);
    const size = Math.ceil(its.length / n);
    for (let i = 0; i < its.length; i += size) chunks.push(its.slice(i, i + size));
    for (const ch of chunks) {
      // קבוצה חדשה פותחת יחידה חדשה, חוץ משארית קטנה (1-2 מילים) של הקבוצה הקודמת
      if (cur && cur.items.length >= 3) { UNITS.push(cur); cur = null; }
      if (!cur) cur = { lvl, cats: [], items: [] };
      if (!cur.cats.includes(c)) cur.cats.push(c);
      cur.items.push(...ch);
      if (cur.items.length >= 5) { UNITS.push(cur); cur = null; }
    }
  }
  if (cur) {
    const last = UNITS[UNITS.length - 1];
    if (UNITS.length > start && cur.items.length < 3) { cur.cats.forEach(c => { if (!last.cats.includes(c)) last.cats.push(c); }); last.items.push(...cur.items); }
    else UNITS.push(cur);
  }
}
const LEVEL_NAMES = { 1: 'שלב 1 · בסיס', 2: 'שלב 2 · בינוני', 3: 'שלב 3 · מתקדם' };

// ===== שמירה וחשבון =====
// כניסה עם Google בלבד (Supabase Auth). ההתקדמות נשמרת בדפדפן (עותק מהיר) ובענן; הגרסה עם savedAt החדש יותר מנצחת.
const sb = supabase.createClient(CLOUD.url, CLOUD.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
const BYID = Object.fromEntries(ITEMS.map(w => [w.id, w]));
let ME = null, booting = true;
const userKey = () => KEY + ':' + ME.id;
function blank() { return { start: dayKey(), xp: 0, streak: 0, lastDay: null, days: {}, w: {}, sound: true, savedAt: 0 }; }
// מזהה מילה = מילה|קבוצה. כשמילה עוברת קבוצה (למשל ויתור שנפרד מניגוד), ההתקדמות עוברת איתה
function migrate(s) {
  for (const id of Object.keys(s.w)) {
    if (BYID[id]) continue;
    const en = id.split('|')[0];
    const it = ITEMS.find(x => x.en === en && !s.w[x.id] && (x.cat === 'con' || x.cat === 'cnc'));
    if (it) s.w[it.id] = s.w[id];
    delete s.w[id];
  }
  return s;
}
function parse(s) { return s && s.w ? migrate(Object.assign(blank(), s)) : null; }
// התקדמות מלפני החשבונות (KEY בלי משתמש) עוברת לחשבון הראשון שנכנס מהדפדפן הזה
function readLocal() {
  try { const s = parse(JSON.parse(localStorage.getItem(userKey())) || JSON.parse(localStorage.getItem(KEY))); if (s) return s; } catch (e) {}
  return blank();
}
function save() {
  S.savedAt = Date.now();
  if (!ME) return;
  try { localStorage.setItem(userKey(), JSON.stringify(S)); } catch (e) {}
  pushSoon();
}
async function rpc(fn, body) {
  const { data, error } = await sb.rpc(fn, body || {});
  if (error) throw error;
  return data;
}
let pushT = null, sync = 'ok';
function setSync(v) { sync = v; const el = document.getElementById('sync'); if (el) el.textContent = syncIcon(); }
function syncIcon() { return sync === 'ok' ? '☁️' : sync === 'wait' ? '⏳' : '⚠️'; }
function pushSoon(ms = 4000) { clearTimeout(pushT); setSync('wait'); pushT = setTimeout(push, ms); }
async function push() {
  if (!ME) return;
  clearTimeout(pushT);
  try {
    const r = await rpc('amirnet_save', { p_data: S });
    if (r.error === 'no_auth') return logout(true);
    setSync(r.ok ? 'ok' : 'err');
  } catch (e) { setSync('err'); }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (sync !== 'ok') push(); }
  else if (view !== 'lesson') refreshFromCloud();
});
let S = blank();

// ===== עזרים =====
function dayKey(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5); }
const now = () => Date.now();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const disp = en => en.replace(/\.\.\./g, ' … ').replace(/\s+/g, ' ').trim();
const ws = w => S.w[w.id];
const box = w => (S.w[w.id] ? S.w[w.id].b : 0);
function today() { const k = dayKey(); if (!S.days[k]) S.days[k] = { xp: 0, fresh: 0, ans: 0, ok: 0 }; return S.days[k]; }
function introduced() { return ITEMS.filter(w => S.w[w.id]); }
function near(a, b) { return (NEAR[a] || []).includes(b) || (NEAR[b] || []).includes(a); }
function streakNow() { if (!S.lastDay) return 0; return daysBetween(S.lastDay, dayKey()) <= 1 ? S.streak : 0; }

function fillSentence(s, en) {
  const ps = en.includes('...') ? en.split('...').map(x => x.trim()) : [en];
  let i = 0;
  return esc(s).replace(/___/g, (m, off, all) => { let t = ps[i++] || ''; if (off === 0 || /[.!?]\s+$/.test(all.slice(0, off))) t = cap(t); return '<b class="hl">' + esc(t) + '</b>'; });
}
function blankSentence(s) { return esc(s).replace(/___/g, '<span class="blank">______</span>'); }
function chip(c) { const k = CATS[c]; return `<span class="chip" style="--c:${k.color}">${k.icon} ${k.he}</span>`; }

// ===== צלילים ודיבור =====
let AC;
function beep(ok) {
  if (S.sound) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime;
      const notes = ok ? [[660, 0], [990, 0.09]] : [[200, 0], [160, 0.13]];
      notes.forEach(([f, d]) => {
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = ok ? 'sine' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
        o.connect(g).connect(AC.destination); o.start(t + d); o.stop(t + d + 0.22);
      });
    } catch (e) {}
  }
  if (!ok && navigator.vibrate) navigator.vibrate(120);
}
function speak(t, force) {
  if ((!S.sound && !force) || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/\.\.\./g, ', ')); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) {}
}
function say(i) { speak(ITEMS[i].en, true); }

// ===== חזרה מרווחת =====
function introduce(w) { S.w[w.id] = { b: 0, due: now(), ok: 0, bad: 0, intro: now() }; today().fresh++; save(); }
function typeFor(b) {
  const opts = b <= 0 ? ['meaning'] : b === 1 ? ['meaning', 'reverse', 'category'] : b === 2 ? ['reverse', 'category', 'sentence']
    : b === 3 ? ['sentence', 'sentence', 'typeSentence'] : b === 4 ? ['type', 'typeSentence', 'sentence'] : ['type', 'typeSentence', 'typeSentence', 'sentence'];
  // תרגיל שהתקרה שלו כבר הושגה לא מקדם את המילה, אז בוחרים קשה ממנו
  const up = opts.filter(t => CAP[t] > b);
  return pick(up.length ? up : opts);
}
function easier(t) { return { type: 'sentence', typeSentence: 'sentence', sentence: 'reverse', reverse: 'meaning', category: 'meaning' }[t] || 'meaning'; }
function grade(w, type, ok) {
  const s = ws(w), t = now(), d = today();
  d.ans++;
  if (ok) {
    s.ok++; d.ok++; s.run = (s.run || 0) + 1;
    if (s.b < CAP[type]) s.b++;
    s.due = t + INT[s.b] * 60000;
    S.xp += 10; d.xp += 10; if (L) { L.xp += 10; L.ok++; }
  } else {
    s.bad++; s.run = 0;
    s.b = Math.max(0, s.b - (DROP[type] || 2));
    s.due = t + 60000;
    if (L) L.bad++;
  }
  s.last = t;
  save();
}

// מילה חלשה = טעית בה, ועוד לא ענית עליה נכון פעמיים ברצף מאז
function isWeak(w) { const s = S.w[w.id]; return !!s && s.bad > 0 && (s.run !== undefined ? s.run < 2 : s.b < 3); }

// ===== מסיחים =====
function farPool(w) { return ITEMS.filter(x => x.cat !== w.cat && !near(x.cat, w.cat) && x.en !== w.en && !sameMeaning(x, w)); }
function meaningDistractors(w) {
  const out = [];
  for (const x of shuffle(farPool(w))) { if (out.length >= 3) break; if (!sameMeaning(x, w) && !out.includes(x.he)) out.push(x.he); }
  return out;
}
function reverseDistractors(w) {
  const pair = w.en.includes('...');
  const out = [];
  for (const x of shuffle(farPool(w))) { if (out.length >= 3) break; if (x.en.includes('...') !== pair && Math.random() < 0.8) continue; if (!out.includes(x.en)) out.push(x.en); }
  for (const x of shuffle(farPool(w))) { if (out.length >= 3) break; if (!out.includes(x.en)) out.push(x.en); }
  return out;
}
function sentenceOptions(w) {
  if (w.d) return shuffle([w.en, ...w.d.slice(0, 3)]);
  const pool = farPool(w).filter(x => !syn(x.en, w.en) && x.cat !== 'rel' && x.cat !== 'deg' && !x.en.includes('...') && !AMBIG.has(x.en));
  const same = shuffle(pool.filter(x => x.pos === w.pos)), other = shuffle(pool.filter(x => x.pos !== w.pos));
  const out = [];
  for (const x of [...same, ...other]) { if (out.length >= 3) break; if (!out.includes(x.en)) out.push(x.en); }
  return shuffle([w.en, ...out]);
}
const norm = s => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/…/g, ' ').replace(/\.{3}/g, ' ').replace(/\./g, '').replace(/[,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function checkTyped(w, input) {
  const a = norm(input), t = norm(w.en);
  if (!a) return null;
  if (a === t) return { ok: true };
  const other = ITEMS.find(x => norm(x.en) === a);
  if (other) return syn(other.en, w.en) ? { ok: true, alt: other } : { ok: false };
  if (t.length >= 5 && lev(a, t) <= (t.length >= 9 ? 2 : 1)) return { ok: true, typo: true };
  return { ok: false };
}

// ===== בניית שיעור =====
function unitInfo(u) {
  const its = UNITS[u].items;
  const intro = its.filter(w => S.w[w.id]).length;
  const score = its.reduce((a, w) => a + Math.min(MASTER, box(w)), 0) / (its.length * MASTER);
  return { intro, total: its.length, score, done: its.every(w => box(w) >= MASTER) };
}
function unlocked(u) { return u === 0 || UNITS[u - 1].items.every(w => S.w[w.id]); }
function currentUnit() { for (let u = 0; u < UNITS.length; u++) if (UNITS[u].items.some(w => !S.w[w.id])) return u; return -1; }
function matchSet(list) {
  const out = [], he = new Set(), en = new Set();
  for (const w of list) { if (out.length >= 5) break; if (he.has(w.he) || en.has(w.en) || out.some(x => sameMeaning(x, w))) continue; out.push(w); he.add(w.he); en.add(w.en); }
  return out;
}
// only = לחיצה על יחידה מסוימת: רק המילים של היחידה. בלי only («המשך ללמוד») נכנסות גם חזרות מכל היחידות
function buildLearn(u, only) {
  const unit = UNITS[u], t = now();
  const fresh = unit.items.filter(w => !S.w[w.id]).slice(0, 5);
  const used = new Set(fresh.map(w => w.id));
  const pool = only ? unit.items.filter(w => S.w[w.id]) : introduced();
  const rev = shuffle(pool.filter(w => ws(w).due <= t)).sort((a, b) => box(a) - box(b)).slice(0, fresh.length ? 6 : 10);
  rev.forEach(w => used.add(w.id));
  const want = fresh.length ? 5 : 10;
  const extra = [...unit.items, ...(only ? [] : shuffle(introduced()))].filter(w => S.w[w.id] && !used.has(w.id)).sort((a, b) => box(a) - box(b));
  for (const w of extra) { if (rev.length >= want) break; if (!used.has(w.id)) { rev.push(w); used.add(w.id); } }
  const revQ = rev.map(w => ({ k: 'q', w }));
  const q = [];
  fresh.forEach(w => { q.push({ k: 'intro', w }); q.push({ k: 'q', w, type: 'meaning' }); if (revQ.length) q.push(revQ.shift()); });
  q.push(...revQ);
  shuffle(fresh).forEach(w => q.push({ k: 'q', w, type: pick(['reverse', 'category']) }));
  const ms = matchSet(shuffle([...fresh, ...rev]));
  if (ms.length >= 4) q.push({ k: 'match', ws: ms });
  return q;
}
function buildReview() {
  const t = now(), intro = introduced();
  let list = shuffle(intro.filter(w => ws(w).due <= t)).sort((a, b) => box(a) - box(b)).slice(0, 12);
  if (list.length < 8) {
    const more = shuffle(intro).filter(w => !list.includes(w)).sort((a, b) => box(a) - box(b));
    list = list.concat(more.slice(0, 8 - list.length));
  }
  const q = shuffle(list).map(w => ({ k: 'q', w }));
  const ms = matchSet(shuffle(list));
  if (ms.length >= 4) q.splice(Math.min(5, q.length), 0, { k: 'match', ws: ms });
  return q;
}
// כל מילה חלשה מופיעה פעמיים, כך ששיעור שעבר בהצלחה מוציא אותה מהרשימה
function buildWeak() {
  const list = shuffle(introduced().filter(isWeak)).sort((a, b) => (ws(b).bad / (ws(b).ok + 1)) - (ws(a).bad / (ws(a).ok + 1))).slice(0, 8);
  return [...shuffle(list), ...shuffle(list)].map(w => ({ k: 'q', w }));
}

// ===== מצב השיעור =====
let view = 'home', L = null, dictQ = '', dictOpen = -1;
function startLesson(q, title) {
  if (!q.length) { toast('אין כרגע מה לתרגל כאן'); return; }
  L = { q, done: 0, ok: 0, bad: 0, xp: 0, fresh: 0, retries: {}, title, cur: null, conf: [] };
  view = 'lesson';
  prepare();
  render();
}
function prepare() {
  const it = L.q[0];
  if (!it) { L.cur = null; return; }
  if (it.k === 'intro') {
    if (!S.w[it.w.id]) { introduce(it.w); L.fresh++; }
    L.cur = { k: 'intro' };
    setTimeout(() => speak(it.w.en), 250);
    return;
  }
  if (it.k === 'match') {
    L.cur = { k: 'match', left: shuffle(it.ws), right: shuffle(it.ws), sel: null, done: new Set(), wrong: new Set(), flash: [] };
    return;
  }
  const w = it.w;
  if (!S.w[w.id]) introduce(w);
  const type = it.type || typeFor(box(w));
  const c = { k: 'q', type, ans: null };
  if (type === 'meaning') { c.opts = shuffle([w.he, ...meaningDistractors(w)]); c.correct = w.he; }
  else if (type === 'reverse') { c.opts = shuffle([w.en, ...reverseDistractors(w)]); c.correct = w.en; }
  else if (type === 'category') { const own = new Set(ITEMS.filter(x => x.en === w.en).map(x => x.cat)); c.opts = shuffle([w.cat, ...shuffle(CAT_KEYS.filter(k => !own.has(k))).slice(0, 3)]); c.correct = w.cat; }
  else if (type === 'sentence') { c.opts = sentenceOptions(w); c.correct = w.en; }
  if (type === 'sentence' || type === 'typeSentence') c.sent = w.s2 && (box(w) >= 3 ? Math.random() < 0.7 : Math.random() < 0.4) ? w.s2 : w;
  L.cur = c;
}
// מילה שכבר מכירים: קופצת לשלב המשפטים, ובודקים אותה מיד במשפט
function knowIt() {
  const it = L.q[0], s = S.w[it.w.id];
  s.b = Math.max(s.b, 3); s.due = now(); save();
  L.q = [it, { k: 'q', w: it.w, type: 'sentence' }, ...L.q.slice(1).filter(x => x.w !== it.w)];
  next();
}
// טעות בבחירה: זוכרים עם מה התבלבלת, ומציגים בסוף השיעור
function noteConfusion(w, c, chosen) {
  const other = c.type === 'meaning' ? ITEMS.find(x => x.he === chosen) : c.type === 'category' ? null : ITEMS.find(x => x.en === chosen);
  if (!other || other === w || L.conf.some(p => p[0] === w && p[1] === other)) return;
  L.conf.push([w, other]);
}
function answerOpt(i) {
  const c = L.cur;
  if (!c || c.ans) return;
  const w = L.q[0].w, ok = c.opts[i] === c.correct;
  c.ans = { i, ok };
  if (!ok) noteConfusion(w, c, c.opts[i]);
  grade(w, c.type, ok);
  beep(ok);
  if (ok) speak(w.en);
  render();
}
function checkType() {
  const c = L.cur, inp = document.getElementById('ty');
  if (!c || c.ans || !inp) return;
  const w = L.q[0].w, r = checkTyped(w, inp.value);
  if (!r) { inp.focus(); return; }
  c.ans = Object.assign({ typed: inp.value }, r);
  grade(w, c.type, r.ok);
  beep(r.ok);
  if (r.ok) speak(w.en);
  render();
}
function next() {
  const it = L.q.shift(), c = L.cur;
  L.done++;
  if (it && it.k === 'q' && c && c.ans && !c.ans.ok) {
    const n = L.retries[it.w.id] || 0;
    if (n < 2) { L.retries[it.w.id] = n + 1; L.q.push({ k: 'q', w: it.w, type: easier(c.type) }); }
  }
  if (!L.q.length) return finish();
  prepare();
  render();
}
function matchTap(side, idx) {
  const c = L.cur;
  if (!c || c.k !== 'match') return;
  const w = (side === 'l' ? c.left : c.right)[idx];
  if (c.done.has(w.id)) return;
  if (!c.sel || c.sel.side === side) { c.sel = { side, idx, w }; if (side === 'l') speak(w.en); render(); return; }
  if (c.sel.w.id === w.id) {
    c.done.add(w.id); c.sel = null; beep(true);
    if (c.done.size === c.left.length) {
      render();
      setTimeout(() => {
        const it = L.q[0];
        it.ws.forEach(x => grade(x, 'match', !c.wrong.has(x.id)));
        it.ws.filter(x => c.wrong.has(x.id)).forEach(x => L.q.push({ k: 'q', w: x, type: 'meaning' }));
        L.q.shift(); L.done++;
        if (!L.q.length) return finish();
        prepare(); render();
      }, 450);
      return;
    }
  } else {
    c.wrong.add(w.id); c.wrong.add(c.sel.w.id); beep(false);
    c.flash = [c.sel.w.id + c.sel.side, w.id + side];
    c.sel = null;
    setTimeout(() => { if (L && L.cur === c) { c.flash = []; render(); } }, 500);
  }
  render();
}
function finish() {
  const k = dayKey();
  if (S.lastDay !== k) { S.streak = (S.lastDay && daysBetween(S.lastDay, k) === 1) ? S.streak + 1 : 1; S.lastDay = k; }
  save();
  push();
  L.finished = true;
  beep(true);
  render();
}
function quitLesson() {
  if (L && !L.finished && L.done > 0 && !confirm('לצאת מהשיעור? מה שענית עד עכשיו כבר נשמר.')) return;
  L = null; view = 'home'; render();
}

// ===== מסכים =====
function topBar() {
  const mastered = ITEMS.filter(w => box(w) >= MASTER).length;
  return `<header class="top"><span class="stat" title="ימים ברצף">🔥 ${streakNow()}</span><span class="stat" title="נקודות">⭐ ${S.xp}</span><span class="stat" title="מילים שאתה שולט בהן">👑 ${mastered}/${ITEMS.length}</span><span id="sync" class="stat" title="שמירה בחשבון" onclick="go('settings')">${syncIcon()}</span></header>`;
}
function navBar() {
  const b = (v, ic, t) => `<button class="${view === v ? 'on' : ''}" onclick="go('${v}')"><span class="ic">${ic}</span>${t}</button>`;
  return `<nav class="nav">${b('home', '🏠', 'לימוד')}${b('sims', '📝', 'מבחנים')}${b('dict', '📖', 'מילון')}${b('settings', '⚙️', 'הגדרות')}</nav>`;
}
function go(v) { view = v; render(); window.scrollTo(0, 0); }

function renderHome() {
  const total = ITEMS.length, intro = introduced().length;
  const mastered = ITEMS.filter(w => box(w) >= MASTER).length;
  const known = ITEMS.filter(w => box(w) >= 3).length;
  const dayIdx = Math.max(1, daysBetween(S.start, dayKey()) + 1);
  const daysLeft = Math.max(1, PLAN_DAYS - dayIdx + 1);
  const td = today();
  const target = Math.max(1, Math.ceil((total - intro + td.fresh) / daysLeft));
  const dueN = introduced().filter(w => ws(w).due <= now()).length;
  const weakN = introduced().filter(isWeak).length;
  const cu = currentUnit();
  const dayLabel = dayIdx <= PLAN_DAYS ? `יום ${dayIdx} מתוך ${PLAN_DAYS}` : `יום ${dayIdx} (היעד היה ${PLAN_DAYS} ימים, ממשיכים עד שליטה מלאה)`;
  const pctFresh = Math.min(100, Math.round(td.fresh / target * 100));
  let h = topBar() + '<main>';
  h += `<section class="card plan">
    <div class="plan-h"><b>${dayLabel}</b><span>${td.fresh >= target && intro < total ? 'עמדת ביעד של היום 🎉' : ''}</span></div>
    <div class="lbl"><span>מילים חדשות היום</span><span>${td.fresh}/${target}</span></div>
    <div class="bar"><i style="width:${pctFresh}%"></i></div>
    <div class="lbl"><span>מכיר (שלב משפטים ומעלה)</span><span>${known}/${total}</span></div>
    <div class="bar"><i style="width:${known / total * 100}%;background:var(--b)"></i></div>
    <div class="lbl"><span>שולט (כותב לבד) 👑</span><span>${mastered}/${total}</span></div>
    <div class="bar"><i style="width:${mastered / total * 100}%;background:var(--y)"></i></div>
  </section>`;
  h += cu >= 0
    ? `<button class="btn big" onclick="startLesson(buildLearn(${cu}),'יחידה ${cu + 1}')">המשך ללמוד · יחידה ${cu + 1}</button>`
    : `<button class="btn big" onclick="startLesson(buildReview(),'חזרה')">הכרת את כל המילים! עכשיו חזרה עד שליטה</button>`;
  h += `<div class="row"><button class="btn blue" onclick="startLesson(buildReview(),'חזרה')">🔁 חזרה${dueN ? ` (${dueN})` : ''}</button><button class="btn ghost" onclick="startLesson(buildWeak(),'נקודות חלשות')">🎯 חלשות${weakN ? ` (${weakN})` : ''}</button></div>`;
  let lvl = 0;
  UNITS.forEach((un, u) => {
    if (un.lvl !== lvl) { lvl = un.lvl; h += `<h2 class="sec">${LEVEL_NAMES[lvl]}</h2>`; }
    const inf = unitInfo(u), lock = !unlocked(u), k = CATS[un.cats[0]];
    const names = un.cats.map(c => CATS[c].he).join(' · ');
    h += `<button class="unit ${lock ? 'locked' : ''} ${u === cu ? 'cur' : ''}" onclick="openUnit(${u})">
      <span class="uic" style="background:${lock ? '#e5e5e5' : k.color}">${lock ? '🔒' : inf.done ? '👑' : un.cats.map(c => CATS[c].icon).join('')}</span>
      <span class="ut"><span class="un">יחידה ${u + 1}${u === cu ? ' · אתה כאן' : ''}</span><span class="uh">${names}</span>
      <span class="bar sm"><i style="width:${Math.round(inf.score * 100)}%;background:${inf.done ? 'var(--y)' : 'var(--g)'}"></i></span>
      <span class="us">${inf.intro}/${inf.total} מילים · ${Math.round(inf.score * 100)}% שליטה</span></span></button>`;
  });
  h += `<p class="foot">טעית? המילה תחזור בקרוב. צדקת? היא תחזור בעוד יותר זמן. כל מילה עוברת מפירוש, לקבוצה, למשפט ובסוף לכתיבה.</p>`;
  return h + '</main>' + navBar();
}
function openUnit(u) {
  if (!unlocked(u)) { toast('קודם תכיר את כל המילים ביחידה הקודמת'); return; }
  startLesson(buildLearn(u, true), 'יחידה ' + (u + 1));
}

function renderLesson() {
  if (L.finished) {
    const acc = L.ok + L.bad ? Math.round(L.ok / (L.ok + L.bad) * 100) : 100;
    return `<main class="done"><div class="trophy">🎉</div><h2>השיעור הושלם!</h2>
      <div class="kpis"><div class="kpi y"><b>+${L.xp}</b><span>נקודות</span></div><div class="kpi g"><b>${acc}%</b><span>דיוק</span></div><div class="kpi b"><b>${L.fresh}</b><span>מילים חדשות</span></div></div>
      ${L.conf.length ? `<div class="card conf"><b>במה התבלבלת</b>${L.conf.slice(0, 4).map(([a, b]) => `<div class="cf"><span><b class="en">${esc(disp(a.en))}</b> = ${esc(a.he)}</span><span><b class="en">${esc(disp(b.en))}</b> = ${esc(b.he)}</span></div>`).join('')}</div>` : ''}
      <button class="btn big" onclick="quitLesson()">המשך</button></main>`;
  }
  const total = L.done + L.q.length, pct = Math.round(L.done / total * 100);
  const it = L.q[0], c = L.cur;
  let h = `<header class="lhead"><button class="x" onclick="quitLesson()" aria-label="יציאה">✕</button><div class="bar"><i style="width:${pct}%"></i></div></header><main class="lbody">`;
  let foot = '';
  if (c.k === 'intro') {
    const w = it.w;
    h += `<div class="prompt">מילה חדשה ✨</div>${chip(w.cat)}
      <div class="big"><span class="en">${esc(disp(w.en))}</span> <button class="spk" onclick="say(${w.i})" aria-label="השמע">🔊</button></div>
      <div class="mean">${esc(w.he)}</div>
      <div class="ex"><div class="en">${fillSentence(w.s, w.en)}</div><div class="exhe">${esc(w.sh)}</div></div>
      ${w.note ? `<div class="note">💡 ${esc(w.note)}</div>` : ''}
      <div class="tip">${CATS[w.cat].icon} <b>${CATS[w.cat].he}:</b> ${CATS[w.cat].tip}</div>`;
    foot = `<div class="lfoot row2"><button class="btn ghost" onclick="knowIt()">כבר מכיר ✓</button><button class="btn" onclick="next()">הבנתי, ממשיכים</button></div>`;
  } else if (c.k === 'match') {
    h += `<div class="prompt">התאם כל מילה לפירוש שלה</div><div class="match"><div class="col">`;
    c.right.forEach((w, i) => { h += matchBtn(c, w, 'r', i, esc(w.he), ''); });
    h += `</div><div class="col">`;
    c.left.forEach((w, i) => { h += matchBtn(c, w, 'l', i, esc(disp(w.en)), 'en'); });
    h += `</div></div>`;
  } else {
    const w = it.w;
    if (c.type === 'meaning') h += `<div class="prompt">מה הפירוש?</div><div class="big"><span class="en">${esc(disp(w.en))}</span> <button class="spk" onclick="say(${w.i})">🔊</button></div>`;
    if (c.type === 'reverse') h += `<div class="prompt">איך אומרים באנגלית?</div><div class="big he">${esc(w.he)}</div>`;
    if (c.type === 'category') h += `<div class="prompt">לאיזו קבוצה המילה שייכת?</div><div class="big"><span class="en">${esc(disp(w.en))}</span> <button class="spk" onclick="say(${w.i})">🔊</button></div>`;
    if (c.type === 'sentence') h += `<div class="prompt">איזו מילה משלימה את המשפט?</div><div class="sent en">${blankSentence(c.sent.s)}</div>`;
    if (c.type === 'type') h += `<div class="prompt">כתוב את המילה באנגלית</div><div class="big he">${esc(w.he)}</div>${chip(w.cat)}${pairHint(w)}`;
    if (c.type === 'typeSentence') h += `<div class="prompt">השלם את המשפט במילה הנכונה</div><div class="sent en">${blankSentence(c.sent.s)}</div>${chip(w.cat)}${pairHint(w)}`;
    if (c.opts) {
      const startCap = c.type === 'sentence' && /(^|[.!?]\s+)___/.test(c.sent.s);
      h += `<div class="opts ${c.type === 'meaning' || c.type === 'category' ? '' : 'ltr'}">`;
      c.opts.forEach((o, i) => {
        let label = c.type === 'category' ? `${CATS[o].icon} ${CATS[o].he}` : c.type === 'meaning' ? esc(o) : esc(startCap ? cap(disp(o)) : disp(o));
        let cls = '';
        if (c.ans) { if (o === c.correct) cls = 'right'; else if (i === c.ans.i) cls = 'wrong'; else cls = 'dim'; }
        h += `<button class="opt ${cls} ${c.type === 'meaning' || c.type === 'category' ? '' : 'en'}" onclick="answerOpt(${i})" ${c.ans ? 'disabled' : ''}>${label}</button>`;
      });
      h += `</div>`;
    } else {
      const v = c.ans ? esc(c.ans.typed) : '';
      h += `<input id="ty" class="ty en ${c.ans ? (c.ans.ok ? 'right' : 'wrong') : ''}" dir="ltr" lang="en" placeholder="Type in English" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${v}" ${c.ans ? 'disabled' : ''} onkeydown="if(event.key==='Enter')checkType()">`;
      if (!c.ans) foot = `<div class="lfoot"><button class="btn" onclick="checkType()">בדוק</button></div>`;
    }
    if (c.ans) foot = sheet(w, c);
  }
  return h + '</main>' + foot;
}
function pairHint(w) { return w.en.includes('...') ? '<div class="exhe">כתוב את שני החלקים ברצף, למשל: <span class="en">not only but also</span></div>' : ''; }
function matchBtn(c, w, side, i, label, cls) {
  let st = '';
  if (c.done.has(w.id)) st = 'done';
  else if (c.flash.includes(w.id + side)) st = 'wrong';
  else if (c.sel && c.sel.side === side && c.sel.idx === i) st = 'sel';
  return `<button class="mt ${cls} ${st}" onclick="matchTap('${side}',${i})" ${st === 'done' ? 'disabled' : ''}>${label}</button>`;
}
// «למה לא»: מסבירים למה התשובה שבחרת לא מתאימה — לפי הדקדוק כשהוא שונה, ואחרת לפי המשמעות
const POS_RULE = {
  c: 'מילת חיבור: אחריה בא משפט שלם, עם נושא ופועל',
  p: 'מילת יחס: אחריה בא שם עצם או ing, לא משפט שלם',
  a: 'מקשרת בין שני משפטים נפרדים, בדרך כלל עם פסיק אחריה',
  i: 'אחריה בא פועל בצורת המקור (to go)',
};
const POS_HERE = {
  c: 'כאן אחרי החסר בא משפט שלם',
  p: 'כאן אחרי החסר בא שם עצם',
  a: 'כאן החסר מחבר בין שני משפטים נפרדים',
  i: 'כאן אחרי החסר בא פועל',
};
function whyNot(w, c) {
  const chosen = c.opts[c.ans.i];
  if (c.type === 'category') return `<div class="sh-c">💡 למה לא ${esc(CATS[chosen].he)}? ${esc(CATS[chosen].tip)}. כאן: ${esc(CATS[w.cat].tip)}.</div>`;
  const x = c.type === 'meaning' ? ITEMS.find(y => y.he === chosen) : (ITEMS.find(y => y.en === chosen && y.pos !== w.pos) || ITEMS.find(y => y.en === chosen));
  if (c.type === 'meaning') return x ? `<div class="sh-c">💡 «${esc(chosen)}» זה הפירוש של <b class="en">${esc(disp(x.en))}</b>.</div>` : '';
  const name = `<b class="en">${esc(disp(chosen))}</b>`;
  if (!x) return `<div class="sh-c">💡 למה לא ${name}? היא לא מתאימה למשמעות של המשפט. כאן צריך «${esc(w.he)}».</div>`;
  let h = `<div class="sh-c">💡 למה לא ${name}? ${name} = ${esc(x.he)}.`;
  if (c.type === 'sentence' && x.pos !== w.pos && POS_RULE[x.pos] && POS_HERE[w.pos]) h += ` היא ${POS_RULE[x.pos]}. ${POS_HERE[w.pos]}, ולכן <b class="en">${esc(disp(w.en))}</b>.`;
  else if (x.cat !== w.cat) h += ` זו ${esc(CATS[x.cat].he)}, וכאן הקשר הוא ${esc(CATS[w.cat].he)}: ${esc(CATS[w.cat].tip)}.`;
  return h + '</div>';
}
function sheet(w, c) {
  const a = c.ans, ok = a.ok;
  const praise = pick(['מעולה!', 'יפה מאוד!', 'נכון!', 'אלוף!', 'בדיוק!']);
  let h = `<div class="sheet ${ok ? 'ok' : 'bad'}"><div class="sh-t">${ok ? '✅ ' + praise : '❌ לא בדיוק'}</div>`;
  if (!ok) h += `<div class="sh-c">התשובה הנכונה: ${c.type === 'category' ? `<b>${CATS[w.cat].icon} ${CATS[w.cat].he}</b>` : `<b class="en">${esc(disp(w.en))}</b>`}${c.type === 'meaning' ? ` = ${esc(w.he)}` : ''}</div>`;
  if (!ok && c.opts && a.i !== undefined) h += whyNot(w, c);
  if (a.typo) h += `<div class="sh-c">שים לב לאיות: <b class="en">${esc(w.en)}</b></div>`;
  if (a.alt) h += `<div class="sh-c">גם נכון! המילה שתרגלנו כאן: <b class="en">${esc(disp(w.en))}</b></div>`;
  h += `<div class="sh-i"><b class="en">${esc(disp(w.en))}</b> = ${esc(w.he)} ${chip(w.cat)}</div>`;
  if (c.type === 'category') h += `<div class="sh-s">${CATS[w.cat].icon} ${CATS[w.cat].tip}</div>`;
  const sn = c.sent || w;
  h += `<div class="sh-s en">${fillSentence(sn.s, w.en)}</div><div class="sh-s">${esc(sn.sh)}</div>`;
  if (w.note && (!ok || c.type === 'sentence')) h += `<div class="sh-s">💡 ${esc(w.note)}</div>`;
  return h + `<button class="btn ${ok ? '' : 'red'}" onclick="next()">המשך</button></div>`;
}

function renderDict() {
  return topBar() + `<main><h2 class="sec">📖 כל המילים לפי קבוצות</h2>
    <input class="search" placeholder="חיפוש בעברית או באנגלית" value="${esc(dictQ)}" oninput="dictQ=this.value;document.getElementById('dl').innerHTML=dictList()">
    <div class="legend"><span><i class="dot b0"></i>חדש</span><span><i class="dot b1"></i>לומד</span><span><i class="dot b3"></i>מכיר</span><span><i class="dot b5"></i>שולט</span></div>
    <div id="dl">${dictList()}</div></main>` + navBar();
}
function dotClass(w) { if (!S.w[w.id]) return 'b0'; const b = box(w); return b >= MASTER ? 'b5' : b >= 3 ? 'b3' : 'b1'; }
function dictList() {
  const q = dictQ.trim().toLowerCase();
  let h = '';
  for (const c of CAT_KEYS) {
    const its = ITEMS.filter(w => w.cat === c && (!q || w.en.toLowerCase().includes(q) || w.he.includes(q)));
    if (!its.length) continue;
    const k = CATS[c];
    h += `<div class="dcat"><div class="dch" style="--c:${k.color}">${k.icon} ${k.he} <span class="en">${k.en}</span></div><div class="dtip">${k.tip}</div>`;
    its.forEach(w => {
      h += `<div class="dw" onclick="dictOpen=dictOpen===${w.i}?-1:${w.i};document.getElementById('dl').innerHTML=dictList()">
        <i class="dot ${dotClass(w)}"></i><b class="en">${esc(disp(w.en))}</b><span class="dhe">${esc(w.he)}</span><span class="lv">${'•'.repeat(w.lvl)}</span></div>`;
      if (dictOpen === w.i) h += `<div class="dx"><div class="en">${fillSentence(w.s, w.en)}</div><div>${esc(w.sh)}</div>${w.note ? `<div>💡 ${esc(w.note)}</div>` : ''}<button class="spk" onclick="event.stopPropagation();say(${w.i})">🔊 השמע</button></div>`;
    });
    h += '</div>';
  }
  return h || '<p class="foot">לא נמצאו מילים</p>';
}

function renderSettings() {
  return topBar() + `<main><h2 class="sec">⚙️ הגדרות</h2>
    <div class="card"><label class="sw"><input type="checkbox" ${S.sound ? 'checked' : ''} onchange="S.sound=this.checked;save()"> צלילים והקראה של המילים</label></div>
    <div class="card"><b>איך זה עובד</b>
      <p>${ITEMS.length} מילות קישור ב-${UNITS.length} יחידות ו-3 שלבים, מהקל לקשה. כל מילה עוברת 4 פורמטים: פירוש ← קבוצה ← השלמת משפט ← כתיבה לבד. היא נחשבת «שולט» 👑 רק אחרי שכתבת אותה נכון.</p>
      <p>טעית? המילה יורדת שלב וחוזרת עוד באותו שיעור ובשיעור הבא. צדקת? היא חוזרת אחרי 10 דקות, שעה, 4 שעות, 10 שעות, יום ויומיים.</p>
      <p>יעד: 3 ימים. כל יום כתוב בכרטיס הראשי כמה מילים חדשות צריך כדי לעמוד ביעד. מומלץ לפתוח «חזרה» כמה פעמים ביום, גם ל-5 דקות.</p></div>
    <div class="card"><b>👤 ${esc(ME.name)}</b><p><span class="en">${esc(ME.email || '')}</span><br>ההתקדמות נשמרת בחשבון ${syncIcon()} ${sync === 'ok' ? 'הכול מגובה' : sync === 'wait' ? 'שומר...' : 'לא נשמר כרגע (אין אינטרנט?), ייקלט כשיחזור החיבור'}. אפשר להיכנס עם אותו חשבון Google מכל טלפון או מחשב.</p>
      <button class="btn ghost" onclick="logout()">התנתק</button></div>
    <div class="card"><div class="row"><button class="btn ghost" onclick="restartPlan()">התחל את 3 הימים מהיום</button><button class="btn red" onclick="resetAll()">איפוס מלא</button></div></div>
  </main>` + navBar();
}

// ===== כניסה עם Google =====
const G_LOGO = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function renderLogin() {
  return `<main class="login">
    <img src="icon.svg" alt="" class="logo">
    <h1>מילות קישור לאמירנט</h1>
    <p class="sub">${ITEMS.length} מילים · 3 ימים · כמו דואלינגו</p>
    ${booting ? '<p class="sub">טוען...</p>' : `<button class="btn gbtn" onclick="googleLogin()">${G_LOGO}<span>כניסה עם Google</span></button>
    <div id="lmsg" class="lmsg"></div>
    <p class="foot">ההתקדמות נשמרת בחשבון שלך, ואפשר להמשיך מכל טלפון או מחשב.</p>`}
  </main>`;
}
async function googleLogin() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
  if (error) document.getElementById('lmsg').textContent = 'הכניסה לא הצליחה, נסה שוב';
}
// נכנסים עם משתמש מחובר: מורידים את ההתקדמות מהענן ובוחרים את הגרסה החדשה יותר
async function enter(user) {
  const md = user.user_metadata || {};
  ME = { id: user.id, email: user.email, name: md.full_name || md.name || user.email };
  const local = readLocal();
  S = local;
  try {
    const r = await rpc('amirnet_load');
    if (r.error) throw r;
    const server = parse(r.data);
    S = server && server.savedAt >= local.savedAt ? server : local;
    if (S !== server) push();
  } catch (e) { setSync('err'); }
  try { localStorage.removeItem(KEY); localStorage.removeItem('amirnet-session'); localStorage.setItem(userKey(), JSON.stringify(S)); } catch (e) {}
}
async function logout(forced) {
  if (!forced) { if (!confirm('להתנתק? ההתקדמות שמורה בחשבון.')) return; await push(); }
  try { await sb.auth.signOut(); } catch (e) {}
  ME = null; S = blank(); L = null; view = 'home';
  render();
  if (forced) toast('צריך להיכנס שוב');
}
// חזרה לאפליקציה: אם בענן יש גרסה חדשה יותר (נלמד ממכשיר אחר), לוקחים אותה
async function refreshFromCloud() {
  if (!ME) return;
  try {
    const r = await rpc('amirnet_load');
    if (r.error === 'no_auth') return logout(true);
    const server = parse(r.data);
    if (server && server.savedAt > S.savedAt) {
      S = server;
      try { localStorage.setItem(userKey(), JSON.stringify(S)); } catch (e) {}
      if (view !== 'lesson') render();
    } else if (server && server.savedAt < S.savedAt) push();
  } catch (e) { setSync('err'); }
}
async function boot() {
  render();
  try {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      await enter(data.session.user);
      if (location.search.includes('code=')) { history.replaceState(null, '', location.pathname); toast('שלום ' + ME.name.split(' ')[0] + '! 👋'); }
    }
  } catch (e) {}
  booting = false;
  render();
}
function restartPlan() { S.start = dayKey(); save(); toast('ספירת 3 הימים מתחילה מהיום'); go('home'); }
function resetAll() { if (!confirm('למחוק את כל ההתקדמות ולהתחיל מאפס?')) return; S = blank(); save(); go('home'); }

function toast(t) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2600);
}
function render() {
  const app = document.getElementById('app');
  app.className = view;
  app.innerHTML = !ME ? renderLogin() : view === 'lesson' && L ? renderLesson() : view === 'sims' && window.renderSims ? renderSims() : view === 'dict' ? renderDict() : view === 'settings' ? renderSettings() : renderHome();
  const ty = document.getElementById('ty');
  if (ty && !ty.disabled) setTimeout(() => ty.focus(), 50);
}
boot();
