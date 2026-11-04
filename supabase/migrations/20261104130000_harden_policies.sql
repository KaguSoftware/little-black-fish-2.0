-- Harden policies. NOT APPLIED: review, then apply only with explicit approval.
--
-- Written without being able to inspect the live pg_policies (no network when authored), so the
-- storage section discovers and drops the existing write policies dynamically instead of by name.
-- Before applying, run the SELECT at the bottom of this file and confirm what will be dropped.
--
-- Application code is already compatible with BEFORE and AFTER this migration:
--   * public getSettings() reads site_settings with `key <> 'contact'`;
--   * the contact action and the admin page read `contact` with the service role (bypasses RLS).

-- ---------------------------------------------------------------------------------------------
-- 1. site_settings: the `contact` row holds notificationEmail (private) but the table had an
--    anon "public read" policy using (true). Keep public read for every other key.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "public read" on public.site_settings;
create policy "public read" on public.site_settings
  for select
  using (key <> 'contact');

-- ---------------------------------------------------------------------------------------------
-- 2. Table grants on the six admin-content tables. Writes only ever go through the service role
--    (which bypasses RLS and grants), so anon/authenticated lose every privilege (insert, update,
--    delete, truncate, references, trigger...) and only get SELECT back on the five public tables.
--    RLS still filters rows on top of this. admin_audit gets no grant at all (service role only).
-- ---------------------------------------------------------------------------------------------
revoke all on public.site_content, public.site_settings, public.team_members,
  public.series_chapters, public.series_characters, public.admin_audit
  from anon, authenticated;

grant select on public.site_content, public.site_settings, public.team_members,
  public.series_chapters, public.series_characters
  to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Storage (buckets `projects` and `hero`): uploads happen in the browser as the signed-in
--    admin, so only an admin JWT may write/delete. Public read stays.
--    Admin = auth.jwt() -> app_metadata ->> role = 'admin' (same rule as requireAdminUser();
--    app_metadata is not user-editable, unlike user_metadata).
--
--    3a. Drop every existing INSERT/UPDATE/DELETE/ALL policy on storage.objects that mentions the
--        `projects` or `hero` bucket (names are unknown here, hence the dynamic loop). Policies for
--        other buckets are left alone.
-- ---------------------------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '''(projects|hero)'''
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

--    3b. Public read of both buckets (also replaces the read half of any dropped ALL policy).
drop policy if exists "lbf public read projects hero" on storage.objects;
create policy "lbf public read projects hero" on storage.objects
  for select
  using (bucket_id in ('projects', 'hero'));

--    3c. Admin-only writes.
drop policy if exists "lbf admin insert projects hero" on storage.objects;
create policy "lbf admin insert projects hero" on storage.objects
  for insert
  with check (bucket_id in ('projects', 'hero') and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "lbf admin update projects hero" on storage.objects;
create policy "lbf admin update projects hero" on storage.objects
  for update
  using (bucket_id in ('projects', 'hero') and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id in ('projects', 'hero') and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "lbf admin delete projects hero" on storage.objects;
create policy "lbf admin delete projects hero" on storage.objects
  for delete
  using (bucket_id in ('projects', 'hero') and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Pre-flight check (read-only), run BEFORE applying to see what 3a will drop:
--   select policyname, cmd, roles, qual, with_check from pg_policies
--   where schemaname = 'storage' and tablename = 'objects' order by policyname;
