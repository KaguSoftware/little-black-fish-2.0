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
| `tellers` | `Record<TellerId, {portrait?, focus?: [x,y], accent?: [l,c,h], stageHue?}>` | default `{}` (= code look). portrait `/path`/http(s); focus 0..100 %; accent l 0.2..0.95, c 0..0.37, h 0..360; stageHue 0..360; unknown slugs rejected; empty looks dropped. Written by `updateSeriesCharacter({look})`, not by the Settings panel |

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

## Voices (roster): who is on the site

Single source of truth for the six tellers ("voices"). `series_characters` (`visible`, `order`, text) + `site_settings.tellers` (look) + code (models, eyelines, plates, moods).
- Isomorphic: `src/shared/content/roster.ts` (`RosterEntry`, `rosterFrom`, `buildRoster`, `countWord`, registry `activeTellers()/activeIds()/tellerView(id)`).
- Server loader: `getRoster(): Promise<RosterEntry[]>` (`src/shared/data/roster.ts`): visible voices in admin order, never throws, DB failure = all six defaults, may be `[]`. The locale layout puts it in `SiteData.roster`; client components use `useRoster()` (`SiteData.tsx`). The `SiteDataProvider` mirrors it into the module registry (client only) for non-React code (director, runtime, lantern, Cast, Autoplay). R3F canvases do not see React context: pass the roster as props or read the registry.
- `updateSeriesCharacter(slug, {..., look?})`: `look` undefined = untouched, `null`/`{}` = back to defaults; read-modify-write of that slug inside the shared `tellers` row; audits `series.character.look` + `series.character.update`; invalidates `series` and `site-settings`.
- Behavior by count N (visible voices): home eyes ring dots = N (accents from the roster), reel = N frames, lantern wall drops stills whose voices are all hidden, headline uses `home.reel.title` with `{count}` as a word (en/fa 0..12, digits beyond) and `titleOne`/`labelOne` for N = 1; N = 0 removes the eyes and reel sections (and the hero cue scrolls to "Other work") and the series page shows the `series.empty` state. Series: switcher hidden for N < 2, cast list (THE OTHERS) hidden for N < 2, `castFor(teller, chapter, ids)` only places visible others, Autoplay hands over to the next visible voice (N = 1 replays), the stage remounts (`key`) when the roster changes, and if the current teller was hidden the first visible one takes over (`resetTellerWeights`). The Snake King owns the home eyes; if he is hidden the first visible voice lends his puppet and accent.
- Admin: Series > Voices (default tab): show/hide, drag/up-down reorder (existing `reorder` upsert), live count + warnings, per-voice editor with look (portrait upload to `projects`, focus picker with reel/chip/list crops, accent OKLCH sliders, stage hue, reset), preview link. Chapters tab keeps word/title editing.
- Not covered: the archive page tagline `archive.featuredSub` ("Six tellers, one story.") and `series.metaDescription` ("six points of view") are static copy (editable in Page copy); PuppetLab (dev tool) still lists all six.

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
`content.save`, `content.reset`, `settings.save`, `team.create|update|show|hide|delete`, `series.chapter.update`, `series.character.update`, `series.character.look`, `series_chapters.show|hide`, `series_characters.show|hide`, `media.delete`. (The pre-existing projects/hero/categories/submissions actions do not write audit rows yet.)

## Public components still to rewire (not done by this layer)
`SITE.*`/`PAYMENT_LINKS`/`HERO_VIDEOS` call sites (Footer, Maker, ArchivePage, WatchButton, SupportPage, LanternScene), `TEAM` in AboutPage, `TELLERS`/`CHAPTERS` text in the series UI, root layout `generateMetadata` (use `settings.seo`/`studio`). Server components call `getSettings()`/`getTeam()`/`getSeriesContent()` and pass data down; client components need props.
