// Grow קורא לכאן אחרי תשלום (notifyUrl). ההודעה לא חתומה, ולכן לא סומכים עליה:
// מאמתים מול Grow עם processId + processToken שנשמרו ביצירה, בודקים שהסכום ומזהה העסקה תואמים, ורק אז פותחים גישה.
// לפרוס בלי אימות JWT (Grow לא שולח טוקן): supabase functions deploy grow-notify --no-verify-jwt

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
  life: { months: 1200, sum: 99, title: 'פטורנט: גישה מלאה לכל החיים' },
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
  if (req.method !== 'POST') return new Response('ok');
  const db = admin();
  let f: Record<string, string> = {};
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('json')) {
      const j = await req.json();
      const flat = (o: Record<string, unknown>, pre = '') => { for (const [k, v] of Object.entries(o || {})) { const key = pre ? `${pre}[${k}]` : k; if (v && typeof v === 'object') flat(v as Record<string, unknown>, key); else f[key] = String(v ?? ''); } };
      flat(j);
    } else {
      for (const [k, v] of (await req.formData()).entries()) f[k] = String(v);
    }
  } catch { return new Response('bad request', { status: 400 }); }
  const d = (k: string) => f[`data[${k}]`] ?? f[k] ?? '';
  const processId = d('processId');
  if (!processId) return new Response('no process', { status: 400 });

  const { data: pay } = await db.rpc('amirnet_pay_get', { p_process_id: processId });
  if (!pay) return new Response('unknown process', { status: 404 });
  const plan = PLANS[pay.plan];

  // אימות מול Grow (לא מול מה שהגיע בהודעה)
  const info = await grow('getPaymentProcessInfo', { processId, processToken: pay.process_token });
  const t = info?.data?.transactions?.[0] ?? info?.data ?? {};
  const code = String(t.statusCode ?? t.transactionStatusCode ?? '');
  const txId = String(t.transactionId ?? t.transactionID ?? '');
  const sum = parseFloat(String(t.sum ?? '0'));
  const ok = info?.status === 1 && code === '2' && txId && txId === d('transactionId') && sum >= Number(pay.amount) - 0.5 && plan;
  if (!ok) {
    await db.rpc('amirnet_pay_fail', { p_process_id: processId, p_raw: { notify: f, info } });
    return new Response('not verified', { status: 200 });
  }
  await db.rpc('amirnet_pay_confirm', { p_process_id: processId, p_transaction_id: txId, p_amount: sum, p_months: plan.months, p_raw: { notify: f, info } });

  // אישור קבלת ההודעה ל-Grow (אחרת הם שולחים אותה שוב). מחזירים את כל שדות data כפי שהגיעו
  const echo: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) { const m = k.match(/^data\[([^\]]+)\]$/); if (m) echo[m[1]] = v; }
  await grow('approveTransaction', echo);
  return new Response('ok');
});
