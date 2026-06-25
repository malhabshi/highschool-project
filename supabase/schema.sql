-- Masar database schema for Supabase.
-- Run this once in the Supabase SQL Editor.

-- ───────── PROFILES (staff accounts; linked to Supabase Auth) ─────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  role text not null default 'employee' check (role in ('admin','employee')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ───────── STUDENTS ─────────
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  school text not null default '',
  assigned_to uuid references profiles(id) on delete set null,
  deletion_requested boolean not null default false,
  tag text,
  notes text not null default '',
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ───────── QUESTIONS (configurable profile questions) ─────────
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  type text not null check (type in ('yesno','multi')),
  options text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ───────── ANNOUNCEMENTS ─────────
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_at timestamptz not null default now()
);

-- ───────── EVENTS ─────────
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  created_at timestamptz not null default now()
);

-- ───────── SETTINGS (single row: logo) ─────────
create table if not exists settings (
  id int primary key default 1,
  logo text
);
insert into settings (id, logo) values (1, null) on conflict (id) do nothing;

-- Seed the default questions (only if the table is empty).
insert into questions (label, type, options, position)
select * from (values
  ('Did the student answer our call?', 'yesno', '{}'::text[], 0),
  ('Does the student want a scholarship?', 'yesno', '{}'::text[], 1),
  ('Which countries does the student want to apply for?', 'multi', '{UK,USA,AZ/NZ}'::text[], 2)
) as v(label, type, options, position)
where not exists (select 1 from questions);

-- ───────── ROW LEVEL SECURITY ─────────
-- Only signed-in staff can read/write. The public (anon) cannot touch anything.
alter table profiles      enable row level security;
alter table students      enable row level security;
alter table questions     enable row level security;
alter table announcements enable row level security;
alter table events        enable row level security;
alter table settings      enable row level security;

drop policy if exists "auth all" on profiles;
drop policy if exists "auth all" on students;
drop policy if exists "auth all" on questions;
drop policy if exists "auth all" on announcements;
drop policy if exists "auth all" on events;
drop policy if exists "auth all" on settings;

create policy "auth all" on profiles      for all to authenticated using (true) with check (true);
create policy "auth all" on students      for all to authenticated using (true) with check (true);
create policy "auth all" on questions     for all to authenticated using (true) with check (true);
create policy "auth all" on announcements for all to authenticated using (true) with check (true);
create policy "auth all" on events        for all to authenticated using (true) with check (true);
create policy "auth all" on settings      for all to authenticated using (true) with check (true);
