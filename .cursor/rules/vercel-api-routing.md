---
description: Troubleshooting Vercel API routing — 405 errors on PATCH/POST/DELETE in production
globs:
  - vercel.json
  - api/**
---

# Vercel API Routing — Known Issue & Fix

## Symptom

All PATCH, POST, or DELETE requests in production return **405 Method Not Allowed** with `Content-Type: text/html` and `Content-Disposition: inline; filename="index.html"`. GET requests to simple routes like `/api/ping` or `/api/health` may still work. The browser console shows repeated `net::ERR_ABORTED 405` errors. Selections, saves, and mutations fail across the entire app — not specific to one component.

## Root Cause

Two compounding issues in the Vercel deployment:

1. **`api/index.ts` catch-all wrapper.** If an `api/index.ts` file exists that wraps the full Express app (`import { createApp } from "../server/app"`), Vercel maps it to the `/api` path. It can shadow the dedicated, self-contained serverless functions in `api/components/`, `api/health.ts`, etc. It also tends to crash on cold start due to heavy transitive dependencies (Express, Drizzle, pg, etc.).

2. **Missing explicit routes for dynamic segments.** The `api/components/[nodeId].ts` serverless function handles `/api/components/:nodeId` (GET, PATCH, DELETE). But Vercel's filesystem auto-detection does not reliably resolve the `[nodeId]` dynamic segment when `outputDirectory` is set to a custom path (`dist/public`). Without an explicit route in `vercel.json`, these requests fall through to the SPA catch-all, which serves `index.html` and returns 405 for non-GET methods.

## Fix

1. **Delete `api/index.ts`** if it exists. The dedicated serverless functions already cover every route:
   - `api/ping.ts` → `/api/ping`
   - `api/health.ts` → `/api/health`
   - `api/seed.ts` → `/api/seed`
   - `api/components/index.ts` → `/api/components` (GET, POST)
   - `api/components/[nodeId].ts` → `/api/components/:nodeId` (GET, PATCH, DELETE)

2. **Use explicit `routes` in `vercel.json`** that map each API path to its serverless function *before* the filesystem handler and SPA fallback:

```json
{
  "routes": [
    { "src": "/api/ping", "dest": "/api/ping" },
    { "src": "/api/health", "dest": "/api/health" },
    { "src": "/api/seed", "dest": "/api/seed" },
    { "src": "/api/components/([^/]+)", "dest": "/api/components/[nodeId]?nodeId=$1" },
    { "src": "/api/components/?$", "dest": "/api/components" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

The dynamic route `"/api/components/([^/]+)"` captures the nodeId and passes it as `?nodeId=$1`, which the handler reads via `req.query.nodeId`.

3. **Deploy via `vercel --prod --yes`** (auto-deploy from GitHub pushes may not be configured).

## How to Verify

```bash
# Should return 200 with JSON:
curl -s -w "\n%{http_code}" -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}' \
  https://school-design-suite-cursor.vercel.app/api/components/college_exposure
```

If you get 405 with HTML, the routes are misconfigured. If you get 200 with JSON, it's working.

## Key Diagnostic Clue

If the response to a PATCH/POST has `Content-Type: text/html` and `Content-Disposition: inline; filename="index.html"`, the request is hitting the SPA fallback — not a serverless function. The fix is always in `vercel.json` routing.
