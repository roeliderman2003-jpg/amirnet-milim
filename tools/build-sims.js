// בונה את sims.js מ-sims-src/sim*.json ובודק את המבנה. הרצה: node tools/build-sims.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'sims-src');
const ORDER = ['sc', 'sc', 'rc', 'rs', 'rs', 'sc'], N = { sc: 4, rs: 3, rc: 5 };
// רמות: אילו סימולציות בכל רמה, ו-hi = הציון המשוער הגבוה ביותר שסימולציה ברמה יכולה להראות
const TIERS = [
  { he: 'בסיס', hi: 118, sims: [1, 2, 6] },
  { he: 'בינוני', hi: 132, sims: [3, 7, 8] },
  { he: 'מתקדם', hi: 142, sims: [4, 9, 10] },
  { he: 'פטור', hi: 150, sims: [5, 11, 12] },
];
const files = fs.readdirSync(src).filter(f => /^sim\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)));
const errs = [], sims = [];
for (const f of files) {
  const num = parseInt(f.slice(3)), d = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  const e = m => errs.push(f + ': ' + m);
  if (!d.title) e('no title');
  if (d.chapters.map(c => c.type).join() !== ORDER.join()) e('chapter order ' + d.chapters.map(c => c.type).join());
  const pos = [0, 0, 0, 0];
  // בניסוח מחדש התשובה הנכונה לא בולטת באורך: עד 2 מילים מעל המסיח הארוך, והכי ארוכה ב-2 שאלות לכל היותר
  let longest = 0;
  d.chapters.forEach((c, ci) => c.type === 'rs' && c.qs.forEach((q, qi) => {
    const w = q.o.map(o => o.trim().split(/\s+/).length), other = Math.max(...w.filter((_, i) => i !== q.a));
    if (w[q.a] > other + 2) e(`ch${ci + 1} q${qi + 1} correct restatement is ${w[q.a]} words vs ${other}`);
    if (w[q.a] > other) longest++;
  }));
  if (longest > 2) e(`correct restatement is the longest in ${longest} questions`);
  d.chapters.forEach((c, ci) => {
    if (c.qs.length !== N[c.type]) e(`ch${ci + 1} has ${c.qs.length} questions`);
    if (c.type === 'rc' && (!Array.isArray(c.text) || c.text.length < 3)) e('rc text');
    c.qs.forEach((q, qi) => {
      const at = `ch${ci + 1} q${qi + 1}`;
      if (!Array.isArray(q.o) || q.o.length !== 4) e(at + ' options');
      else if (new Set(q.o.map(o => o.trim().toLowerCase())).size !== 4) e(at + ' duplicate options');
      if (!(q.a >= 0 && q.a <= 3)) e(at + ' answer index'); else pos[q.a]++;
      if (c.type === 'sc' && (q.q.match(/___/g) || []).length !== 1) e(at + ' needs exactly one ___');
      if (!q.ex || q.ex.includes('—')) e(at + ' explanation missing or has a long dash');
      if (!Array.isArray(q.w) || !q.w.every(x => Array.isArray(x) && x.length === 2 && x[0] && x[1])) e(at + ' words');
    });
  });
  const ti = TIERS.findIndex(t => t.sims.includes(num));
  if (ti < 0) { e('not in any tier'); continue; }
  const t = TIERS[ti], title = `${t.he} · מבחן ${t.sims.indexOf(num) + 1}`;
  sims.push({ id: 's' + num, title, tier: ti, tierHe: t.he, hi: t.hi, chapters: d.chapters });
  console.log(f, title, 'answers by position', pos.join('/'));
}
sims.sort((a, b) => a.tier - b.tier || a.title.localeCompare(b.title));
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(root, 'sims.js'), '// נוצר אוטומטית מ-sims-src/ ע"י tools/build-sims.js. לא לערוך כאן.\nconst SIMS = ' + JSON.stringify(sims) + ';\n');
console.log('sims.js:', sims.length, 'simulations,', sims.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.qs.length, 0), 0), 'questions');
