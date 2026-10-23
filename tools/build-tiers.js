// בונה את free.js (ציבורי) ואת paid/paid.js (מעלים ל-Supabase Storage, ל-bucket הפרטי paid, בשם paid.js).
// הרצה אחרי כל שינוי בתוכן: node tools/build-tiers.js
// חינם: 5 היחידות הראשונות בכל נושא, סימולציה אחת מלאה (f1), והפרקים של האבחון (לא מוצעים כתרגול; התרגול לפי חלק כולו בתשלום).
// בתשלום: הכול. האפליקציה טוענת את free.js, ואם יש גישה פעילה מורידה את paid.js ומחליפה בו את הנתונים.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const FILES = ['words.js', 'vocab.js', 'sentences2.js', 'sentences3.js', 'sentences-more.js', 'sims.js', 'practice.js'];
const FREE_UNITS = 5;
// אבחון התחלתי: פרקים קבועים מהתרגול (חייבים להיות בחינם). ראו DIAG ב-app.js
const DIAG_SETS = ['x1sc2', 'x0rs2', 'x2rs2', 'x0sc2', 'x1sc3', 'x3sc2'];

const src = FILES.map(f => fs.readFileSync(path.join(root, f), 'utf8').replace(/^const /gm, 'var '));
const ctx = {};
vm.createContext(ctx);
src.forEach(s => vm.runInContext(s, ctx));
// אותה חלוקה ליחידות כמו באפליקציה: לוקחים את buildUnits מתוך app.js
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bu = app.match(/function buildUnits\(ITEMS, CAT_KEYS\) \{[\s\S]*?\nreturn UNITS;\n\}/);
if (!bu) throw new Error('buildUnits not found in app.js');
vm.runInContext(bu[0], ctx);

const freeIds = new Set(), meta = { units: {}, words: {} };
for (const [k, raw, cats, id] of [['link', ctx.RAW, ctx.CATS, r => r[0] + '|' + r[2]], ['vocab', ctx.VRAW, ctx.VCATS, r => 'v:' + r[0]]]) {
  const items = raw.map(r => ({ id: id(r), lvl: r[4], cat: r[2], r }));
  const units = ctx.buildUnits(items, Object.keys(cats));
  units.slice(0, FREE_UNITS).forEach(u => u.items.forEach(w => freeIds.add(w.id)));
  meta.units[k] = units.length; meta.words[k] = items.length;
}
const pickObj = (o, keep) => Object.fromEntries(Object.entries(o).filter(([k]) => keep(k)));
const f1 = ctx.SIM_FORMS[0], f1Sets = new Set(f1.slots.flatMap(s => Object.values(s)));
const prFree = id => DIAG_SETS.includes(id);
DIAG_SETS.forEach(id => { if (!ctx.PRACTICE_SETS[id]) throw new Error('diagnostic set missing: ' + id); });
meta.sims = ctx.SIM_FORMS.length; meta.practice = Object.keys(ctx.PRACTICE_SETS).length;

const free = {
  CATS: ctx.CATS, NEAR: ctx.NEAR, RAW: ctx.RAW.filter(r => freeIds.has(r[0] + '|' + r[2])),
  VCATS: ctx.VCATS, VNEAR: ctx.VNEAR, VRAW: ctx.VRAW.filter(r => freeIds.has('v:' + r[0])),
  S2: pickObj(ctx.S2, k => freeIds.has(k)), S3: pickObj(ctx.S3, k => freeIds.has(k)), SMORE: pickObj(ctx.SMORE, k => freeIds.has(k)),
  SIM_SETS: pickObj(ctx.SIM_SETS, k => f1Sets.has(k)), SIM_FORMS: [f1],
  PRACTICE_SETS: pickObj(ctx.PRACTICE_SETS, prFree),
};
const version = crypto.createHash('sha1').update(src.join('\n')).digest('hex').slice(0, 10);
meta.version = version;
const out = '// נוצר אוטומטית ע"י tools/build-tiers.js: התוכן החינמי. לא לערוך כאן.\n'
  + Object.entries(free).map(([k, v]) => `var ${k} = ${JSON.stringify(v)};`).join('\n')
  + `\nvar TIER_META = ${JSON.stringify(meta)};\nvar FULL = false;\n`;
fs.writeFileSync(path.join(root, 'free.js'), out);
fs.mkdirSync(path.join(root, 'paid'), { recursive: true });
fs.writeFileSync(path.join(root, 'paid', 'paid.js'), '// התוכן המלא של פטורנט. לא לפרסם: מעלים רק ל-Supabase Storage (bucket פרטי paid, שם הקובץ paid.js).\n'
  + src.join('\n') + `\nvar PAID_VERSION = ${JSON.stringify(version)};\nvar FULL = true;\n`);
const kb = f => Math.round(fs.statSync(path.join(root, f)).size / 1024);
console.log(`free.js ${kb('free.js')}KB: ${free.RAW.length} מילות קישור, ${free.VRAW.length} מילים, ${Object.keys(free.SIM_SETS).length} פרקי סימולציה, ${Object.keys(free.PRACTICE_SETS).length} פרקי תרגול`);
console.log(`paid/paid.js ${kb('paid/paid.js')}KB, גרסה ${version}`);
