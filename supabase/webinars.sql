-- Webinars: scheduled live sessions hosted by staff and open to anyone with
-- the link. Staff use the tables directly; public visitors never touch them —
-- they only go through the security-definer functions at the bottom.

create table if not exists webinars (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','ended')),
  host_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- People who registered ahead of time or joined while live.
create table if not exists webinar_registrations (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists webinar_registrations_webinar_idx
  on webinar_registrations (webinar_id);

-- Q&A submitted by viewers during a live webinar.
create table if not exists webinar_questions (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  name text not null,
  text text not null,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists webinar_questions_webinar_idx
  on webinar_questions (webinar_id);

alter table webinars              enable row level security;
alter table webinar_registrations enable row level security;
alter table webinar_questions     enable row level security;

drop policy if exists "auth all" on webinars;
drop policy if exists "auth all" on webinar_registrations;
drop policy if exists "auth all" on webinar_questions;
create policy "auth all" on webinars              for all to authenticated using (true) with check (true);
create policy "auth all" on webinar_registrations for all to authenticated using (true) with check (true);
create policy "auth all" on webinar_questions     for all to authenticated using (true) with check (true);

-- Live updates for the host's Q&A and registration lists, and for webinar
-- status/host changes (e.g. handing a live webinar to a colleague).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'webinars') then
    alter publication supabase_realtime add table webinars;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'webinar_questions') then
    alter publication supabase_realtime add table webinar_questions;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'webinar_registrations') then
    alter publication supabase_realtime add table webinar_registrations;
  end if;
end $$;

-- ───────── Public (anonymous) access ─────────

-- The public webinar page: just what a visitor needs to see, by link code.
create or replace function get_public_webinar(p_code text)
returns table (
  id uuid, code text, title text, description text,
  scheduled_at timestamptz, status text, host_name text
)
language sql stable security definer set search_path = public as $$
  select w.id, w.code, w.title, w.description, w.scheduled_at, w.status,
         coalesce(p.name, '')
  from webinars w
  left join profiles p on p.id = w.host_id
  where w.code = p_code;
$$;

-- Register (or record joining). Skips duplicates with the same email/phone.
create or replace function register_for_webinar(
  p_code text, p_name text, p_email text, p_phone text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  w_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
begin
  if v_name = '' or length(v_name) > 120 or length(v_email) > 200
     or length(v_phone) > 40 or (v_email = '' and v_phone = '') then
    raise exception 'invalid registration';
  end if;
  select w.id into w_id from webinars w
    where w.code = p_code and w.status <> 'ended';
  if w_id is null then
    raise exception 'webinar not found';
  end if;
  if exists (
    select 1 from webinar_registrations r
    where r.webinar_id = w_id
      and ((v_email <> '' and r.email = v_email)
        or (v_phone <> '' and r.phone = v_phone))
  ) then
    return;
  end if;
  insert into webinar_registrations (webinar_id, name, email, phone)
    values (w_id, v_name, v_email, v_phone);
end;
$$;

-- Ask a question while the webinar is live. Returns the question id so the
-- asker can see when it's marked answered.
create or replace function ask_webinar_question(
  p_code text, p_name text, p_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  w_id uuid;
  q_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_text text := trim(coalesce(p_text, ''));
begin
  if v_name = '' or length(v_name) > 120 or v_text = '' or length(v_text) > 1000 then
    raise exception 'invalid question';
  end if;
  select w.id into w_id from webinars w
    where w.code = p_code and w.status = 'live';
  if w_id is null then
    raise exception 'webinar is not live';
  end if;
  insert into webinar_questions (webinar_id, name, text)
    values (w_id, v_name, v_text)
    returning id into q_id;
  return q_id;
end;
$$;

grant execute on function get_public_webinar(text) to anon, authenticated;
grant execute on function register_for_webinar(text, text, text, text) to anon, authenticated;
grant execute on function ask_webinar_question(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ───────── Guest hosts (attendees made host by staff) ─────────
-- Each attendee's browser keeps a random secret and shares only its SHA-256
-- hash. Staff grant hosting to that hash; the guest proves it by sending the
-- secret, which never goes over the shared realtime channel.
create table if not exists webinar_guest_hosts (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  secret_hash text not null,
  name text not null default '',
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (webinar_id, secret_hash)
);
alter table webinar_guest_hosts enable row level security;
drop policy if exists "auth all" on webinar_guest_hosts;
create policy "auth all" on webinar_guest_hosts
  for all to authenticated using (true) with check (true);

-- The webinar id if this secret belongs to an active guest host, else null.
create or replace function guest_host_webinar(p_code text, p_secret text)
returns uuid
language sql stable security definer set search_path = public as $$
  select w.id from webinars w
  join webinar_guest_hosts g on g.webinar_id = w.id
  where w.code = p_code and w.status <> 'ended' and not g.revoked
    and g.secret_hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex');
$$;

create or replace function guest_is_host(p_code text, p_secret text)
returns boolean
language sql stable security definer set search_path = public as $$
  select guest_host_webinar(p_code, p_secret) is not null;
$$;

create or replace function guest_list_questions(p_code text, p_secret text)
returns table (id uuid, name text, text text, answered boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare w_id uuid := guest_host_webinar(p_code, p_secret);
begin
  if w_id is null then raise exception 'not a host'; end if;
  return query
    select q.id, q.name, q.text, q.answered, q.created_at
    from webinar_questions q where q.webinar_id = w_id
    order by q.created_at;
end;
$$;

create or replace function guest_set_question_answered(
  p_code text, p_secret text, p_id uuid, p_answered boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare w_id uuid := guest_host_webinar(p_code, p_secret);
begin
  if w_id is null then raise exception 'not a host'; end if;
  update webinar_questions set answered = p_answered
    where id = p_id and webinar_id = w_id;
end;
$$;

create or replace function guest_end_webinar(p_code text, p_secret text)
returns void
language plpgsql security definer set search_path = public as $$
declare w_id uuid := guest_host_webinar(p_code, p_secret);
begin
  if w_id is null then raise exception 'not a host'; end if;
  update webinars set status = 'ended' where id = w_id;
end;
$$;

revoke execute on function guest_host_webinar(text, text) from public, anon, authenticated;
grant execute on function guest_is_host(text, text) to anon, authenticated;
grant execute on function guest_list_questions(text, text) to anon, authenticated;
grant execute on function guest_set_question_answered(text, text, uuid, boolean) to anon, authenticated;
grant execute on function guest_end_webinar(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
