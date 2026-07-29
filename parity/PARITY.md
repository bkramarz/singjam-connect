# Native ↔ Mobile-Web Parity Checklist

The native app (`apps/native`) should look and behave like the **mobile web** experience
(`apps/web`), plus native-only capabilities (local caching, push). This is the living
inventory of that parity — **update it in the same PR as any change to a listed flow.**

## How we work on parity (to avoid churn + credit burn)

1. **One screen at a time, driven by this file.** No mass multi-agent "audit everything"
   sweeps — those are slow, unreliable, and expensive. Pick a `⚠️`/`❌` row, compare that
   one screen's web vs native, fix, tick it.
2. **Shared *logic* lives in `packages/core`, not reimplemented per app.** Rules (filter
   matching, option cascading, sort, confidence/lead gating, formatting, search
   normalization) go in core with unit tests; both apps import them so they can't drift.
   UI (RN vs HTML) stays per-app. See "Core-extraction backlog" below.
3. **Business mutations live in one place** (web API route / Supabase RPC / core) — native
   calls them (Bearer pattern), never reimplements. Per CLAUDE.md.
4. **Batch web-affecting merges.** Native-only changes now auto-skip Netlify builds
   (netlify.toml `ignore`), so they're free; web-affecting changes cost a build — bundle them.
5. **Keep native mobile-idiomatic where it's clearly better** (ActionSheet for pickers,
   full-screen filter sheets vs web's inline panels). Parity ≠ pixel-copy; it's behavior +
   visual hierarchy. When native intentionally diverges, note it in the row.

Legend: ✅ at parity · ⚠️ partial / known diff · ❌ missing · 🚫 desktop-only (open in browser) · ❓ not yet verified

## Screens & flows

### Repertoire (`apps/native/app/(tabs)/index.tsx` ↔ web `/repertoire`)
| Feature | Status | Notes |
|---|---|---|
| Sort (A→Z / Z→A / Popular) | ✅ | Native ActionSheet vs web dropdown — intentional. |
| Confidence/role filter | ✅ | ActionSheet vs web `<select>`. |
| Extended filters (genre/culture/language/theme/vibe/tonality/meter) | ✅ | Full-screen sheet vs web inline panel — intentional. |
| Year range filter | ✅ | Added 2026-07-20 (PR consolidated in 7740057). |
| Cascading filter options | ✅ | Added 2026-07-20 — each dimension derived from songs passing other filters. |
| Add-song search (ranked) | ✅ | `search_songs` RPC; lead-gating on `singing_voice`. |
| Add-song rows (composers + jammers) | ✅ | Via `formatComposers` + popularity. |
| Suggestions ("Songs you might know") | ✅ | `SuggestionCard`, infinite scroll (PR #241). |
| Submit a missing song | ✅ | `SubmitMissingSong` → `/api/songs/submit` (bearer). Mobile-simplified: no Spotify-preview step. |

### Song Library / Search (`apps/native/app/songs.tsx` ↔ web `/search`)
| Feature | Status | Notes |
|---|---|---|
| Sort on toolbar | ✅ | Moved out of the filter modal 2026-07-20. |
| Filters + Year + cascading | ✅ | Same as repertoire. |
| Result rows (composers/artist/jammers) | ✅ | Rebuilt 2026-07-28 to reuse `SuggestionCard` (native's web-`SongCard` mirror): bordered card, title + (songwriters) — production/artist (year), genre chips + jammer count. Replaced the old thin `border-b` rows. |
| Search card + result count | ✅ | Added 2026-07-28 — web's bordered search panel with the "N song(s)" line; scrolls with the list. Previous list-blanking spinner replaced by a "Searching…" label so results stay visible during refetch. |
| "Hide my songs" | ✅ | Moved 2026-07-28 from a switch inside the filter sheet to a toolbar checkbox next to Sort/Filters, as on web. Shown only when signed in with a non-empty repertoire, and (like web) it no longer counts toward the Filters badge. |
| Already-in-repertoire state | ✅ | Added 2026-07-28: "✓ In your repertoire" pill + role control (ActionSheet vs web `<select>`), replacing the old static "Added" text — the role can now be changed from this screen, as on web. |
| Add-song lead gating | ✅ | |
| Submit a missing song | ✅ | 2026-07-28: collapsed "Can't find your song?" panel now sits at the foot of the search results (web keeps its form there), not only in the empty state. |
| YouTube/Spotify links on rows | ✅ | 2026-07-28: browse rows have them too — native's catalog fetch moved off a raw `songs` select onto the **`browse_songs` RPC web `/search` uses**, which derives the ids from the media URLs in SQL. Web embeds players inline; native opens the apps (intentional — a WebView per row would hurt scrolling). |
| Catalog data matches web | ✅ | Fixed 2026-07-28 by the same move. The old raw join read `song_composers` only, so it dropped lyricists (web: "My Favorite Things (O. Hammerstein II, R. Rodgers)", native: "(R. Rodgers)"), and used bare `year_written`, so recording-only years were missing. `browse_songs` unions composers+lyricists and takes `least(year_written, min(recording year))` — same rule as `my_repertoire`, which fixed this class of drift on Repertoire in #237. |
| Pagination | ⚠️ | Native still loads the whole catalog client-side — now 6 parallel `browse_songs` pages, measured ~310-560ms vs the old raw select's 582ms — where web pages incrementally. Fine at current catalog size; revisit for the offline-catalog track. |
| `song_popularity_counts` RPC | ✅ | No longer called: `browse_songs` returns `popularity`. `songs.tsx` was the **last caller anywhere in the repo**, so the RPC (migration 049) is now unreferenced and safe to drop in a future migration. |

### Sets
| Feature | Status | Notes |
|---|---|---|
| Sets list (owned/collab/public) | ✅ | `(tabs)/sets.tsx`. |
| Set detail: songs, reorder, key, leaders | ✅ | `set/[id].tsx`. |
| Leader/support display + public-viewer gate | ✅ | Native now renders per-song Lead/Support pills (explicit leaders + participant repertoire confidence), hidden from public viewers via `isPublicViewer = !isOwner && !isCollaborator`, editor-toggleable — mirrors web `SetSongRow`. Replaced the old self-only leader star. (native has no CSV/PDF export, so those web gates don't apply.) Derivation still inline; see core-extraction backlog. |
| Co-owner role | ✅ | Native recognizes `co-owner` (full owner powers except delete + assigning co-owners). All native set mutations now route through the web API via bearer (single-source authz), so co-owners aren't blocked by owner/editor-only RLS. Owner-only: delete + granting/changing co-owner. |
| Mark-as-played | ✅ | PR #187 / #240; `reorderSongsForPlayed` in core. Now via `PATCH /songs/[songId]` + reorder. |
| Realtime sync | ✅ | PR #240 (narrower than web by design). |
| Add song to set — shows songs already in set | ✅ | `existingIds` → "Added". Add now via `POST /songs`. |
| Spotify export | ✅ | Bearer route. |
| Collaborators / sharing | ✅ | Set-settings modal: owner + co-owners manage sharing, add/remove collaborators, and change roles (co-owner assignment is owner-only), all through the web API. Editors still can't invite from native (web allows it — minor follow-up). |

### Add-to-set (from repertoire) — `AddToSetModal`
| Feature | Status | Notes |
|---|---|---|
| Lists owned + collaborating sets | ✅ | Added 2026-07-20 (was owned-only). |
| Marks sets already containing the song | ✅ | Added 2026-07-20 — mirrors web `AddToSetPanel`. |
| "+ New set" inline create | ❌ | Web has it; native says "create from Sets tab". Low priority. |

### Jams
| Feature | Status | Notes |
|---|---|---|
| Jams list + card | ✅ | `JamCard`; time format aligned to web (device locale, TZ only when set). |
| RSVP / waitlist | ✅ | Web route via bearer (PR #238). |
| Invite respond / cancel / copy | ✅ | PR #238. |
| Jam detail | ✅ | |
| Location autocomplete | ⚠️ | Uses **deprecated** legacy Google Places endpoint (jam/new, jam/edit, ProfileForm) — migrate to Places New API. |
| JamCard time format i18n | ✅ | Fixed 2026-07-20. |

### Friends / Matches (`(tabs)/friends.tsx`)
| Feature | Status | Notes |
|---|---|---|
| Match list + search | ✅ | `match_jammers` / `search_users` RPCs. |
| Invite to jam | ✅ | |

### Sign up / Account creation (`apps/native/app/(auth)` ↔ web `/auth` + `/account` setup)
| Feature | Status | Notes |
|---|---|---|
| Welcome screen | ✅ | Native-only entry (logo, tagline, Get started / Sign in / Continue as Guest). Web opens straight to the form — intentional (app launch vs web page). |
| Email/password + confirm, Google, Apple, forgot-password | ✅ | Aligned. |
| Signup value-prop subcopy | ✅ | Added 2026-07-21 — native now shows web's "Discover new music…" copy in signin+signup. |
| Google button mark | ⚠️ | Native uses a monochrome Ionicon `logo-google`; web uses the multicolour Google "G". Minor cosmetic. |
| Post-signup profile setup | ✅ | Web `/account` (`AccountPanel`) ↔ native `/setup` (`ProfileForm`). |
| Profile photo during setup | ✅ | Added 2026-07-21 — native `ProfileForm` now has optional avatar upload (camera/library, 5 MB cap), matching web's setup panel. |
| Username auto-suggest from email | ✅ | Added 2026-07-21 — `suggestUsername` extracted to `packages/core/username`, used by both. |
| Username uniqueness check | ✅ | Native switched `.eq`→`.ilike` (case-insensitive) 2026-07-21 to match web and prevent case-variant collisions. |
| Email change / delete / sign out in setup | 🚫 | Web bundles these into the same panel; native keeps them in the profile tab / account modal — intentional split. |
| Instruments / genres pickers | ✅ | Rebuilt inline 2026-07-21 to match web: "You play"/"Your genres" cards, featured chips + inline search, `genres_by_usage` featured ordering (falls back to full list). Existing-instrument level uses an iOS ActionSheet (web uses a `<select>`); add-step uses inline level buttons like web. Replaced the old full-screen modal pickers. |

### Profile / Account
| Feature | Status | Notes |
|---|---|---|
| Profile view/edit | ✅ | `ProfileForm`. |
| Save → ActiveCampaign sync | ✅ | PR #239 (bearer). |
| Username rules | ✅ | `packages/core/username`. |
| Avatar upload + 5 MB cap | ✅ | Cap added 2026-07-20. |
| Account settings / email change | ✅ | |
| Report a bug | ✅ | Native `/feedback` (bearer) — PR #243. |
| Admin link | 🚫 | Desktop-only by choice. |

### Other
| Screen | Status | Notes |
|---|---|---|
| Notifications | ✅ | Push notifications shipped (PR #235). |
| Song detail (`song/[id]`) | ⚠️ | Works; 4 pre-existing `tsc` null-guard warnings (baseline). |
| Public profile (`/u/[username]`) | ❓ | Native has `profile/[id]`; verify nothing deep-links to `/u/`. |
| Tablet/iPad layout | ✅ | `ContentContainer` max-width (PR #242). Visual verify pending iPad build. |
| PDF / song-editor / admin / about-privacy-terms | 🚫 | Desktop-only / open-in-browser. |

## Core-extraction backlog (structural anti-drift)
Move these rules into `packages/core` (with unit tests) so web + native share one implementation.
Each is **web-affecting** (core rebuilds web) → batch them.
- [x] Song filter matching + **cascading option derivation** — in core as `songMatchesFilters` /
      `deriveFilterOptions` / `countActiveFilters`. The native *sheet* that renders them is now a
      single `components/SongFilterSheet.tsx` shared by `songs.tsx` and `(tabs)/index.tsx`
      (2026-07-28), mirroring web's shared `FilterPanel`; it had been hand-copied into both and
      had drifted (sheet title, year placeholders, missing empty state). Web `useSongFilters`
      still wraps core separately — fine, it's React state plumbing, not rules.
- [ ] Lead-gating / confidence rules (`canLead = singing_voice && !== 'none'`) — duplicated in
      `SuggestionCard`, `RepertoireCard`, `songs.tsx`, web `ConfidencePicker`.
- [ ] Sort comparators (title asc/desc, popularity+title tiebreak).
- [ ] Search field-set / normalization used by add-song rows.
- [ ] Set leader/support participant derivation (who leads/supports a song from explicit
      `leader_user_ids` + participant repertoire confidence, hidden from public viewers).
      Currently inline in web `SetSongRow` and native `set/[id].tsx`; extract to core with tests.

Already shared in core: `formatComposers`, `mergeSuggestionsById`, `reorderSongsForPlayed`,
`formatJamTime`, `username` rules, `singingVoice`, `sortRepertoireSearchResults`.

## Known gaps / deferred (not yet scheduled)
- Add-to-set "+ New set" inline create (native).
- Google Places New API migration (L3).
- Search pagination on native (superseded by the offline-catalog track — see `project_offline_catalog` memory).
- Filter option **cascading/year logic** is currently inline per native screen (native has no
  component test harness); extract to core to get tests — see backlog above.
