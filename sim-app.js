'use strict';
// ===== סימולציות בפורמט אמירנט =====
// המבנה לפי מצגת מאל"ו (12/2024): 6 פרקים, לכל פרק זמן קבוע, אפשר לנוע בין שאלות הפרק ולשנות תשובה עד שהזמן נגמר.
// הנתונים ב-sims.js (SIMS). התוצאות נשמרות ב-S.sims ונשמרות בענן יחד עם שאר ההתקדמות.
// משתמש בפונקציות הגלובליות של app.js: S, ITEMS, save, push, render, go, esc, shuffle, toast, startLesson, introduce, topBar, navBar.

const SIM_TYPE = {
  sc: { he: 'השלמת משפטים', n: 4, min: 4, how: 'בחרו את התשובה שמשלימה את המשפט בצורה הטובה ביותר.' },
  rs: { he: 'ניסוח מחדש', n: 3, min: 6, how: 'בחרו את המשפט שאומר את אותו הדבר כמו משפט המקור, בלי להוסיף ובלי לשנות את המשמעות.' },
  rc: { he: 'הבנת הנקרא', n: 5, min: 15, how: 'קראו את הקטע וענו על 5 השאלות. אפשר לעבור בין השאלות ולחזור לקטע בכל רגע.' },
};
// טווחי הציון באמירנט (50-150) ורמות המיון
const SIM_BANDS = [[134, 'פטור'], [120, 'מתקדמים ב'], [100, 'מתקדמים א'], [85, 'בסיסי'], [70, 'טרום בסיסי ב'], [50, 'טרום בסיסי א']];
const SIM_KEEP = 3; // כמה ניסיונות אחרונים נשמרים לכל סימולציה
let SM = null, simTick = null, simOpen = {};

function simStore() {
  if (!S.sims || typeof S.sims !== 'object') S.sims = {};
  if (!S.sims.r) S.sims.r = {};
  if (!S.sims.words) S.sims.words = {};
  return S.sims;
}
const simById = id => SIMS.find(s => s.id === id);
const simQCount = sim => sim.chapters.reduce((a, c) => a + c.qs.length, 0);
const simMinutes = sim => sim.chapters.reduce((a, c) => a + SIM_TYPE[c.type].min, 0);
const simBand = est => SIM_BANDS.find(b => est >= b[0])[1];
const simClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const simBlank = s => esc(s).replace(/___/g, '<span class="blank">______</span>');

// ציון משוער: ניכוי ניחוש (25%) ומתיחה לטווח של הסימולציה. סימולציה קלה לא יכולה להראות פטור.
function simEstimate(sim, ok, n) {
  const p = Math.max(0, (ok / n - 0.25) / 0.75);
  return Math.round(50 + p * (sim.hi - 50));
}

// ----- התחלה וניווט -----
function simStart(id) {
  const sim = simById(id);
  const notimer = !!(document.getElementById('simnotimer') || {}).checked;
  SM = { sim, ch: 0, qi: 0, intro: true, ans: sim.chapters.map(c => c.qs.map(() => -1)), pins: {}, notimer, end: 0, done: false, showText: true };
  view = 'sims';
  render(); window.scrollTo(0, 0);
}
function simBeginChapter() {
  SM.intro = false; SM.qi = 0; SM.showText = true;
  SM.end = Date.now() + SIM_TYPE[SM.sim.chapters[SM.ch].type].min * 60000;
  simStartTick();
  render(); window.scrollTo(0, 0);
}
function simStartTick() {
  clearInterval(simTick);
  if (SM.notimer) return;
  simTick = setInterval(() => {
    if (!SM || SM.done || SM.intro) return clearInterval(simTick);
    const left = SM.end - Date.now(), el = document.getElementById('simclock');
    if (el) { el.textContent = simClock(left); el.classList.toggle('low', left < 60000); }
    if (left <= 0) { clearInterval(simTick); toast('הזמן של הפרק נגמר'); simNextChapter(); }
  }, 500);
}
function simPick(i) { if (!SM || SM.done) return; SM.ans[SM.ch][SM.qi] = i; render(); }
function simGoQ(i) { SM.qi = i; render(); }
function simPin() { const k = SM.ch + ':' + SM.qi; SM.pins[k] = !SM.pins[k]; render(); }
function simToggleClock() { SM.hideClock = !SM.hideClock; render(); }
function simToggleText() { SM.showText = !SM.showText; render(); }
function simEndChapter() {
  const open = SM.ans[SM.ch].filter(a => a < 0).length;
  if (!SM.notimer && open && !confirm(`נשארו ${open} שאלות בלי תשובה. שאלה בלי תשובה נחשבת טעות, ולכן עדיף לנחש. לסיים את הפרק?`)) return;
  simNextChapter();
}
function simNextChapter() {
  clearInterval(simTick);
  if (SM.ch < SM.sim.chapters.length - 1) { SM.ch++; SM.intro = true; render(); window.scrollTo(0, 0); return; }
  simFinish();
}
function simQuit() {
  if (SM && !SM.done && !confirm('לצאת מהסימולציה? התשובות של הניסיון הזה לא יישמרו.')) return;
  clearInterval(simTick); SM = null; render(); window.scrollTo(0, 0);
}

// ----- סיום: ציון, שמירה ומילים לחיזוק -----
function simWeakWords(sim, ans) {
  const out = new Map();
  sim.chapters.forEach((c, ci) => c.qs.forEach((q, qi) => {
    if (ans[ci][qi] === q.a) return;
    (q.w || []).forEach(([en, he]) => { const k = en.toLowerCase(); if (!out.has(k)) out.set(k, { en, he }); });
  }));
  return [...out.values()];
}
// מילה מהסימולציה שקיימת באפליקציה (מילות קישור / אוצר מילים) מקבלת את הפריט שלה
function simAppItem(en) { const k = en.toLowerCase(); return ITEMS.find(w => w.en.toLowerCase() === k) || null; }
function simFinish() {
  clearInterval(simTick);
  const { sim, ans } = SM;
  const by = { sc: [0, 0], rs: [0, 0], rc: [0, 0] };
  let ok = 0, n = 0;
  sim.chapters.forEach((c, ci) => c.qs.forEach((q, qi) => { n++; by[c.type][1]++; if (ans[ci][qi] === q.a) { ok++; by[c.type][0]++; } }));
  const est = simEstimate(sim, ok, n);
  const st = simStore();
  const weak = simWeakWords(sim, ans);
  // מילים שכבר נלמדו באפליקציה חוזרות מיד ל«חזרה»; כל המילים נשמרות ברשימת החיזוק
  let queued = 0;
  weak.forEach(x => {
    st.words[x.en.toLowerCase()] = { en: x.en, he: x.he, at: Date.now() };
    const it = simAppItem(x.en);
    if (it && S.w[it.id]) { S.w[it.id].due = Date.now(); queued++; }
  });
  const rec = { at: Date.now(), ok, n, est, by, ans, notimer: SM.notimer };
  st.r[sim.id] = [rec, ...(st.r[sim.id] || [])].slice(0, SIM_KEEP);
  save(); push();
  SM.done = true; SM.rec = rec; SM.weak = weak; SM.queued = queued;
  simOpen = {};
  render(); window.scrollTo(0, 0);
}
function simShowLast(id) {
  const sim = simById(id), rec = (simStore().r[id] || [])[0];
  if (!rec) return;
  SM = { sim, ans: rec.ans, done: true, rec, weak: simWeakWords(sim, rec.ans), queued: 0, pins: {} };
  simOpen = {};
  render(); window.scrollTo(0, 0);
}
function simPractice(list) {
  const its = [];
  list.forEach(x => { const it = simAppItem(x.en); if (it && !its.includes(it)) its.push(it); });
  if (!its.length) { toast('המילים האלה עוד לא נמצאות בתרגול של האפליקציה'); return; }
  const q = [];
  its.forEach(w => { if (!S.w[w.id]) { q.push({ k: 'intro', w }); q.push({ k: 'q', w, type: 'meaning' }); } else q.push({ k: 'q', w }); });
  shuffle(its).forEach(w => q.push({ k: 'q', w }));
  SM = null;
  startLesson(q, 'מילים מהסימולציה');
}
function simPracticeAll() { simPractice(Object.values(simStore().words)); }
function simPracticeLast() { simPractice(SM.weak); }
function simClearWords() { if (!confirm('לנקות את רשימת המילים לחיזוק?')) return; simStore().words = {}; save(); render(); }

// ----- מסכים -----
function renderSims() {
  if (!SM) return renderSimList();
  if (SM.done) return renderSimResult();
  if (SM.intro) return renderSimIntro();
  return renderSimQuestion();
}
function renderSimList() {
  const st = simStore();
  let h = topBar() + `<main><h2 class="sec">📝 סימולציות אמירנט</h2>
    <div class="card"><p>כל סימולציה בנויה כמו 6 הפרקים הראשונים של אמירנט: 3 פרקי השלמת משפטים (4 שאלות, 4 דקות), 2 פרקי ניסוח מחדש (3 שאלות, 6 דקות) ופרק הבנת הנקרא (קטע ו-5 שאלות, 15 דקות). בתוך פרק אפשר לעבור בין השאלות ולשנות תשובה עד שהזמן נגמר. שאלה בלי תשובה נחשבת טעות, אז תמיד כדאי לנחש.</p>
    <label class="sw"><input type="checkbox" id="simnotimer"> בלי טיימר (תרגול רגוע)</label></div>`;
  SIMS.forEach(sim => {
    const rs = st.r[sim.id] || [], last = rs[0], best = rs.reduce((m, r) => Math.max(m, r.est), 0);
    h += `<div class="card simc"><div class="plan-h"><b>${esc(sim.title)}</b><span>${simQCount(sim)} שאלות · ${simMinutes(sim)} דק׳</span></div>
      ${last ? `<div class="lbl"><span>ניסיון אחרון: ${last.ok}/${last.n} נכונות · ציון משוער ${last.est}</span><span>שיא ${best}</span></div>` : '<div class="lbl"><span>עוד לא נעשתה</span></div>'}
      <div class="row"><button class="btn" onclick="simStart('${sim.id}')">${last ? 'עוד פעם' : 'להתחיל'}</button>${last ? `<button class="btn ghost" onclick="simShowLast('${sim.id}')">תוצאות והסברים</button>` : ''}</div></div>`;
  });
  const words = Object.values(st.words).sort((a, b) => b.at - a.at);
  if (words.length) {
    h += `<h2 class="sec">💪 מילים לחיזוק מהסימולציות (${words.length})</h2><div class="card">
      ${words.slice(0, 40).map(x => `<div class="dw"><b class="en">${esc(x.en)}</b><span class="dhe">${esc(x.he)}</span>${simAppItem(x.en) ? '<span class="simin" title="קיימת בתרגול">✓</span>' : ''}</div>`).join('')}
      <div class="row" style="margin-top:12px"><button class="btn blue" onclick="simPracticeAll()">לתרגל את המילים</button><button class="btn ghost" onclick="simClearWords()">לנקות</button></div>
      <p class="foot">✓ = המילה קיימת בתרגול של האפליקציה ותיכנס לשיעור. השאר מופיעות כאן עם הפירוש.</p></div>`;
  }
  h += `<p class="foot">הציון הוא הערכה גסה בלבד: המבחן האמיתי אדפטיבי (הקושי משתנה לפי התשובות), ונמשך עד 50 דקות.</p>`;
  return h + '</main>' + navBar();
}
function renderSimIntro() {
  const c = SM.sim.chapters[SM.ch], t = SIM_TYPE[c.type];
  return `<main class="done simintro"><div class="trophy">${c.type === 'rc' ? '📄' : c.type === 'rs' ? '🔄' : '✏️'}</div>
    <div class="un">${esc(SM.sim.title)} · פרק ${SM.ch + 1} מתוך ${SM.sim.chapters.length}</div>
    <h2>${t.he}</h2><p class="simhow">${t.how}</p>
    <div class="kpis"><div class="kpi b"><b>${c.qs.length}</b><span>שאלות</span></div><div class="kpi y"><b>${SM.notimer ? '∞' : t.min}</b><span>דקות</span></div></div>
    <button class="btn big" onclick="simBeginChapter()">להתחיל את הפרק</button>
    <button class="btn ghost" onclick="simQuit()">יציאה מהסימולציה</button></main>`;
}
function renderSimQuestion() {
  const c = SM.sim.chapters[SM.ch], q = c.qs[SM.qi], a = SM.ans[SM.ch][SM.qi], t = SIM_TYPE[c.type];
  const left = SM.end - Date.now(), last = SM.qi === c.qs.length - 1, pin = SM.pins[SM.ch + ':' + SM.qi];
  let h = `<header class="lhead simhead"><button class="x" onclick="simQuit()" aria-label="יציאה">✕</button>
    <span class="simt">פרק ${SM.ch + 1}/${SM.sim.chapters.length} · ${t.he}</span>
    ${SM.notimer ? '' : `<button id="simclock" class="simclock ${left < 60000 ? 'low' : ''} ${SM.hideClock ? 'hid' : ''}" onclick="simToggleClock()" title="הסתרת השעון">${SM.hideClock ? '⏱️' : simClock(left)}</button>`}</header>
    <nav class="simbar">${c.qs.map((x, i) => `<button class="${i === SM.qi ? 'cur' : ''} ${SM.ans[SM.ch][i] >= 0 ? 'ans' : ''}" onclick="simGoQ(${i})">${i + 1}${SM.pins[SM.ch + ':' + i] ? '📌' : ''}</button>`).join('')}</nav>
    <main class="lbody simbody">`;
  if (c.type === 'rc') {
    h += `<button class="simtog" onclick="simToggleText()">${SM.showText ? '▲ להסתיר את הקטע' : '▼ להציג את הקטע'}</button>`;
    if (SM.showText) h += simPassage(c);
  }
  h += `<div class="prompt simq">${SM.qi + 1}. ${c.type === 'sc' ? 'השלימו את המשפט' : c.type === 'rs' ? 'איזה משפט אומר את אותו הדבר?' : 'שאלה על הקטע'}</div>`;
  if (c.type === 'sc') h += `<div class="sent en">${simBlank(q.q)}</div>`;
  else h += `<div class="sent en simsrc">${esc(q.q)}</div>`;
  h += `<div class="opts simopts">${q.o.map((o, i) => `<button class="opt en ${a === i ? 'sel' : ''}" onclick="simPick(${i})"><span class="simn">${i + 1}</span>${esc(o)}</button>`).join('')}</div></main>`;
  h += `<div class="lfoot simfoot"><button class="btn ghost simpin ${pin ? 'on' : ''}" onclick="simPin()" title="לסמן כדי לחזור">📌</button>
    <button class="btn ghost" onclick="simGoQ(${SM.qi - 1})" ${SM.qi === 0 ? 'disabled' : ''}>→ הקודמת</button>
    ${last ? `<button class="btn" onclick="simEndChapter()">סיום הפרק</button>` : `<button class="btn blue" onclick="simGoQ(${SM.qi + 1})">הבאה ←</button>`}</div>`;
  return h;
}
function simPassage(c) {
  return `<div class="simtext en"><b>${esc(c.title || '')}</b>${c.text.map((p, i) => `<p><span class="simpn">(${i + 1})</span> ${esc(p)}</p>`).join('')}</div>`;
}
function simToggleOpen(k) { simOpen[k] = !simOpen[k]; render(); }
function renderSimResult() {
  const { sim, rec, weak } = SM, ans = rec.ans;
  const pct = Math.round(rec.ok / rec.n * 100);
  const inApp = weak.filter(x => simAppItem(x.en)).length;
  let h = topBar() + `<main><div class="done simres"><div class="trophy">${pct >= 80 ? '🏆' : pct >= 55 ? '💪' : '📚'}</div>
    <div class="un">${esc(sim.title)}${rec.notimer ? ' · בלי טיימר' : ''}</div>
    <h2>ציון משוער: ${rec.est}</h2><div class="simband">רמה: ${simBand(rec.est)}</div>
    <div class="kpis"><div class="kpi g"><b>${rec.ok}/${rec.n}</b><span>נכונות</span></div>
      <div class="kpi b"><b>${rec.by.sc[0]}/${rec.by.sc[1]}</b><span>השלמת משפטים</span></div>
      <div class="kpi y"><b>${rec.by.rs[0]}/${rec.by.rs[1]}</b><span>ניסוח מחדש</span></div>
      <div class="kpi b"><b>${rec.by.rc[0]}/${rec.by.rc[1]}</b><span>הבנת הנקרא</span></div></div></div>
    <p class="foot">הערכה גסה: הסימולציה הזו מגיעה עד ציון ${sim.hi}, והמבחן האמיתי אדפטיבי. ${simTip(rec.by)}</p>`;
  if (weak.length) {
    h += `<h2 class="sec">💪 מילים לחזק (${weak.length})</h2><div class="card">
      ${weak.map(x => `<div class="dw"><b class="en">${esc(x.en)}</b><span class="dhe">${esc(x.he)}</span>${simAppItem(x.en) ? '<span class="simin" title="קיימת בתרגול">✓</span>' : ''}</div>`).join('')}
      ${inApp ? `<button class="btn blue" style="margin-top:12px" onclick="simPracticeLast()">לתרגל עכשיו (${inApp} מילים מהאפליקציה)</button>` : ''}
      <p class="foot">${SM.queued ? `${SM.queued} מילים שכבר למדת חזרו ל«חזרה». ` : ''}כל המילים נשמרו ברשימת החיזוק במסך הסימולציות.</p></div>`;
  }
  h += `<h2 class="sec">📋 כל השאלות עם הסברים</h2>`;
  let num = 0;
  sim.chapters.forEach((c, ci) => {
    h += `<div class="simch">פרק ${ci + 1} · ${SIM_TYPE[c.type].he}</div>`;
    if (c.type === 'rc') {
      const k = 'p' + ci;
      h += `<button class="simtog" onclick="simToggleOpen('${k}')">${simOpen[k] ? '▲ להסתיר את הקטע' : '▼ להציג את הקטע'}</button>${simOpen[k] ? simPassage(c) : ''}`;
    }
    c.qs.forEach((q, qi) => {
      num++;
      const my = ans[ci][qi], ok = my === q.a, k = ci + ':' + qi, open = simOpen[k] === undefined ? !ok : simOpen[k];
      h += `<div class="simr ${ok ? 'ok' : 'bad'}"><div class="simrh" onclick="simOpen['${k}']=${!open};render()"><span>${ok ? '✅' : '❌'} ${num}.</span><span class="en simrq">${esc(c.type === 'sc' ? q.q.replace(/___/g, '____') : q.q)}</span><span class="simar">${open ? '▲' : '▼'}</span></div>`;
      if (open) {
        h += `<div class="simrb">${q.o.map((o, i) => `<div class="simro ${i === q.a ? 'right' : i === my ? 'wrong' : ''}"><span class="simn">${i + 1}</span><span class="en">${esc(o)}</span>${i === q.a ? ' ✓' : i === my ? ' ✗' : ''}</div>`).join('')}
          ${my < 0 ? '<div class="sh-s">לא סימנת תשובה (נחשב טעות).</div>' : ''}
          <div class="simex">💡 ${esc(q.ex)}</div>
          ${q.w && q.w.length ? `<div class="simw">${q.w.map(([en, he]) => `<span class="chip" style="--c:#1899d6"><span class="en">${esc(en)}</span> = ${esc(he)}</span>`).join(' ')}</div>` : ''}</div>`;
      }
      h += `</div>`;
    });
  });
  h += `<div class="row" style="margin-top:16px"><button class="btn" onclick="simStart('${sim.id}')">לנסות שוב</button><button class="btn ghost" onclick="SM=null;render();window.scrollTo(0,0)">לכל הסימולציות</button></div>`;
  return h + '</main>' + navBar();
}
// עצה לפי החלק החלש
function simTip(by) {
  const r = k => by[k][1] ? by[k][0] / by[k][1] : 1;
  const worst = ['sc', 'rs', 'rc'].sort((a, b) => r(a) - r(b))[0];
  if (r(worst) >= 0.85) return 'מצוין בכל החלקים. אפשר לעבור לסימולציה קשה יותר.';
  return {
    sc: 'החלק החלש: השלמת משפטים. קודם קוראים את כל המשפט ומחפשים את הקשר (ניגוד, סיבה, תוספת), ורק אז מסתכלים על התשובות.',
    rs: 'החלק החלש: ניסוח מחדש. מסמנים במשפט המקור את מילות הקישור ואת מילות הכמות (all, some, rarely), ופוסלים כל תשובה שמשנה אחת מהן.',
    rc: 'החלק החלש: הבנת הנקרא. קודם קוראים את השאלה, אחר כך מחפשים בפסקה שהיא מפנה אליה. תשובה נכונה תמיד נשענת על משפט בקטע.',
  }[worst];
}

// עיצוב המסכים של הסימולציות (כאן ולא ב-index.html, כדי שהקובץ יעמוד בפני עצמו)
(function () {
  const css = `
.simc .row{margin-top:10px}
.simhead{gap:10px;border-bottom:2px solid var(--line)}
.simt{flex:1;font-weight:800;font-size:15px}
.simclock{background:var(--soft);border:2px solid var(--line);border-radius:12px;padding:6px 10px;font-weight:800;font-size:16px;font-variant-numeric:tabular-nums;color:var(--ink);min-width:66px}
.simclock.low{color:var(--rd);border-color:var(--r);background:#ffdfe0}
.simclock.hid{min-width:0}
.simbar{display:flex;gap:8px;padding:10px 16px 0;flex-wrap:wrap}
.simbar button{min-width:44px;height:40px;border-radius:12px;border:2px solid var(--line);background:var(--bg);font-weight:800;color:var(--mut);font-size:15px;padding:0 8px}
.simbar button.ans{background:#ddf4ff;color:var(--bd);border-color:#bfe6fd}
.simbar button.cur{border-color:var(--b);color:var(--bd);box-shadow:0 3px 0 var(--b)}
.simbody{padding-bottom:150px}
.simq{font-size:18px}
.simsrc{font-size:18px}
.simopts .opt{text-align:left;font-size:16px;font-weight:500;line-height:1.45;display:flex;gap:10px;align-items:flex-start;padding:12px}
.simopts .opt.sel{border-color:var(--b);background:#ddf4ff;box-shadow:0 4px 0 var(--b)}
.simn{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--soft);border:2px solid var(--line);font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;color:var(--mut)}
.opt.sel .simn{background:var(--b);border-color:var(--b);color:#fff}
.simfoot{display:flex;gap:10px}
.simfoot .btn{flex:1}
.simfoot .simpin{flex:0 0 56px;padding:14px 0}
.simfoot .simpin.on{background:#fff7d6;border-color:var(--y)}
.simfoot .btn:disabled{opacity:.4}
.simtog{background:none;border:0;color:var(--bd);font-weight:700;font-size:14px;align-self:flex-start;padding:4px 0}
.simtext{background:var(--soft);border:2px solid var(--line);border-radius:14px;padding:12px 14px;max-height:46vh;overflow:auto;font-size:16px;line-height:1.6;text-align:left}
.simtext p{margin:8px 0}
.simpn{color:var(--mut);font-size:13px;font-weight:700}
.simintro .un,.simres .un{font-size:14px;color:var(--mut);font-weight:700}
.simintro h2{color:var(--b);text-shadow:none}
.simhow{color:#4b4b4b;line-height:1.55;max-width:420px}
.simres h2{color:var(--gd);text-shadow:none}
.simband{font-weight:800;color:var(--bd);font-size:18px}
.simres .kpis{flex-wrap:wrap}
.simres .kpi{min-width:44%}
.simch{font-weight:800;color:#4b4b4b;margin:18px 4px 8px}
.simr{border:2px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden}
.simr.bad{border-color:#ffc1c1}
.simrh{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;cursor:pointer;font-weight:700}
.simrq{flex:1;font-weight:500;font-size:14px;line-height:1.45;text-align:left;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.simar{color:var(--mut);font-size:12px}
.simrb{padding:0 12px 12px;display:flex;flex-direction:column;gap:6px}
.simro{direction:ltr;display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.45;padding:6px 8px;border-radius:10px;text-align:left}
.simro.right{background:#d7ffb8;color:#3f7f00;font-weight:600}
.simro.wrong{background:#ffdfe0;color:#c21f1f}
.simex{background:#fff7d6;border:2px solid #ffe28a;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.55}
.simw{display:flex;flex-wrap:wrap;gap:6px}
.simin{color:var(--g);font-weight:800}
`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
