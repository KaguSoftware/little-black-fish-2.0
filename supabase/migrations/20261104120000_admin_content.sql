-- Admin-editable content: copy overrides, settings, team, series, audit log.
-- All tables: RLS on, public SELECT, writes only via the service role (bypasses RLS).

create or replace function public.lbf_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Copy overrides: key = "<namespace>.<dotted.path>", numeric segments index arrays.
create table if not exists public.site_content (
  key text not null,
  locale text not null check (locale in ('en','fa')),
  value text not null default '',
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name_en text not null default '',
  name_fa text not null default '',
  title_en text not null default '',
  title_fa text not null default '',
  role_en text not null default '',
  role_fa text not null default '',
  photo_url text,
  instagram text,
  "order" int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chapters: slug matches ChapterId in src/shared/content/chapters.ts.
create table if not exists public.series_chapters (
  slug text primary key,
  word_en text not null default '',
  word_fa text not null default '',
  title_en text not null default '',
  title_fa text not null default '',
  "order" int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Characters: slug matches TellerId in src/shared/content/characters.ts.
-- narration_*: { hello, world, day, did, others } (chapter id -> line).
create table if not exists public.series_characters (
  slug text primary key,
  name_en text not null default '',
  name_fa text not null default '',
  role_en text not null default '',
  role_fa text not null default '',
  mood_en text not null default '',
  mood_fa text not null default '',
  narration_en jsonb not null default '{}'::jsonb,
  narration_fa jsonb not null default '{}'::jsonb,
  "order" int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text,
  action text not null,
  target text
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);

do $$
declare t text;
begin
  foreach t in array array['site_content','site_settings','team_members','series_chapters','series_characters'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.lbf_set_updated_at()', t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
  end loop;
end $$;

-- Audit log is admin-only: RLS on, no policies (service role only).
alter table public.admin_audit enable row level security;
