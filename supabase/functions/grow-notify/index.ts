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
//   GROW_WEBHOOK_KEY / GROW_WEBHOOK_SECRET — לתשלום דרך קישור תשלום (webhook של החשבון). מספיק אחד מהם
//   GROW_LINK_DESC / GROW_LINK_ID — איך מזהים שהתשלום שלנו (ברירת מחדל: התיאור כולל «פטורנט»)
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

// ----- קישור תשלום -----
// Grow לא חותמים את ה-webhook. מאמתים כמו ב-liderman-dashboard: סוד בכתובת (?k=GROW_WEBHOOK_SECRET, שנותנים לתמיכה של Grow)
// או webhookKey ששווה ל-GROW_WEBHOOK_KEY (המפתח ש-Grow מצמידים לכל ה-webhooks של החשבון).
// בחשבון Grow יש גם עסקים אחרים, ולכן מקבלים רק תשלום שהתיאור שלו כולל GROW_LINK_DESC (ברירת מחדל: פטורנט),
// או שמזהה הקישור שלו הוא GROW_LINK_ID. הגישה נפתחת לפי המייל שהמשלם הזין בעמוד התשלום
const LIFE_MONTHS = 1200, LIFE_SUM = 99;
async function linkPayment(req: Request, d: (k: string) => string, f: Record<string, string>, db: ReturnType<typeof admin>) {
  const k = new URL(req.url).searchParams.get('k') || '';
  const okSecret = (env('GROW_WEBHOOK_SECRET') && k === env('GROW_WEBHOOK_SECRET')) || (env('GROW_WEBHOOK_KEY') && d('webhookKey') === env('GROW_WEBHOOK_KEY'));
  if (!okSecret) return new Response('unauthorized', { status: 401 });
  const desc = (d('paymentDesc') || d('description') || d('productName') || '').toLowerCase();
  const linkId = d('paymentLinkProcessId') || d('paymentLinkId');
  const want = (env('GROW_LINK_DESC') || 'פטורנט').toLowerCase();
  const ours = (env('GROW_LINK_ID') && linkId === env('GROW_LINK_ID')) || desc.includes(want) || desc.includes('patornet');
  if (!ours) return new Response('ok'); // תשלום של עסק אחר באותו חשבון
  const code = d('statusCode');
  if (code && code !== '2') return new Response('ok'); // לא שולם
  const tx = d('transactionCode') || d('transactionId') || d('asmachta');
  const sum = parseFloat((d('paymentSum') || d('sum') || '0').replace(/,/g, ''));
  const email = d('payerEmail') || d('email');
  if (!tx || !email || !(sum >= LIFE_SUM - 0.5)) {
    console.error('grow link payment rejected', { tx, email: !!email, sum });
    return new Response('ok');
  }
  const { data, error } = await db.rpc('amirnet_pay_link', { p_tx: tx, p_email: email, p_amount: sum, p_months: LIFE_MONTHS, p_raw: f });
  if (error) { console.error('pay_link failed', error); return new Response('error', { status: 500 }); } // Grow ינסו שוב
  return new Response(JSON.stringify(data || { ok: true }), { headers: { 'Content-Type': 'application/json' } });
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
  const d = (k: string) => f[`data[${k}]`] ?? f[k] ?? f[`data[customFields][${k}]`] ?? '';
  const processId = d('processId');
  // תשלום דרך קישור תשלום (pay.grow.link): webhook של החשבון, בלי processId שלנו
  if (!processId || !(await db.rpc('amirnet_pay_get', { p_process_id: processId })).data) return await linkPayment(req, d, f, db);

  const { data: pay } = await db.rpc('amirnet_pay_get', { p_process_id: processId });
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
