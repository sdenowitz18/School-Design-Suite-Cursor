# Debugging: UI Selection & Missing Data

This rule captures recurring issues and how to diagnose them fast.

---

## Problem 1: "Nothing is selectable" / clicks don't register

### Root cause (z-index stacking with Radix Sheet overlay)

The app uses a Radix Dialog-based `Sheet` (`modal={false}`) for the right-hand working panel.
`SheetOverlay` renders a `fixed inset-0` div that covers the entire viewport.
Radix portaled menus (Select, Dropdown, Popover, ContextMenu) are siblings of that overlay in the DOM.

If the overlay's z-index ≥ the menu's z-index, or if the overlay has pointer-events enabled, it eats all clicks.

### Z-index architecture (as fixed)

| Layer | z-index | Notes |
|-------|---------|-------|
| Sheet overlay | `z-50` | `pointer-events-none` when sheet uses `modal={false}` via `overlayPointerEventsNone` prop |
| Sheet content panel | `z-[100]` | The actual side panel |
| Module library strip | `z-[100]` | Top strip; uses `DismissableLayerBranch` |
| All portaled menus | `z-[200]` | Select, Dropdown, Popover, ContextMenu base classes |

### How to check

1. Open browser DevTools → Elements
2. Search for `data-radix-popper-content-wrapper` (portaled menu) or the overlay `data-state="open"` with `fixed inset-0`
3. Compare computed z-index values
4. Check if the overlay has `pointer-events: auto` (bad) or `pointer-events: none` (good)

### Rules to follow

- **NEVER** add inline `z-50` or `z-[100]` to `DropdownMenuContent`, `SelectContent`, `PopoverContent`, or `ContextMenuContent` — it overrides the base `z-[200]` via `twMerge`
- When using `Sheet` with `modal={false}`, always pass `overlayPointerEventsNone` to `SheetContent`
- If adding a new portaled Radix component, its content z-index must be ≥ `z-[200]`

---

## Problem 2: "Components not showing" / canvas is blank / old data

### Diagnosis checklist (in order)

1. **Check the server terminal for errors** — look for 500s on `GET /api/components`
2. **Database quota** — Neon free tier has a monthly data transfer limit. Error message: `Your project has exceeded the data transfer quota`. Fix: upgrade plan, wait for reset, or use local Postgres.
3. **Server not restarted** — server-side code changes (anything in `server/`, `api/`, `shared/`) require killing the Node process and running `npm run dev` again. Vite only hot-reloads client code.
4. **Query cache stale** — `componentQueries.all` uses `staleTime: 0` + `refetchOnMount: "always"` to avoid the global `staleTime: Infinity` hiding DB changes. If a mutation fires, `onSuccess` must call both `invalidateQueries` AND `refetchQueries`.

### Auto-seed behavior

- When `GET /api/components` returns `[]` (empty DB), the client fires `POST /api/seed`
- Seed only creates the `overall` node (no legacy ring components)
- `autoSeedAttempted` ref prevents infinite loops; resets on error so it retries
- The canvas shows `SHELL_OVERALL_CANVAS_NODE` (center card placeholder) while waiting

### Quick server restart

```bash
kill $(lsof -ti :5050) 2>/dev/null; sleep 1; npm run dev
```

### Vercel vs local

- **Local dev**: Express server in `server/routes.ts` uses Drizzle ORM via `server/storage.ts`
- **Vercel prod**: Serverless functions in `api/` folder use raw `pg` Pool queries
- Seed defaults live in `server/seed-defaults.ts` — **both** paths import from there (single source of truth)

---

## Problem 3: "Old components keep coming back"

### What was happening

- `FALLBACK_NODES` in `canvas-view.tsx` hardcoded Algebra/Math/College Exposure — shown when API returned empty
- `seed-defaults.ts` and `api/seed.ts` both had the same legacy seeds inline
- `component-health-view.tsx` had `RING_NODE_IDS = ["algebra", "math", "college_exposure"]` hardcoded

### What was fixed

- `FALLBACK_NODES` removed; replaced with `SHELL_OVERALL_CANVAS_NODE` (only overall)
- `seed-defaults.ts` now seeds only `overall`; `api/seed.ts` imports from there
- `RING_NODE_IDS` replaced with dynamic check: `nodeId !== "overall"`

### Rule: NEVER hardcode node IDs

Ring components are user-created via the module library. Don't reference specific node IDs in code.
