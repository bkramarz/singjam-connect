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
| Result rows (composers/artist/jammers) | ✅ | |
| Add-song lead gating | ✅ | |
| Submit a missing song (empty state) | ✅ | |
| Inline YouTube/Spotify players on rows | ⚠️ | Web embeds; native rows don't (song detail has them). Intentionally skipped — heavy on mobile. |
| Pagination | ⚠️ | Native loads up to 1000 client-side; web paginates. Fine at current catalog size; revisit for the offline-catalog track. |

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
- [ ] Song filter matching + **cascading option derivation** (currently duplicated inline in
      `songs.tsx` and `(tabs)/index.tsx`, and separately in web `useSongFilters`). Highest value.
- [ ] Lead-gating / confidence rules (`canLead = singing_voice && !== 'none'`) — duplicated in
      `SuggestionCard`, `AddSongModal`, `songs.tsx`, web `ConfidencePicker`.
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
