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
    check (kind in ('ct', 'tr')),
  constraint downloadable_assets_quota_group_check
    check (quota_group = 'asset_shared'),
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

create table if not exists public.asset_download_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.downloadable_assets(id) on delete cascade,
  quota_group text not null,
  downloaded_bytes bigint not null,
  constraint asset_download_logs_group_check
    check (quota_group in ('asset_shared', 'structure_download')),
  constraint asset_download_logs_bytes_nonnegative
    check (downloaded_bytes >= 0)
);

create index if not exists downloadable_assets_created_at_idx
  on public.downloadable_assets(created_at desc);

create index if not exists asset_download_logs_user_group_idx
  on public.asset_download_logs(user_id, quota_group);

insert into public.download_quota_policies (quota_group, daily_limit_bytes)
values
  ('asset_shared', 104857600),
  ('structure_download', 409600)
on conflict (quota_group) do update
set daily_limit_bytes = excluded.daily_limit_bytes;

alter table public.downloadable_assets enable row level security;
alter table public.download_quota_policies enable row level security;
alter table public.asset_download_logs enable row level security;

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

drop policy if exists "asset_download_logs_select_own" on public.asset_download_logs;
create policy "asset_download_logs_select_own"
on public.asset_download_logs
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
  and (storage.foldername(name))[2] in ('ct', 'tr')
);

create policy "asset_files_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('ct', 'tr')
);

create policy "asset_files_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('ct', 'tr')
)
with check (
  bucket_id = 'asset-files'
  and (storage.foldername(name))[1] = 'assets'
  and (storage.foldername(name))[2] in ('ct', 'tr')
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

  select coalesce(sum(downloaded_bytes), 0)
  into v_used_bytes
  from public.asset_download_logs
  where user_id = v_uid
    and quota_group = v_asset.quota_group;

  if v_used_bytes + v_asset.file_size_bytes > v_daily_limit_bytes then
    raise exception 'daily download quota exceeded';
  end if;

  insert into public.asset_download_logs (
    user_id,
    asset_id,
    quota_group,
    downloaded_bytes
  )
  values (
    v_uid,
    v_asset.id,
    v_asset.quota_group,
    v_asset.file_size_bytes
  );

  return query
  select
    v_asset.id,
    v_asset.file_path,
    v_asset.file_size_bytes,
    v_asset.quota_group,
    v_daily_limit_bytes,
    v_used_bytes + v_asset.file_size_bytes,
    greatest(0, v_daily_limit_bytes - (v_used_bytes + v_asset.file_size_bytes));
end;
$$;

grant execute on function public.reserve_asset_download(uuid) to authenticated;

create or replace function public.reset_asset_download_logs()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table public.asset_download_logs;
$$;
