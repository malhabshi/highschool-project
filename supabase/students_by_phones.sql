-- Given a list of normalized 8-digit phone numbers, return the matching
-- students and the account user they are assigned to. Used by the Annual
-- Meeting to link an attendee (by phone) to their student record + owner.
drop function if exists students_by_phones(text[]);

create or replace function students_by_phones(p_phones text[])
returns table (
  assigned_id uuid,
  assigned_name text,
  student_name text,
  p1 text,
  p2 text
)
language sql
stable
security invoker
as $$
  select
    s.assigned_to,
    p.name,
    s.name,
    right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 8),
    right(regexp_replace(coalesce(s.phone2, ''), '\D', '', 'g'), 8)
  from students s
  left join profiles p on p.id = s.assigned_to
  where right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 8) = any(p_phones)
     or right(regexp_replace(coalesce(s.phone2, ''), '\D', '', 'g'), 8) = any(p_phones);
$$;

grant execute on function students_by_phones to anon, authenticated;

notify pgrst, 'reload schema';
