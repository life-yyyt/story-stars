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
