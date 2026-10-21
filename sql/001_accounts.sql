-- חשבונות לאפליקציית מילות הקישור. סכמה נפרדת, בלי גישה ישירה: רק דרך שלוש הפונקציות.
create schema if not exists amirnet;
revoke all on schema amirnet from public, anon, authenticated;

create table if not exists amirnet.users (
  name text primary key,              -- שם המשתמש באותיות קטנות
  display text not null,
  code_hash text not null,
  data jsonb not null default '{}'::jsonb,
  fails int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table amirnet.users enable row level security;

-- מחזירה 'ok' או קוד שגיאה. לא זורקת exception, כדי שספירת הניסיונות הכושלים תישמר
create or replace function amirnet.verify(p_name text, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare u amirnet.users;
begin
  select * into u from amirnet.users where name = lower(trim(p_name));
  if not found then return 'no_user'; end if;
  if u.locked_until is not null and u.locked_until > now() then return 'locked'; end if;
  if u.code_hash <> extensions.crypt(p_code, u.code_hash) then
    update amirnet.users set fails = fails + 1,
      locked_until = case when fails + 1 >= 8 then now() + interval '10 minutes' end
      where name = u.name;
    return 'bad_code';
  end if;
  if u.fails > 0 then update amirnet.users set fails = 0, locked_until = null where name = u.name; end if;
  return 'ok';
end $$;

create or replace function public.amirnet_register(p_name text, p_code text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n text := lower(trim(p_name));
begin
  if char_length(n) < 2 or char_length(n) > 30 then return jsonb_build_object('error', 'bad_name'); end if;
  if char_length(p_code) < 4 or char_length(p_code) > 40 then return jsonb_build_object('error', 'short_code'); end if;
  if exists (select 1 from amirnet.users where name = n) then return jsonb_build_object('error', 'name_taken'); end if;
  if pg_column_size(p_data) > 300000 then return jsonb_build_object('error', 'too_big'); end if;
  insert into amirnet.users (name, display, code_hash, data)
    values (n, trim(p_name), extensions.crypt(p_code, extensions.gen_salt('bf')), coalesce(p_data, '{}'::jsonb));
  return jsonb_build_object('name', trim(p_name), 'data', coalesce(p_data, '{}'::jsonb));
end $$;

create or replace function public.amirnet_login(p_name text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e text := amirnet.verify(p_name, p_code); u amirnet.users;
begin
  if e <> 'ok' then return jsonb_build_object('error', e); end if;
  select * into u from amirnet.users where name = lower(trim(p_name));
  return jsonb_build_object('name', u.display, 'data', u.data);
end $$;

create or replace function public.amirnet_save(p_name text, p_code text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e text;
begin
  if pg_column_size(p_data) > 300000 then return jsonb_build_object('error', 'too_big'); end if;
  e := amirnet.verify(p_name, p_code);
  if e <> 'ok' then return jsonb_build_object('error', e); end if;
  update amirnet.users set data = p_data, updated_at = now() where name = lower(trim(p_name));
  return jsonb_build_object('ok', true);
end $$;

revoke all on function amirnet.verify(text, text) from public, anon, authenticated;
revoke all on function public.amirnet_register(text, text, jsonb), public.amirnet_login(text, text), public.amirnet_save(text, text, jsonb) from public;
grant execute on function public.amirnet_register(text, text, jsonb), public.amirnet_login(text, text), public.amirnet_save(text, text, jsonb) to anon, authenticated;
