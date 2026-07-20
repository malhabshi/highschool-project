-- Saved snapshots of the Meeting attendees (so we can reset the live table
-- between meetings but keep old data downloadable from the website).
create table if not exists meeting_archives (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_at timestamptz not null default now(),
  count int not null default 0,
  attendees jsonb not null default '[]'::jsonb
);
alter table meeting_archives enable row level security;
drop policy if exists "auth all" on meeting_archives;
create policy "auth all" on meeting_archives
  for all to authenticated using (true) with check (true);

-- Shared meeting settings (single row). `country` locks the meeting/draw to one
-- accepted country when set.
create table if not exists meeting_settings (
  id int primary key default 1,
  country text,
  constraint meeting_settings_single_row check (id = 1)
);
insert into meeting_settings (id, country) values (1, null)
  on conflict (id) do nothing;
alter table meeting_settings enable row level security;
drop policy if exists "auth all" on meeting_settings;
create policy "auth all" on meeting_settings
  for all to authenticated using (true) with check (true);

-- Bring yesterday's snapshot into the website archives (if not already there).
insert into meeting_archives (label, count, attendees)
select
  'Meeting 2026-07-19',
  (select count(*) from meeting_attendees_2026_07_19),
  coalesce(
    (select jsonb_agg(to_jsonb(t)) from meeting_attendees_2026_07_19 t),
    '[]'::jsonb
  )
where not exists (
  select 1 from meeting_archives where label = 'Meeting 2026-07-19'
);

notify pgrst, 'reload schema';
