-- תשלום דרך קישור תשלום של Grow (pay.grow.link) במקום API: ה-webhook של Grow מגיע ל-grow-notify,
-- והגישה נפתחת לפי המייל שהמשלם הזין. אם עוד אין משתמש עם המייל הזה, התשלום נשמר כ«לא משויך»
-- ומשויך אוטומטית כשמשתמש עם אותו מייל נכנס (amirnet_me). מריצים פעם אחת ב-SQL Editor, אחרי 004.

-- נקרא רק מ-grow-notify (service_role). אידמפוטנטי לפי מזהה העסקה
create or replace function public.amirnet_pay_link(p_tx text, p_email text, p_amount numeric, p_months int, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid; em text := lower(trim(coalesce(p_email, ''))); base timestamptz;
begin
  if coalesce(p_tx, '') = '' then return jsonb_build_object('error', 'no_tx'); end if;
  if exists (select 1 from amirnet.payments where process_id = 'link:' || p_tx) then return jsonb_build_object('ok', true, 'already', true); end if;
  select id into uid from auth.users where lower(email) = em limit 1;
  insert into amirnet.payments (user_id, email, plan, amount, process_id, status, transaction_id, raw)
    values (uid, em, 'life', p_amount, 'link:' || p_tx, case when uid is null then 'unclaimed' else 'paid' end, p_tx, p_raw);
  if uid is not null then
    select greatest(now(), coalesce(max(valid_until), now())) into base from amirnet.entitlements where user_id = uid;
    insert into amirnet.entitlements (user_id, plan, valid_until, payment_ref, amount)
      values (uid, 'life', base + make_interval(months => p_months), p_tx, p_amount) on conflict (payment_ref) do nothing;
  end if;
  return jsonb_build_object('ok', true, 'matched', uid is not null);
end $$;

-- מה מגיע למשתמש המחובר. כולל שיוך של תשלום «לא משויך» עם אותו מייל
create or replace function public.amirnet_me()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); em text; e amirnet.entitlements; p amirnet.payments;
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  select lower(email) into em from auth.users where id = uid;
  for p in select * from amirnet.payments where status = 'unclaimed' and email = em for update loop
    update amirnet.payments set user_id = uid, status = 'paid', updated_at = now() where id = p.id;
    insert into amirnet.entitlements (user_id, plan, valid_until, payment_ref, amount)
      values (uid, 'life', now() + interval '100 years', p.transaction_id, p.amount) on conflict (payment_ref) do nothing;
  end loop;
  select * into e from amirnet.entitlements where user_id = uid order by valid_until desc limit 1;
  return jsonb_build_object('active', coalesce(e.valid_until > now(), false), 'plan', e.plan, 'valid_until', e.valid_until);
end $$;

revoke all on function public.amirnet_pay_link(text, text, numeric, int, jsonb) from public, anon, authenticated;
grant execute on function public.amirnet_pay_link(text, text, numeric, int, jsonb) to service_role;
revoke all on function public.amirnet_me() from public, anon;
grant execute on function public.amirnet_me() to authenticated;
