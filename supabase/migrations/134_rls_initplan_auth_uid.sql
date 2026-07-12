-- Wrap auth.uid() in a scalar subquery in all RLS policies so Postgres
-- evaluates it once per statement (initplan) instead of once per row.
-- Generated from live pg_policies on 2026-07-12; expressions otherwise unchanged.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

alter policy "admin write artists" on public.artists
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write cultures" on public.cultures
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write feature_flags" on public.feature_flags
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write genres" on public.genres
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "jam_genres deletable by host" on public.jam_genres
  using ((EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_genres.jam_id) AND (j.host_user_id = (select auth.uid()))))));

alter policy "jam_genres insertable by host" on public.jam_genres
  with check ((EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_genres.jam_id) AND (j.host_user_id = (select auth.uid()))))));

alter policy "jam_genres readable for community jams" on public.jam_genres
  using ((((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_genres.jam_id) AND (j.visibility = 'community'::text))))));

alter policy "authenticated insert jam_invites" on public.jam_invites
  with check (((select auth.uid()) = invited_user_id));

alter policy "authenticated users can insert invites" on public.jam_invites
  with check (((select auth.uid()) = invited_by));

alter policy "host and attendees read jam_invites" on public.jam_invites
  using ((((select auth.uid()) = invited_user_id) OR (EXISTS ( SELECT 1
   FROM jams
  WHERE ((jams.id = jam_invites.jam_id) AND (jams.host_user_id = (select auth.uid())))))));

alter policy "hosts can read jam invites" on public.jam_invites
  using ((EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_invites.jam_id) AND (j.host_user_id = (select auth.uid()))))));

alter policy "invitees can read their invites" on public.jam_invites
  using (((select auth.uid()) = invited_user_id));

alter policy "invitees can update their invites" on public.jam_invites
  using (((select auth.uid()) = invited_user_id));

alter policy "own delete jam_invites" on public.jam_invites
  using (((select auth.uid()) = invited_user_id));

alter policy "own update jam_invites" on public.jam_invites
  using (((select auth.uid()) = invited_user_id));

alter policy "users can read rsvps" on public.jam_rsvps
  using ((((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_rsvps.jam_id) AND (j.host_user_id = (select auth.uid())))))));

alter policy "users can rsvp" on public.jam_rsvps
  with check (((select auth.uid()) = user_id));

alter policy "users can update own rsvp" on public.jam_rsvps
  using (((select auth.uid()) = user_id));

alter policy "jam_themes deletable by host" on public.jam_themes
  using ((EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_themes.jam_id) AND (j.host_user_id = (select auth.uid()))))));

alter policy "jam_themes insertable by host" on public.jam_themes
  with check ((EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_themes.jam_id) AND (j.host_user_id = (select auth.uid()))))));

alter policy "jam_themes readable for community jams" on public.jam_themes
  using ((((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM jams j
  WHERE ((j.id = jam_themes.jam_id) AND (j.visibility = 'community'::text))))));

alter policy "authenticated insert jams" on public.jams
  with check (((select auth.uid()) = host_user_id));

alter policy "delete own jam" on public.jams
  using (((select auth.uid()) = host_user_id));

alter policy "host delete jams" on public.jams
  using (((select auth.uid()) = host_user_id));

alter policy "host update jams" on public.jams
  using (((select auth.uid()) = host_user_id));

alter policy "insert own jam" on public.jams
  with check (((select auth.uid()) = host_user_id));

alter policy "read jams" on public.jams
  using (((visibility = 'official'::text) OR (visibility = 'community'::text) OR ((select auth.uid()) = host_user_id) OR user_has_jam_invite(id)));

alter policy "update own jam" on public.jams
  using (((select auth.uid()) = host_user_id));

alter policy "admin write languages" on public.languages
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "users can read own notifications" on public.notifications
  using (((select auth.uid()) = user_id));

alter policy "users can update own notifications" on public.notifications
  using (((select auth.uid()) = user_id));

alter policy "admin write people" on public.people
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "Admin write productions" on public.productions
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "update own profile" on public.profiles
  using (((select auth.uid()) = id));

alter policy "upsert own profile" on public.profiles
  with check (((select auth.uid()) = id));

alter policy "set_collaborators_delete" on public.set_collaborators
  using ((((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_collaborators.set_id) AND (s.owner_user_id = (select auth.uid())))))));

alter policy "set_collaborators_insert" on public.set_collaborators
  with check (((select auth.uid()) = invited_by));

alter policy "set_collaborators_select" on public.set_collaborators
  using (((status = 'accepted'::text) OR ((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_collaborators.set_id) AND (s.owner_user_id = (select auth.uid())))))));

alter policy "set_collaborators_self_join" on public.set_collaborators
  with check ((((select auth.uid()) IS NOT NULL) AND ((select auth.uid()) = user_id) AND (status = 'accepted'::text) AND (role = 'viewer'::text) AND (EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_collaborators.set_id) AND (s.link_sharing = 'link'::text))))));

alter policy "set_collaborators_update" on public.set_collaborators
  using ((EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_collaborators.set_id) AND (s.owner_user_id = (select auth.uid()))))));

alter policy "set_songs_delete" on public.set_songs
  using (((EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_songs.set_id) AND (s.owner_user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM set_collaborators sc
  WHERE ((sc.set_id = sc.set_id) AND (sc.user_id = (select auth.uid())) AND (sc.status = 'accepted'::text) AND (sc.role = 'editor'::text))))));

alter policy "set_songs_insert" on public.set_songs
  with check ((((select auth.uid()) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_songs.set_id) AND (s.owner_user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM set_collaborators sc
  WHERE ((sc.set_id = sc.set_id) AND (sc.user_id = (select auth.uid())) AND (sc.status = 'accepted'::text) AND (sc.role = 'editor'::text)))))));

alter policy "set_songs_update" on public.set_songs
  using (((EXISTS ( SELECT 1
   FROM sets s
  WHERE ((s.id = set_songs.set_id) AND (s.owner_user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM set_collaborators sc
  WHERE ((sc.set_id = sc.set_id) AND (sc.user_id = (select auth.uid())) AND (sc.status = 'accepted'::text) AND (sc.role = 'editor'::text))))));

alter policy "sets_delete" on public.sets
  using (((select auth.uid()) = owner_user_id));

alter policy "sets_insert" on public.sets
  with check (((select auth.uid()) = owner_user_id));

alter policy "sets_update" on public.sets
  using (((select auth.uid()) = owner_user_id));

alter policy "admin write song_alternate_titles" on public.song_alternate_titles
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_composers" on public.song_composers
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_cultures" on public.song_cultures
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_genres" on public.song_genres
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_languages" on public.song_languages
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_lyricists" on public.song_lyricists
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "Admin write song_productions" on public.song_productions
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_recording_artists" on public.song_recording_artists
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write song_themes" on public.song_themes
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin write songs" on public.songs
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "song editor update songs" on public.songs
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'song_editor'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'song_editor'::user_role)))));

alter policy "admin write themes" on public.themes
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "admin read all user_songs" on public.user_songs
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

alter policy "user_songs_delete_own" on public.user_songs
  using ((user_id = (select auth.uid())));

alter policy "user_songs_insert_own" on public.user_songs
  with check ((user_id = (select auth.uid())));

alter policy "user_songs_read_own" on public.user_songs
  using ((user_id = (select auth.uid())));

alter policy "user_songs_update_own" on public.user_songs
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

