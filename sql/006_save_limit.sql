-- פטורנט: הגדלת הגבול של שמירת ההתקדמות מ-100KB ל-1MB (רועי 31/10).
-- ב-100KB השמירה לענן נחסמת בסביבות 400 מילים מתורגלות. כל 936 המילים תופסות עד ~300KB.
-- מריצים פעם אחת ב-SQL Editor של Supabase (בטוח להריץ שוב). ההרשאות על הפונקציה נשמרות.

-- ===== שמירה: עד 1MB, ולא יותר מפעם בשנייה =====
create or replace function public.amirnet_save(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); last timestamptz;
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if pg_column_size(p_data) > 1000000 then return jsonb_build_object('error', 'too_big'); end if;
  select updated_at into last from amirnet.progress where user_id = uid;
  if last is not null and last > now() - interval '1 second' then return jsonb_build_object('error', 'slow'); end if;
  update amirnet.progress set data = p_data, updated_at = now() where user_id = uid;
  if not found then
    perform public.amirnet_load();
    update amirnet.progress set data = p_data, updated_at = now() where user_id = uid;
  end if;
  return jsonb_build_object('ok', true);
end $$;
