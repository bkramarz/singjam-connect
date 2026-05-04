import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { syncContact, ContactProfile } from "@/lib/activecampaign";

const AC_API_URL = process.env.AC_API_URL;
const AC_API_KEY = process.env.AC_API_KEY;

const SINGJAM_TAG_ID = "24";
const LIST_IDS = ["1", "4", "9"];

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

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

export type ACSyncStatus = {
  email: string;
  userId: string;
  inAC: boolean;
  hasTag: boolean;
  missingLists: string[];
};

export async function GET() {
  const admin = supabaseAdmin();

  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: sbAuthData }, profilesResult, acContacts] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id"),
    fetchAllACContacts(),
  ]);

  const sbUsers = sbAuthData?.users ?? [];
  const acByEmail = new Map(acContacts.map((c) => [c.email?.toLowerCase(), c]));

  const statuses: ACSyncStatus[] = await Promise.all(
    sbUsers.map(async (sbUser) => {
      const email = sbUser.email?.toLowerCase() ?? "";
      const acContact = acByEmail.get(email);

      if (!acContact) {
        return { email, userId: sbUser.id, inAC: false, hasTag: false, missingLists: [...LIST_IDS] };
      }

      const [tagsData, listsData] = await Promise.all([
        acFetch(`/contacts/${acContact.id}/contactTags`),
        acFetch(`/contacts/${acContact.id}/contactLists`),
      ]);

      const tagIds: string[] = (tagsData?.contactTags ?? []).map((t: { tag: string }) => t.tag);
      const subscribedLists = new Set<string>(
        (listsData?.contactLists ?? [])
          .filter((cl: { status: string }) => cl.status === "1")
          .map((cl: { list: string }) => cl.list)
      );

      return {
        email,
        userId: sbUser.id,
        inAC: true,
        hasTag: tagIds.includes(SINGJAM_TAG_ID),
        missingLists: LIST_IDS.filter((id) => !subscribedLists.has(id)),
      };
    })
  );

  return NextResponse.json(statuses);
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userIds }: { userIds: string[] } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const [{ data: sbAuthData }, profilesResult] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id,display_name,last_name,neighborhood,instrument_levels,favorite_genres,singing_voice"),
  ]);

  const profileById = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );

  const targets = (sbAuthData?.users ?? []).filter((u) => userIds.includes(u.id));

  let synced = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (u) => {
      if (!u.email) { failed++; return; }
      const p = profileById.get(u.id) ?? {} as Record<string, unknown>;
      const profile: ContactProfile = {
        firstName: (p.display_name as string) || undefined,
        lastName: (p.last_name as string) || undefined,
        neighborhood: (p.neighborhood as string) || undefined,
        singingVoice: (p.singing_voice as string)
          ? (p.singing_voice as string).split(",").map((s) => s.trim())
          : undefined,
        instrumentLevels: (p.instrument_levels as Record<string, string>) || undefined,
        favoriteGenres: (p.favorite_genres as string[]) || undefined,
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
