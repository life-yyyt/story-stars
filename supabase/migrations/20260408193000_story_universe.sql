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
