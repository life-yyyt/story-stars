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
