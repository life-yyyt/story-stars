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
  next_view_count integer;
begin
  insert into public.story_views (story_id, viewer_fingerprint)
  values (p_story_id, p_viewer_fingerprint)
  on conflict (story_id, viewer_fingerprint, view_bucket) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.stories as story
    set view_count = story.view_count + 1
    where story.id = p_story_id
      and story.visibility = 'public'
    returning story.view_count into next_view_count;
  end if;

  if next_view_count is null then
    select story.view_count
    into next_view_count
    from public.stories as story
    where story.id = p_story_id;
  end if;

  return query
  select
    inserted_count > 0,
    coalesce(next_view_count, 0);
end;
$$;

drop function if exists public.record_story_like(uuid, text);

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
  next_like_count integer;
  next_brightness_score double precision;
  viewer_has_liked boolean;
begin
  insert into public.story_likes (story_id, viewer_fingerprint)
  select p_story_id, p_viewer_fingerprint
  where exists (
    select 1
    from public.stories as story
    where story.id = p_story_id
      and story.visibility = 'public'
      and p_viewer_fingerprint is not null
  )
  on conflict (story_id, viewer_fingerprint) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.stories as story
    set
      like_count = story.like_count + 1,
      brightness_score = public.calculate_story_brightness(story.visibility, story.like_count + 1)
    where story.id = p_story_id
      and story.visibility = 'public'
    returning story.like_count, story.brightness_score into next_like_count, next_brightness_score;
  end if;

  if next_like_count is null then
    select story.like_count, story.brightness_score
    into next_like_count, next_brightness_score
    from public.stories as story
    where story.id = p_story_id;
  end if;

  select exists (
    select 1
    from public.story_likes as story_like
    where story_like.story_id = p_story_id
      and story_like.viewer_fingerprint = p_viewer_fingerprint
  )
  into viewer_has_liked;

  return query
  select
    inserted_count > 0,
    coalesce(next_like_count, 0),
    coalesce(next_brightness_score, 0.60::double precision),
    viewer_has_liked;
end;
$$;

grant execute on function public.record_story_view(uuid, text) to anon, authenticated;
grant execute on function public.record_story_like(uuid, text) to anon, authenticated;
