// בונה את sims.js מ-sims-src/sim*.json ובודק את המבנה. הרצה: node tools/build-sims.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'sims-src');
const ORDER = ['sc', 'sc', 'rc', 'rs', 'rs', 'sc'], N = { sc: 4, rs: 3, rc: 5 };
const HI = { 1: 115, 2: 122, 3: 132, 4: 142, 5: 150 }; // הציון המשוער הגבוה ביותר שכל סימולציה יכולה להראות
const files = fs.readdirSync(src).filter(f => /^sim\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)));
const errs = [], sims = [];
for (const f of files) {
  const num = parseInt(f.slice(3)), d = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  const e = m => errs.push(f + ': ' + m);
  if (!d.title) e('no title');
  if (d.chapters.map(c => c.type).join() !== ORDER.join()) e('chapter order ' + d.chapters.map(c => c.type).join());
  const pos = [0, 0, 0, 0];
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
  sims.push({ id: 's' + num, title: d.title, level: d.level, hi: HI[num] || 150, chapters: d.chapters });
  console.log(f, d.title, 'answers by position', pos.join('/'));
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(root, 'sims.js'), '// נוצר אוטומטית מ-sims-src/ ע"י tools/build-sims.js. לא לערוך כאן.\nconst SIMS = ' + JSON.stringify(sims) + ';\n');
console.log('sims.js:', sims.length, 'simulations,', sims.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.qs.length, 0), 0), 'questions');
