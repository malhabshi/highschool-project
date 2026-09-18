-- Math quiz (قدرات الرياضيات) — questions extracted from the course booklet.
-- Run this once in the Supabase SQL Editor, or:
--   node scripts/run-sql.mjs supabase/quiz.sql

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  -- Which exercise set the question came from, e.g. 'absolute-value'.
  topic text not null default '',
  -- Arabic section heading as printed in the booklet.
  section text not null default '',
  -- Where to find it in the PDF, so a reviewer can check the original.
  source_page int,
  -- The question number as printed (the booklet skips some numbers).
  number int,
  -- Question text. Math is wrapped in $...$ and rendered with KaTeX.
  body text not null,
  -- Exactly four choices, in printed order a, b, c, d.
  options text[] not null default '{}',
  -- 0 = a, 1 = b, 2 = c, 3 = d.
  answer_index int not null default 0 check (answer_index between 0 and 3),
  -- true only where the booklet's own answer key (page 77) confirms it.
  -- false means the answer was worked out and still needs a human check.
  verified boolean not null default false,
  -- Short note on how the answer was reached; shown in the review screen.
  work text not null default '',
  -- Ordered step-by-step solution. Maths is wrapped in $...$ and rendered
  -- with KaTeX, so it reads correctly inside right-to-left Arabic.
  steps text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quiz_questions_position_idx on quiz_questions (position);

-- Same access rule as the rest of the app: signed-in staff only, no anon access.
alter table quiz_questions enable row level security;
drop policy if exists "auth all" on quiz_questions;
create policy "auth all" on quiz_questions for all to authenticated using (true) with check (true);
