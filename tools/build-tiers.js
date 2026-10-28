// בונה את free.js (ציבורי): כל התוכן, פתוח לכולם (רועי 28/10: בלי תשלום, כל מי שמקבל את הקישור משתמש במלואה).
// הרצה אחרי כל שינוי בתוכן: node tools/build-tiers.js
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const FILES = ['words.js', 'vocab.js', 'sentences2.js', 'sentences3.js', 'sentences-more.js', 'sims.js', 'practice.js'];
// אבחון התחלתי: פרקים קבועים מהתרגול. ראו DIAG ב-app.js
const DIAG_SETS = ['x1sc2', 'x0rs2', 'x2rs2', 'x0sc2', 'x1sc3', 'x3sc2'];

// בווינדוס הקבצים נשלפים עם CRLF: מנרמלים ל-\n כדי שה-regex וה-hash יהיו זהים בכל מחשב
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const src = FILES.map(f => read(f).replace(/^const /gm, 'var '));
const ctx = {};
vm.createContext(ctx);
src.forEach(s => vm.runInContext(s, ctx));
// אותה חלוקה ליחידות כמו באפליקציה: לוקחים את buildUnits מתוך app.js
const app = read('app.js');
const bu = app.match(/function buildUnits\(ITEMS, CAT_KEYS\) \{[\s\S]*?\nreturn UNITS;\n\}/);
if (!bu) throw new Error('buildUnits not found in app.js');
vm.runInContext(bu[0], ctx);

const meta = { units: {}, words: {} };
for (const [k, raw, cats, id] of [['link', ctx.RAW, ctx.CATS, r => r[0] + '|' + r[2]], ['vocab', ctx.VRAW, ctx.VCATS, r => 'v:' + r[0]]]) {
  const items = raw.map(r => ({ id: id(r), lvl: r[4], cat: r[2], r }));
  meta.units[k] = ctx.buildUnits(items, Object.keys(cats)).length; meta.words[k] = items.length;
}
DIAG_SETS.forEach(id => { if (!ctx.PRACTICE_SETS[id]) throw new Error('diagnostic set missing: ' + id); });
meta.sims = ctx.SIM_FORMS.length; meta.practice = Object.keys(ctx.PRACTICE_SETS).length;
meta.version = crypto.createHash('sha1').update(src.join('\n')).digest('hex').slice(0, 10);

const out = '// נוצר אוטומטית ע"י tools/build-tiers.js: כל התוכן, פתוח לכולם. לא לערוך כאן.\n'
  + src.join('\n') + `\nvar TIER_META = ${JSON.stringify(meta)};\nvar FULL = true;\n`;
fs.writeFileSync(path.join(root, 'free.js'), out);
console.log(`free.js ${Math.round(fs.statSync(path.join(root, 'free.js')).size / 1024)}KB: ${meta.words.link} מילות קישור, ${meta.words.vocab} מילים, ${meta.sims} סימולציות, ${meta.practice} פרקי תרגול, גרסה ${meta.version}`);
