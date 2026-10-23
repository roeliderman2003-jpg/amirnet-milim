'use strict';
// טוען את פטורנט: ספריית ההתחברות, התוכן החינמי (free.js), ולמי שיש גישה פעילה גם את התוכן המלא
// (paid.js מ-bucket פרטי ב-Supabase Storage, נשמר במטמון של הדפדפן לפי גרסה). רק אחר כך את האפליקציה עצמה.
(function () {
  const fail = msg => {
    document.getElementById('app').innerHTML = `<main class="login"><img src="icon.svg" alt="" class="logo"><h1>פטורנט</h1>
      <p class="sub">${msg}</p><button class="btn" onclick="location.reload()">לנסות שוב</button></main>`;
  };
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.body.appendChild(s); });
  window.PLAN = { active: false };
  async function loadPaid() {
    const key = 'paid-' + TIER_META.version;
    let text = null;
    try { const c = await caches.open('patornet-paid'); const r = await c.match(key); if (r) text = await r.text(); } catch (e) {}
    if (!text) {
      const { data, error } = await window.sb.storage.from('paid').download('paid.js');
      if (error || !data) throw error || new Error('no paid content');
      text = await data.text();
      try { const c = await caches.open('patornet-paid'); for (const k of await c.keys()) await c.delete(k); await c.put(key, new Response(text)); } catch (e) {}
    }
    const s = document.createElement('script');
    s.textContent = text;
    document.head.appendChild(s);
    if (typeof PAID_VERSION === 'undefined') throw new Error('bad paid content');
  }
  (async () => {
    if (typeof supabase === 'undefined' || typeof TIER_META === 'undefined' || typeof CLOUD === 'undefined') return fail('לא הצלחנו לטעון את האפליקציה. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.');
    window.sb = supabase.createClient(CLOUD.url, CLOUD.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        const r = await sb.rpc('amirnet_me');
        if (r.data && !r.data.error) window.PLAN = r.data;
        if (PLAN.active) { try { await loadPaid(); } catch (e) { window.PAID_ERROR = String(e && e.message || e); } }
      }
    } catch (e) {}
    try { await load('sim-app.js'); await load('pro.js'); await load('app.js'); }
    catch (e) { fail('לא הצלחנו לטעון את האפליקציה. כדאי לנסות שוב.'); }
  })();
})();
