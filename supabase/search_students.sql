-- Server-side paginated/filtered/sorted student search.
-- (Drop old signatures first since we add parameters over time.)
drop function if exists search_students(text,text,uuid,text,text,text,text,jsonb,jsonb,text,text,boolean,uuid,int,int);
drop function if exists search_student_ids(text,text,uuid,text,text,text,text,jsonb,jsonb,boolean,uuid);

create or replace function search_students(
  p_search text default '',
  p_assigned_mode text default 'any',   -- 'any' | 'unassigned' | 'employee'
  p_assigned uuid default null,
  p_school text default null,
  p_major text default null,
  p_country text default null,
  p_gender text default null,
  p_tag text default null,
  p_yesno jsonb default '{}'::jsonb,     -- { questionId: 'true' | 'false' }
  p_multi jsonb default '{}'::jsonb,     -- { questionId: 'OptionString' }
  p_card_b text default null,
  p_card_d text default null,
  p_admin boolean default true,
  p_user uuid default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (data jsonb, is_duplicate boolean, total bigint)
language sql
stable
security invoker
as $$
  with filtered as (
    select s.*
    from students s
    where (s.source is null or s.source <> 'my-students')
      and (p_admin or s.assigned_to = p_user)
      and (
        not p_admin
        or p_assigned_mode = 'any'
        or (p_assigned_mode = 'unassigned' and s.assigned_to is null)
        or (p_assigned_mode = 'employee' and s.assigned_to = p_assigned)
      )
      and (
        p_search = ''
        or s.name ilike '%' || p_search || '%'
        or s.phone ilike '%' || p_search || '%'
      )
      and (p_school is null or s.school = p_school)
      and (p_major is null or coalesce(s.major, '') = p_major)
      and (p_country is null or coalesce(s.accepted_country, '') = p_country)
      and (p_gender is null or coalesce(s.gender, 'N/A') = p_gender)
      and (p_tag is null or coalesce(s.tag, '') = p_tag)
      and not exists (
        select 1 from jsonb_each_text(p_yesno) f
        where coalesce(s.answers ->> f.key, '') <> f.value
      )
      and not exists (
        select 1 from jsonb_each_text(p_multi) f
        where coalesce((s.answers -> f.key) ? f.value, false) = false
      )
  )
  select
    to_jsonb(f.*) as data,
    (select count(*) from students d where d.phone = f.phone) > 1 as is_duplicate,
    count(*) over () as total
  from filtered f
  order by
    (
      case
        when p_admin and p_card_b is not null and p_card_d is not null
             and f.answers ->> p_card_b = 'true'
             and f.answers ->> p_card_d = 'true'
             and f.sent_to_masar_at is null then 2
        when p_card_b is not null and f.answers ->> p_card_b = 'true' then 1
        else 0
      end
    ) desc,
    f.created_at asc
  limit p_limit offset p_offset;
$$;

grant execute on function search_students to anon, authenticated;

-- Just the matching ids (for "select all across pages").
create or replace function search_student_ids(
  p_search text default '',
  p_assigned_mode text default 'any',
  p_assigned uuid default null,
  p_school text default null,
  p_major text default null,
  p_country text default null,
  p_gender text default null,
  p_tag text default null,
  p_yesno jsonb default '{}'::jsonb,
  p_multi jsonb default '{}'::jsonb,
  p_admin boolean default true,
  p_user uuid default null
)
returns setof uuid
language sql
stable
security invoker
as $$
  select s.id
  from students s
  where (s.source is null or s.source <> 'my-students')
    and (p_admin or s.assigned_to = p_user)
    and (
      not p_admin
      or p_assigned_mode = 'any'
      or (p_assigned_mode = 'unassigned' and s.assigned_to is null)
      or (p_assigned_mode = 'employee' and s.assigned_to = p_assigned)
    )
    and (
      p_search = ''
      or s.name ilike '%' || p_search || '%'
      or s.phone ilike '%' || p_search || '%'
    )
    and (p_school is null or s.school = p_school)
    and (p_major is null or coalesce(s.major, '') = p_major)
    and (p_country is null or coalesce(s.accepted_country, '') = p_country)
    and (p_gender is null or coalesce(s.gender, 'N/A') = p_gender)
    and (p_tag is null or coalesce(s.tag, '') = p_tag)
    and not exists (
      select 1 from jsonb_each_text(p_yesno) f
      where coalesce(s.answers ->> f.key, '') <> f.value
    )
    and not exists (
      select 1 from jsonb_each_text(p_multi) f
      where coalesce((s.answers -> f.key) ? f.value, false) = false
    );
$$;

grant execute on function search_student_ids to anon, authenticated;

-- Distinct schools, majors, accepted countries, and list tags for filters.
create or replace function student_facets(
  p_admin boolean default true,
  p_user uuid default null
)
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'schools', coalesce((
      select jsonb_agg(distinct school order by school)
      from students
      where (source is null or source <> 'my-students')
        and (p_admin or assigned_to = p_user)
        and coalesce(school, '') <> ''
    ), '[]'::jsonb),
    'majors', coalesce((
      select jsonb_agg(distinct major order by major)
      from students
      where (source is null or source <> 'my-students')
        and (p_admin or assigned_to = p_user)
        and coalesce(major, '') <> ''
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(distinct accepted_country order by accepted_country)
      from students
      where (source is null or source <> 'my-students')
        and (p_admin or assigned_to = p_user)
        and coalesce(accepted_country, '') <> ''
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(distinct tag order by tag)
      from students
      where (source is null or source <> 'my-students')
        and (p_admin or assigned_to = p_user)
        and coalesce(tag, '') <> ''
    ), '[]'::jsonb)
  );
$$;

grant execute on function student_facets to anon, authenticated;
