'use strict';
// ===== סימולציות בפורמט אמירנט =====
// המבנה לפי מצגת מאל"ו (12/2024): 6 פרקים, לכל פרק זמן קבוע, אפשר לנוע בין שאלות הפרק ולשנות תשובה עד שהזמן נגמר.
// אדפטיבי כמו אמירנט: כולם מתחילים מאותה רמה, ואחרי כל פרק נבחר הקושי של הפרק הבא לפי ההצלחה בו.
// הציון מחושב מכל התשובות ומהקושי של כל שאלה (מודל IRT), ומומר לסולם 50-150.
// מאגר השאלות ב-sims.js (SIMS): 12 סט-פרקים ב-4 רמות קושי (sim.tier 0-3). התוצאות נשמרות ב-S.sims ונשמרות בענן.
// משתמש בפונקציות הגלובליות של app.js: S, ITEMS/ALL, save, push, render, esc, shuffle, toast, startLesson, topBar, navBar.

const SIM_TYPE = {
  sc: { he: 'השלמת משפטים', n: 4, min: 4, how: 'בחרו את התשובה שמשלימה את המשפט בצורה הטובה ביותר.' },
  rs: { he: 'ניסוח מחדש', n: 3, min: 6, how: 'בחרו את המשפט שאומר את אותו הדבר כמו משפט המקור, בלי להוסיף ובלי לשנות את המשמעות.' },
  rc: { he: 'הבנת הנקרא', n: 5, min: 15, how: 'קראו את הקטע וענו על 5 השאלות. אפשר לעבור בין השאלות ולחזור לקטע בכל רגע.' },
};
const SIM_ORDER = ['sc', 'sc', 'rc', 'rs', 'rs', 'sc']; // סדר הפרקים באמירנט
const SIM_N = SIM_ORDER.reduce((a, t) => a + SIM_TYPE[t].n, 0), SIM_MIN = SIM_ORDER.reduce((a, t) => a + SIM_TYPE[t].min, 0);
// טווחי הציון באמירנט (50-150) ורמות המיון
const SIM_BANDS = [[134, 'פטור'], [120, 'מתקדמים ב׳'], [100, 'מתקדמים א׳'], [85, 'בסיסי'], [70, 'טרום בסיסי ב׳'], [50, 'טרום בסיסי א׳']];
// הנחות המודל (מאל"ו לא מפרסם אותן): 4 רמות קושי, קושי b לכל רמה, הבחנה A, סיכוי ניחוש C (4 תשובות), ציון = 100 + 25θ
const SIM_TIER_HE = ['קל', 'בינוני', 'קשה', 'קשה מאוד'];
const SIM_B = [-1.2, -0.2, 0.8, 1.8], SIM_A = 1.5, SIM_C = 0.25, SIM_START = 1;
const SIM_FORMS = [{ id: 'f1', he: 'מבחן 1', k: 0 }, { id: 'f2', he: 'מבחן 2', k: 1 }, { id: 'f3', he: 'מבחן 3', k: 2 }, { id: 'mix', he: 'מבחן מעורב', k: -1 }];
const SIM_KEEP = 3; // כמה ניסיונות אחרונים נשמרים לכל מבחן
let SM = null, simTick = null, simOpen = {};

function simStore() {
  if (!S.sims || typeof S.sims !== 'object') S.sims = {};
  if (!S.sims.r) S.sims.r = {};
  if (!S.sims.words) S.sims.words = {};
  return S.sims;
}
const simForm = id => SIM_FORMS.find(f => f.id === id);
const simBand = est => SIM_BANDS.find(b => est >= b[0])[1];
const simClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const simBlank = s => esc(s).replace(/___/g, '<span class="blank">______</span>');
const simTierSims = t => SIMS.filter(s => s.tier === t);

// ----- בחירת פרקים (אדפטיבי) -----
function simChapter(simId, slot, tier) {
  const s = SIMS.find(x => x.id === simId);
  return Object.assign({}, s.chapters[slot], { tier, ref: [simId, slot] });
}
// מבחן 1-3: אותו סט בכל רמה (בלי חפיפה בין המבחנים). מעורב: פרק שעוד לא הופיע בניסיונות הקודמים, אם יש
function simPickChapter(form, slot, tier) {
  const pool = simTierSims(tier);
  if (form.k >= 0) return simChapter(pool[form.k % pool.length].id, slot, tier);
  const seen = new Set(Object.values(simStore().r).flat().flatMap(r => (r.refs || []).map(x => x.join(':'))));
  const fresh = pool.filter(s => !seen.has(s.id + ':' + slot));
  return simChapter(pick(fresh.length ? fresh : pool).id, slot, tier);
}
// אחרי כל פרק: 75%+ נכונות → קשה יותר, עד שליש → קל יותר, אחרת אותה רמה
function simNextTier(tier, ok, n) { const r = ok / n; return r >= 0.75 ? Math.min(3, tier + 1) : r <= 0.34 ? Math.max(0, tier - 1) : tier; }

// ----- ציון -----
// הסתברות לתשובה נכונה ביכולת θ על שאלה בקושי b (מודל 3PL), ואומדן EAP של θ מכל התשובות
const simP = (t, b) => SIM_C + (1 - SIM_C) / (1 + Math.exp(-SIM_A * (t - b)));
function simTheta(resp) {
  let num = 0, den = 0;
  for (let t = -4; t <= 4.0001; t += 0.05) {
    let l = Math.exp(-t * t / 2);
    for (const [b, ok] of resp) { const p = simP(t, b); l *= ok ? p : 1 - p; }
    num += t * l; den += l;
  }
  return num / den;
}
const simScale = t => Math.round(Math.max(50, Math.min(150, 100 + 25 * t)));
function simResponses(chs, ans) { return chs.flatMap((c, ci) => c.qs.map((q, qi) => [SIM_B[c.tier], ans[ci][qi] === q.a])); }
function simScoreHow() {
  return 'המבחן מתאים את עצמו כמו אמירנט: הפרק הראשון ברמה בינונית, ולפי ההצלחה בכל פרק הפרק הבא קשה או קל יותר. הציון מחושב מכל התשובות ומהקושי של כל שאלה: תשובה נכונה בשאלה קשה מעלה יותר, וניחוש לא מוריד. מאל"ו מפרסם רק את העיקרון. מספר רמות הקושי (כאן 4), הנוסחה (מודל IRT עם סיכוי ניחוש של 25%) וההמרה לסולם הן הנחות שלנו, ולכן הציון מדויק בערך ±10.';
}
// מה חסר לרמה הבאה: כמה תשובות שגויות היו צריכות להיות נכונות (מהקשות, ששוות יותר) כדי לעבור את הסף
function simNextGoal(rec, chs) {
  const next = SIM_BANDS.slice().reverse().find(b => b[0] > rec.est);
  if (!next) return 'הגעת לרמת פטור, הרמה הגבוהה ביותר. 🏆';
  const resp = simResponses(chs, rec.ans);
  const wrong = resp.map((r, i) => [r[0], i]).filter((_, i) => !resp[i][1]).sort((a, b) => b[0] - a[0]);
  for (let k = 1; k <= wrong.length; k++) {
    const r2 = resp.map(r => r.slice());
    wrong.slice(0, k).forEach(([, i]) => { r2[i][1] = true; });
    if (simScale(simTheta(r2)) >= next[0]) return `עד ${next[1]} (${next[0]}) חסרות ${next[0] - rec.est} נקודות: בערך עוד ${k} תשובות נכונות. הצלחה בפרקים הראשונים מעבירה לשאלות קשות יותר, ששוות יותר.`;
  }
  return `עד ${next[1]} (${next[0]}) חסרות ${next[0] - rec.est} נקודות. כדי להגיע לשם צריך להצליח כבר בפרקים הראשונים, כדי שהמבחן יעבור לשאלות קשות יותר, ששוות יותר.`;
}

// ----- התחלה וניווט -----
function simStart(id) {
  const form = simForm(id);
  const notimer = !!(document.getElementById('simnotimer') || {}).checked;
  const first = simPickChapter(form, 0, SIM_START);
  SM = { form, chs: [first], ch: 0, qi: 0, intro: true, ans: [first.qs.map(() => -1)], pins: {}, notimer, end: 0, done: false, showText: true };
  view = 'sims';
  render(); window.scrollTo(0, 0);
}
function simBeginChapter() {
  SM.intro = false; SM.qi = 0; SM.showText = true;
  SM.end = Date.now() + SIM_TYPE[SM.chs[SM.ch].type].min * 60000;
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
  const c = SM.chs[SM.ch], ok = c.qs.filter((q, i) => SM.ans[SM.ch][i] === q.a).length;
  if (SM.ch < SIM_ORDER.length - 1) {
    const nx = simPickChapter(SM.form, SM.ch + 1, simNextTier(c.tier, ok, c.qs.length));
    SM.chs.push(nx); SM.ans.push(nx.qs.map(() => -1));
    SM.ch++; SM.intro = true; render(); window.scrollTo(0, 0); return;
  }
  simFinish();
}
function simQuit() {
  if (SM && !SM.done && !confirm('לצאת מהסימולציה? התשובות של הניסיון הזה לא יישמרו.')) return;
  clearInterval(simTick); SM = null; render(); window.scrollTo(0, 0);
}

// ----- סיום: ציון, שמירה ומילים לחיזוק -----
function simWeakWords(chs, ans) {
  const out = new Map();
  chs.forEach((c, ci) => c.qs.forEach((q, qi) => {
    if (ans[ci][qi] === q.a) return;
    (q.w || []).forEach(([en, he]) => { const k = en.toLowerCase(); if (!out.has(k)) out.set(k, { en, he }); });
  }));
  return [...out.values()];
}
// מילה מהסימולציה שקיימת באפליקציה (מילות קישור / אוצר מילים) מקבלת את הפריט שלה
function simAppItem(en) { const k = en.toLowerCase(); return (typeof ALL !== 'undefined' ? ALL : ITEMS).find(w => w.en.toLowerCase() === k) || null; } // שני הנושאים: מילות קישור קודם, ואז אוצר מילים
function simFinish() {
  clearInterval(simTick);
  const { form, chs, ans } = SM;
  const by = { sc: [0, 0], rs: [0, 0], rc: [0, 0] };
  let ok = 0, n = 0;
  chs.forEach((c, ci) => c.qs.forEach((q, qi) => { n++; by[c.type][1]++; if (ans[ci][qi] === q.a) { ok++; by[c.type][0]++; } }));
  const theta = simTheta(simResponses(chs, ans)), est = simScale(theta);
  const st = simStore();
  const weak = simWeakWords(chs, ans);
  // מילים שכבר נלמדו באפליקציה חוזרות מיד ל«חזרה»; כל המילים נשמרות ברשימת החיזוק
  let queued = 0;
  weak.forEach(x => {
    st.words[x.en.toLowerCase()] = { en: x.en, he: x.he, at: Date.now() };
    const it = simAppItem(x.en);
    if (it && S.w[it.id]) { S.w[it.id].due = Date.now(); queued++; }
  });
  const rec = { at: Date.now(), form: form.id, ok, n, est, band: simBand(est), theta: Math.round(theta * 100) / 100, tiers: chs.map(c => c.tier), refs: chs.map(c => c.ref), by, ans, notimer: SM.notimer };
  st.r[form.id] = [rec, ...(st.r[form.id] || [])].slice(0, SIM_KEEP);
  save(); push();
  SM.done = true; SM.rec = rec; SM.weak = weak; SM.queued = queued;
  simOpen = {};
  render(); window.scrollTo(0, 0);
}
function simShowLast(id) {
  const rec = (simStore().r[id] || [])[0];
  if (!rec || !rec.refs) return;
  const chs = rec.refs.map(([sid, slot], i) => simChapter(sid, slot, rec.tiers[i]));
  SM = { form: simForm(id), chs, ans: rec.ans, done: true, rec, weak: simWeakWords(chs, rec.ans), queued: 0, pins: {} };
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
    <div class="card"><p>מבחן אחד לכולם, כמו אמירנט: 6 פרקים (3 השלמת משפטים, קטע קריאה ו-2 ניסוח מחדש), ${SIM_N} שאלות ו-${SIM_MIN} דקות. הפרק הראשון ברמה בינונית, ולפי ההצלחה בכל פרק הפרק הבא קשה או קל יותר. בסוף מקבלים ציון אחד בסולם 50-150 ואת הרמה.</p>
    <p>בתוך פרק אפשר לעבור בין השאלות ולשנות תשובה עד שהזמן נגמר. שאלה בלי תשובה נחשבת טעות, אז תמיד כדאי לנחש.</p>
    <label class="sw"><input type="checkbox" id="simnotimer"> בלי טיימר (תרגול רגוע)</label></div>`;
  SIM_FORMS.forEach(f => {
    const rs = st.r[f.id] || [], last = rs[0], best = rs.reduce((m, r) => Math.max(m, r.est), 0);
    h += `<div class="card simc"><div class="plan-h"><b>${f.he}</b><span>${SIM_N} שאלות · ${SIM_MIN} דק׳</span></div>
      ${f.k < 0 ? '<div class="lbl"><span>פרקים מכל המבחנים, קודם כאלה שעוד לא ראית</span></div>' : ''}
      ${last ? `<div class="lbl"><span>אחרון: ציון ${last.est} (${last.band || simBand(last.est)})</span><span>הגבוה: ${best}</span></div>` : '<div class="lbl"><span>עוד לא נעשה</span></div>'}
      <div class="row"><button class="btn" onclick="simStart('${f.id}')">${last ? 'עוד פעם' : 'להתחיל'}</button>${last && last.refs ? `<button class="btn ghost" onclick="simShowLast('${f.id}')">תוצאות והסברים</button>` : ''}</div></div>`;
  });
  const words = Object.values(st.words).sort((a, b) => b.at - a.at);
  if (words.length) {
    h += `<h2 class="sec">💪 מילים לחיזוק מהסימולציות (${words.length})</h2><div class="card">
      ${words.slice(0, 40).map(x => `<div class="dw"><b class="en">${esc(x.en)}</b><span class="dhe">${esc(x.he)}</span>${simAppItem(x.en) ? '<span class="simin" title="קיימת בתרגול">✓</span>' : ''}</div>`).join('')}
      <div class="row" style="margin-top:12px"><button class="btn blue" onclick="simPracticeAll()">לתרגל את המילים</button><button class="btn ghost" onclick="simClearWords()">לנקות</button></div>
      <p class="foot">✓ = המילה קיימת בתרגול של האפליקציה ותיכנס לשיעור. השאר מופיעות כאן עם הפירוש.</p></div>`;
  }
  return h + '</main>' + navBar();
}
function renderSimIntro() {
  const c = SM.chs[SM.ch], t = SIM_TYPE[c.type];
  return `<main class="done simintro"><div class="trophy">${c.type === 'rc' ? '📄' : c.type === 'rs' ? '🔄' : '✏️'}</div>
    <div class="un">${SM.form.he} · פרק ${SM.ch + 1} מתוך ${SIM_ORDER.length}</div>
    <h2>${t.he}</h2><p class="simhow">${t.how}</p>
    <div class="kpis"><div class="kpi b"><b>${c.qs.length}</b><span>שאלות</span></div><div class="kpi y"><b>${SM.notimer ? '∞' : t.min}</b><span>דקות</span></div></div>
    <button class="btn big" onclick="simBeginChapter()">להתחיל את הפרק</button>
    <button class="btn ghost" onclick="simQuit()">יציאה מהסימולציה</button></main>`;
}
function renderSimQuestion() {
  const c = SM.chs[SM.ch], q = c.qs[SM.qi], a = SM.ans[SM.ch][SM.qi], t = SIM_TYPE[c.type];
  const left = SM.end - Date.now(), last = SM.qi === c.qs.length - 1, pin = SM.pins[SM.ch + ':' + SM.qi];
  let h = `<header class="lhead simhead"><button class="x" onclick="simQuit()" aria-label="יציאה">✕</button>
    <span class="simt">פרק ${SM.ch + 1}/${SIM_ORDER.length} · ${t.he}</span>
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
  const { form, chs, rec, weak } = SM, ans = rec.ans;
  const pct = Math.round(rec.ok / rec.n * 100);
  const inApp = weak.filter(x => simAppItem(x.en)).length;
  const best = (simStore().r[form.id] || []).reduce((m, r) => Math.max(m, r.est), 0);
  let h = topBar() + `<main><div class="done simres"><div class="trophy">${pct >= 80 ? '🏆' : pct >= 55 ? '💪' : '📚'}</div>
    <div class="un">${form.he}${rec.notimer ? ' · בלי טיימר' : ''}</div>
    <div class="simscore">${rec.est}</div><div class="simband">ציון אמירנט · ${simBand(rec.est)}</div>
    <div class="simgoal">${simNextGoal(rec, chs)}</div>
    <div class="kpis"><div class="kpi g"><b>${rec.ok}/${rec.n}</b><span>נכונות</span></div>
      <div class="kpi b"><b>${rec.by.sc[0]}/${rec.by.sc[1]}</b><span>השלמת משפטים</span></div>
      <div class="kpi y"><b>${rec.by.rs[0]}/${rec.by.rs[1]}</b><span>ניסוח מחדש</span></div>
      <div class="kpi b"><b>${rec.by.rc[0]}/${rec.by.rc[1]}</b><span>הבנת הנקרא</span></div></div>
    <div class="simpath">מסלול הקושי: ${chs.map(c => SIM_TIER_HE[c.tier]).join(' ← ')}</div></div>
    <p class="foot">איך חושב הציון: ${simScoreHow()}${best > rec.est ? ` הציון הגבוה שלך במבחן הזה: ${best}.` : ''}</p>
    <p class="foot">${simTip(rec.by)}</p>`;
  if (weak.length) {
    h += `<h2 class="sec">💪 מילים לחזק (${weak.length})</h2><div class="card">
      ${weak.map(x => `<div class="dw"><b class="en">${esc(x.en)}</b><span class="dhe">${esc(x.he)}</span>${simAppItem(x.en) ? '<span class="simin" title="קיימת בתרגול">✓</span>' : ''}</div>`).join('')}
      ${inApp ? `<button class="btn blue" style="margin-top:12px" onclick="simPracticeLast()">לתרגל עכשיו (${inApp} מילים מהאפליקציה)</button>` : ''}
      <p class="foot">${SM.queued ? `${SM.queued} מילים שכבר למדת חזרו ל«חזרה». ` : ''}כל המילים נשמרו ברשימת החיזוק במסך הסימולציות.</p></div>`;
  }
  h += `<h2 class="sec">📋 כל השאלות עם הסברים</h2>`;
  let num = 0;
  chs.forEach((c, ci) => {
    h += `<div class="simch">פרק ${ci + 1} · ${SIM_TYPE[c.type].he} · ${SIM_TIER_HE[c.tier]}</div>`;
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
  h += `<div class="row" style="margin-top:16px"><button class="btn" onclick="simStart('${form.id}')">לנסות שוב</button><button class="btn ghost" onclick="SM=null;render();window.scrollTo(0,0)">לכל המבחנים</button></div>`;
  return h + '</main>' + navBar();
}
// עצה לפי החלק החלש
function simTip(by) {
  const r = k => by[k][1] ? by[k][0] / by[k][1] : 1;
  const worst = ['sc', 'rs', 'rc'].sort((a, b) => r(a) - r(b))[0];
  if (r(worst) >= 0.85) return 'מצוין בכל החלקים. נסו מבחן אחר כדי לראות אם זה יציב.';
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
.simpath{font-size:14px;color:var(--mut);font-weight:700;margin-top:4px}
.simrec{font-size:12px;background:var(--g);color:#fff;border-radius:99px;padding:2px 10px;vertical-align:middle;margin-right:6px}
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
.simscore{font-size:64px;font-weight:800;color:var(--gd);line-height:1}
.simband{font-weight:800;color:var(--bd);font-size:18px}
.simgoal{font-size:15px;line-height:1.5;color:#4b4b4b;max-width:420px}
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
