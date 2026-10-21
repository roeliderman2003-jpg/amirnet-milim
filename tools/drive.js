// מריץ שיעורים אוטומטית ובודק כל מסך. בקונסול: await runAll(60)
function chk(cond, msg, P) { if (!cond) P.push(msg); }
function htmlOk(P, where) {
  const h = document.getElementById('app').innerHTML;
  if (/undefined|NaN|\[object/.test(h)) P.push(where + ': undefined/NaN בתצוגה');
}
async function runLesson(P, T, wrongRate, given) {
  const cu = currentUnit();
  const r = Math.random();
  const q = given || (cu < 0 || r < 0.2 ? buildReview() : r < 0.27 ? buildWeak() : buildLearn(cu));
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
    chk(!(w.topic === 'link' && (c.type === 'type' || c.type === 'typeSentence')), 'שאלת כתיבה במילות קישור ' + w.en, P);
    const wrong = Math.random() < wrongRate;
    if (c.opts) {
      chk(c.opts.length === 4, `${c.type} ${w.en}: ${c.opts.length} אפשרויות`, P);
      chk(new Set(c.opts).size === c.opts.length, `${c.type} ${w.en}: אפשרות כפולה`, P);
      chk(c.opts.includes(c.correct), `${c.type} ${w.en}: אין תשובה נכונה`, P);
      if (c.type === 'sentence') chk(c.opts.filter(o => o === w.en).length === 1, 'משפט: התשובה פעמיים', P);
      if (c.type === 'meaning') chk(c.opts.filter(o => o === w.he).length === 1, 'פירוש כפול ' + w.en, P);
      chk(c.opts.every(o => (c.type === 'category' ? TOPICS[w.topic].keys.includes(o) : true)), 'קבוצה מנושא אחר ' + w.en, P);
      chk(c.type !== 'meaning' || c.opts.every(o => TOPICS[w.topic].items.some(x => x.he === o)), 'פירוש מנושא אחר ' + w.en, P);
      // מסיחים ממילים שכבר נחשפו: כשיש מספיק כאלה, אף מסיח לא אמור להיות מילה שעוד לא ראית
      // (חוץ ממילה בשני חלקים כמו either... or, שבה עדיף מסיח בשני חלקים גם אם הוא חדש)
      if (['meaning', 'reverse', 'sentence'].includes(c.type) && !(c.type === 'sentence' && w.d)) {
        const seen = o => ITEMS.some(x => (c.type === 'meaning' ? x.he : x.en) === o && S.w[x.id]);
        const ds = c.opts.filter(o => o !== c.correct);
        T.dist = (T.dist || 0) + ds.length; T.distSeen = (T.distSeen || 0) + ds.filter(seen).length;
        if (c.type !== 'sentence' && !w.en.includes('...') && farPool(w).filter(x => S.w[x.id]).length >= 10) chk(ds.every(seen), `${c.type} ${w.en}: מסיח ממילה שעוד לא נחשפה`, P);
      }
      const i = wrong ? c.opts.findIndex(o => o !== c.correct) : c.opts.indexOf(c.correct);
      answerOpt(i);
      chk(c.ans && c.ans.ok === !wrong, `${c.type} ${w.en}: הבדיקה הפוכה`, P);
    } else {
      const inp = document.getElementById('ty');
      if (!inp) { P.push('אין שדה כתיבה'); break; }
      const idk = wrong && Math.random() < 0.5;
      chk(document.body.innerHTML.includes('typeDontKnow()'), 'אין כפתור «לא יודע» בכתיבה', P);
      if (idk) { const b0 = box(w); typeDontKnow(); chk(c.ans && c.ans.idk && !c.ans.ok && box(w) <= b0, `לא יודע ${w.en}: לא נחשב כטעות`, P); T.idk = (T.idk || 0) + 1; }
      else { inp.value = wrong ? 'qqqq' : w.en; checkType(); }
      chk(c.ans && c.ans.ok === !wrong, `כתיבה ${w.en}: הבדיקה הפוכה`, P);
      // «התכוונתי לזה»: מבטל את הטעות ונחשב כתשובה נכונה, בלי ספירה כפולה
      if (wrong && !idk && Math.random() < 0.5) {
        const b0 = c.undo.st.b, d0 = c.undo.day.ans, bad0 = c.undo.st.bad, lb = c.undo.L.bad;
        chk(document.body.innerHTML.includes('typeMeant()'), 'אין כפתור «התכוונתי לזה»', P);
        typeMeant(); T.meant = (T.meant || 0) + 1;
        chk(c.ans.ok && ws(w).bad === bad0 && today().ans === d0 + 1 && L.bad === lb && box(w) >= b0, `התכוונתי לזה ${w.en}: לא חושב נכון`, P);
      }
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
    const otherBefore = Object.keys(S.w).filter(id => (!BYID[id] || BYID[id].topic !== k) && !TWIN[id]).length;
    // מסכים
    for (const v of ['home', 'dict', 'settings']) { go(v); htmlOk(P, v); }
    go('home');
    chk(UNITS.every(u => u.items.every(w => w.topic === k)), 'יחידה עם מילה מנושא אחר', P);
    chk(new Set(UNITS.flatMap(u => u.items.map(w => w.id))).size === ITEMS.length, 'לא כל המילים ביחידות', P);
    let lessons = 0;
    for (let i = 0; i < n; i++) { if (await runLesson(P, T, wrongRate)) lessons++; }
    const otherAfter = Object.keys(S.w).filter(id => (!BYID[id] || BYID[id].topic !== k) && !TWIN[id]).length;
    chk(otherBefore === otherAfter, 'שיעור בנושא אחד שינה התקדמות בנושא השני', P);
    chk(Object.keys(S.w).every(id => BYID[id]), 'מזהה התקדמות לא מוכר', P);
    go('home'); htmlOk(P, 'בית אחרי');
    out[k] = { lessons, words: ITEMS.length, units: UNITS.length, introduced: introduced().length, mastered: ITEMS.filter(w => box(w) >= MASTER).length, types: T, problems: [...new Set(P)].slice(0, 40), problemCount: P.length };
  }
  // שיעור מעורב (כמו מילים חלשות מסימולציה): כל שאלה מקבלת מסיחים מהנושא של המילה, והנושא חוזר אחרי השיעור
  { const P = [], T = {}; pickTopic('link');
    const mix = shuffle([...TOPICS.link.items.slice(0, 5), ...TOPICS.vocab.items.slice(0, 5)]).flatMap(w => [{ k: 'q', w, type: 'category' }, { k: 'q', w, type: 'meaning' }, { k: 'q', w, type: 'sentence' }]);
    await runLesson(P, T, 0.2, mix);
    chk(topic === 'link', 'הנושא לא חזר אחרי שיעור מעורב', P);
    out.mixed = { types: T, problems: [...new Set(P)] }; }
  // מילים בשני הנושאים: התקדמות זהה בשניהם, וגם התקדמות ישנה בצד אחד עוברת לשני בטעינה
  { const P = [], pairs = Object.keys(TWIN);
    for (const id of pairs) { const a = S.w[id], b = S.w[TWIN[id].id]; if (!!a !== !!b || (a && (a.b !== b.b || !!a.known !== !!b.known || a.due !== b.due))) P.push('לא מסונכרן ' + id); }
    const [l1, l2] = TOPICS.link.items.filter(w => TWIN[w.id]), v2 = TWIN[l2.id];
    const old = parse({ w: { [l1.id]: { b: 4, due: 1, ok: 5, bad: 0, intro: 1 }, [v2.id]: { b: 0, due: 1, ok: 0, bad: 1, intro: 1, known: true } }, savedAt: 1 });
    chk(old.w[TWIN[l1.id].id] && old.w[TWIN[l1.id].id].b === 4, 'התקדמות ישנה לא עברה לתאומה', P);
    chk(old.w[l2.id] && old.w[l2.id].known, '«מכיר» לא עבר לתאומה', P);
    out.twins = { pairs: pairs.length / 2, introducedPairs: pairs.filter(id => S.w[id]).length / 2, problems: P }; }
  out.simItem = typeof simAppItem === 'function' ? [!!simAppItem('although'), !!simAppItem('abundant')] : 'no sims';
  out.errors = window.__errors.slice(0, 20);
  out.savedTopic = window.__saved && window.__saved.topic;
  return out;
}
