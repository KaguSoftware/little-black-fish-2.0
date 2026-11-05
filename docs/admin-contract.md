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
- Not editable via content: namespaces `admin` and `adminMedia` (`NON_EDITABLE_NAMESPACES`), and the series.json sections owned by the series tables: `series.chapters.*`, `series.roles.*`, `series.names.*`, `series.lines.*`, `series.moods.*` (`isEditableKey`). `saveContent` rejects them.
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
| `heroVideos` | `{src, title, project, poster?}[]` (max 12) | `HERO_VIDEOS`; src `/path` or http(s); project = project slug (unused by the site); `poster` = still shown on the film's wall plate before/instead of the film. Only the first two films are played (LanternScene `VIDEO_SLOT_INDEX`) |
| `wall` | `{src, focus?: [x,y], zoom?: 1..3, alt?}[]` (max 40) | `[]` = the built-in 18 stills (`WALL_ORDER`/`FRAMING` in `shared/content/wall.ts`, minus voices that are hidden). Non-empty = exactly this list, in order. `src` `/plates/sNN.webp` = a built-in still (keeps its texture chain and framing unless `focus` is set); any other src is an admin image loaded through the Next image optimiser (`/_next/image?url=…&w=1600|1280|960&q=60`, widths/qualities allowed in `next.config.ts`), falling back to the raw file and then still s09. `focus` = percent of the picture that stays in the tall crop |
| `archive` | `{pinnedImage, pinnedFocus?: [x,y], pinnedAlt?}` | `pinnedImage` "" = built-in still s20 on the pinned Series row of the archive (/projects) |
| `teamFocus` | `Record<memberId, [x,y]>` | focus point (object-position %) of the team photo on /about; missing = centred |
| `tellers` | `Record<TellerId, {portrait?, focus?: [x,y], accent?: [l,c,h], stageHue?, reel?, plates?: {world?,day?,did?,others?}}>` | default `{}` (= code look). portrait `/path`/http(s); focus 0..100 %; accent l 0.2..0.95, c 0..0.37, h 0..360; stageHue 0..360; unknown slugs rejected; empty looks dropped. Written by `updateSeriesCharacter({look})`, not by the Settings panel |

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

## Media (`media.ts`) and the image components

```ts
listMedia(bucket: "projects"|"hero", offset = 0, limit = 100 /* max 200 */): Promise<ActionResult<MediaPage>>  // root of bucket, newest first
interface MediaPage { items: MediaItem[]; nextOffset: number | null }       // null = last page
deleteMedia(bucket, path: string, force?: boolean): Promise<ActionResult>    // refuses while referenced (error lists users) unless force
replaceMedia(bucket, oldUrl, newUrl): Promise<ActionResult<{ updated: number }>>
mediaUsage(bucket, url): Promise<ActionResult<string[]>>                     // same labels as MediaItem.usedBy; [] = unreferenced
interface MediaItem { name; path; url; size; mimeType; createdAt; usedBy: string[] }
```
- `replaceMedia` re-points every reference of `oldUrl` to `newUrl` (both must be files of `bucket`): `projects.image_url`, `projects.gallery_urls` (array members), `hero_slides.image_url`, `team_members.photo_url` and every string leaf of every `site_settings` row (so `seo.ogImage`, `heroVideos[].src`, `tellers.*.portrait` and any future image setting are covered with no change here). It writes `admin_audit` (`media.replace`) and refreshes `site-content`, `site-settings`, `team`, `series`. It does NOT delete the old file; the UI then offers that as an explicit, undo-less confirmation. Any new column or setting that holds an image URL is found by `collectReferences()` in `lib.ts` (extend it for new TABLE columns; settings need nothing).
- `usedBy` labels (parsed by the UI in `media-lib.tsx`, `useUseLabels`): `project <slug>`, `project gallery <slug>`, `hero slide <id>`, `team member <name>`, `setting <dotted.path>`. Keep that vocabulary if you add new ones.
- Uploads stay client-side (browser to Supabase Storage with the admin session, XHR for real progress).

### Shared UI (all in `src/features/admin`; strings in namespace `adminMedia`, non-editable via Page copy)
- `toast.tsx`: `toast({kind?: "ok"|"error"|"info", text, undo?, duration?, onExpire?})`, `dismissToast(id)`. Bottom-center stack, aria-live, pauses on hover/focus, renders inside the topmost open `<dialog>` (a modal blocks the page behind it). Default 8 s with Undo, 5 s plain, errors stay. `parts.tsx` keeps `useNotice()` / `NoticeLine` / `Notify`: `notify.ok(text, {undo?, duration?, onExpire?})`, `notify.fail(...)`; `clear()` no longer closes toasts.
- `uploader.ts`: `useUploader({bucket, imagesOnly?, maxDimension? = 2560, hints?, onUploaded?})` -> `{items: UploadItem[], active, upload(files) => Promise<string[]> /* URLs that succeeded, input order */, cancel(id), retry(id), dismiss(id), clearFinished()}`. WebP re-encode (max 1 MB), videos as-is, 100 MB limit, 3 parallel. `hints: {recommended?: {width, height, ratio?}, minWidth?}` never block; they add `UploadItem.warnings`. Also exports `useFileDrop(onFiles, disabled?)` (`{over, props}`), `onPasteImages(onFiles)` (React onPaste), `usePasteImages`, `acceptFor(imagesOnly)`.
- `media-lib.tsx`: `<UploadQueue uploader compact?/>`, `useMediaList(bucket, enabled?)` (paged), `useUseLabels()`, `fmtSize`, `fmtDate`, `isHttpUrl`.
- `media-api.ts`: `MediaApiProvider` / `useMediaApi()`; defaults to the real actions + Supabase. Swap it to test with mocks.
- `Upload.tsx` (legacy props kept: `bucket,label,hint,error,mode,value,onChange,imagesOnly` + new `maxDimension,hints`): multi-file in `mode="add"`, drop/paste, per-file progress, Retry.
- `ImagePicker`: `{bucket, multiple?, imagesOnly?, onPick(urls: string[]), onClose, hints?, title?, maxDimension?}`. Modal with tabs Library (search, All/Unused, usage, select) / Upload / From link. Mount to open, unmount in `onClose`.
- `ImageField`: `{value: string|null, onChange(url), bucket, aspect?: "16/9"|number, fit?: "cover"|"contain", hints?, label, focus?: [x,y] /* percent */, onFocusChange?, alt?, onAltChange?, imagesOnly?, disabled?, maxDimension?, description?, error?}`. Empty = drop zone "Add photo"; filled = Replace photo / Remove (Undo toast, no confirm) / Details (alt, focus point, copy, open, "used in N places"). Drop a file on the preview to replace.
- `ImageListField`: `{value: string[], onChange(urls), bucket, max?, label, hints?, imagesOnly? = true, onSetCover?(url), coverUrl?, disabled?, maxDimension?, description?}`. Drag to reorder (pointer, spring, rubber-band) or focus + Space + arrows (announced), drop files anywhere to add, per-item Remove (Undo) / Move first / Set as cover.
- `MediaPanel`: grid + size slider, search, filters (All / Unused / In use / Videos), multi-select with action bar, drop anywhere to upload, file sheet (details, used-by links, Copy, Replace file, Delete), "Load more". Deleting UNUSED files hides them at once and deletes for real when the 8 s Undo toast ends (closing the page earlier keeps the file). Deleting files that are still used always asks first and names the places that will break.
- `SiteImages.tsx`: `SiteImagesPanel({data, locale, hidden, labelledBy, notify})`, section id `images` (nav group Site, after Media). Placeholder until filled in.
- Styles: `styles-media.ts` (injected once via `<MediaStyles/>`).

## Images section (`SiteImages.tsx`) and image slots

`SiteImagesPanel` is the home of every picture: groups by page (Home: wall, films, film-strip frames; Series: portrait + four chapter backdrops per voice; Archive: pinned image; About: team photos; Projects: covers with a link to the project editor; Sharing: OG image; Built into the site: read-only list with reasons). Every action saves at once (optimistic, rolled back on failure) with an Undo toast; `media-api.ts` carries `saveSetting`/`updateTeam` so tests can mock them. Slot ids and the settings they write are in `images-model.ts` (`readSlot`/`writeSlot`, `builtInOf`, `WALL_SEED`). `ImageSlot` (picture with a built-in default) is used by the voice editor (`VoiceLook.tsx`: portrait, film-strip frame, four backdrops). `ProjectEditor` uses `ImageField` + `ImageListField` ("Set as cover"), `TeamEditor` uses `ImageField` with focus (read-modify-write of `teamFocus` through `getAdminSetting(key)`).
Public wiring: `LanternScene` (wall + posters), `ReelStrip` (`RosterEntry.reel`), series `Backdrop`/`PlateLibrary`/`director.plateOf` (plate refs are a StillId or an image URL via `plateSrc`), `ArchivePage` (`SiteData.archive`), `AboutPage` (next/image + `teamFocus`), portraits through `smallImage()`. `SiteData` carries `wall` and `archive`; the roster carries `reel`/`plates`.
Orphan hygiene: after a replace/remove, `useOrphanOffer()` (`orphans.ts`) checks `mediaUsage` and, if nothing uses the old file, shows one toast "Delete file" (never automatic). `toast({actionLabel})` renames the action button.
The hero-slides editor (`HeroEditor`, table `hero_slides`) is retired: nothing on the public site renders it; hero films are managed under Images.

## Reorder (`reorder.ts`)
`reorder(table, items: {id, order}[])` with `ReorderTable = "projects"|"hero_slides"|"categories"|"team_members"|"series_chapters"|"series_characters"`. For the two series tables `id` is the row **slug**.

## `loadAdminData()` -> `AdminData` (`data.ts`, requires admin)
Existing: `projects, heroSlides, categories, submissions`. New:
`teamMembers: TeamMemberRow[]` (all, ordered), `seriesChapters`, `seriesCharacters` (all rows incl. hidden; empty if never seeded), `settings: Settings` (effective), `settingsStored: string[]` (keys with a stored row), `content: ContentEntry[]`, `audit: AdminAuditRow[]` (latest 50, newest first).

## Audit actions written
`content.save`, `content.reset`, `settings.save`, `team.create|update|show|hide|delete`, `series.chapter.update`, `series.character.update`, `series.character.look`, `series_chapters.show|hide`, `series_characters.show|hide`, `media.delete`, `media.replace`. (The pre-existing projects/hero/categories/submissions actions do not write audit rows yet.)

## Public components still to rewire (not done by this layer)
`SITE.*`/`PAYMENT_LINKS`/`HERO_VIDEOS` call sites (Footer, Maker, ArchivePage, WatchButton, SupportPage, LanternScene), `TEAM` in AboutPage, `TELLERS`/`CHAPTERS` text in the series UI, root layout `generateMetadata` (use `settings.seo`/`studio`). Server components call `getSettings()`/`getTeam()`/`getSeriesContent()` and pass data down; client components need props.

## Admin shell UX layer (see docs/admin-ux-review.md)

- Sections (hash ids unchanged): `dashboard content images media projects categories team series settings inbox account`. `#hero` redirects to `#images`; HeroEditor / `hero_slides` data untouched, no longer reachable.
- `actions-seam.tsx`: `AdminActionsProvider` / `useAdminActions()` carry the shell's own server actions (reorder, content, settings, submissions, password, project/category toggle+delete) so a harness can mock them. Per-record editors still call their actions directly.
- `ux.tsx`: `useConfirm()` (ConfirmSheet as a promise, replaces `window.confirm`), `SaveBar` (sticky Unsaved changes / Discard / Save, Ctrl+S, "All changes saved" flash), `Switch`, `EmptyState`.
- `CommandPalette.tsx`: Ctrl/Cmd+K or `/`; sections, quick actions, page texts, settings cards, projects, categories, people, voices, text search; recents in localStorage.
- Patterns: explicit save = SaveBar; instant apply (show/hide, reorder, remove, text reset, discard drafts, message delete) = Undo toast; confirm only for deleting a project/category/person and leaving with unsaved work.
- `styles-ux.ts` loads last and restyles shared pieces in the `.adm` scope (`.lbf-cta` is the filled primary button, `.lbf-input` is boxed).
