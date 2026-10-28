'use strict';
// טוען את פטורנט: ספריית ההתחברות והתוכן המלא (free.js, פתוח לכולם). רק אחר כך את האפליקציה עצמה.
(function () {
  const fail = msg => {
    document.getElementById('app').innerHTML = `<main class="login"><img src="icon.svg" alt="" class="logo"><h1>פטורנט</h1>
      <p class="sub">${msg}</p><button class="btn" onclick="location.reload()">לנסות שוב</button></main>`;
  };
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.body.appendChild(s); });
  (async () => {
    if (typeof supabase === 'undefined' || typeof TIER_META === 'undefined' || typeof CLOUD === 'undefined') return fail('לא הצלחנו לטעון את האפליקציה. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.');
    window.sb = supabase.createClient(CLOUD.url, CLOUD.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
    try { await load('sim-app.js'); await load('pro.js'); await load('app.js'); }
    catch (e) { fail('לא הצלחנו לטעון את האפליקציה. כדאי לנסות שוב.'); }
  })();
})();
