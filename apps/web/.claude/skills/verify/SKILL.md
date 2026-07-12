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
