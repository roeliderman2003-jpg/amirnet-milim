// בונה את sentences-more.js מ-sents-src/part-*.json ובודק אותם: עוד משפטים לכל מילה, כדי שהשלמת משפט לא תחזור על אותו משפט (רועי 22/10)
// node tools/build-sents.js                 → בדיקה + כתיבה
// node tools/build-sents.js --file part-3.json → בדיקה של קובץ אחד מול הקלט שלו (sents-src/in-3.json), בלי לכתוב
// קובץ: { "<מזהה מילה>": [["משפט עם ___", "תרגום"], ...] }
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), src = path.join(root, 'sents-src');
const ctx = {};
vm.createContext(ctx);
for (const f of ['words.js', 'vocab.js', 'sentences2.js', 'sentences3.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace(/^const /gm, 'var '), ctx);
const items = {};
ctx.RAW.forEach(r => { items[r[0] + '|' + r[2]] = { en: r[0], s: [r[5]] }; });
ctx.VRAW.forEach(r => { items['v:' + r[0]] = { en: r[0], s: [r[5]] }; });
for (const S of [ctx.S2, ctx.S3]) for (const id in S) if (items[id]) items[id].s.push(S[id][0]);
const NEED = id => id.startsWith('v:') ? 4 : 3;
const only = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null;
const files = only ? [only] : fs.readdirSync(src).filter(f => /^part-\d+\.json$/.test(f)).sort();
const errs = [], out = {}, HE = /[֐-׿]/;
const norm = s => s.toLowerCase().replace(/[^a-z_ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const seenAll = new Set(Object.values(items).flatMap(x => x.s.map(norm)));
for (const f of files) {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')); } catch (e) { errs.push(`${f}: JSON לא תקין: ${e.message}`); continue; }
  const inFile = path.join(src, f.replace('part-', 'in-'));
  if (fs.existsSync(inFile)) JSON.parse(fs.readFileSync(inFile, 'utf8')).forEach(x => { if (!d[x.id]) errs.push(`${f}: חסרה מילה ${x.id}`); });
  for (const [id, list] of Object.entries(d)) {
    const it = items[id], at = `${f} ${id}`;
    if (!it) { errs.push(`${at}: מזהה לא מוכר`); continue; }
    if (!Array.isArray(list) || list.length !== NEED(id)) { errs.push(`${at}: צריך ${NEED(id)} משפטים`); continue; }
    const blanks = it.en.includes('...') ? it.en.split('...').length : 1;
    const parts = it.en.toLowerCase().split('...').map(x => x.trim()).filter(Boolean);
    list.forEach(([s, sh], i) => {
      const a = `${at} #${i + 1}`;
      if (typeof s !== 'string' || (s.match(/___/g) || []).length !== blanks) return errs.push(`${a}: צריך ${blanks} ___`);
      const rest = ' ' + norm(s.replace(/___/g, ' ')) + ' ';
      if (parts.some(p => rest.includes(' ' + norm(p) + ' '))) errs.push(`${a}: המילה עצמה מופיעה במשפט`);
      const n = s.trim().split(/\s+/).length;
      if (n < 7 || n > 24) errs.push(`${a}: ${n} מילים (7-24)`);
      if (!HE.test(sh || '')) errs.push(`${a}: תרגום בלי עברית`);
      if ((s + sh).includes('—')) errs.push(`${a}: קו ארוך`);
      if (seenAll.has(norm(s))) errs.push(`${a}: משפט כפול`);
      seenAll.add(norm(s));
    });
    out[id] = list.map(([s, sh]) => [s.trim(), sh.trim()]);
  }
}
const ids = Object.keys(items).filter(id => !out[id]);
if (!only && ids.length) console.log(`${ids.length} מילים בלי משפטים נוספים (למשל ${ids.slice(0, 5).join(', ')})`);
console.log(`${Object.keys(out).length} מילים, ${Object.values(out).reduce((a, x) => a + x.length, 0)} משפטים`);
if (errs.length) { console.log(`\n${errs.length} שגיאות:\n` + errs.slice(0, 150).join('\n')); process.exitCode = 1; return; }
if (only) return;
fs.writeFileSync(path.join(root, 'sentences-more.js'), '// עוד משפטים לכל מילה (sents-src → node tools/build-sents.js). לא לערוך כאן.\n// [משפט עם ___, תרגום]\nconst SMORE = ' + JSON.stringify(out) + ';\n');
console.log('נכתב sentences-more.js');
