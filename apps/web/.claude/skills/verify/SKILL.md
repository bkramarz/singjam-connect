---
name: verify
description: Build, run, and drive the SingJam web app to verify changes end-to-end
---

# Verifying apps/web changes

Dev server (uses `.env.local`, which points at the **production** Supabase project — reads are fine, avoid destructive writes):

```bash
cd apps/web && PORT=3457 npm run dev   # ready when /search returns 200
```

Drive pages headlessly with Playwright (`npx playwright --version` — installed globally; for scripts, `npm install playwright` in a scratch dir and `import { chromium } from "playwright"`).

Gotchas:
- Song cards render **two** `/songs/…` anchors each — halve anchor counts.
- `/search` browse count label is the `p.uppercase` element.
- RPC traffic is visible as `…/rest/v1/rpc/<name>` requests — assert on those to check what the page actually fetches.
- Direct RPC checks: read `NEXT_PUBLIC_SUPABASE_URL` + anon key from `apps/web/.env.local`, POST to `$URL/rest/v1/rpc/<fn>` with `apikey` header (this exercises grants as the browser would).
- Auth-gated pages (middleware) redirect to /auth when logged out; /search, /songs/[slug] are public.

Driving auth-gated pages (no stored test creds needed — mint a session for `ADMIN_EMAIL`):

1. Service-role client: `admin.auth.admin.generateLink({ type: "magiclink", email: ADMIN_EMAIL })` (does NOT send an email).
2. Anon client: `anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token })` → real session.
3. Cookie for `@supabase/ssr`: name `sb-<project-ref>-auth-token`, value `"base64-" + base64url(JSON.stringify(session))`; if longer than 3180 chars, split into `.0`/`.1`… chunks. Add to the Playwright context for `domain: "localhost", path: "/"` before `page.goto` — middleware and browser client both pick it up.
4. Under Node 20, `createClient` needs `realtime: { transport: ws }` (`npm install ws`) or it throws at import time.

Verifying RPCs behind `authenticated`-only grants without a session: Management API SQL endpoint (`POST https://api.supabase.com/v1/projects/<ref>/database/query`, token from Supabase CLI keychain) and impersonate first: `select set_config('request.jwt.claims', json_build_object('sub', <uid>, 'role', 'authenticated')::text, false);` — then `auth.uid()` resolves inside the same request.
