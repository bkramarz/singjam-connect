---
name: User feedback and preferences
description: Corrections and confirmed approaches from the user during development
type: feedback
---

## Keep new song form minimal
Only show what's needed to create the record — composers, lyricists, standardized title/artist. Everything else (recording artists, year, energy, etc.) goes on the edit page.

**Why:** User explicitly trimmed the new song form down and said "handle everything else on the next page."

**How to apply:** Don't add extra fields to `/admin/songs/new`. The edit page is where enrichment happens.

---

## Use MusicBrainz for recording artists, SHS only for composers
SHS HTML parsing for artists was attempted but unreliable. MB work recordings browse is the correct source for recording artists and their years.

**Why:** User said "get rid of SHS data for recording artists. Let's just use MusicBrainz. Only call SHS for composer data."

**How to apply:** `/api/enrich` — SHS returns `{ composers, lyricists, year }` only. MB returns `topArtists` for recording artists.

---

## Cap recording artists from MB at 5
**Why:** User said "return 5 for now" after trying 3.

**How to apply:** `fetchMBWorkArtists` limits to 5 unique artists sorted by earliest release date.

---

## Don't summarize at end of responses
User prefers concise responses. Don't recap what was done after making changes.

**Why:** Inferred from user's terse communication style.

**How to apply:** Lead with the action/result, skip trailing summaries.
