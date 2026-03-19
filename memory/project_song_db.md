---
name: Song database enrichment
description: Current state of song data pipeline — APIs used, recording artist year logic, admin UI
type: project
---

Work is on branch `feat/recording-artist-year-from-api` — not yet merged to main.

## What's done
- Admin song editor (`/admin/songs/[id]`) has Composers, Lyricists, Recording Artists (with year per pill)
- **Enrich button** on edit page: calls `/api/enrich`, populates recording artists + years from MusicBrainz work recordings (up to 5), sets song year from MB
- **Find composers** on new song page (`/admin/songs/new`): populates standardized title/artist, composers, lyricists only — everything else handled on edit page
- Recording artist year persists via `song_recording_artists.year` column (migration 006)
- Admin songs list shows "First recorded" column = earliest year across recording artists
- Delete button on admin songs list

## API sources
- **MusicBrainz**: canonical titles, composers, lyricists, recording artists with years (browse recordings by work ID, sorted by `first-release-date`, top 5 unique artists)
- **SHS (Second Hand Songs)**: composers/lyricists only — HTML scrape of work page + meta description for year
- **Wikidata**: fallback composers/lyricists
- SHS is NOT used for recording artists or years anymore — MB only

## Key decisions
- `display_artist` on `songs` table is derived from recording artist names joined with " & " on save
- "First recorded" year shown in list = `MIN(song_recording_artists.year)`
- New song form saves title + display_artist + composers only; recording artists handled via Enrich on edit page

**Why:** Recording artist year was the main data quality focus. SHS HTML parsing for artists was unreliable so switched to MB work recordings browse.

**How to apply:** When adding features around song metadata, remember recording artist year is the source of truth for when a song was first recorded — not `songs.year`.
