-- Step-by-step solutions for each quiz question.
-- `work` held a one-line summary in plain text, which rendered unreadably:
-- the maths was not typeset and right-to-left text reversed it.
-- Steps are stored as an ordered array and rendered through KaTeX.
alter table quiz_questions
  add column if not exists steps text[] not null default '{}';
