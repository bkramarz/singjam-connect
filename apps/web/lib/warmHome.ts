const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";

export async function warmHome(fetchFn: typeof fetch = fetch): Promise<void> {
  const res = await fetchFn(`${SITE_URL}/`, {
    headers: { "user-agent": "singjam-cache-warmer" },
  });
  if (!res.ok) {
    throw new Error(`warm ping failed: ${res.status}`);
  }
}
