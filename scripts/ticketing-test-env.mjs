// Ticketing test environment: seed | teardown | status
//
// Safety notes:
//  * .env.local points at PRODUCTION Supabase, so everything here is real data.
//    Teardown removes all of it.
//  * The test event is dated ~120 days in the past ON PURPOSE. Official events
//    are world-readable, and JamsContent fetches jams from the last 90 days —
//    so anything older falls outside that window and appears in NO public
//    listing, upcoming or past. It stays reachable only by direct link.
//  * Test accounts use +aliases on Ben's own address, so ticket emails actually
//    arrive somewhere he can read them.
//  * Stripe stays in test mode; card 4242 4242 4242 4242 moves no real money.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import ws from "ws";

const REPO = "/Users/singjam/GitHub/singjam-connect";
const env = {};
for (const l of readFileSync(`${REPO}/apps/web/.env.local`, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});
const stripe = new Stripe(env.STRIPE_RESTRICTED_KEY);

const MARK = "[TEST ENV]";
const EVENT_NAME = `${MARK} Ticketing review event`;
const PROMO_CODE = "SINGJAMTEST";

const ACCOUNTS = [
  { key: "host",   email: "benkramarz+singjam-test-host@gmail.com",   name: "Test Host",   canHostOfficial: true },
  { key: "member", email: "benkramarz+singjam-test-member@gmail.com", name: "Test Member", canHostOfficial: false },
];
const PASSWORD = env.TICKETING_TEST_PASSWORD;
if (!PASSWORD) throw new Error("TICKETING_TEST_PASSWORD missing from apps/web/.env.local");

const cmd = process.argv[2] ?? "status";

async function findUser(email) {
  // No get-by-email in the admin API; page until found.
  for (let page = 1; page <= 10; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function seed() {
  console.log("Seeding ticketing test environment…\n");

  // 1. Accounts
  const users = {};
  for (const acct of ACCOUNTS) {
    let user = await findUser(acct.email);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email: acct.email,
        password: PASSWORD,
        email_confirm: true, // skip the confirmation round-trip
      });
      if (error) throw new Error(`creating ${acct.email}: ${error.message}`);
      user = data.user;
      console.log(`  created ${acct.key.padEnd(6)} ${acct.email}`);
    } else {
      await db.auth.admin.updateUserById(user.id, { password: PASSWORD });
      console.log(`  reused  ${acct.key.padEnd(6)} ${acct.email} (password reset)`);
    }
    users[acct.key] = user;

    // handle_new_user() creates the profile row; fill in the rest.
    await db.from("profiles").update({
      display_name: acct.name,
      can_host_official: acct.canHostOfficial,
    }).eq("id", user.id);
  }

  // 2. The event — hosted by the TEST HOST, not Ben, so the host persona is a
  //    genuine non-admin exercising can_host_official.
  const startsAt = new Date(Date.now() - 120 * 864e5).toISOString();
  let { data: jam } = await db.from("jams").select("id").eq("name", EVENT_NAME).maybeSingle();
  if (!jam) {
    const { data, error } = await db.from("jams").insert({
      host_user_id: users.host.id,
      name: EVENT_NAME,
      visibility: "official",
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + 3 * 3600e3).toISOString(),
      neighborhood: "Oakland",
      full_address: "Test venue, Oakland, CA",
      notes: "Seeded for end-to-end ticketing review. Safe to delete.",
      timezone: "America/Los_Angeles",
      capacity: 40,
    }).select("id").single();
    if (error) throw new Error(`creating jam: ${error.message}`);
    jam = data;
    console.log(`\n  created event ${jam.id}`);
  } else {
    console.log(`\n  reused event ${jam.id}`);
  }

  // 3. Tiers — deliberately varied: limited, cheap-limited, and unlimited.
  const tiers = [
    { name: "General",    description: "Standard admission",        price_cents: 1500, quantity: 20,   sort_order: 0 },
    { name: "Concession",  description: "Students and seniors",      price_cents: 800,  quantity: 10,   sort_order: 1 },
    { name: "Supporter",   description: "Pays for someone else too", price_cents: 5000, quantity: null, sort_order: 2 },
  ];
  const { data: existing } = await db.from("ticket_types").select("name").eq("jam_id", jam.id);
  const have = new Set((existing ?? []).map((t) => t.name));
  for (const t of tiers) {
    if (have.has(t.name)) { console.log(`  tier exists: ${t.name}`); continue; }
    const { error } = await db.from("ticket_types").insert({ jam_id: jam.id, ...t });
    if (error) throw new Error(`creating tier ${t.name}: ${error.message}`);
    console.log(`  tier created: ${t.name.padEnd(11)} $${(t.price_cents/100).toFixed(2)} ${t.quantity ?? "unlimited"}`);
  }

  // 4. Stripe promo code (test mode)
  // Codes are only honoured on the jam they're registered against (migration 159),
  // so the Stripe objects and the local row have to be created together.
  const found = await stripe.promotionCodes.list({ code: PROMO_CODE, active: true, limit: 1 });
  let promoId = found.data[0]?.id ?? null;
  let couponId = found.data[0]?.promotion?.coupon ?? null;
  if (!promoId) {
    const coupon = await stripe.coupons.create({
      percent_off: 25, duration: "once", name: `${MARK} 25% off`,
    });
    const promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },   // bare `coupon` is rejected
      code: PROMO_CODE,
    });
    promoId = promo.id; couponId = coupon.id;
    console.log(`\n  promo code created: ${PROMO_CODE} (25% off)`);
  } else {
    console.log(`\n  promo code exists: ${PROMO_CODE}`);
  }

  const { data: existingRow } = await db.from("ticket_promo_codes")
    .select("id").eq("jam_id", jam.id).ilike("code", PROMO_CODE).maybeSingle();
  if (!existingRow) {
    await db.from("ticket_promo_codes").insert({
      jam_id: jam.id, code: PROMO_CODE, stripe_promotion_code_id: promoId,
      stripe_coupon_id: couponId, label: "25% off", created_by: users.host.id,
    });
    console.log(`  registered ${PROMO_CODE} against the test event`);
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log("READY\n");
  console.log(`Event page   http://localhost:3457/jam/${jam.id}`);
  console.log(`Host page    http://localhost:3457/jam/${jam.id}/tickets/manage\n`);
  console.log(`Host   ${ACCOUNTS[0].email}`);
  console.log(`Member ${ACCOUNTS[1].email}`);
  console.log(`Password for both: ${PASSWORD}\n`);
  console.log(`Promo code: ${PROMO_CODE} (25% off)`);
  console.log(`Test card:  4242 4242 4242 4242, any future expiry, any CVC`);
  console.log(`${"─".repeat(64)}`);
}

async function teardown() {
  console.log("Tearing down ticketing test environment…\n");

  const { data: jam } = await db.from("jams").select("id").eq("name", EVENT_NAME).maybeSingle();
  if (jam) {
    // Cascades to ticket_types, ticket_orders, tickets and jam_rsvps.
    await db.from("jams").delete().eq("id", jam.id);
    console.log(`  deleted event ${jam.id} (tiers, orders and tickets cascade)`);
  } else {
    console.log("  no test event found");
  }

  for (const acct of ACCOUNTS) {
    const user = await findUser(acct.email);
    if (user) {
      await db.auth.admin.deleteUser(user.id);
      console.log(`  deleted account ${acct.email}`);
    }
  }

  await db.from("ticket_promo_codes").delete().ilike("code", PROMO_CODE);
  const found = await stripe.promotionCodes.list({ code: PROMO_CODE, active: true, limit: 1 });
  for (const p of found.data) {
    await stripe.promotionCodes.update(p.id, { active: false });
    const couponId = p.promotion?.coupon ?? p.coupon?.id ?? p.coupon;
    if (couponId) { try { await stripe.coupons.del(couponId); } catch {} }
    console.log(`  deactivated promo code ${PROMO_CODE}`);
  }

  console.log("\n✔ torn down — production data is back to how it was");
}

async function status() {
  const { data: jam } = await db.from("jams").select("id, name, starts_at, visibility")
    .eq("name", EVENT_NAME).maybeSingle();
  console.log(jam ? `event: ${jam.id} (${jam.visibility}, ${jam.starts_at?.slice(0,10)})` : "event: none");
  if (jam) {
    const { data: tiers } = await db.from("ticket_types").select("name, price_cents, quantity").eq("jam_id", jam.id);
    for (const t of tiers ?? []) {
      const { data: sold } = await db.rpc("ticket_type_sold_count", { type_id: (await db.from("ticket_types").select("id").eq("jam_id", jam.id).eq("name", t.name).single()).data.id });
      console.log(`  ${t.name.padEnd(11)} $${(t.price_cents/100).toFixed(2)}  sold ${sold}/${t.quantity ?? "∞"}`);
    }
    const { count: orders } = await db.from("ticket_orders").select("id", { count:"exact", head:true }).eq("jam_id", jam.id);
    const { count: checked } = await db.from("tickets").select("id", { count:"exact", head:true }).eq("jam_id", jam.id).not("checked_in_at","is",null);
    console.log(`  orders: ${orders ?? 0}, checked in: ${checked ?? 0}`);
  }
  for (const acct of ACCOUNTS) {
    const u = await findUser(acct.email);
    console.log(`${acct.key.padEnd(6)}: ${u ? "exists" : "missing"}`);
  }
}

if (cmd === "seed") await seed();
else if (cmd === "teardown") await teardown();
else await status();
