import { supabase } from '@/lib/supabase';

// Duplicates a jam into a new draft owned by the user, mirroring web's
// "Copy event" (which prefills /jam/new?copy=). Returns the new jam id, or null
// on failure. Genres carry over; official events become community copies.
export async function duplicateJam(jamId: string, userId: string): Promise<string | null> {
  const { data: jam } = await supabase
    .from('jams')
    .select('name, starts_at, ends_at, neighborhood, full_address, notes, visibility, capacity, timezone')
    .eq('id', jamId)
    .maybeSingle();
  if (!jam) return null;

  const j = jam as any;
  const { data, error } = await supabase.from('jams').insert({
    host_user_id: userId,
    name: `${j.name ?? 'Jam'} (copy)`,
    starts_at: j.starts_at,
    ends_at: j.ends_at,
    neighborhood: j.neighborhood,
    full_address: j.full_address,
    notes: j.notes,
    visibility: j.visibility === 'official' ? 'community' : j.visibility,
    capacity: j.capacity,
    timezone: j.timezone,
    created_at: new Date().toISOString(),
  }).select('id').single();
  if (error || !data?.id) return null;

  const { data: genreRows } = await supabase
    .from('jam_genres')
    .select('genre_id')
    .eq('jam_id', jamId);
  if (genreRows && genreRows.length > 0) {
    await supabase.from('jam_genres').insert(
      genreRows.map((g: any) => ({ jam_id: data.id, genre_id: g.genre_id }))
    );
  }
  return data.id;
}
