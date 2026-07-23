create or replace function private.add_bdc_team_member_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.team_members (email, role, active)
    values (lower(new.email), 'bdc', true)
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.add_bdc_team_member_on_signup() from public;

drop trigger if exists assign_bdc_on_auth_user_created on auth.users;
create trigger assign_bdc_on_auth_user_created
after insert on auth.users
for each row execute function private.add_bdc_team_member_on_signup();

insert into public.team_members (email, role, active)
select lower(email), 'bdc', true
from auth.users
where email is not null
on conflict (email) do nothing;
