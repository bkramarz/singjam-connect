---
name: Non-destructive migrations only
description: Never include TRUNCATE, DROP TABLE, or DELETE without WHERE in migration files
type: feedback
---

Never include destructive SQL in migration files — no `TRUNCATE`, no `DROP TABLE`, no `DELETE` without a `WHERE` clause.

**Why:** A migration with `TRUNCATE public.songs` (005_clear_song_data.sql) was re-applied to remote and wiped all song data. Real song records were lost.

**How to apply:** Before writing any migration, check that every statement is additive or safely conditional (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`, etc.). If removal of data or schema is truly needed, flag it explicitly to the user before writing the file.
