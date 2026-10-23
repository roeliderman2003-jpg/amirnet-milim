-- פטורנט: גישה בתשלום (Grow), תוכן נעול ב-Storage, מחיקה וייצוא חשבון, הגבלת קצב לשמירה,
-- לוג אירועים ושגיאות, «מה קיבלתי במבחן», והוצאת מספר הווצאפ וכתובת roee-context מהקוד אל ה-vault.
-- מריצים פעם אחת ב-SQL Editor של Supabase (בטוח להריץ שוב).

-- ===== סודות ב-vault (במקום בקוד הציבורי) =====
-- לפני ההרצה, אם עוד לא קיימים, להוסיף ב-Project Settings → Vault (או כאן, עם הערכים האמיתיים):
--   select vault.create_secret('<כתובת roee-context whatsapp_send>', 'amirnet_ctx_url');
--   select vault.create_secret('<מספר>@c.us', 'amirnet_wa_chat');
-- (amirnet_ctx_token כבר קיים)

-- ===== גישה בתשלום =====
create table if not exists amirnet.entitlements (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null,
  valid_until timestamptz not null,
  payment_ref text unique,
  amount numeric,
  created_at timestamptz not null default now()
);
alter table amirnet.entitlements enable row level security;
create index if not exists entitlements_user on amirnet.entitlements (user_id, valid_until desc);

-- תשלומים: נשמרים גם אחרי מחיקת חשבון (חובה לפי דיני מס), ולכן בלי מפתח זר
create table if not exists amirnet.payments (
  id bigserial primary key,
  user_id uuid,
  email text,
  plan text not null,
  amount numeric not null,
  process_id text unique,
  process_token text,
  status text not null default 'created', -- created / paid / failed
  transaction_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table amirnet.payments enable row level security;

create or replace function public.amirnet_has_access(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from amirnet.entitlements e where e.user_id = p_uid and e.valid_until > now());
$$;

-- מה מגיע למשתמש המחובר
create or replace function public.amirnet_me()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); e amirnet.entitlements;
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  select * into e from amirnet.entitlements where user_id = uid order by valid_until desc limit 1;
  return jsonb_build_object('active', coalesce(e.valid_until > now(), false), 'plan', e.plan, 'valid_until', e.valid_until);
end $$;

-- נקראות רק מה-Edge Functions של Grow (service_role)
create or replace function public.amirnet_pay_create(p_uid uuid, p_plan text, p_amount numeric, p_process_id text, p_process_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into amirnet.payments (user_id, email, plan, amount, process_id, process_token)
    select p_uid, u.email, p_plan, p_amount, p_process_id, p_process_token from auth.users u where u.id = p_uid
  on conflict (process_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- תשלום שאומת מול Grow: פותח גישה (מאריך מהתאריך המאוחר מבין עכשיו לגישה הקיימת). אידמפוטנטי לפי מזהה העסקה
create or replace function public.amirnet_pay_confirm(p_process_id text, p_transaction_id text, p_amount numeric, p_months int, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p amirnet.payments; base timestamptz;
begin
  select * into p from amirnet.payments where process_id = p_process_id for update;
  if not found then return jsonb_build_object('error', 'unknown_process'); end if;
  if p.status = 'paid' then return jsonb_build_object('ok', true, 'already', true); end if;
  if p_amount < p.amount then
    update amirnet.payments set status = 'failed', raw = p_raw, updated_at = now() where id = p.id;
    return jsonb_build_object('error', 'amount_mismatch');
  end if;
  update amirnet.payments set status = 'paid', transaction_id = p_transaction_id, raw = p_raw, updated_at = now() where id = p.id;
  if p.user_id is not null and exists (select 1 from auth.users where id = p.user_id) then
    select greatest(now(), coalesce(max(valid_until), now())) into base from amirnet.entitlements where user_id = p.user_id;
    insert into amirnet.entitlements (user_id, plan, valid_until, payment_ref, amount)
      values (p.user_id, p.plan, base + make_interval(months => p_months), p_transaction_id, p_amount)
      on conflict (payment_ref) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- פרטי תשלום שנשמרו ביצירה (לאימות מול Grow בלי לסמוך על מה שהגיע בהודעה)
create or replace function public.amirnet_pay_get(p_process_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) - 'raw' from amirnet.payments p where p.process_id = p_process_id;
$$;
create or replace function public.amirnet_pay_fail(p_process_id text, p_raw jsonb)
returns void language sql security definer set search_path = '' as $$
  update amirnet.payments set status = case when status = 'paid' then status else 'failed' end, raw = p_raw, updated_at = now() where process_id = p_process_id;
$$;

-- ===== תוכן נעול: bucket פרטי, קריאה רק למי שיש לו גישה פעילה =====
insert into storage.buckets (id, name, public) values ('paid', 'paid', false) on conflict (id) do nothing;
drop policy if exists "amirnet paid read" on storage.objects;
create policy "amirnet paid read" on storage.objects for select to authenticated
  using (bucket_id = 'paid' and public.amirnet_has_access(auth.uid()));

-- ===== מחיקת חשבון =====
create or replace function public.amirnet_delete_me()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  delete from amirnet.reports where user_id = uid;
  delete from amirnet.events where user_id = uid;
  delete from amirnet.real_scores where user_id = uid;
  update amirnet.payments set email = null where user_id = uid;
  delete from auth.users where id = uid; -- progress ו-entitlements נמחקים איתו (cascade)
  return jsonb_build_object('ok', true);
end $$;

-- ===== שמירה: עד 100KB, ולא יותר מפעם בשנייה =====
create or replace function public.amirnet_save(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); last timestamptz;
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if pg_column_size(p_data) > 100000 then return jsonb_build_object('error', 'too_big'); end if;
  select updated_at into last from amirnet.progress where user_id = uid;
  if last is not null and last > now() - interval '1 second' then return jsonb_build_object('error', 'slow'); end if;
  update amirnet.progress set data = p_data, updated_at = now() where user_id = uid;
  if not found then
    perform public.amirnet_load();
    update amirnet.progress set data = p_data, updated_at = now() where user_id = uid;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ===== אירועים ושגיאות (משפך ושיפור), עד 300 ביום למשתמש =====
create table if not exists amirnet.events (
  id bigserial primary key,
  user_id uuid,
  kind text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
alter table amirnet.events enable row level security;
create index if not exists events_user_day on amirnet.events (user_id, created_at);
create or replace function public.amirnet_log(p_kind text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if char_length(coalesce(p_kind, '')) > 40 or pg_column_size(coalesce(p_data, '{}'::jsonb)) > 4000 then return jsonb_build_object('error', 'too_big'); end if;
  if (select count(*) from amirnet.events where user_id = uid and created_at > now() - interval '1 day') >= 300 then return jsonb_build_object('error', 'too_many'); end if;
  insert into amirnet.events (user_id, kind, data) values (uid, p_kind, p_data);
  return jsonb_build_object('ok', true);
end $$;

-- ===== «מה קיבלתי במבחן האמיתי» (לכיול הציון המשוער) =====
create table if not exists amirnet.real_scores (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete cascade,
  score int not null check (score between 50 and 150),
  exam_date date,
  est int,
  created_at timestamptz not null default now()
);
alter table amirnet.real_scores enable row level security;
create or replace function public.amirnet_real_score(p_score int, p_date date, p_est int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if p_score not between 50 and 150 then return jsonb_build_object('error', 'bad_score'); end if;
  if (select count(*) from amirnet.real_scores where user_id = uid) >= 10 then return jsonb_build_object('error', 'too_many'); end if;
  insert into amirnet.real_scores (user_id, score, exam_date, est) values (uid, p_score, p_date, p_est);
  return jsonb_build_object('ok', true);
end $$;

-- ===== דיווח על טעות: כתובת וצ'אט מה-vault, לא מהקוד =====
create or replace function public.amirnet_report(p_item text, p_topic text, p_kind text, p_question jsonb, p_message text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); em text; nm text; rid bigint; tok text; url text; chat text; msg text; q jsonb := coalesce(p_question, '{}'::jsonb);
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if char_length(coalesce(p_message, '')) > 1000 or pg_column_size(q) > 8000 then return jsonb_build_object('error', 'too_big'); end if;
  if (select count(*) from amirnet.reports where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('error', 'too_many');
  end if;
  select u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.email) into em, nm from auth.users u where u.id = uid;
  insert into amirnet.reports (user_id, email, name, topic, item_id, kind, question, message)
    values (uid, em, nm, p_topic, p_item, p_kind, q, p_message) returning id into rid;
  if (select count(*) from amirnet.reports where created_at > now() - interval '1 day') <= 40 then
    select decrypted_secret into tok from vault.decrypted_secrets where name = 'amirnet_ctx_token';
    select decrypted_secret into url from vault.decrypted_secrets where name = 'amirnet_ctx_url';
    select decrypted_secret into chat from vault.decrypted_secrets where name = 'amirnet_wa_chat';
    msg := '🐞 *דיווח על טעות בפטורנט* (#' || rid || ')' || chr(10)
      || 'מ: ' || coalesce(nm, '?') || chr(10)
      || 'סוג: ' || coalesce(p_kind, '?') || chr(10)
      || 'מילה / שאלה: ' || coalesce(p_item, '?') || ' (' || coalesce(p_topic, '?') || ')' || chr(10)
      || coalesce('השאלה: ' || (q ->> 'text') || chr(10), '')
      || coalesce('אפשרויות: ' || (q ->> 'options') || chr(10), '')
      || coalesce('תשובה נכונה לפי האפליקציה: ' || (q ->> 'correct') || chr(10), '')
      || coalesce('ענה: ' || (q ->> 'chosen') || chr(10), '')
      || coalesce('הערה: ' || nullif(p_message, ''), 'הערה: (בלי)');
    if tok is not null and url is not null and chat is not null then
      perform net.http_post(url := url,
        headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Content-Type', 'application/json'),
        body := jsonb_build_object('chat_id', chat, 'message', msg));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

-- ===== הרשאות =====
revoke all on function public.amirnet_has_access(uuid), public.amirnet_me(), public.amirnet_delete_me(), public.amirnet_save(jsonb),
  public.amirnet_log(text, jsonb), public.amirnet_real_score(int, date, int), public.amirnet_report(text, text, text, jsonb, text),
  public.amirnet_pay_create(uuid, text, numeric, text, text), public.amirnet_pay_confirm(text, text, numeric, int, jsonb),
  public.amirnet_pay_get(text), public.amirnet_pay_fail(text, jsonb) from public, anon;
grant execute on function public.amirnet_has_access(uuid), public.amirnet_me(), public.amirnet_delete_me(), public.amirnet_save(jsonb),
  public.amirnet_log(text, jsonb), public.amirnet_real_score(int, date, int), public.amirnet_report(text, text, text, jsonb, text) to authenticated;
revoke all on function public.amirnet_pay_create(uuid, text, numeric, text, text), public.amirnet_pay_confirm(text, text, numeric, int, jsonb),
  public.amirnet_pay_get(text), public.amirnet_pay_fail(text, jsonb) from authenticated;
grant execute on function public.amirnet_pay_create(uuid, text, numeric, text, text), public.amirnet_pay_confirm(text, text, numeric, int, jsonb),
  public.amirnet_pay_get(text), public.amirnet_pay_fail(text, jsonb) to service_role;
