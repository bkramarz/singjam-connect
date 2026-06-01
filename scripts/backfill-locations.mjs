// One-off backfill: normalizes neighborhood values in profiles via Google Places API.
// Run: node scripts/backfill-locations.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const MAPS_KEY = env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

async function normalizeLocation(raw) {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": MAPS_KEY },
    body: JSON.stringify({ input: raw, includedPrimaryTypes: ["locality", "sublocality"] }),
  });
  const json = await res.json();
  const top = json.suggestions?.[0]?.placePrediction?.structuredFormat;
  if (!top) return null;
  const main = top.mainText.text;
  const secondary = top.secondaryText?.text;
  return secondary ? `${main}, ${secondary.split(", ")[0]}` : main;
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: "return=minimal",
      ...options.headers,
    },
  });
  return res;
}

const listRes = await sbFetch("/profiles?select=id,neighborhood&neighborhood=not.is.null");
const profiles = await listRes.json();
console.log(`Found ${profiles.length} profiles with a neighborhood.`);

let updated = 0, skipped = 0, failed = 0;

for (const profile of profiles) {
  const raw = profile.neighborhood;
  try {
    const normalized = await normalizeLocation(raw);
    if (!normalized || normalized === raw) {
      console.log(`  skip  ${raw}`);
      skipped++;
    } else {
      await sbFetch(`/profiles?id=eq.${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ neighborhood: normalized }),
      });
      console.log(`  update  "${raw}" → "${normalized}"`);
      updated++;
    }
  } catch (err) {
    console.log(`  fail  ${raw}: ${err.message}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 100));
}

console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`);
