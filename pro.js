'use strict';
// ===== פטורנט: דף נחיתה, היכרות ואבחון, הגדרות חשבון ולוג =====
// נטען אחרי sim-app.js ולפני app.js (loader.js). משתמש בפונקציות של app.js רק בזמן ריצה.
// הכול חינם ופתוח לכולם (רועי 28/10): free.js מכיל את כל התוכן. TIER_META = כמה יש (free.js)

const BRAND = 'פטורנט', CONTACT = 'roe.liderman2003@gmail.com';

// ----- לוג אירועים ושגיאות (לטבלה amirnet.events, עד 300 ביום למשתמש) -----
let logN = 0;
function logEv(kind, data) {
  if (typeof ME === 'undefined' || !ME || logN > 120) return;
  logN++;
  try { sb.rpc('amirnet_log', { p_kind: kind, p_data: Object.assign({ full: !!window.FULL }, data || {}) }).then(() => {}, () => {}); } catch (e) {}
}
let errN = 0;
window.addEventListener('error', e => { if (errN++ < 5) logEv('error', { m: String(e.message).slice(0, 300), f: String(e.filename || '').split('/').pop(), l: e.lineno }); });
window.addEventListener('unhandledrejection', e => { if (errN++ < 5) logEv('error', { m: String(e.reason && e.reason.message || e.reason).slice(0, 300) }); });

// ----- דף נחיתה (במקום מסך הכניסה) -----
function renderLanding(booting) {
  const m = TIER_META, words = m.words.link + m.words.vocab;
  const cta = booting ? '<p class="sub">טוען...</p>' : `<button class="btn gbtn" onclick="googleLogin()">${G_LOGO}<span>להתחיל בחינם עם Google</span></button><div id="lmsg" class="lmsg"></div>`;
  return `<main class="land">
    <section class="hero"><img src="icon.svg" alt="" class="logo"><h1>${BRAND}</h1>
      <p class="tag">הכנה ממוקדת לאמירנט: לפטור באנגלית, לרמה שצריך לתואר, או לעבור את סף הקבלה</p>
      ${cta}<p class="fine">חינם לגמרי, בלי כרטיס אשראי. ההתקדמות נשמרת בחשבון שלך, מכל טלפון או מחשב.</p></section>
    <section class="feat">
      <div><span>📚</span><b>${words} מילים שחוזרות באמירנט</b><p>מילות קישור ואוצר מילים בחזרה מרווחת, כמו בדואלינגו. 10 דקות ביום מזיזות ציון.</p></div>
      <div><span>📝</span><b>${m.sims} סימולציות אדפטיביות</b><p>במבנה של המבחן, עם שעון לכל פרק, ציון משוער בסולם 50-150 והסבר לכל שאלה.</p></div>
      <div><span>🎯</span><b>תרגול לפי חלק</b><p>השלמת משפטים, ניסוח מחדש והבנת הנקרא, ב-4 רמות קושי, ${m.practice} פרקים.</p></div>
      <div><span>🧭</span><b>אבחון ותוכנית אישית</b><p>מבחן קצר בהתחלה קובע את הרמה שלך, ויעד יומי שמתאים לתאריך המבחן.</p></div>
    </section>
    <section class="faq"><h2>שאלות נפוצות</h2>
      <details><summary>כמה זה עולה?</summary><p>כלום. כל המילים, הסימולציות והתרגול לפי חלק פתוחים לכולם, בלי תשלום ובלי מנוי.</p></details>
      <details><summary>הציון בסימולציה הוא הציון שאקבל?</summary><p>לא בהכרח. זו הערכה לפי התשובות וקושי השאלות, ולא תחזית או התחייבות. היא טובה כדי לראות התקדמות ואיזה חלק לחזק.</p></details>
      <details><summary>זה קשור למאל"ו או לאמירנט הרשמי?</summary><p>לא. ${BRAND} הוא מוצר עצמאי להכנה לבחינה, ואין לו קשר למרכז הארצי לבחינות ולהערכה. כל השאלות נכתבו במיוחד.</p></details>
      <details><summary>אפשר בטלפון?</summary><p>כן. אפשר גם להתקין למסך הבית ולתרגל בלי אינטרנט.</p></details>
    </section>
    ${booting ? '' : `<section class="hero"><button class="btn gbtn" onclick="googleLogin()">${G_LOGO}<span>להתחיל בחינם</span></button></section>`}
    ${legalFoot()}</main>`;
}
function legalFoot() {
  return `<footer class="legal"><a href="terms.html">תנאי שימוש</a> · <a href="privacy.html">מדיניות פרטיות</a> · <a href="accessibility.html">הצהרת נגישות</a> · <a href="mailto:${CONTACT}">יצירת קשר</a>
    <p>${BRAND} הוא מוצר עצמאי ואינו קשור למרכז הארצי לבחינות ולהערכה (מאל"ו). «אמירנט» מוזכר רק כדי לתאר את הבחינה.</p></footer>`;
}

// ----- היכרות: 3 שאלות, ואז אבחון -----
const GOALS = [['exempt', 'פטור מאנגלית (134+)', 134], ['adv2', 'מתקדמים ב׳ (120+)', 120], ['adv1', 'מתקדמים א׳ (100+)', 100], ['basic', 'בסיסי / סף קבלה (85+)', 85], ['unsure', 'עוד לא יודע', 0]];
let onb = { date: '', goal: '', min: 20 };
function renderOnb() {
  return `<main class="onb"><h2 class="sec">👋 ברוך הבא ל${BRAND}</h2><p class="sub2">3 שאלות קצרות, כדי לבנות לך תוכנית.</p>
    <div class="card"><b>מתי המבחן?</b><input type="date" class="search" value="${onb.date}" min="${dayKey()}" onchange="onb.date=this.value">
      <label class="sw"><input type="checkbox" ${onb.date === 'none' ? 'checked' : ''} onchange="onb.date=this.checked?'none':'';render()"> עוד לא נקבע</label></div>
    <div class="card"><b>מה המטרה?</b><div class="chips">${GOALS.map(([k, he]) => `<button class="skip ${onb.goal === k ? 'on' : ''}" onclick="onb.goal='${k}';render()">${he}</button>`).join('')}</div></div>
    <div class="card"><b>כמה זמן ביום תוכל לתרגל?</b><div class="chips">${[10, 20, 30, 45].map(n => `<button class="skip ${onb.min === n ? 'on' : ''}" onclick="onb.min=${n};render()">${n} דקות</button>`).join('')}</div></div>
    <button class="btn big" onclick="onbDone(true)">המשך לאבחון קצר (כ-14 דקות)</button>
    <button class="btn ghost" onclick="onbDone(false)">אעשה את האבחון אחר כך</button></main>`;
}
function onbDone(diag) {
  const days = onb.date && onb.date !== 'none' ? daysBetween(dayKey(), onb.date) : 0;
  S.onb = { date: onb.date === 'none' ? '' : onb.date, goal: onb.goal || 'unsure', min: onb.min, at: Date.now() };
  // יעד ימים לכל נושא: עד 3 ימים לפני המבחן (מינימום שבוע). בלי תאריך: לפי הזמן ביום
  const d = days > 0 ? Math.max(7, Math.min(90, days - 3)) : ({ 10: 60, 20: 45, 30: 30, 45: 21 }[onb.min] || 30);
  S.plan = Object.assign({}, S.plan, { link: Math.min(d, 21), vocab: d });
  S.start = dayKey(); S.starts = Object.assign({}, S.starts, { vocab: dayKey() });
  save(); logEv('onboard', S.onb);
  if (diag) diagStart(); else go('home');
}
function examDays() { return S.onb && S.onb.date ? daysBetween(dayKey(), S.onb.date) : null; }

// ----- אבחון התחלתי: 3 פרקים אדפטיביים (השלמת משפטים ← ניסוח מחדש ← השלמת משפטים), ציון משוער ורמה מומלצת -----
// הפרקים קבועים (DIAG_SETS ב-tools/build-tiers.js), ולכן נמצאים גם בגרסה החינמית
function diagChapter(id) { return Object.assign({}, PRACTICE_SETS[id], { ref: id, key: 'diag' }); }
function diagStart() {
  const ch = diagChapter('x1sc2');
  SM = { diag: true, total: 3, form: { he: 'אבחון' }, chs: [ch], ch: 0, qi: 0, intro: true, ans: [ch.qs.map(() => -1)], pins: {}, notimer: false, end: 0, done: false, showText: true };
  view = 'sims'; render(); window.scrollTo(0, 0);
}
function diagNext() {
  clearInterval(simTick);
  const c = SM.chs[SM.ch], ok = c.qs.filter((q, i) => SM.ans[SM.ch][i] === q.a).length;
  const nx = SM.ch === 0 ? (ok >= 3 ? 'x2rs2' : 'x0rs2') : SM.ch === 1 ? (c.tier >= 2 ? (ok >= 2 ? 'x3sc2' : 'x1sc3') : (ok >= 2 ? 'x1sc3' : 'x0sc2')) : null;
  if (nx) {
    const ch = diagChapter(nx);
    SM.chs.push(ch); SM.ans.push(ch.qs.map(() => -1)); SM.ch++; SM.intro = true;
    render(); window.scrollTo(0, 0); return;
  }
  const est = simScale(simTheta(simResponses(SM.chs, SM.ans)));
  const n = SM.chs.reduce((a, x) => a + x.qs.length, 0), good = SM.chs.reduce((a, x, ci) => a + x.qs.filter((q, i) => SM.ans[ci][i] === q.a).length, 0);
  const weak = simWeakWords(SM.chs, SM.ans), queued = simKeepWeak(weak);
  S.diag = { at: Date.now(), est, ok: good, n, tiers: SM.chs.map(x => x.tier) };
  simStore().pt = est >= 120 ? 3 : est >= 100 ? 2 : est >= 85 ? 1 : 0;
  save(); push(); logEv('diag', { est, ok: good });
  SM.done = true; SM.rec = { ans: SM.ans, est, ok: good, n }; SM.weak = weak; SM.queued = queued; simOpen = {};
  render(); window.scrollTo(0, 0);
}
function renderDiagResult() {
  const { rec, chs, weak } = SM, goal = GOALS.find(g => g[0] === (S.onb && S.onb.goal)), days = examDays();
  const gap = goal && goal[2] ? goal[2] - rec.est : null, gname = goal ? `${goal[1].replace(/ \(.*\)$/, '')} ${goal[2]}+` : '';
  let h = topBar() + `<main><div class="done simres"><div class="trophy">🧭</div><div class="un">אבחון התחלתי · ${rec.ok}/${rec.n} נכונות</div>
    <div class="simscore">${rec.est}</div><div class="simband">ציון משוער · ${simBand(rec.est)}</div>
    <div class="simgoal">${gap === null ? '' : gap <= 0 ? `כבר עכשיו אתה בערך ברמת היעד (${gname}). נשמור על זה ונחזק את החלקים החלשים.` : `עד היעד (${gname}) חסרות בערך ${gap} נקודות.`}
      ${days !== null && days > 0 ? ` נשארו ${days} ימים עד המבחן, והיעד היומי נקבע לפי זה.` : ''}</div></div>
    <p class="foot">האבחון קצר (${rec.n} שאלות) ולכן הציון הוא הערכה גסה בלבד, בטווח של כ-15 נקודות לכל כיוון. סימולציה מלאה תיתן הערכה טובה יותר.
      רמת התרגול הומלצה לפי התוצאה: ${SIM_TIER_HE[simStore().pt]}.</p>
    <button class="btn big" onclick="SM=null;go('home')">להתחיל ללמוד</button>`;
  h += simWeakBlock(weak) + simReview(chs, rec.ans);
  return h + '</main>' + navBar();
}
function diagCard() {
  if (S.diag) return '';
  return `<div class="card diagc"><b>🧭 אבחון התחלתי</b><p>כ-14 דקות, 11 שאלות. נותן ציון משוער ובוחר בשבילך את רמת התרגול.</p><button class="btn blue" onclick="diagStart()">להתחיל אבחון</button></div>`;
}

// ----- הגדרות: ציון אמיתי, הורדת נתונים, מחיקת חשבון -----
function proSettings() {
  return `<div class="card"><b>📮 כבר נבחנת באמירנט?</b><p>ספר לנו מה קיבלת. זה עוזר לנו לדייק את הציון המשוער לכולם.</p>
      <div class="row"><input id="rscore" class="search" type="number" min="50" max="150" inputmode="numeric" placeholder="הציון (50-150)"><input id="rdate" class="search" type="date" max="${dayKey()}"></div>
      <button class="btn ghost" onclick="sendRealScore(this)">שליחה</button></div>
    <div class="card"><b>🔐 הנתונים שלך</b><p>אפשר להוריד עותק של כל ההתקדמות שלך, או למחוק את החשבון לגמרי.</p>
      <div class="row"><button class="btn ghost" onclick="downloadMyData()">הורדת הנתונים שלי</button><button class="btn red" onclick="deleteMe()">מחיקת החשבון שלי</button></div></div>
    ${legalFoot()}`;
}
async function sendRealScore(btn) {
  const sc = +document.getElementById('rscore').value, dt = document.getElementById('rdate').value || null;
  if (!(sc >= 50 && sc <= 150)) { toast('הציון באמירנט הוא בין 50 ל-150'); return; }
  const last = SIM_FORMS.flatMap(f => simRecs(f.id)).sort((a, b) => b.at - a.at)[0];
  btn.disabled = true;
  try { const r = await rpc('amirnet_real_score', { p_score: sc, p_date: dt, p_est: last ? last.est : (S.diag ? S.diag.est : null) }); toast(r.ok ? '✓ תודה! נשמר' : 'לא נשמר, נסה שוב'); }
  catch (e) { toast('לא נשמר, נסה שוב'); }
  btn.disabled = false;
}
function downloadMyData() {
  const blob = new Blob([JSON.stringify({ account: { name: ME.name, email: ME.email }, progress: S, exported: new Date().toISOString() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'patornet-my-data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function deleteMe() {
  if (!confirm('למחוק את החשבון וכל ההתקדמות? אי אפשר לשחזר.')) return;
  try {
    const r = await rpc('amirnet_delete_me');
    if (!r.ok) throw r;
    try { localStorage.clear(); } catch (e) {}
    try { await sb.auth.signOut(); } catch (e) {}
    try { (await caches.keys()).forEach(k => caches.delete(k)); } catch (e) {}
    alert('החשבון נמחק.');
    location.reload();
  } catch (e) { toast('המחיקה לא הצליחה. אפשר לכתוב ל-' + CONTACT); }
}

// ----- עיצוב -----
(function () {
  const css = `
.land{padding:20px 16px 40px;display:flex;flex-direction:column;gap:22px}
.hero{text-align:center;display:flex;flex-direction:column;gap:12px}
.hero h1{margin:0;font-size:32px;color:var(--gd)}
.tag{font-size:18px;line-height:1.5;margin:0;color:#4b4b4b;font-weight:500}
.fine{font-size:13px;color:var(--mut);margin:0;line-height:1.5}
.feat{display:grid;gap:10px}
.feat div{border:2px solid var(--line);border-radius:16px;padding:12px 14px;display:grid;grid-template-columns:auto 1fr;column-gap:12px}
.feat span{font-size:28px;grid-row:span 2}
.feat b{font-size:16px}
.feat p{margin:2px 0 0;font-size:14px;color:#4b4b4b;line-height:1.5}
.faq h2{font-size:20px;margin:0 0 10px;text-align:center}
.faq details{border:2px solid var(--line);border-radius:14px;padding:10px 14px;margin-bottom:8px}
.faq summary{font-weight:700;cursor:pointer}
.faq p{margin:8px 0 0;line-height:1.55;color:#4b4b4b;font-size:15px}
.legal{text-align:center;font-size:13px;color:var(--mut);line-height:1.7;margin-top:8px}
.legal a{color:var(--bd)}
.legal p{margin:6px 0 0}
.diagc{border-color:#bfe6fd;background:#f2fbff}
.onb{padding:16px 16px 40px}
.sub2{color:var(--mut);margin:0 4px 12px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.skip.on{background:#ddf4ff;border-color:var(--b)}
.onb .search,.card .search{width:100%;margin-top:8px}
`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
