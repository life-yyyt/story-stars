create table if not exists public.story_likes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (story_id, viewer_fingerprint)
);

alter table public.stories
add column if not exists like_count integer not null default 0;

create or replace function public.calculate_story_brightness(
  p_visibility text,
  p_like_count integer
)
returns double precision
language sql
immutable
as $$
  select
    case
      when p_visibility = 'private' then 0.46
      else least(
        1.32,
        0.60 + (1.32 - 0.60) * (1 - exp(-greatest(coalesce(p_like_count, 0), 0)::double precision / 22.0))
      )
    end;
$$;

update public.stories
set brightness_score = public.calculate_story_brightness(visibility, like_count);

create or replace function public.get_universe_stars(
  p_viewer_fingerprint text default null
)
returns table (
  id uuid,
  author_id uuid,
  title text,
  body text,
  visibility text,
  author_mode text,
  author_display_name text,
  star_color text,
  star_size_factor double precision,
  brightness_score double precision,
  star_x double precision,
  star_y double precision,
  star_z double precision,
  coordinate_code text,
  created_at timestamptz,
  updated_at timestamptz,
  view_count integer,
  like_count integer,
  viewer_liked boolean
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.author_id,
    case
      when s.visibility = 'private' and auth.uid() is distinct from s.author_id then null
      else s.title
    end as title,
    case
      when s.visibility = 'private' and auth.uid() is distinct from s.author_id then null
      else s.body
    end as body,
    s.visibility,
    s.author_mode,
    case
      when s.visibility = 'private' and auth.uid() is distinct from s.author_id then null
      else s.author_display_name
    end as author_display_name,
    s.star_color,
    s.star_size_factor,
    s.brightness_score,
    s.star_x,
    s.star_y,
    s.star_z,
    case
      when s.visibility = 'private' and auth.uid() is distinct from s.author_id then null
      else s.coordinate_code
    end as coordinate_code,
    s.created_at,
    s.updated_at,
    s.view_count,
    s.like_count,
    exists (
      select 1
      from public.story_likes sl
      where sl.story_id = s.id
        and p_viewer_fingerprint is not null
        and sl.viewer_fingerprint = p_viewer_fingerprint
    ) as viewer_liked
  from public.stories s
  order by s.updated_at desc;
$$;

drop function if exists public.record_story_view(uuid, text);

create or replace function public.record_story_view(
  p_story_id uuid,
  p_viewer_fingerprint text
)
returns table (
  did_insert boolean,
  view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.story_views (story_id, viewer_fingerprint)
  values (p_story_id, p_viewer_fingerprint)
  on conflict (story_id, viewer_fingerprint, view_bucket) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.stories as story
    set view_count = story.view_count + 1
    where story.id = p_story_id
      and story.visibility = 'public';
  end if;

  return query
  select
    inserted_count > 0,
    s.view_count
  from public.stories s
  where s.id = p_story_id;
end;
$$;

create or replace function public.record_story_like(
  p_story_id uuid,
  p_viewer_fingerprint text
)
returns table (
  did_insert boolean,
  like_count integer,
  brightness_score double precision,
  viewer_liked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.story_likes (story_id, viewer_fingerprint)
  select p_story_id, p_viewer_fingerprint
  where exists (
    select 1
    from public.stories s
    where s.id = p_story_id
      and s.visibility = 'public'
      and (auth.uid() is null or auth.uid() is distinct from s.author_id)
  )
  on conflict (story_id, viewer_fingerprint) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.stories as story
    set
      like_count = story.like_count + 1,
      brightness_score = public.calculate_story_brightness(story.visibility, story.like_count + 1)
    where story.id = p_story_id
      and story.visibility = 'public';
  end if;

  return query
  select
    inserted_count > 0,
    s.like_count,
    s.brightness_score,
    exists (
      select 1
      from public.story_likes sl
      where sl.story_id = s.id
        and sl.viewer_fingerprint = p_viewer_fingerprint
    ) as viewer_liked
  from public.stories s
  where s.id = p_story_id;
end;
$$;

alter table public.story_likes enable row level security;

grant execute on function public.calculate_story_brightness(text, integer) to anon, authenticated;
grant execute on function public.get_universe_stars(text) to anon, authenticated;
grant execute on function public.record_story_view(uuid, text) to anon, authenticated;
grant execute on function public.record_story_like(uuid, text) to anon, authenticated;
