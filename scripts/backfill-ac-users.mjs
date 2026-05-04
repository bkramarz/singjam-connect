// One-off backfill: syncs all Supabase users into ActiveCampaign with full profile data.
// Run: node scripts/backfill-ac-users.mjs
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
const AC_URL = env.AC_API_URL;
const AC_KEY = env.AC_API_KEY;

const LIST_IDS = ["1", "4", "9"];
const TAG_ID = "24";

const INSTRUMENT_MAP = {
  "Guitar": "Guitar", "Electric Bass": "Bass", "Upright Bass": "Bass",
  "Piano/Keys": "Piano/Keyboard", "Drums": "Drums", "Percussion": "Percussion",
  "Violin/Fiddle": "Violin", "Cello": "Cello", "Banjo": "Banjo",
  "Mandolin": "Mandolin", "Ukulele": "Ukulele", "Flute": "Flute",
  "Clarinet": "Clarinet", "Saxophone": "Saxophone", "Trumpet": "Trumpet",
  "Trombone": "Trombone", "Harmonica": "Harmonica", "Accordion": "Accordion",
  "Organ": "Organ", "Ney": "Ney", "Oud": "Oud",
};

const GENRE_MAP = {
  "Rock": "Rock", "Folk Rock": "Folk", "Country Rock": "Country / Bluegrass",
  "Hard Rock": "Hard Rock / Metal", "Heavy Metal": "Hard Rock / Metal", "Metal": "Hard Rock / Metal",
  "Punk": "Punk Rock", "Post-Punk": "Punk Rock", "Jazz": "Jazz", "Folk": "Folk",
  "Blues": "Blues", "Soul": "Soul / R&B", "R&B": "Soul / R&B",
  "Country": "Country / Bluegrass", "Bluegrass": "Country / Bluegrass",
  "Outlaw Country": "Country / Bluegrass", "Western Swing": "Country / Bluegrass",
  "Americana": "Country / Bluegrass", "Reggae": "Reggae", "Latin": "Latin",
  "Salsa": "Latin", "Tango": "Latin", "Bossa Nova": "Latin",
  "Gospel": "Christian / Gospel music", "Christian": "Christian / Gospel music",
  "Contemporary Christian": "Christian / Gospel music", "Hymns": "Christian / Gospel music",
  "Worship": "Christian / Gospel music", "Klezmer": "Jewish music",
  "Spiritual": "Non-denominational sacred music",
};

async function acFetch(path, options = {}) {
  const res = await fetch(`${AC_URL}/api/3${path}`, {
    ...options,
    headers: { "Api-Token": AC_KEY, "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`  AC error: ${options.method ?? "GET"} ${path} → ${res.status}`, body.slice(0, 200));
    return null;
  }
  return res.json();
}

async function syncUser(email, profile) {
  const fieldValues = [];

  if (profile.neighborhood) {
    fieldValues.push({ field: "18", value: profile.neighborhood });
  }

  const acInstruments = new Set();
  const otherInstruments = [];
  const singingVoice = profile.singing_voice ? profile.singing_voice.split(",").map(s => s.trim()) : [];
  if (singingVoice.some(v => v === "lead" || v === "backup")) {
    acInstruments.add("Voice");
  }
  for (const instrument of Object.keys(profile.instrument_levels ?? {})) {
    const mapped = INSTRUMENT_MAP[instrument];
    if (mapped) acInstruments.add(mapped);
    else if (instrument !== "Other") otherInstruments.push(instrument);
  }
  if (acInstruments.size > 0) {
    fieldValues.push({ field: "29", value: [...acInstruments].join("||") });
  }
  if (otherInstruments.length > 0) {
    fieldValues.push({ field: "39", value: otherInstruments.join(", ") });
  }

  const acGenres = new Set();
  const otherGenres = [];
  for (const genre of profile.favorite_genres ?? []) {
    const mapped = GENRE_MAP[genre];
    if (mapped) acGenres.add(mapped);
    else otherGenres.push(genre);
  }
  if (acGenres.size > 0) {
    fieldValues.push({ field: "30", value: [...acGenres].join("||") });
  }
  if (otherGenres.length > 0) {
    fieldValues.push({ field: "38", value: otherGenres.join(", ") });
  }

  const firstName = profile.display_name ?? "";
  const lastName = profile.last_name ?? "";

  const contactData = await acFetch("/contact/sync", {
    method: "POST",
    body: JSON.stringify({
      contact: {
        email,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(fieldValues.length ? { fieldValues } : {}),
      },
    }),
  });

  const contactId = contactData?.contact?.id;
  if (!contactId) {
    console.error(`  Could not upsert contact for ${email}`);
    return false;
  }

  const results = await Promise.all([
    ...LIST_IDS.map((listId) =>
      acFetch("/contactLists", {
        method: "POST",
        body: JSON.stringify({ contactList: { contact: contactId, list: listId, status: 1 } }),
      })
    ),
    acFetch("/contactTags", {
      method: "POST",
      body: JSON.stringify({ contactTag: { contact: contactId, tag: TAG_ID } }),
    }),
  ]);

  const allOk = results.every(r => r !== null);
  return allOk;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const [usersRes, profilesRes] = await Promise.all([
  fetch(`${SB_URL}/auth/v1/admin/users?per_page=1000`, { headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY } }).then(r => r.json()),
  fetch(`${SB_URL}/rest/v1/profiles?select=id,display_name,last_name,neighborhood,instrument_levels,favorite_genres,singing_voice`, { headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY } }).then(r => r.json()),
]);

const profileById = Object.fromEntries(profilesRes.map(p => [p.id, p]));

// Users to backfill (identified by audit)
const TARGET_EMAILS = new Set([
  "achibenshalom@gmail.com",
  "briel.pomerantz@gmail.com",
  "joegalang1@gmail.com",
  "sherri.kronfeld@gmail.com",
  "suryamusiclessons@gmail.com",
  "sacredmusicfellowship@gmail.com",
  "music@singjam.org",
  "benkramarz@gmail.com",
]);

const targets = usersRes.users.filter(u => TARGET_EMAILS.has(u.email?.toLowerCase()));

console.log(`Backfilling ${targets.length} users into ActiveCampaign...\n`);

for (const user of targets) {
  const profile = profileById[user.id] ?? {};
  process.stdout.write(`  ${user.email} ... `);
  const ok = await syncUser(user.email, profile);
  console.log(ok ? "✅ done" : "❌ partial/failed (see errors above)");
}

console.log("\nBackfill complete.");
