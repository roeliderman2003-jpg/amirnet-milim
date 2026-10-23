-- דיווח על טעות מתוך האפליקציה: נשמר בטבלה, ונשלח לרועי בווצאפ מיד (דרך roee-context).
-- הטוקן, הכתובת ומספר הווצאפ שמורים ב-vault (amirnet_ctx_token, amirnet_ctx_url, amirnet_wa_chat), לא בקוד. הגרסה העדכנית בקובץ 004.
create extension if not exists pg_net;

create table if not exists amirnet.reports (
  id bigserial primary key,
  user_id uuid,
  email text,
  name text,
  topic text,
  item_id text,
  kind text,
  question jsonb,
  message text,
  status text not null default 'new',  -- new / fixed / rejected
  created_at timestamptz not null default now()
);
alter table amirnet.reports enable row level security;

create or replace function public.amirnet_report(p_item text, p_topic text, p_kind text, p_question jsonb, p_message text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); em text; nm text; rid bigint; tok text; msg text; q jsonb := coalesce(p_question, '{}'::jsonb);
begin
  if uid is null then return jsonb_build_object('error', 'no_auth'); end if;
  if char_length(coalesce(p_message, '')) > 1000 or pg_column_size(q) > 8000 then return jsonb_build_object('error', 'too_big'); end if;
  -- הגנה מהצפה: עד 30 דיווחים למשתמש ביום
  if (select count(*) from amirnet.reports where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('error', 'too_many');
  end if;
  select u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.email) into em, nm from auth.users u where u.id = uid;
  insert into amirnet.reports (user_id, email, name, topic, item_id, kind, question, message)
    values (uid, em, nm, p_topic, p_item, p_kind, q, p_message) returning id into rid;
  -- ווצאפ לרועי, עד 40 הודעות ביום בסך הכול (מעבר לזה רק נשמר)
  if (select count(*) from amirnet.reports where created_at > now() - interval '1 day') <= 40 then
    select decrypted_secret into tok from vault.decrypted_secrets where name = 'amirnet_ctx_token';
    msg := '🐞 *דיווח על טעות באפליקציית אמירנט* (#' || rid || ')' || chr(10)
      || 'מ: ' || coalesce(nm, '?') || chr(10)
      || 'סוג: ' || coalesce(p_kind, '?') || chr(10)
      || 'מילה / שאלה: ' || coalesce(p_item, '?') || ' (' || coalesce(p_topic, '?') || ')' || chr(10)
      || coalesce('השאלה: ' || (q ->> 'text') || chr(10), '')
      || coalesce('אפשרויות: ' || (q ->> 'options') || chr(10), '')
      || coalesce('תשובה נכונה לפי האפליקציה: ' || (q ->> 'correct') || chr(10), '')
      || coalesce('ענה: ' || (q ->> 'chosen') || chr(10), '')
      || coalesce('הערה: ' || nullif(p_message, ''), 'הערה: (בלי)');
    if tok is not null then
      perform net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'amirnet_ctx_url'),
        headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Content-Type', 'application/json'),
        body := jsonb_build_object('chat_id', (select decrypted_secret from vault.decrypted_secrets where name = 'amirnet_wa_chat'), 'message', msg));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

revoke all on function public.amirnet_report(text, text, text, jsonb, text) from public, anon;
grant execute on function public.amirnet_report(text, text, text, jsonb, text) to authenticated;
