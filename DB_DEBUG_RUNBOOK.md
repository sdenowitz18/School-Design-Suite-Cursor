# Database Debug Runbook (Local + Vercel)

This is the step-by-step process we used to diagnose and fix data/save issues.

Use this when:
- data appears missing,
- edits are not persisting,
- `/api/*` returns 500,
- local works but production does not (or vice versa).

## 1) Quick symptom triage

- **UI changes appear, then disappear on refresh**
  - Usually PATCH failed or wrote to a different DB.
- **Only default components are visible**
  - Usually connected to seeded/fresh DB (or wrong branch/project).
- **Local was working, then suddenly not saving**
  - Often stale dev server process with old env vars still in memory.

## 2) Canonical data flow

1. Frontend state updates in React.
2. Autosave sends `PATCH /api/components/:nodeId`.
3. API handler writes JSON (`designed_experience_data`, `health_data`) to `components`.
4. Query cache refreshes and UI reloads from API response.

If saving fails, check API + DB first before changing frontend logic.

## 3) Local debug checklist

### A. Verify local API is alive

```bash
curl -sS http://localhost:5050/api/health
```

Expected:
- `ok: true`
- `db.ok: true`

If this fails, local server is down or DB auth is broken.

### B. Verify actual data source

```bash
curl -sS http://localhost:5050/api/components
```

If this JSON does not contain expected data, issue is DB target, not UI.

### C. Force-refresh env usage

If `.env` changed, restart server fully:
1. Stop all `npm run dev` processes.
2. Start fresh:

```bash
npm run dev
```

Why: running Node processes do not hot-reload env vars.

### D. Watch server logs while reproducing

Look for:
- `PATCH /api/components/<nodeId> 200` (good)
- `500` errors (bad)
- DB errors like:
  - `password authentication failed`
  - `ENOTFOUND ...`

## 4) Production (Vercel) debug checklist

### A. Verify function health

- `https://<your-domain>/api/ping`
- `https://<your-domain>/api/health`

`/api/health` should return:
- `ok: true`
- `db.ok: true`
- env presence flags showing `HAS_DATABASE_URL: true`

### B. Confirm Vercel env var is correct

In Vercel Project Settings:
- Ensure `DATABASE_URL` exists for **Production**.
- Confirm no malformed prefix/suffix (e.g. `psql_`, stray quotes).
- Redeploy after env changes.

### C. Confirm endpoint/branch consistency

If production shows unexpected data:
- compare host in connection string (e.g. `ep-...neon.tech`) with intended Neon endpoint.
- ensure local and production both point to same DB endpoint if intended.

## 5) SQL-level truth checks

Use direct DB query when API results are ambiguous.

### A. List components

```sql
select node_id, title from components order by node_id;
```

### B. Verify schema exists

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

### C. Validate key saved payloads

```sql
select
  node_id,
  (designed_experience_data ? 'portraitOfGraduate') as has_pog,
  (health_data ? 'ringDesignScoreData') as has_design,
  (health_data ? 'ringImplementationScoreData') as has_impl,
  (health_data ? 'ringConditionsScoreData') as has_cond,
  (health_data ? 'experienceScoreData') as has_exp,
  (health_data ? 'outcomeScoreData') as has_out
from components
order by node_id;
```

## 6) Known failure signatures and fixes

- **`password authentication failed for user 'neondb_owner'`**
  - Wrong credential in env OR stale process using old env.
  - Fix env, restart local server, redeploy Vercel if prod.

- **`getaddrinfo ENOTFOUND ...`**
  - Invalid hostname in connection string.
  - Fix URL formatting in env var.

- **`relation "components" does not exist`**
  - Connected to wrong/empty DB or wrong schema.
  - Point to correct DB; run schema/migrations if necessary.

- **Site up but saves not sticking**
  - PATCH failing silently in UI due backend 500.
  - Confirm PATCH logs and health endpoint.

## 7) Safe operating practices

- Treat API/DB as source of truth, not temporary UI state.
- Never paste full credentials in logs/chats long-term.
- Rotate DB password if exposed.
- Keep one canonical env var key (`DATABASE_URL`) across local + Vercel.
- After any connection-string update:
  - restart local dev server,
  - redeploy Vercel.

## 8) Optional hardening we should add next

- Visible save-failed toast/banner on PATCH errors.
- In-app health indicator in dev mode.
- Startup log showing active DB host (without secrets).
- One-click JSON export/import backup for `components`.

