-- The `photos` bucket is materialized from supabase/config.toml in local development
-- and by `supabase seed buckets --linked` for a linked project. Its metadata is owned
-- by the Storage service and must not be modified directly in migrations.

drop policy if exists "photos_authenticated_select" on storage.objects;
drop policy if exists "photos_authenticated_insert" on storage.objects;
drop policy if exists "photos_authenticated_update" on storage.objects;
drop policy if exists "photos_authenticated_delete" on storage.objects;

-- No policies are created for anon or authenticated. Edge Functions use a server-only
-- secret key and all public access is mediated by token validation in `photo`.
