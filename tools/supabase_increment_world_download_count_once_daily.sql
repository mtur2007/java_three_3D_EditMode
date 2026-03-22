alter table public.worlds
add column if not exists download_count bigint not null default 0;

create table if not exists public.world_download_logs (
  id bigint generated always as identity primary key,
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  constraint world_download_logs_once_per_day unique (world_id, user_id)
);

alter table public.world_download_logs
drop column if exists downloaded_on;

alter table public.world_download_logs
drop column if exists created_at;

create index if not exists world_download_logs_user_world_idx
  on public.world_download_logs(user_id, world_id);

alter table public.world_download_logs enable row level security;

drop policy if exists "world_download_logs_select_own_only" on public.world_download_logs;
create policy "world_download_logs_select_own_only"
on public.world_download_logs
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.increment_world_download_count(
  p_world_id uuid
)
returns public.worlds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_world public.worlds%rowtype;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select *
  into v_world
  from public.worlds
  where id = p_world_id
    and status = 'published'
  for update;

  if not found then
    raise exception 'world not found or not published';
  end if;

  insert into public.world_download_logs (
    world_id,
    user_id
  )
  values (
    p_world_id,
    v_uid
  )
  on conflict (world_id, user_id) do nothing;

  if found then
    update public.worlds
    set download_count = coalesce(download_count, 0) + 1
    where id = p_world_id
    returning *
    into v_world;
  end if;

  return v_world;
end;
$$;

grant execute on function public.increment_world_download_count(uuid) to authenticated;

create or replace function public.reset_world_download_logs()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table public.world_download_logs;
$$;

grant execute on function public.reset_world_download_logs() to service_role;

-- 毎日0時台などに実行する想定の手動クエリ:
-- select public.reset_world_download_logs();
