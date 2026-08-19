create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists supabase_vault with schema vault;

create or replace function private.invoke_photo_cleanup()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  cleanup_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'grace_booth_project_url'
  order by created_at desc
  limit 1;

  select decrypted_secret
  into cleanup_secret
  from vault.decrypted_secrets
  where name = 'grace_booth_cleanup_secret'
  order by created_at desc
  limit 1;

  if project_url is null or cleanup_secret is null then
    raise warning 'Grace Booth cleanup Vault secrets are not configured';
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/cleanup-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cleanup-Secret', cleanup_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_photo_cleanup() from public, anon, authenticated;
grant execute on function private.invoke_photo_cleanup() to postgres;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'grace-booth-cleanup-expired';

  perform cron.schedule(
    'grace-booth-cleanup-expired',
    '17 19 * * *',
    'select private.invoke_photo_cleanup()'
  );
end;
$$;
