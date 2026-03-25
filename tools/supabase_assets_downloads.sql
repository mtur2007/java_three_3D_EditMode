create extension if not exists pgcrypto;

create table if not exists public.downloadable_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  quota_group text not null default 'asset_shared',
  title text not null,
  description text,
  file_path text not null,
  file_size_bytes bigint not null default 0,
  thumbnail_path text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  constraint downloadable_assets_kind_check
    check (kind in ('st', 'ct', 'tr')),
  constraint downloadable_assets_quota_group_check
    check (quota_group in ('asset_shared', 'structure_download')),
  constraint downloadable_assets_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint downloadable_assets_file_size_nonnegative
    check (file_size_bytes >= 0)
);

create table if not exists public.download_quota_policies (
  quota_group text primary key,
  daily_limit_bytes bigint not null,
  constraint download_quota_policies_group_check
    check (quota_group in ('asset_shared', 'structure_download')),
  constraint download_quota_policies_limit_nonnegative
    check (daily_limit_bytes >= 0)
);

create table if not exists public.downloaded_bytes_log (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  asset_downloaded_bytes bigint not null default 0,
  structure_downloaded_bytes bigint not null default 0,
  constraint downloaded_bytes_log_asset_nonnegative
    check (asset_downloaded_bytes >= 0),
  constraint downloaded_bytes_log_structure_nonnegative
    check (structure_downloaded_bytes >= 0)
);

create index if not exists downloadable_assets_created_at_idx
  on public.downloadable_assets(created_at desc);

create index if not exists downloaded_bytes_log_user_id_idx
  on public.downloaded_bytes_log(user_id);

insert into public.download_quota_policies (quota_group, daily_limit_bytes)
values
  ('asset_shared', 104857600),
  ('structure_download', 409600)
on conflict (quota_group) do update
set daily_limit_bytes = excluded.daily_limit_bytes;

alter table public.downloadable_assets enable row level security;
alter table public.download_quota_policies enable row level security;
alter table public.downloaded_bytes_log enable row level security;

drop policy if exists "downloadable_assets_select_authenticated" on public.downloadable_assets;
create policy "downloadable_assets_select_authenticated"
on public.downloadable_assets
for select
to authenticated
using (true);

drop policy if exists "downloadable_assets_insert_authenticated" on public.downloadable_assets;
create policy "downloadable_assets_insert_authenticated"
on public.downloadable_assets
for insert
to authenticated
with check (true);

drop policy if exists "downloadable_assets_update_authenticated" on public.downloadable_assets;
create policy "downloadable_assets_update_authenticated"
on public.downloadable_assets
for update
to authenticated
using (true)
with check (true);

drop policy if exists "download_quota_policies_select_authenticated" on public.download_quota_policies;
create policy "download_quota_policies_select_authenticated"
on public.download_quota_policies
for select
to authenticated
using (true);

drop policy if exists "downloaded_bytes_log_select_own" on public.downloaded_bytes_log;
create policy "downloaded_bytes_log_select_own"
on public.downloaded_bytes_log
for select
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('asset-files', 'asset-files', false)
on conflict (id) do nothing;

drop policy if exists "asset_files_select_authenticated" on storage.objects;
drop policy if exists "asset_files_insert_authenticated" on storage.objects;
drop policy if exists "asset_files_update_authenticated" on storage.objects;

create policy "asset_files_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('st', 'ct', 'tr')
);

create policy "asset_files_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('st', 'ct', 'tr')
);

create policy "asset_files_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('st', 'ct', 'tr')
)
with check (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('st', 'ct', 'tr')
);

create or replace function public.reserve_asset_download(
  p_asset_id uuid
)
returns table (
  asset_id uuid,
  file_path text,
  file_size_bytes bigint,
  quota_group text,
  daily_limit_bytes bigint,
  used_bytes bigint,
  remaining_bytes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_asset public.downloadable_assets%rowtype;
  v_daily_limit_bytes bigint;
  v_used_bytes bigint;
  v_remaining_bytes bigint;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select *
  into v_asset
  from public.downloadable_assets
  where id = p_asset_id
    and status = 'published';

  if not found then
    raise exception 'asset not found or not published';
  end if;

  select dqp.daily_limit_bytes
  into v_daily_limit_bytes
  from public.download_quota_policies
  as dqp
  where dqp.quota_group = v_asset.quota_group;

  if v_daily_limit_bytes is null then
    raise exception 'quota policy not found';
  end if;

  insert into public.downloaded_bytes_log (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  if v_asset.quota_group = 'structure_download' then
    select dbl.structure_downloaded_bytes
    into v_used_bytes
    from public.downloaded_bytes_log as dbl
    where dbl.user_id = v_uid
    for update;
  else
    select dbl.asset_downloaded_bytes
    into v_used_bytes
    from public.downloaded_bytes_log as dbl
    where dbl.user_id = v_uid
    for update;
  end if;

  v_used_bytes := coalesce(v_used_bytes, 0);

  if v_used_bytes + v_asset.file_size_bytes > v_daily_limit_bytes then
    raise exception 'daily download quota exceeded';
  end if;

  if v_asset.quota_group = 'structure_download' then
    update public.downloaded_bytes_log
    set structure_downloaded_bytes = structure_downloaded_bytes + v_asset.file_size_bytes
    where user_id = v_uid;
  else
    update public.downloaded_bytes_log
    set asset_downloaded_bytes = asset_downloaded_bytes + v_asset.file_size_bytes
    where user_id = v_uid;
  end if;

  v_used_bytes := v_used_bytes + v_asset.file_size_bytes;
  v_remaining_bytes := greatest(0, v_daily_limit_bytes - v_used_bytes);

  return query
  select
    v_asset.id,
    v_asset.file_path,
    v_asset.file_size_bytes,
    v_asset.quota_group,
    v_daily_limit_bytes,
    v_used_bytes,
    v_remaining_bytes;
end;
$$;

grant execute on function public.reserve_asset_download(uuid) to authenticated;

create or replace function public.reserve_world_download(
  p_world_id uuid
)
returns table (
  world_id uuid,
  world_zip_path text,
  world_zip_bytes bigint,
  daily_limit_bytes bigint,
  used_bytes bigint,
  remaining_bytes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_world public.worlds%rowtype;
  v_daily_limit_bytes bigint;
  v_used_bytes bigint;
  v_remaining_bytes bigint;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select w.*
  into v_world
  from public.worlds as w
  where w.id = p_world_id
    and w.status = 'published';

  if not found then
    raise exception 'world not found or not published';
  end if;

  select dqp.daily_limit_bytes
  into v_daily_limit_bytes
  from public.download_quota_policies as dqp
  where dqp.quota_group = 'structure_download';

  if v_daily_limit_bytes is null then
    raise exception 'quota policy not found';
  end if;

  insert into public.downloaded_bytes_log (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select dbl.structure_downloaded_bytes
  into v_used_bytes
  from public.downloaded_bytes_log as dbl
  where dbl.user_id = v_uid
  for update;

  v_used_bytes := coalesce(v_used_bytes, 0);

  if v_used_bytes + coalesce(v_world.world_zip_bytes, 0) > v_daily_limit_bytes then
    raise exception 'structure download quota exceeded';
  end if;

  update public.downloaded_bytes_log
  set structure_downloaded_bytes = structure_downloaded_bytes + coalesce(v_world.world_zip_bytes, 0)
  where user_id = v_uid;

  v_used_bytes := v_used_bytes + coalesce(v_world.world_zip_bytes, 0);
  v_remaining_bytes := greatest(0, v_daily_limit_bytes - v_used_bytes);

  return query
  select
    v_world.id,
    v_world.world_zip_path,
    coalesce(v_world.world_zip_bytes, 0),
    v_daily_limit_bytes,
    v_used_bytes,
    v_remaining_bytes;
end;
$$;

grant execute on function public.reserve_world_download(uuid) to authenticated;

create or replace function public.reset_asset_downloaded_bytes_log()
returns void
language sql
security definer
set search_path = public
as $$
  update public.downloaded_bytes_log
  set
    asset_downloaded_bytes = 0;
$$;

create or replace function public.reset_structure_downloaded_bytes_log()
returns void
language sql
security definer
set search_path = public
as $$
  update public.downloaded_bytes_log
  set
    structure_downloaded_bytes = 0;
$$;

create or replace function public.reset_downloaded_bytes_log()
returns void
language sql
security definer
set search_path = public
as $$
  update public.downloaded_bytes_log
  set
    asset_downloaded_bytes = 0,
    structure_downloaded_bytes = 0;
$$;
