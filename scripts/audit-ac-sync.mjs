// One-off audit script: compares Supabase users against ActiveCampaign contacts.
// Run: node scripts/audit-ac-sync.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

// Parse .env.local
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const AC_API_URL = env.AC_API_URL;
const AC_API_KEY = env.AC_API_KEY;

const SINGJAM_TAG_ID = "24";
const SINGJAM_LIST_IDS = new Set(["1", "4", "9"]);

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getSupabaseUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
    );
    if (!res.ok) throw new Error(`Supabase users fetch failed: ${res.status}`);
    const data = await res.json();
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return users;
}

async function getSupabaseProfiles() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,display_name,last_name,neighborhood,instrument_levels,favorite_genres,singing_voice`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
  );
  if (!res.ok) throw new Error(`Supabase profiles fetch failed: ${res.status}`);
  return res.json();
}

// ── ActiveCampaign helpers ────────────────────────────────────────────────────

async function acFetch(path) {
  const res = await fetch(`${AC_API_URL}/api/3${path}`, {
    headers: { "Api-Token": AC_API_KEY },
  });
  if (!res.ok) throw new Error(`AC fetch failed: ${res.status} ${path}`);
  return res.json();
}

async function getAllACContacts() {
  const contacts = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const data = await acFetch(`/contacts?limit=${limit}&offset=${offset}`);
    const batch = data.contacts ?? [];
    contacts.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return contacts;
}

async function getACContactTags(contactId) {
  const data = await acFetch(`/contacts/${contactId}/contactTags`);
  return (data.contactTags ?? []).map((t) => t.tag);
}

async function getACContactLists(contactId) {
  const data = await acFetch(`/contacts/${contactId}/contactLists`);
  return data.contactLists ?? [];
}

// ── Main audit ────────────────────────────────────────────────────────────────

console.log("Fetching Supabase users and profiles...");
const [sbUsers, sbProfiles] = await Promise.all([getSupabaseUsers(), getSupabaseProfiles()]);

const profileById = Object.fromEntries(sbProfiles.map((p) => [p.id, p]));

console.log(`Found ${sbUsers.length} Supabase users, ${sbProfiles.length} profiles\n`);

console.log("Fetching all ActiveCampaign contacts...");
const acContacts = await getAllACContacts();
const acByEmail = Object.fromEntries(acContacts.map((c) => [c.email?.toLowerCase(), c]));

console.log(`Found ${acContacts.length} AC contacts\n`);

// For each Supabase user, check AC status
const issues = [];
const ok = [];

for (const user of sbUsers) {
  const email = user.email?.toLowerCase();
  if (!email) {
    issues.push({ email: "(none)", id: user.id, problem: "Supabase user has no email" });
    continue;
  }

  const acContact = acByEmail[email];
  const profile = profileById[user.id];

  if (!acContact) {
    issues.push({ email, id: user.id, problem: "Not found in ActiveCampaign" });
    continue;
  }

  // Check tag and lists in parallel
  const [tagIds, contactLists] = await Promise.all([
    getACContactTags(acContact.id),
    getACContactLists(acContact.id),
  ]);

  const contactProblems = [];

  // Tag check
  if (!tagIds.includes(SINGJAM_TAG_ID)) {
    contactProblems.push(`Missing tag "SingJam App User" (tag ${SINGJAM_TAG_ID})`);
  }

  // List membership check (status 1 = subscribed, 2 = unsubscribed)
  const subscribedLists = new Set(
    contactLists.filter((cl) => cl.status === "1").map((cl) => cl.list)
  );
  for (const listId of SINGJAM_LIST_IDS) {
    if (!subscribedLists.has(listId)) {
      const listNames = { "1": "Sacred Music Fellowship", "4": "SingJam", "9": "SMF General Announcements" };
      contactProblems.push(`Not subscribed to list ${listId} (${listNames[listId]})`);
    }
  }

  // Name check
  const displayName = profile?.display_name ?? user.user_metadata?.full_name ?? "";
  const lastName = profile?.last_name ?? "";
  const firstName = displayName.split(" ")[0] ?? "";

  if (firstName && acContact.firstName && acContact.firstName !== firstName) {
    contactProblems.push(
      `First name mismatch: AC="${acContact.firstName}" vs Supabase="${firstName}"`
    );
  }
  if (lastName && acContact.lastName && acContact.lastName !== lastName) {
    contactProblems.push(
      `Last name mismatch: AC="${acContact.lastName}" vs Supabase="${lastName}"`
    );
  }

  if (contactProblems.length > 0) {
    issues.push({ email, id: user.id, acId: acContact.id, problems: contactProblems });
  } else {
    ok.push(email);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════");
console.log("AUDIT REPORT");
console.log("═══════════════════════════════════════════════════\n");

console.log(`✅  Clean (${ok.length} users):`);
for (const e of ok) console.log(`    ${e}`);

console.log(`\n❌  Issues found (${issues.length} users):`);
for (const item of issues) {
  console.log(`\n  ${item.email}  (Supabase: ${item.id ?? "?"}${item.acId ? `, AC: ${item.acId}` : ""})`);
  if (item.problem) {
    console.log(`    • ${item.problem}`);
  } else {
    for (const p of item.problems ?? []) console.log(`    • ${p}`);
  }
}

console.log("\n═══════════════════════════════════════════════════");
console.log(`Total: ${sbUsers.length} Supabase users | ${ok.length} OK | ${issues.length} with issues`);
console.log("═══════════════════════════════════════════════════");
