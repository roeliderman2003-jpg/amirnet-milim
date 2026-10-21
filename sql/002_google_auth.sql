-- מעבר לכניסה עם Google בלבד (Supabase Auth). השם והקוד הוסרו (לא נרשם אף משתמש).
drop function if exists public.amirnet_register(text, text, jsonb);
drop function if exists public.amirnet_login(text, text);
drop function if exists public.amirnet_save(text, text, jsonb);
drop function if exists amirnet.verify(text, text);
drop table if exists amirnet.users;

create table if not exists amirnet.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table amirnet.progress enable row level security;

-- מחזירה את ההתקדמות של המשתמש המחובר, ויוצרת לו שורה בכניסה הראשונה
create or replace function public.amirnet_load()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r amirnet.progress;
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  select * into r from amirnet.progress where user_id = uid;
  if not found then
    insert into amirnet.progress (user_id, email, name)
      select id, email, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', email)
      from auth.users where id = uid
      returning * into r;
  end if;
  return jsonb_build_object('name', r.name, 'email', r.email, 'data', r.data);
end $$;

create or replace function public.amirnet_save(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if pg_column_size(p_data) > 300000 then return jsonb_build_object('error', 'too_big'); end if;
  update amirnet.progress set data = p_data, updated_at = now() where user_id = uid;
  if not found then
    perform public.amirnet_load();
    update amirnet.progress set data = p_data, updated_at = now() where user_id = uid;
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.amirnet_load(), public.amirnet_save(jsonb) from public, anon;
grant execute on function public.amirnet_load(), public.amirnet_save(jsonb) to authenticated;
