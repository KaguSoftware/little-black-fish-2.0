# Admin content contract

Foundation layer for "everything editable from /admin". UI and public-component work builds on this file.
Short version of the action list also lives in the header of `src/shared/actions/admin/types.ts`.

## Rules (all actions)

- `"use server"` files under `src/shared/actions/admin/`. Each action first calls `requireAdminUser()` (via `adminUser()` in `lib.ts`), uses the service client, validates input, returns `ActionResult<T>` (`{success:true,data?}` | `{success:false,error}`), writes a row to `admin_audit`, then `refresh(tags)`: `updateTag(tag)` for the touched cache tags + `revalidatePath("/[locale]","layout")` + `revalidatePath("/[locale]/admin","page")`.
- Types for inputs / `AdminData` / `ContentEntry` / `MediaItem`: `src/shared/actions/admin/types.ts`. Row types: `src/shared/data/types.ts`. Settings types, defaults and validators: `src/shared/data/settingsSchema.ts` (isomorphic, safe to import in client components).
- Caching: `cacheComponents` is off, so reads use `unstable_cache` (`src/shared/data/cached.ts`) with tags and a 300 s safety revalidate. Tags: `site-content`, `site-settings`, `team`, `series`.

## Tables (RLS on; public SELECT; writes only through the service role)

Migration: `supabase/migrations/20261104120000_admin_content.sql` (applied). `updated_at` is maintained by trigger `lbf_set_updated_at`.

| table | columns |
|---|---|
| `site_content` | `key text`, `locale 'en'\|'fa'`, `value text`, `updated_at`; PK `(key, locale)` |
| `site_settings` | `key text pk`, `value jsonb`, `updated_at` |
| `team_members` | `id uuid pk`, `name_en/fa`, `title_en/fa`, `role_en/fa`, `photo_url`, `instagram` (bare handle), `order int`, `visible bool`, `created_at`, `updated_at` |
| `series_chapters` | `slug text pk` (= `ChapterId`), `word_en/fa`, `title_en/fa`, `order`, `visible`, timestamps |
| `series_characters` | `slug text pk` (= `TellerId`), `name_en/fa`, `role_en/fa`, `mood_en/fa`, `narration_en/fa jsonb` (`{hello,world,day,did,others}` -> line; missing/"" = built-in line), `order`, `visible`, timestamps |
| `admin_audit` | `id bigint identity`, `at`, `actor_email`, `action`, `target`. No policies: service role only (not publicly readable) |

3D model ids, colors, camera, plates, segments stay in code and are joined by `slug`.
Code defaults in DB-row shape: `src/shared/data/defaults.ts` (`TEAM_DEFAULTS`, `CHAPTER_DEFAULTS`, `CHARACTER_DEFAULTS`).
Seeded (idempotent, never overwrites edits; `--force` overwrites settings/series): `node --env-file=.env.local scripts/seed-content.mjs`. `site_content` is intentionally empty.

## Copy overrides (`site_content`)

- Key: `<namespace>.<dotted.path>` exactly as in `messages/<locale>/<namespace>.json`; array items use numeric segments: `about.sections.1.paragraphs.0`. Namespace never contains a dot.
- Applied in `src/i18n/request.ts` over the JSON (`applyOverridesInPlace` in `src/shared/data/contentPaths.ts`): only existing string leaves are replaced (stale/garbage keys are ignored); any failure falls back to pure JSON. So every existing `useTranslations` call site picks up edits with no change.
- Not editable via content: namespace `admin`, and the series.json sections owned by the series tables: `series.chapters.*`, `series.roles.*`, `series.names.*`, `series.lines.*`, `series.moods.*` (`isEditableKey`). `saveContent` rejects them.
- Saving a value equal to the default deletes the override. `value` may be `""` (blank copy) and is stored.
- Public reader: `getContentOverrides(locale): Promise<Record<string,string>>` (`src/shared/data/content.ts`, `{}` on failure).

### Actions (`content.ts`)
```ts
saveContent(entries: { key: string; locale: "en"|"fa"; value: string }[]): Promise<ActionResult<{ saved: number; cleared: number }>>
resetContent(key: string, locale: "en"|"fa"|"both"): Promise<ActionResult>
```
### Server helper (`data.ts`, not an action; requires admin)
```ts
listContentEntries(): Promise<ContentEntry[]>
interface ContentEntry { key; namespace; path; en; fa; enOverridden: boolean; faOverridden: boolean; enDefault; faDefault } // en/fa = effective text
```

## Settings (`site_settings`), one row per key

Shapes/defaults/validation in `src/shared/data/settingsSchema.ts`. `saveSettings(key, value)` validates and stores the normalized value; the whole value for a key is replaced.

| key | shape | default source / notes |
|---|---|---|
| `studio` | `{name, fullName, tagline, city, url, email}` | `SITE`. `url` http(s) required; `email` "" or valid (code default is "": SITE.email was a `[EMAIL]` placeholder) |
| `socials` | `{label, href}[]` (max 12) | `SITE.socials`; href http(s) |
| `payments` | `{key, label?, href}[]` (max 6, unique `key` `[a-z0-9-]+`) | `PAYMENT_LINKS` (`worldwide`, `iran`); href http(s) |
| `contact` | `{notificationEmail}` | "" = use env `ADMIN_CONTACT_EMAIL` |
| `seo` | `{title, description, ogImage}` | all "" = use messages `common.studio`/`common.description`, no OG image; ogImage http(s) or `/path` |
| `series` | `{title, year, url}` | `SITE.series*`; url http(s), `/path` or `#anchor` |
| `heroVideos` | `{src, title, project}[]` (max 12) | `HERO_VIDEOS`; src `/path` or http(s); project = project slug |

```ts
saveSettings<K extends SettingKey>(key: K, value: Settings[K]): Promise<ActionResult>
getSettings(): Promise<Settings>   // src/shared/data/settings.ts, server-only; every key present (stored if valid else default); never throws
```
Contact form (`src/shared/actions/contact.ts`) sends to the `contact` setting (read with the service client via `getNotificationEmail()` in `settings.ts`), falling back to env `ADMIN_CONTACT_EMAIL`.
Privacy: `contact.notificationEmail` is private. The public `getSettings()` never reads the `contact` row with the anon client (`key <> 'contact'`), so its `contact` is always the default; only the admin (`loadAdminData`, service client) and the contact action see the real value. `supabase/migrations/20261104130000_harden_policies.sql` (written, applied only on approval) also removes `contact` from the anon SELECT policy.

## Team (`team.ts`)
```ts
createTeamMember(input: TeamMemberInput): Promise<ActionResult<{id: string}>>
updateTeamMember(id, input): Promise<ActionResult>        // replaced photo removed from storage if unreferenced
setTeamMemberVisible(id, visible): Promise<ActionResult>
deleteTeamMember(id): Promise<ActionResult>               // + photo cleanup if unreferenced
interface TeamMemberInput { nameEn; nameFa; titleEn?; titleFa?; roleEn?; roleFa?; photoUrl?; instagram? }
```
`nameEn`/`nameFa` required. `instagram` accepts `handle`, `@handle` or an instagram.com URL (stored bare). `photoUrl` http(s) or `/path`, empty = monogram. Photos are uploaded client-side with `Upload.tsx` into the existing `projects` bucket (bucket root; there is no team bucket).
Public: `getTeam(): Promise<TeamMember[]>` (`src/shared/data/team.ts`): same shape as `TEAM` in `content/team.ts` (`photo`/`instagram` null when unset). Visible rows only, ordered. Falls back to `TEAM` only when the read errors. An empty table (or everyone hidden) is legitimate and returns `[]`; run the seed script to populate a fresh database.

## Series (`series.ts`)
```ts
updateSeriesChapter(slug, input: { wordEn; wordFa; titleEn; titleFa }): Promise<ActionResult>        // all required
updateSeriesCharacter(slug, input: SeriesCharacterInput): Promise<ActionResult>
setSeriesChapterVisible(slug, visible) / setSeriesCharacterVisible(slug, visible): Promise<ActionResult>
interface SeriesCharacterInput { nameEn; nameFa; roleEn?; roleFa?; moodEn?; moodFa?; narrationEn?: Record<string,string>; narrationFa?: Record<string,string> }
```
Slugs must be known to code (unknown -> error); rows are upserted so un-seeded rows get created. `narration*` keys: `hello world day did others` (others ignored).
Public: `getSeriesContent(): Promise<{chapters: SeriesChapterRow[]; characters: SeriesCharacterRow[]}>` (`src/shared/data/series.ts`): visible, ordered; slugs missing from DB are filled from `CHAPTER_DEFAULTS`/`CHARACTER_DEFAULTS`; never throws. Consumers join by `slug` to `CHAPTERS`/`TELLERS` and use the row text in place of `series.json`/code text. Hiding a chapter or character only removes it from this list: the 3D scene/segments are code-driven, so consumers decide what hiding means.

## Media (`media.ts`)
```ts
listMedia(bucket: "projects"|"hero"): Promise<ActionResult<MediaItem[]>>   // root of bucket, newest first, max 1000
deleteMedia(bucket, path: string, force?: boolean): Promise<ActionResult>  // refuses while referenced (error lists users) unless force
interface MediaItem { name; path; url; size; mimeType; createdAt; usedBy: string[] }
```
Uploads stay client-side (`src/features/admin/Upload.tsx`, `getSupabaseClient().storage`).

## Reorder (`reorder.ts`)
`reorder(table, items: {id, order}[])` with `ReorderTable = "projects"|"hero_slides"|"categories"|"team_members"|"series_chapters"|"series_characters"`. For the two series tables `id` is the row **slug**.

## `loadAdminData()` -> `AdminData` (`data.ts`, requires admin)
Existing: `projects, heroSlides, categories, submissions`. New:
`teamMembers: TeamMemberRow[]` (all, ordered), `seriesChapters`, `seriesCharacters` (all rows incl. hidden; empty if never seeded), `settings: Settings` (effective), `settingsStored: string[]` (keys with a stored row), `content: ContentEntry[]`, `audit: AdminAuditRow[]` (latest 50, newest first).

## Audit actions written
`content.save`, `content.reset`, `settings.save`, `team.create|update|show|hide|delete`, `series.chapter.update`, `series.character.update`, `series_chapters.show|hide`, `series_characters.show|hide`, `media.delete`. (The pre-existing projects/hero/categories/submissions actions do not write audit rows yet.)

## Public components still to rewire (not done by this layer)
`SITE.*`/`PAYMENT_LINKS`/`HERO_VIDEOS` call sites (Footer, Maker, ArchivePage, WatchButton, SupportPage, LanternScene), `TEAM` in AboutPage, `TELLERS`/`CHAPTERS` text in the series UI, root layout `generateMetadata` (use `settings.seo`/`studio`). Server components call `getSettings()`/`getTeam()`/`getSeriesContent()` and pass data down; client components need props.
