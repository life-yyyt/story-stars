-- ==== 20260408193000_story_universe.sql ====
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default 'Star Traveler',
  phone_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 12000),
  visibility text not null check (visibility in ('public', 'private')),
  author_mode text not null check (author_mode in ('named', 'anonymous')),
  author_display_name text,
  star_x double precision not null,
  star_y double precision not null,
  star_z double precision not null,
  star_size_factor double precision not null check (star_size_factor between 0.8 and 1.8),
  star_color text not null check (star_color ~ '^#[0-9A-Fa-f]{6}$'),
  brightness_score double precision not null default 0.60,
  coordinate_code text unique,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stories_coordinate_code_idx
on public.stories (coordinate_code)
where coordinate_code is not null;

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_fingerprint text not null,
  view_bucket date not null default now()::date,
  created_at timestamptz not null default now(),
  unique (story_id, viewer_fingerprint, view_bucket)
);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  draft_title text,
  draft_body text,
  target_visibility text not null default 'public',
  rule_hit_codes text[] not null default '{}',
  llm_label text,
  final_status text not null,
  message text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stories_set_updated_at on public.stories;
create trigger stories_set_updated_at
before update on public.stories
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_anonymous_user boolean := coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false);
begin
  insert into public.profiles (id, nickname, phone_verified_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'display_name',
      case
        when is_anonymous_user then concat('Star Traveler-', left(new.id::text, 4))
        else concat('Star Traveler-', right(coalesce(new.phone, ''), 4))
      end,
      'Star Traveler'
    ),
    new.phone_confirmed_at
  )
  on conflict (id) do update
  set
    nickname = excluded.nickname,
    phone_verified_at = excluded.phone_verified_at;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_profile();

create or replace function public.generate_coordinate_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate :=
      'STAR-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 3)) ||
      '-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 3));

    exit when not exists (
      select 1 from public.stories where coordinate_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.reserve_story_coordinate()
returns table (
  star_x double precision,
  star_y double precision,
  star_z double precision,
  star_size_factor double precision,
  coordinate_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_x double precision;
  candidate_y double precision;
  candidate_z double precision;
  candidate_size double precision;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate_x := -90 + random() * 180;
    candidate_y := -42 + random() * 84;
    candidate_z := -90 + random() * 180;
    candidate_size := (round((0.8 + random())::numeric, 2))::double precision;

    exit when attempts > 60 or not exists (
      select 1
      from public.stories existing_story
      where sqrt(
        power(existing_story.star_x - candidate_x, 2) +
        power(existing_story.star_y - candidate_y, 2) +
        power(existing_story.star_z - candidate_z, 2)
      ) < 8.5
    );
  end loop;

  return query
  select
    candidate_x,
    candidate_y,
    candidate_z,
    candidate_size,
    public.generate_coordinate_code();
end;
$$;

create or replace function public.get_universe_stars()
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
  view_count integer
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
    s.view_count
  from public.stories s
  where s.visibility = 'public' or auth.uid() = s.author_id
  order by s.updated_at desc;
$$;

drop function if exists public.record_story_view(uuid, text);

create or replace function public.record_story_view(
  p_story_id uuid,
  p_viewer_fingerprint text
)
returns table (
  did_insert boolean,
  view_count integer,
  brightness_score double precision
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
      and story.visibility = 'public';
  end if;

  return query
  select
    inserted_count > 0,
    s.view_count,
    s.brightness_score
  from public.stories s
  where s.id = p_story_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.moderation_logs enable row level security;

drop policy if exists "profiles are readable by owner" on public.profiles;
create policy "profiles are readable by owner"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles are updatable by owner" on public.profiles;
create policy "profiles are updatable by owner"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "public stories are readable" on public.stories;
create policy "public stories are readable"
on public.stories
for select
to anon, authenticated
using (visibility = 'public' or auth.uid() = author_id);

drop policy if exists "authors can insert stories" on public.stories;
create policy "authors can insert stories"
on public.stories
for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists "authors can update stories" on public.stories;
create policy "authors can update stories"
on public.stories
for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "authors can delete stories" on public.stories;
create policy "authors can delete stories"
on public.stories
for delete
to authenticated
using (auth.uid() = author_id);

grant execute on function public.generate_coordinate_code() to authenticated;
grant execute on function public.reserve_story_coordinate() to authenticated;
grant execute on function public.get_universe_stars() to anon, authenticated;
grant execute on function public.record_story_view(uuid, text) to anon, authenticated;

-- ==== 20260409213000_story_likes_brightness.sql ====
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
    from public.stories s
    where s.id = p_story_id
      and s.visibility = 'public'
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
    from public.story_likes sl
    where sl.story_id = p_story_id
      and sl.viewer_fingerprint = p_viewer_fingerprint
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

alter table public.story_likes enable row level security;

grant execute on function public.calculate_story_brightness(text, integer) to anon, authenticated;
grant execute on function public.get_universe_stars(text) to anon, authenticated;
grant execute on function public.record_story_view(uuid, text) to anon, authenticated;
grant execute on function public.record_story_like(uuid, text) to anon, authenticated;

-- ==== 20260409233000_universe_window_loading.sql ====
create extension if not exists postgis;

create or replace function public.story_voxel_cell(
  p_x double precision,
  p_y double precision,
  p_z double precision,
  p_cell_size double precision
)
returns text
language sql
immutable
as $$
  select concat_ws(
    ':',
    floor(p_x / p_cell_size)::bigint,
    floor(p_y / p_cell_size)::bigint,
    floor(p_z / p_cell_size)::bigint
  );
$$;

alter table public.stories
add column if not exists star_point geometry(PointZ, 0)
generated always as (st_setsrid(st_makepoint(star_x, star_y, star_z), 0)) stored;

alter table public.stories
add column if not exists cell_l1 text
generated always as (public.story_voxel_cell(star_x, star_y, star_z, 40.0)) stored;

alter table public.stories
add column if not exists cell_l2 text
generated always as (public.story_voxel_cell(star_x, star_y, star_z, 64.0)) stored;

alter table public.stories
add column if not exists cell_l3 text
generated always as (public.story_voxel_cell(star_x, star_y, star_z, 96.0)) stored;

create index if not exists stories_star_point_gix on public.stories using gist (star_point);
create index if not exists stories_cell_l1_idx on public.stories (cell_l1);
create index if not exists stories_cell_l2_idx on public.stories (cell_l2);
create index if not exists stories_cell_l3_idx on public.stories (cell_l3);

create or replace function public.get_universe_window_stars(
  p_center_x double precision,
  p_center_y double precision,
  p_center_z double precision,
  p_radius double precision,
  p_viewer_fingerprint text default null
)
returns table (
  id uuid,
  visibility text,
  star_color text,
  star_size_factor double precision,
  brightness_score double precision,
  star_x double precision,
  star_y double precision,
  star_z double precision,
  coordinate_code text,
  is_owner boolean
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select st_setsrid(st_makepoint(p_center_x, p_center_y, p_center_z), 0) as point
  )
  select
    s.id,
    s.visibility,
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
    auth.uid() = s.author_id as is_owner
  from public.stories s
  cross join target t
  where (s.visibility = 'public' or auth.uid() = s.author_id)
    and st_3ddwithin(s.star_point, t.point, p_radius)
  order by s.updated_at desc
  limit 360;
$$;

create or replace function public.get_universe_clusters(
  p_center_x double precision,
  p_center_y double precision,
  p_center_z double precision,
  p_zoom_tier text,
  p_viewer_fingerprint text default null
)
returns table (
  id text,
  x double precision,
  y double precision,
  z double precision,
  count integer,
  intensity double precision,
  dominant_color text,
  radius double precision,
  semantic_label text,
  semantic_temperature double precision
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select st_setsrid(st_makepoint(p_center_x, p_center_y, p_center_z), 0) as point
  ),
  scoped as (
    select
      s.*,
      case
        when p_zoom_tier = 'far' then s.cell_l3
        else s.cell_l2
      end as cluster_id,
      case
        when p_zoom_tier = 'far' then 96.0
        else 64.0
      end as cell_size
    from public.stories s
    cross join target t
    where (s.visibility = 'public' or auth.uid() = s.author_id)
      and st_3ddwithin(s.star_point, t.point, 900)
      and (
        (p_zoom_tier = 'far')
        or (p_zoom_tier <> 'far' and not st_3ddwithin(s.star_point, t.point, 84))
      )
  )
  select
    scoped.cluster_id as id,
    avg(scoped.star_x)::double precision as x,
    avg(scoped.star_y)::double precision as y,
    avg(scoped.star_z)::double precision as z,
    count(*)::integer as count,
    least(1.12, 0.24 + (ln(count(*) + 1) / ln(2)) * 0.14)::double precision as intensity,
    (array_agg(scoped.star_color order by scoped.brightness_score desc))[1] as dominant_color,
    (max(scoped.cell_size) * (0.46 + least(count(*), 18) * 0.022))::double precision as radius,
    null::text as semantic_label,
    null::double precision as semantic_temperature
  from scoped
  group by scoped.cluster_id
  order by count(*) desc;
$$;

create or replace function public.get_story_detail(
  p_story_id uuid,
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
    s.title,
    s.body,
    s.visibility,
    s.author_mode,
    s.author_display_name,
    s.star_color,
    s.star_size_factor,
    s.brightness_score,
    s.star_x,
    s.star_y,
    s.star_z,
    s.coordinate_code,
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
  where s.id = p_story_id
    and (s.visibility = 'public' or auth.uid() = s.author_id);
$$;

create or replace function public.resolve_coordinate_target(
  p_coordinate_code text,
  p_viewer_fingerprint text default null
)
returns table (
  story_id uuid,
  star_x double precision,
  star_y double precision,
  star_z double precision,
  coordinate_code text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id as story_id,
    s.star_x,
    s.star_y,
    s.star_z,
    s.coordinate_code
  from public.stories s
  where upper(s.coordinate_code) = upper(trim(p_coordinate_code))
    and (s.visibility = 'public' or auth.uid() = s.author_id)
  limit 1;
$$;

grant execute on function public.story_voxel_cell(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.get_universe_window_stars(double precision, double precision, double precision, double precision, text) to anon, authenticated;
grant execute on function public.get_universe_clusters(double precision, double precision, double precision, text, text) to anon, authenticated;
grant execute on function public.get_story_detail(uuid, text) to anon, authenticated;
grant execute on function public.resolve_coordinate_target(text, text) to anon, authenticated;

-- ==== 20260420103000_clean_anonymous_profiles.sql ====
alter table public.profiles
alter column nickname set default 'Star Traveler';

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_anonymous_user boolean := coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false);
begin
  insert into public.profiles (id, nickname, phone_verified_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'display_name',
      case
        when is_anonymous_user then concat('Star Traveler-', left(new.id::text, 4))
        else concat('Star Traveler-', right(coalesce(new.phone, ''), 4))
      end,
      'Star Traveler'
    ),
    new.phone_confirmed_at
  )
  on conflict (id) do update
  set
    nickname = excluded.nickname,
    phone_verified_at = excluded.phone_verified_at;

  return new;
end;
$$;

-- ==== 20260420143000_daily_story_limit.sql ====
create or replace function public.enforce_daily_story_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_count integer;
begin
  select count(*)
  into daily_count
  from public.stories story
  where story.author_id = new.author_id
    and (story.created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;

  if daily_count >= 3 then
    raise exception 'DAILY_STORY_LIMIT_REACHED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists stories_daily_limit on public.stories;
create trigger stories_daily_limit
before insert on public.stories
for each row
execute function public.enforce_daily_story_limit();

-- ==== 20260421170000_star_remnants.sql ====
create table if not exists public.star_remnants (
  id uuid primary key default gen_random_uuid(),
  original_story_id uuid unique,
  star_color text not null check (star_color ~ '^#[0-9A-Fa-f]{6}$'),
  star_size_factor double precision not null check (star_size_factor between 0.8 and 1.8),
  brightness_score double precision not null default 0.46,
  star_x double precision not null,
  star_y double precision not null,
  star_z double precision not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz not null default now()
);

alter table public.star_remnants
add column if not exists star_point geometry(PointZ, 0)
generated always as (st_setsrid(st_makepoint(star_x, star_y, star_z), 0)) stored;

alter table public.star_remnants
add column if not exists cell_l2 text
generated always as (public.story_voxel_cell(star_x, star_y, star_z, 64.0)) stored;

alter table public.star_remnants
add column if not exists cell_l3 text
generated always as (public.story_voxel_cell(star_x, star_y, star_z, 96.0)) stored;

create index if not exists star_remnants_star_point_gix on public.star_remnants using gist (star_point);
create index if not exists star_remnants_cell_l2_idx on public.star_remnants (cell_l2);
create index if not exists star_remnants_cell_l3_idx on public.star_remnants (cell_l3);

create or replace function public.retire_story_to_remnant(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_story public.stories%rowtype;
begin
  select *
  into target_story
  from public.stories
  where id = p_story_id
    and author_id = auth.uid();

  if not found then
    return false;
  end if;

  insert into public.star_remnants (
    original_story_id,
    star_color,
    star_size_factor,
    brightness_score,
    star_x,
    star_y,
    star_z,
    created_at,
    retired_at
  )
  values (
    target_story.id,
    target_story.star_color,
    target_story.star_size_factor,
    least(target_story.brightness_score, 0.46),
    target_story.star_x,
    target_story.star_y,
    target_story.star_z,
    target_story.created_at,
    now()
  )
  on conflict (original_story_id) do update
  set
    star_color = excluded.star_color,
    star_size_factor = excluded.star_size_factor,
    brightness_score = excluded.brightness_score,
    star_x = excluded.star_x,
    star_y = excluded.star_y,
    star_z = excluded.star_z,
    retired_at = excluded.retired_at;

  delete from public.stories
  where id = p_story_id
    and author_id = auth.uid();

  return true;
end;
$$;

create or replace function public.get_universe_window_stars(
  p_center_x double precision,
  p_center_y double precision,
  p_center_z double precision,
  p_radius double precision,
  p_viewer_fingerprint text default null
)
returns table (
  id uuid,
  visibility text,
  star_color text,
  star_size_factor double precision,
  brightness_score double precision,
  star_x double precision,
  star_y double precision,
  star_z double precision,
  coordinate_code text,
  is_owner boolean
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select st_setsrid(st_makepoint(p_center_x, p_center_y, p_center_z), 0) as point
  ),
  window_rows as (
    select
      s.id,
      s.visibility,
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
      auth.uid() = s.author_id as is_owner,
      s.updated_at as sort_time
    from public.stories s
    cross join target t
    where (s.visibility = 'public' or auth.uid() = s.author_id)
      and st_3ddwithin(s.star_point, t.point, p_radius)

    union all

    select
      r.id,
      'private'::text as visibility,
      r.star_color,
      r.star_size_factor,
      r.brightness_score,
      r.star_x,
      r.star_y,
      r.star_z,
      null::text as coordinate_code,
      false as is_owner,
      r.retired_at as sort_time
    from public.star_remnants r
    cross join target t
    where st_3ddwithin(r.star_point, t.point, p_radius)
  )
  select
    window_rows.id,
    window_rows.visibility,
    window_rows.star_color,
    window_rows.star_size_factor,
    window_rows.brightness_score,
    window_rows.star_x,
    window_rows.star_y,
    window_rows.star_z,
    window_rows.coordinate_code,
    window_rows.is_owner
  from window_rows
  order by window_rows.sort_time desc
  limit 360;
$$;

create or replace function public.get_universe_clusters(
  p_center_x double precision,
  p_center_y double precision,
  p_center_z double precision,
  p_zoom_tier text,
  p_viewer_fingerprint text default null
)
returns table (
  id text,
  x double precision,
  y double precision,
  z double precision,
  count integer,
  intensity double precision,
  dominant_color text,
  radius double precision,
  semantic_label text,
  semantic_temperature double precision
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select st_setsrid(st_makepoint(p_center_x, p_center_y, p_center_z), 0) as point
  ),
  scoped as (
    select
      s.star_x,
      s.star_y,
      s.star_z,
      s.star_color,
      s.brightness_score,
      case
        when p_zoom_tier = 'far' then s.cell_l3
        else s.cell_l2
      end as cluster_id,
      case
        when p_zoom_tier = 'far' then 96.0
        else 64.0
      end as cell_size
    from public.stories s
    cross join target t
    where (s.visibility = 'public' or auth.uid() = s.author_id)
      and st_3ddwithin(s.star_point, t.point, 900)
      and (
        (p_zoom_tier = 'far')
        or (p_zoom_tier <> 'far' and not st_3ddwithin(s.star_point, t.point, 84))
      )

    union all

    select
      r.star_x,
      r.star_y,
      r.star_z,
      r.star_color,
      r.brightness_score,
      case
        when p_zoom_tier = 'far' then r.cell_l3
        else r.cell_l2
      end as cluster_id,
      case
        when p_zoom_tier = 'far' then 96.0
        else 64.0
      end as cell_size
    from public.star_remnants r
    cross join target t
    where st_3ddwithin(r.star_point, t.point, 900)
      and (
        (p_zoom_tier = 'far')
        or (p_zoom_tier <> 'far' and not st_3ddwithin(r.star_point, t.point, 84))
      )
  )
  select
    scoped.cluster_id as id,
    avg(scoped.star_x)::double precision as x,
    avg(scoped.star_y)::double precision as y,
    avg(scoped.star_z)::double precision as z,
    count(*)::integer as count,
    least(1.12, 0.24 + (ln(count(*) + 1) / ln(2)) * 0.14)::double precision as intensity,
    (array_agg(scoped.star_color order by scoped.brightness_score desc))[1] as dominant_color,
    (max(scoped.cell_size) * (0.46 + least(count(*), 18) * 0.022))::double precision as radius,
    null::text as semantic_label,
    null::double precision as semantic_temperature
  from scoped
  group by scoped.cluster_id
  order by count(*) desc;
$$;

alter table public.star_remnants enable row level security;

grant execute on function public.retire_story_to_remnant(uuid) to authenticated;
grant execute on function public.get_universe_window_stars(double precision, double precision, double precision, double precision, text) to anon, authenticated;
grant execute on function public.get_universe_clusters(double precision, double precision, double precision, text, text) to anon, authenticated;

