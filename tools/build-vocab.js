// בונה את vocab.js מהקבצים ב-vocab-src ובודק אותם.
// node tools/build-vocab.js        → בדיקה + כתיבה
// node tools/build-vocab.js --check → בדיקה בלבד
// שורה: [מילה, פירוש, קבוצה, חלק דיבור (n/v/j/r/x), רמה 1-3, משפט עם ___, תרגום המשפט, הערה?, מסיחים קבועים?]
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'vocab-src');
const { cats, near } = JSON.parse(fs.readFileSync(path.join(src, 'cats.json'), 'utf8'));
// --file part-03.json → בודק רק את הקובץ הזה ואת הכיסוי של chunk-3.txt, בלי לכתוב
const only = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null;
const files = only ? [only] : fs.readdirSync(src).filter(f => /^part-.*\.json$/.test(f)).sort();
const errs = [], rows = [], seen = new Map();
const HE = /[֐-׿]/;
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')); } catch (e) { errs.push(`${f}: JSON לא תקין: ${e.message}`); continue; }
  arr.forEach((r, i) => {
    const at = `${f}#${i} ${r && r[0]}`;
    if (!Array.isArray(r) || r.length < 7) return errs.push(`${at}: חסרים שדות`);
    const [en, he, cat, pos, lvl, s, sh, note, d] = r;
    if (typeof en !== 'string' || !/^[a-z][a-z' .-]*$/i.test(en)) errs.push(`${at}: מילה לא תקינה`);
    if (seen.has(en.toLowerCase())) errs.push(`${at}: כפילות (גם ב-${seen.get(en.toLowerCase())})`); else seen.set(en.toLowerCase(), f);
    if (!HE.test(he || '')) errs.push(`${at}: פירוש בלי עברית`);
    if (!cats[cat]) errs.push(`${at}: קבוצה לא קיימת ${cat}`);
    if (!'nvjrx'.includes(pos) || pos.length !== 1) errs.push(`${at}: חלק דיבור לא תקין ${pos}`);
    if (![1, 2, 3].includes(lvl)) errs.push(`${at}: רמה לא תקינה ${lvl}`);
    if (typeof s !== 'string' || (s.match(/___/g) || []).length !== 1) errs.push(`${at}: במשפט צריך ___ אחד בדיוק`);
    else if (s.replace('___', '').toLowerCase().split(/[^a-z'-]+/).includes(en.toLowerCase())) errs.push(`${at}: המילה עצמה מופיעה במשפט`);
    if (!HE.test(sh || '')) errs.push(`${at}: תרגום משפט בלי עברית`);
    if (note != null && typeof note !== 'string') errs.push(`${at}: הערה לא טקסט`);
    if (d != null && (!Array.isArray(d) || d.length < 3 || d.includes(en))) errs.push(`${at}: מסיחים לא תקינים`);
    rows.push(r.slice(0, d ? 9 : note ? 8 : 7));
  });
}
// כיסוי: כל מילה ברשימת המקור מופיעה
const listFile = path.join(src, only ? only.replace(/^part-0*(\d+)\.json$/, 'chunk-$1.txt') : 'words.txt');
let missing = [];
if (fs.existsSync(listFile)) {
  const want = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  missing = want.filter(w => !seen.has(w.toLowerCase()));
  const extra = [...seen.keys()].filter(w => !want.some(x => x.toLowerCase() === w));
  if (missing.length) errs.push(`חסרות ${missing.length} מילים מהרשימה: ${missing.slice(0, 30).join(', ')}${missing.length > 30 ? ' ...' : ''}`);
  if (extra.length) errs.push(`${extra.length} מילים שלא ברשימה: ${extra.slice(0, 30).join(', ')}`);
}
// מילים קלות מדי (רועי 21/10): נשארות במקור ובבדיקת הכיסוי, אבל לא נכנסות לאפליקציה. רשימה ב-drop.json
const dropFile = path.join(src, 'drop.json');
const drop = new Set(fs.existsSync(dropFile) ? JSON.parse(fs.readFileSync(dropFile, 'utf8')).words.map(w => w.toLowerCase()) : []);
[...drop].filter(w => !seen.has(w)).forEach(w => errs.push(`drop.json: ${w} לא קיימת במקור`));
const all = rows.length;
for (let i = rows.length - 1; i >= 0; i--) if (drop.has(rows[i][0].toLowerCase())) rows.splice(i, 1);
if (drop.size) console.log(`הוסרו ${all - rows.length} מילים קלות (drop.json)`);
const byCat = {}, byLvl = {};
rows.forEach(r => { byCat[r[2]] = (byCat[r[2]] || 0) + 1; byLvl[r[4]] = (byLvl[r[4]] || 0) + 1; });
console.log(`${rows.length} מילים מ-${files.length} קבצים · רמות ${JSON.stringify(byLvl)}`);
console.log(Object.entries(byCat).map(([k, n]) => `${k}:${n}`).join(' '));
if (errs.length) { console.log(`\n${errs.length} שגיאות:\n` + errs.slice(0, 200).join('\n')); process.exitCode = 1; }
if (process.argv.includes('--check') || only || errs.length) return;
const out = `// אוצר מילים כללי לאמירנט. נבנה אוטומטית מ-vocab-src (node tools/build-vocab.js). לא לערוך ידנית.
// [מילה, פירוש, קבוצה, חלק דיבור (n שם עצם / v פועל / j תואר / r תואר פועל / x אחר), רמה, משפט עם ___, תרגום המשפט, הערה, מסיחים קבועים]
const VCATS = ${JSON.stringify(cats, null, 1)};
const VNEAR = ${JSON.stringify(near)};
const VRAW = [
${rows.sort((a, b) => a[0].localeCompare(b[0])).map(r => JSON.stringify(r)).join(',\n')}
];
`;
fs.writeFileSync(path.join(root, 'vocab.js'), out);
console.log('נכתב vocab.js');
