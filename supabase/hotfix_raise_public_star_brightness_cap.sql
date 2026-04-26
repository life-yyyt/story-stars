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
set brightness_score = public.calculate_story_brightness(visibility, like_count)
where visibility = 'public';

grant execute on function public.calculate_story_brightness(text, integer) to anon, authenticated;
