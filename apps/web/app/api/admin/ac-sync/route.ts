import { NextResponse } from "next/server";
import { fetchAllRows } from "@singjam/core";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { fetchAllAuthUsers } from "@/lib/authUsers";
import { syncContact, ContactProfile } from "@/lib/activecampaign";

const AC_API_URL = process.env.AC_API_URL;
const AC_API_KEY = process.env.AC_API_KEY;

const SINGJAM_TAG_ID = "24";
const LIST_IDS = ["1", "4", "9"];

async function acFetch(path: string) {
  if (!AC_API_URL || !AC_API_KEY) return null;
  const res = await fetch(`${AC_API_URL}/api/3${path}`, {
    headers: { "Api-Token": AC_API_KEY },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchAllACContacts() {
  const contacts: { id: string; email: string }[] = [];
  let offset = 0;
  while (true) {
    const data = await acFetch(`/contacts?limit=100&offset=${offset}`);
    const batch: { id: string; email: string }[] = data?.contacts ?? [];
    contacts.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }
  return contacts;
}

type ACProfileRow = {
  id: string;
  display_name: string | null;
  last_name: string | null;
  neighborhood: string | null;
  instrument_levels: Record<string, string> | null;
  favorite_genres: string[] | null;
  singing_voice: string | null;
};

export type ACSyncStatus = {
  email: string;
  userId: string;
  inAC: boolean;
  hasTag: boolean;
  missingLists: string[];
  unsubscribedLists: string[];
};

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const [sbUsers, acContacts] = await Promise.all([
    fetchAllAuthUsers(admin.auth.admin),
    fetchAllACContacts(),
  ]);

  const acByEmail = new Map(acContacts.map((c) => [c.email?.toLowerCase(), c]));

  const statuses: ACSyncStatus[] = await Promise.all(
    sbUsers.map(async (sbUser) => {
      const email = sbUser.email?.toLowerCase() ?? "";
      const acContact = acByEmail.get(email);

      if (!acContact) {
        return { email, userId: sbUser.id, inAC: false, hasTag: false, missingLists: [...LIST_IDS], unsubscribedLists: [] };
      }

      const [tagsData, listsData] = await Promise.all([
        acFetch(`/contacts/${acContact.id}/contactTags`),
        acFetch(`/contacts/${acContact.id}/contactLists`),
      ]);

      const tagIds: string[] = (tagsData?.contactTags ?? []).map((t: { tag: string }) => t.tag);
      const contactLists: { list: string; status: string }[] = listsData?.contactLists ?? [];
      const subscribedLists = new Set<string>(contactLists.filter((cl) => cl.status === "1").map((cl) => cl.list));
      const unsubscribedListSet = new Set<string>(contactLists.filter((cl) => cl.status === "2").map((cl) => cl.list));

      return {
        email,
        userId: sbUser.id,
        inAC: true,
        hasTag: tagIds.includes(SINGJAM_TAG_ID),
        missingLists: LIST_IDS.filter((id) => !subscribedLists.has(id) && !unsubscribedListSet.has(id)),
        unsubscribedLists: LIST_IDS.filter((id) => unsubscribedListSet.has(id)),
      };
    })
  );

  return NextResponse.json(statuses);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userIds }: { userIds: string[] } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const [sbUsers, profiles] = await Promise.all([
    fetchAllAuthUsers(admin.auth.admin),
    fetchAllRows<ACProfileRow>((from, to) =>
      admin
        .from("profiles")
        .select("id,display_name,last_name,neighborhood,instrument_levels,favorite_genres,singing_voice")
        .order("id")
        .range(from, to) as any
    ),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const targets = sbUsers.filter((u) => userIds.includes(u.id));

  let synced = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (u) => {
      if (!u.email) { failed++; return; }
      const p = profileById.get(u.id);
      const profile: ContactProfile = {
        firstName: p?.display_name || undefined,
        lastName: p?.last_name || undefined,
        neighborhood: p?.neighborhood || undefined,
        singingVoice: p?.singing_voice
          ? p.singing_voice.split(",").map((s) => s.trim())
          : undefined,
        instrumentLevels: p?.instrument_levels || undefined,
        favoriteGenres: p?.favorite_genres || undefined,
      };
      try {
        await syncContact(u.email, profile);
        synced++;
      } catch {
        failed++;
      }
    })
  );

  return NextResponse.json({ synced, failed });
}
