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
