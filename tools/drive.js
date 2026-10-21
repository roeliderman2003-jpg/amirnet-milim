// מריץ שיעורים אוטומטית ובודק כל מסך. בקונסול: await runAll(60)
function chk(cond, msg, P) { if (!cond) P.push(msg); }
function htmlOk(P, where) {
  const h = document.getElementById('app').innerHTML;
  if (/undefined|NaN|\[object/.test(h)) P.push(where + ': undefined/NaN בתצוגה');
}
async function runLesson(P, T, wrongRate) {
  const cu = currentUnit();
  const r = Math.random();
  const q = cu < 0 || r < 0.2 ? buildReview() : r < 0.27 ? buildWeak() : buildLearn(cu);
  if (!q.length) return false;
  startLesson(q, 'בדיקה');
  let steps = 0;
  while (L && !L.finished) {
    if (++steps > 400) { P.push('שיעור לא נגמר'); break; }
    htmlOk(P, 'שיעור');
    const it = L.q[0], c = L.cur;
    if (!c) { P.push('אין שאלה נוכחית'); break; }
    if (c.k === 'intro') { T.intro = (T.intro || 0) + 1; chk(it.w.s.includes('___') && it.w.sh, 'מילה בלי משפט ' + it.w.en, P); next(); continue; }
    if (c.k === 'match') {
      T.match = (T.match || 0) + 1;
      chk(new Set(c.left.map(w => w.he)).size === c.left.length, 'התאמה עם פירוש כפול', P);
      if (Math.random() < wrongRate && c.left.length > 1) { matchTap('l', 0); const j = c.right.findIndex(w => w.id !== c.left[0].id); matchTap('r', j); await new Promise(r => setTimeout(r, 520)); }
      for (let i = 0; i < c.left.length; i++) { const w = c.left[i]; if (c.done.has(w.id)) continue; matchTap('l', i); matchTap('r', c.right.findIndex(x => x.id === w.id)); }
      await new Promise(r => setTimeout(r, 480));
      continue;
    }
    const w = it.w;
    T[c.type] = (T[c.type] || 0) + 1;
    const wrong = Math.random() < wrongRate;
    if (c.opts) {
      chk(c.opts.length === 4, `${c.type} ${w.en}: ${c.opts.length} אפשרויות`, P);
      chk(new Set(c.opts).size === c.opts.length, `${c.type} ${w.en}: אפשרות כפולה`, P);
      chk(c.opts.includes(c.correct), `${c.type} ${w.en}: אין תשובה נכונה`, P);
      if (c.type === 'sentence') chk(c.opts.filter(o => o === w.en).length === 1, 'משפט: התשובה פעמיים', P);
      if (c.type === 'meaning') chk(c.opts.filter(o => o === w.he).length === 1, 'פירוש כפול ' + w.en, P);
      chk(c.opts.every(o => (c.type === 'category' ? CAT_KEYS.includes(o) : true)), 'קבוצה מנושא אחר ' + w.en, P);
      const i = wrong ? c.opts.findIndex(o => o !== c.correct) : c.opts.indexOf(c.correct);
      answerOpt(i);
      chk(c.ans && c.ans.ok === !wrong, `${c.type} ${w.en}: הבדיקה הפוכה`, P);
    } else {
      const inp = document.getElementById('ty');
      if (!inp) { P.push('אין שדה כתיבה'); break; }
      inp.value = wrong ? 'qqqq' : w.en; checkType();
      chk(c.ans && c.ans.ok === !wrong, `כתיבה ${w.en}: הבדיקה הפוכה`, P);
    }
    htmlOk(P, 'משוב');
    next();
  }
  htmlOk(P, 'סוף שיעור');
  quitLesson();
  // מזיזים את הזמן: כל המילים «מתיישנות» קצת, כדי שחזרות יגיעו
  const shift = (30 + Math.random() * 600) * 60000;
  for (const id in S.w) S.w[id].due -= shift;
  return true;
}
async function runAll(n = 60, wrongRate = 0.15) {
  while (!ME) await new Promise(r => setTimeout(r, 100));
  const out = {};
  for (const k of Object.keys(TOPICS)) {
    pickTopic(k);
    const P = [], T = {};
    const otherBefore = Object.keys(S.w).filter(id => !BYID[id] || BYID[id].topic !== k).length;
    // מסכים
    for (const v of ['home', 'dict', 'settings']) { go(v); htmlOk(P, v); }
    go('home');
    chk(UNITS.every(u => u.items.every(w => w.topic === k)), 'יחידה עם מילה מנושא אחר', P);
    chk(new Set(UNITS.flatMap(u => u.items.map(w => w.id))).size === ITEMS.length, 'לא כל המילים ביחידות', P);
    let lessons = 0;
    for (let i = 0; i < n; i++) { if (await runLesson(P, T, wrongRate)) lessons++; }
    const otherAfter = Object.keys(S.w).filter(id => !BYID[id] || BYID[id].topic !== k).length;
    chk(otherBefore === otherAfter, 'שיעור בנושא אחד שינה התקדמות בנושא השני', P);
    chk(Object.keys(S.w).every(id => BYID[id]), 'מזהה התקדמות לא מוכר', P);
    go('home'); htmlOk(P, 'בית אחרי');
    out[k] = { lessons, words: ITEMS.length, units: UNITS.length, introduced: introduced().length, mastered: ITEMS.filter(w => box(w) >= MASTER).length, types: T, problems: [...new Set(P)].slice(0, 40), problemCount: P.length };
  }
  out.errors = window.__errors.slice(0, 20);
  out.savedTopic = window.__saved && window.__saved.topic;
  return out;
}
