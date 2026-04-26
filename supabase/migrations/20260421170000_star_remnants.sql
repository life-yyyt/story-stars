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
