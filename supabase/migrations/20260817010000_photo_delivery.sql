create extension if not exists pgcrypto with schema extensions;

create type public.photo_session_status as enum (
  'pending',
  'ready',
  'expired',
  'deleting',
  'deleted'
);

create table public.booth_devices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  device_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint booth_devices_device_name_length
    check (char_length(device_name) between 1 and 80)
);

comment on table public.booth_devices is
  'Allow-list of dedicated Supabase Auth users permitted to operate a booth.';

create table public.photo_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references public.booth_devices (user_id) on delete restrict,
  client_session_id uuid not null,
  public_token_hash bytea not null,
  storage_object_path text not null,
  status public.photo_session_status not null default 'pending',
  delivery_generation integer not null default 0,
  content_type text not null,
  byte_size bigint not null,
  content_sha256 bytea not null,
  image_width integer not null,
  image_height integer not null,
  google_forms_url text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  ready_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  cleanup_lease_id uuid,
  cleanup_lease_until timestamptz,
  constraint photo_sessions_public_token_hash_length
    check (octet_length(public_token_hash) = 32),
  constraint photo_sessions_storage_object_path_shape
    check (
      storage_object_path ~ '^[0-9]{4}/[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg$'
    ),
  constraint photo_sessions_content_type
    check (content_type = 'image/jpeg'),
  constraint photo_sessions_delivery_generation
    check (delivery_generation >= 0),
  constraint photo_sessions_byte_size
    check (byte_size between 1 and 12582912),
  constraint photo_sessions_content_sha256_length
    check (octet_length(content_sha256) = 32),
  constraint photo_sessions_image_dimensions
    check (
      image_width between 1 and 3000
      and image_height between 1 and 3000
      and greatest(image_width, image_height) between 2500 and 3000
    ),
  constraint photo_sessions_google_forms_url
    check (
      google_forms_url is null
      or (
        char_length(google_forms_url) <= 2048
        and google_forms_url ~ '^https://(forms[.]gle/|forms[.]google[.]com/|docs[.]google[.]com/forms/)'
      )
    ),
  constraint photo_sessions_ready_expiry
    check (
      (ready_at is null and expires_at is null)
      or (
        ready_at is not null
        and expires_at = ready_at + interval '720 hours'
      )
    ),
  constraint photo_sessions_status_timestamps
    check (
      (status = 'pending' and ready_at is null and expires_at is null and deleted_at is null)
      or (status = 'ready' and ready_at is not null and expires_at is not null and deleted_at is null)
      or (status = 'expired' and ready_at is not null and expires_at is not null and deleted_at is null)
      or (status = 'deleting' and deleted_at is null)
      or (status = 'deleted' and deleted_at is not null)
    ),
  constraint photo_sessions_cleanup_lease_pair
    check (
      (cleanup_lease_id is null and cleanup_lease_until is null)
      or (cleanup_lease_id is not null and cleanup_lease_until is not null)
    ),
  constraint photo_sessions_cleanup_status
    check (
      status = 'deleting'
      or cleanup_lease_id is null
    )
);

comment on table public.photo_sessions is
  'Private photo-delivery metadata. public_token_hash is SHA-256 of the raw 256-bit QR token.';

comment on column public.photo_sessions.public_token_hash is
  'Exactly 32 bytes. The raw public token must never be stored in Postgres.';

create unique index photo_sessions_public_token_hash_key
  on public.photo_sessions (public_token_hash);

create unique index photo_sessions_storage_object_path_key
  on public.photo_sessions (storage_object_path);

create index photo_sessions_owner_status_idx
  on public.photo_sessions (owner_user_id, status, created_at desc);

create unique index photo_sessions_owner_client_session_key
  on public.photo_sessions (owner_user_id, client_session_id);

create index photo_sessions_expiry_cleanup_idx
  on public.photo_sessions (expires_at)
  where status in ('ready', 'expired');

create index photo_sessions_pending_cleanup_idx
  on public.photo_sessions (updated_at)
  where status = 'pending';

create index photo_sessions_deleting_cleanup_idx
  on public.photo_sessions (cleanup_lease_until)
  where status = 'deleting';

alter table public.booth_devices enable row level security;
alter table public.booth_devices force row level security;
alter table public.photo_sessions enable row level security;
alter table public.photo_sessions force row level security;

revoke all on public.booth_devices from anon, authenticated;
revoke all on public.photo_sessions from anon, authenticated;

grant all on public.booth_devices to service_role;
grant all on public.photo_sessions to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function public.create_or_get_photo_session(
  p_candidate_id uuid,
  p_owner_user_id uuid,
  p_client_session_id uuid,
  p_public_token_hash_hex text,
  p_storage_object_path text,
  p_content_type text,
  p_byte_size bigint,
  p_content_sha256_hex text,
  p_image_width integer,
  p_image_height integer,
  p_google_forms_url text
)
returns table (
  id uuid,
  storage_object_path text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photo_sessions%rowtype;
  metadata_matches boolean;
begin
  if p_public_token_hash_hex !~ '^[0-9a-f]{64}$'
    or p_content_sha256_hex !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_hash';
  end if;

  insert into public.photo_sessions (
    id,
    owner_user_id,
    client_session_id,
    public_token_hash,
    storage_object_path,
    content_type,
    byte_size,
    content_sha256,
    image_width,
    image_height,
    google_forms_url
  )
  values (
    p_candidate_id,
    p_owner_user_id,
    p_client_session_id,
    decode(p_public_token_hash_hex, 'hex'),
    p_storage_object_path,
    p_content_type,
    p_byte_size,
    decode(p_content_sha256_hex, 'hex'),
    p_image_width,
    p_image_height,
    p_google_forms_url
  )
  on conflict (owner_user_id, client_session_id) do nothing;

  select *
  into target
  from public.photo_sessions
  where owner_user_id = p_owner_user_id
    and client_session_id = p_client_session_id
  for update;

  if target.id = p_candidate_id then
    return query select target.id, target.storage_object_path, true;
    return;
  end if;

  metadata_matches := target.content_type = p_content_type
    and target.byte_size = p_byte_size
    and target.content_sha256 = decode(p_content_sha256_hex, 'hex')
    and target.image_width = p_image_width
    and target.image_height = p_image_height
    and target.google_forms_url is not distinct from p_google_forms_url
    and target.public_token_hash = decode(p_public_token_hash_hex, 'hex');

  if not metadata_matches then
    raise exception using errcode = 'P0001', message = 'photo_session_conflict';
  end if;

  if target.status = 'pending' then
    update public.photo_sessions
    set updated_at = statement_timestamp()
    where photo_sessions.id = target.id;
    return query select target.id, target.storage_object_path, false;
    return;
  end if;

  if target.status = 'deleted'
    and target.ready_at is null
    and target.expires_at is null then
    return query
    update public.photo_sessions
    set
      status = 'pending',
      delivery_generation = target.delivery_generation + 1,
      updated_at = statement_timestamp(),
      deleted_at = null,
      cleanup_lease_id = null,
      cleanup_lease_until = null
    where photo_sessions.id = target.id
    returning photo_sessions.id, photo_sessions.storage_object_path, false;
    return;
  end if;

  raise exception using errcode = 'P0001', message = 'photo_session_conflict';
end;
$$;

create or replace function public.resume_or_reopen_photo_session(
  p_session_id uuid,
  p_owner_user_id uuid
)
returns table (
  id uuid,
  storage_object_path text,
  reopened boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photo_sessions%rowtype;
begin
  select *
  into target
  from public.photo_sessions
  where id = p_session_id
    and owner_user_id = p_owner_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'photo_session_not_found';
  end if;

  if target.status = 'pending' then
    update public.photo_sessions
    set updated_at = statement_timestamp()
    where photo_sessions.id = target.id;
    return query select
      target.id,
      target.storage_object_path,
      target.updated_at <= clock_timestamp() - interval '24 hours';
    return;
  end if;

  if target.status = 'deleted'
    and target.ready_at is null
    and target.expires_at is null then
    return query
    update public.photo_sessions
    set
      status = 'pending',
      delivery_generation = target.delivery_generation + 1,
      updated_at = statement_timestamp(),
      deleted_at = null,
      cleanup_lease_id = null,
      cleanup_lease_until = null
    where photo_sessions.id = target.id
    returning photo_sessions.id, photo_sessions.storage_object_path, true;
    return;
  end if;

  raise exception using errcode = 'P0001', message = 'photo_session_not_resumable';
end;
$$;

create or replace function public.finalize_photo_session(
  p_session_id uuid,
  p_owner_user_id uuid,
  p_public_token_hash_hex text,
  p_delivery_generation integer
)
returns table (
  status public.photo_session_status,
  ready_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photo_sessions%rowtype;
  finalized_at timestamptz := statement_timestamp();
begin
  if p_public_token_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_hash';
  end if;

  select *
  into target
  from public.photo_sessions
  where id = p_session_id
    and owner_user_id = p_owner_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'photo_session_not_found';
  end if;

  if target.public_token_hash <> decode(p_public_token_hash_hex, 'hex') then
    raise exception using errcode = 'P0001', message = 'public_token_mismatch';
  end if;

  if target.delivery_generation <> p_delivery_generation then
    raise exception using errcode = 'P0001', message = 'photo_session_generation_mismatch';
  end if;

  if target.status = 'ready' then
    return query select target.status, target.ready_at, target.expires_at;
    return;
  end if;

  if target.status <> 'pending'
    or target.cleanup_lease_id is not null then
    raise exception using errcode = 'P0001', message = 'photo_session_not_pending';
  end if;

  return query
  update public.photo_sessions
  set
    status = 'ready',
    ready_at = finalized_at,
    expires_at = finalized_at + interval '720 hours',
    updated_at = finalized_at
  where id = target.id
  returning
    photo_sessions.status,
    photo_sessions.ready_at,
    photo_sessions.expires_at;
end;
$$;

create or replace function public.resolve_photo_session(
  p_public_token_hash_hex text
)
returns table (
  id uuid,
  storage_object_path text,
  content_type text,
  byte_size bigint,
  google_forms_url text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    photo_sessions.id,
    photo_sessions.storage_object_path,
    photo_sessions.content_type,
    photo_sessions.byte_size,
    photo_sessions.google_forms_url,
    photo_sessions.expires_at
  from public.photo_sessions
  where p_public_token_hash_hex ~ '^[0-9a-f]{64}$'
    and photo_sessions.public_token_hash = decode(p_public_token_hash_hex, 'hex')
    and photo_sessions.status = 'ready'
    and photo_sessions.expires_at > clock_timestamp()
  limit 1;
$$;

create or replace function public.claim_photo_cleanup(
  p_limit integer,
  p_lease_id uuid
)
returns table (
  id uuid,
  storage_object_path text,
  previous_status public.photo_session_status
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'cleanup_limit_out_of_range';
  end if;

  update public.photo_sessions
  set
    status = 'expired',
    updated_at = statement_timestamp()
  where status = 'ready'
    and expires_at <= clock_timestamp();

  return query
  with candidates as (
    select photo_sessions.id, photo_sessions.status as previous_status
    from public.photo_sessions
    where (
      photo_sessions.status in ('expired', 'deleting')
      or (
        photo_sessions.status = 'pending'
        and photo_sessions.updated_at <= clock_timestamp() - interval '24 hours'
      )
    )
      and (
        photo_sessions.cleanup_lease_until is null
        or photo_sessions.cleanup_lease_until <= clock_timestamp()
      )
    order by coalesce(photo_sessions.expires_at, photo_sessions.updated_at), photo_sessions.id
    for update skip locked
    limit p_limit
  )
  update public.photo_sessions
  set
    status = 'deleting',
    cleanup_lease_id = p_lease_id,
    cleanup_lease_until = statement_timestamp() + interval '10 minutes',
    updated_at = statement_timestamp()
  from candidates
  where photo_sessions.id = candidates.id
  returning photo_sessions.id, photo_sessions.storage_object_path, candidates.previous_status;
end;
$$;

create or replace function public.complete_photo_cleanup(
  p_session_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.photo_sessions
  set
    status = 'deleted',
    deleted_at = coalesce(deleted_at, statement_timestamp()),
    cleanup_lease_id = null,
    cleanup_lease_until = null,
    updated_at = statement_timestamp()
  where id = p_session_id
    and cleanup_lease_id = p_lease_id
    and status = 'deleting';

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.create_or_get_photo_session(
  uuid, uuid, uuid, text, text, text, bigint, text, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.resume_or_reopen_photo_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_photo_session(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.resolve_photo_session(text) from public, anon, authenticated;
revoke all on function public.claim_photo_cleanup(integer, uuid) from public, anon, authenticated;
revoke all on function public.complete_photo_cleanup(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_or_get_photo_session(
  uuid, uuid, uuid, text, text, text, bigint, text, integer, integer, text
) to service_role;
grant execute on function public.resume_or_reopen_photo_session(uuid, uuid) to service_role;
grant execute on function public.finalize_photo_session(uuid, uuid, text, integer) to service_role;
grant execute on function public.resolve_photo_session(text) to service_role;
grant execute on function public.claim_photo_cleanup(integer, uuid) to service_role;
grant execute on function public.complete_photo_cleanup(uuid, uuid) to service_role;
