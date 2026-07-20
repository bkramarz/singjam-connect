import AsyncStorage from '@react-native-async-storage/async-storage';

// Stale-while-revalidate cache, mirroring web's sessionStorage `cache:/...`
// pattern (JamsContent.tsx, repertoire/page.tsx) but persistent across app
// launches. Entries are scoped to a user id so another account's (or a
// signed-out view's) personalized data is never shown.

const PREFIX = 'cache:';

type Entry<T> = { uid: string | null; data: T };

export async function readCache<T>(key: string, uid: string | null): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.uid !== uid) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, uid: string | null, data: T) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ uid, data }));
  } catch {
    // Cache is best-effort; the live fetch is the source of truth
  }
}

export async function clearCaches() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {}
}
