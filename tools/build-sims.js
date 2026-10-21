// בונה את sims.js: מאגר פרקים (SIM_SETS) ונוסחים אדפטיביים (SIM_FORMS), ובודק את התוכן. הרצה: node tools/build-sims.js
// מקורות: sims-src/sim*.json (סימולציות מלאות, כל פרק = פרק במאגר ברמה של הסימולציה)
//         sims-src/pack-*.json (פרקים נוספים: {"tier":N,"sc":[...],"rs":[...]} או {"tier":N,"rc":[...]})
// נוסח = מבחן רב-שלבי: פרק פתיחה בינוני, ובכל אחד מ-5 הפרקים הבאים גרסה קלה (lo) וגרסה קשה (hi).
// כל פרק במאגר משמש בנוסח אחד בלבד, כך שאין שאלות שחוזרות בין נוסחים.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'sims-src');
const ORDER = ['sc', 'sc', 'rc', 'rs', 'rs', 'sc'], N = { sc: 4, rs: 3, rc: 5 };
// לכל פרק במבחן: מאילו רמות לוקחים את פרק הפתיחה / הקל / הקשה, לפי סדר העדפה
const PLAN = [
  { mid: [1, 2] },
  { lo: [0, 1], hi: [2, 3] },
  { lo: [0, 1], hi: [2, 3] },
  { lo: [0, 1], hi: [2, 3] },
  { lo: [1, 0], hi: [3, 2] },
  { lo: [1, 0], hi: [3, 2] },
];
// סימולציה מלאה ← רמת קושי (0 בסיס, 1 בינוני, 2 מתקדם, 3 פטור)
const SIM_TIER = { 1: 0, 2: 0, 6: 0, 3: 1, 7: 1, 8: 1, 4: 2, 9: 2, 10: 2, 5: 3, 11: 3, 12: 3 };

const errs = [], sets = [];
const words = s => s.trim().split(/\s+/).length;
function checkSet(set, at) {
  const e = m => errs.push(at + ': ' + m);
  if (set.qs.length !== N[set.type]) e(`${set.qs.length} questions`);
  if (set.type === 'rc' && (!Array.isArray(set.text) || set.text.length < 3)) e('rc text');
  set.qs.forEach((q, qi) => {
    const a = `q${qi + 1}`;
    if (!Array.isArray(q.o) || q.o.length !== 4) return e(a + ' options');
    if (new Set(q.o.map(o => o.trim().toLowerCase())).size !== 4) e(a + ' duplicate options');
    if (!(q.a >= 0 && q.a <= 3)) e(a + ' answer index');
    if (set.type === 'sc' && (q.q.match(/___/g) || []).length !== 1) e(a + ' needs exactly one ___');
    if (!q.ex || q.ex.includes('—')) e(a + ' explanation missing or has a long dash');
    if (!Array.isArray(q.w) || !q.w.every(x => Array.isArray(x) && x.length === 2 && x[0] && x[1])) e(a + ' words');
    // בניסוח מחדש התשובה הנכונה לא בולטת באורך
    if (set.type === 'rs') {
      const w = q.o.map(words), other = Math.max(...w.filter((_, i) => i !== q.a));
      if (w[q.a] > other + 2) e(`${a} correct restatement is ${w[q.a]} words vs ${other}`);
    }
  });
}
// הנכונה היא הארוכה ביותר בלא יותר משליש משאלות הניסוח מחדש בקובץ
function checkLongest(list, at) {
  const qs = list.filter(s => s.type === 'rs').flatMap(s => s.qs);
  const longest = qs.filter(q => { const w = q.o.map(words); return w[q.a] > Math.max(...w.filter((_, i) => i !== q.a)); }).length;
  if (qs.length && longest > Math.ceil(qs.length / 3)) errs.push(`${at}: correct restatement is the longest in ${longest}/${qs.length} questions`);
}

for (const f of fs.readdirSync(src).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  const mine = [];
  let m;
  if ((m = f.match(/^sim(\d+)\.json$/))) {
    const num = +m[1], tier = SIM_TIER[num];
    if (tier === undefined) { errs.push(f + ': no tier'); continue; }
    if (d.chapters.map(c => c.type).join() !== ORDER.join()) errs.push(f + ': chapter order');
    d.chapters.forEach((c, ci) => mine.push(Object.assign({ id: `s${num}c${ci}`, tier }, c)));
  } else if ((m = f.match(/^pack-(\w+)-t(\d)\.json$/))) {
    for (const type of ['sc', 'rs', 'rc']) (d[type] || []).forEach((c, i) => mine.push(Object.assign({ id: `p${d.tier}${type}${i + 1}`, tier: d.tier, type }, c)));
  } else continue;
  mine.forEach(s => checkSet(s, `${f} ${s.id}`));
  checkLongest(mine, f);
  sets.push(...mine);
}

// חלוקה לנוסחים: כל נוסח לוקח לכל משבצת את הפרק הפנוי הראשון לפי סדר ההעדפה של הרמות
// חלוקה לנוסחים: מנסים כמה שיותר נוסחים. ממלאים משבצת-משבצת (כל הנוסחים יחד), כדי שהמשבצות המוגבלות
// (פרק הפתיחה מרמה 1 או 2) יקבלו קודם, ובתוך משבצת לוקחים לפי סדר ההעדפה של הרמות.
let used = new Set();
function take(type, tiers) {
  for (const t of tiers) {
    const s = sets.find(x => x.type === type && x.tier === t && !used.has(x.id));
    if (s) { used.add(s.id); return s.id; }
  }
  return null;
}
function allocate(n) {
  used = new Set();
  const forms = Array.from({ length: n }, (_, k) => ({ id: 'f' + (k + 1), he: 'מבחן ' + (k + 1), slots: ORDER.map(() => ({})) }));
  for (let i = 0; i < ORDER.length; i++) for (const key of Object.keys(PLAN[i])) for (let k = 0; k < n; k++) {
    // פרק הפתיחה מתחלף בין רמה 1 לרמה 2, כדי שהמאגר יתחלק בדיוק
    const tiers = key === 'mid' && k % 2 ? PLAN[i][key].slice().reverse() : PLAN[i][key];
    const id = take(ORDER[i], tiers);
    if (!id) return null;
    forms[k].slots[i][key] = id;
  }
  return forms;
}
let forms = [];
for (let n = Math.floor(sets.length / 11); n > 0; n--) { const f = allocate(n); if (f) { forms = f; break; } }
const MIN_FORMS = +process.env.MIN_FORMS || 12; // לבדיקה מקומית עם מאגר חלקי: MIN_FORMS=1
if (forms.length < MIN_FORMS) errs.push(`only ${forms.length} complete forms (need ${MIN_FORMS})`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }

const out = {};
sets.forEach(s => { out[s.id] = s; });
fs.writeFileSync(path.join(root, 'sims.js'), '// נוצר אוטומטית מ-sims-src/ ע"י tools/build-sims.js. לא לערוך כאן.\nconst SIM_SETS = ' + JSON.stringify(out) + ';\nconst SIM_FORMS = ' + JSON.stringify(forms) + ';\n');
const byTier = t => ['sc', 'rs', 'rc'].map(x => x + ':' + sets.filter(s => s.tier === t && s.type === x).length).join(' ');
[0, 1, 2, 3].forEach(t => console.log('tier', t, byTier(t)));
console.log('sims.js:', sets.length, 'sets,', sets.reduce((a, s) => a + s.qs.length, 0), 'questions,', forms.length, 'forms, unused sets:', sets.length - used.size);
