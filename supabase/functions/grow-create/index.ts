// פותח תשלום ב-Grow למשתמש המחובר ומחזיר את כתובת עמוד התשלום.
// הדפדפן קורא: supabase.functions.invoke('grow-create', { body: { plan, fullName, phone } })
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ===== משותף (זהה ב-grow-create וב-grow-notify, כדי שכל פונקציה תהיה קובץ אחד) =====
// משותף ל-grow-create ול-grow-notify: התוכניות, כתובות Grow (משולם) וקריאות לשרת שלהם.
// משתני סביבה (Supabase → Edge Functions → Secrets):
//   GROW_USER_ID, GROW_PAGE_CODE  — מקבלים מתמיכת ה-API של Grow (apisupport@grow.business)
//   GROW_API_KEY                  — רק אם Grow נתנו (חשבון רב-עסקי). אחרת להשאיר ריק
//   GROW_ENV                      — sandbox או production
//   SITE_URL                      — כתובת האתר, למשל https://roeliderman2003-jpg.github.io/amirnet-milim/
// SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY ו-SUPABASE_ANON_KEY קיימים אוטומטית.

// מחיר וזמן גישה נקבעים כאן בשרת בלבד (לא מהדפדפן)
const PLANS: Record<string, { months: number; sum: number; title: string }> = {
  m2: { months: 2, sum: 149, title: 'פטורנט: גישה מלאה לחודשיים' },
  m4: { months: 4, sum: 199, title: 'פטורנט: גישה מלאה ל-4 חודשים' },
};

const env = (k: string) => Deno.env.get(k) || '';
const GROW_BASE = env('GROW_ENV') === 'production' ? 'https://secure.meshulam.co.il' : 'https://sandbox.meshulam.co.il';
const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// כל הקריאות ל-Grow: form-data, ותשובה status 1 = הצלחה (גם שגיאה חוזרת ב-HTTP 200)
async function grow(method: string, fields: Record<string, string>) {
  const fd = new FormData();
  fd.set('userId', env('GROW_USER_ID'));
  fd.set('pageCode', env('GROW_PAGE_CODE'));
  if (env('GROW_API_KEY')) fd.set('apiKey', env('GROW_API_KEY'));
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) fd.set(k, String(v));
  const r = await fetch(`${GROW_BASE}/api/light/server/1.0/${method}`, { method: 'POST', body: fd });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { status: 0, err: { message: 'bad json', text: text.slice(0, 500) } }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const auth = req.headers.get('Authorization') || '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'no_auth' }, 401);

    const { plan, fullName, phone } = await req.json();
    const p = PLANS[plan];
    if (!p) return json({ error: 'bad_plan' }, 400);
    // Grow דורש שם מלא (לפחות שתי מילים) ונייד ישראלי 05XXXXXXXX
    const name = String(fullName || '').trim().replace(/\s+/g, ' ');
    let tel = String(phone || '').replace(/\D/g, '');
    if (tel.startsWith('972')) tel = '0' + tel.slice(3);
    if (name.split(' ').length < 2) return json({ error: 'bad_name' }, 400);
    if (!/^05\d{8}$/.test(tel)) return json({ error: 'bad_phone' }, 400);

    const site = Deno.env.get('SITE_URL')!.replace(/\/?$/, '/');
    const r = await grow('createPaymentProcess', {
      sum: p.sum.toFixed(2),
      description: p.title,
      successUrl: site + '?paid=1',
      cancelUrl: site + '?paid=0',
      notifyUrl: Deno.env.get('SUPABASE_URL') + '/functions/v1/grow-notify',
      'pageField[fullName]': name,
      'pageField[phone]': tel,
      'pageField[email]': user.email || '',
      cField1: user.id,
      cField2: plan,
      maxPaymentNum: '3',
      'productData[0][catalogNumber]': plan,
      'productData[0][quantity]': '1',
      'productData[0][price]': p.sum.toFixed(2),
      'productData[0][itemDescription]': p.title,
    });
    if (r.status !== 1 || !r.data?.url) return json({ error: 'grow', detail: r.err }, 502);
    await admin().rpc('amirnet_pay_create', { p_uid: user.id, p_plan: plan, p_amount: p.sum, p_process_id: String(r.data.processId), p_process_token: String(r.data.processToken) });
    return json({ url: r.data.url });
  } catch (e) {
    return json({ error: 'server', detail: String(e) }, 500);
  }
});
