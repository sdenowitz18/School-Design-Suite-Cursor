# Designed Experience seeding scripts

One-off TypeScript scripts that write **`designedExperienceData`** and **`snapshotData`** to components in the database. Use them as templates when you add new blueprint components or want to bulk-fill design data.

> **Distinct from `scores/`** — those scripts populate scored performance data (`healthData`: measures, instances, and scores). These scripts populate blueprint design choices only.

## Prerequisites

- Project root `.env` with database connection (same as the app).
- Run from the **repository root** so imports resolve.

## How to run

From the repo root:

```bash
node --env-file=.env --import tsx/esm scripts/designed-experience/<script-name>.ts
```

Shorter aliases (same behavior):

```bash
npm run seed:de:world-languages
npm run seed:de:batch-2
npm run seed:de:batch-3
```

Examples (full command):

```bash
node --env-file=.env --import tsx/esm scripts/designed-experience/seed-world-languages.ts
node --env-file=.env --import tsx/esm scripts/designed-experience/seed-batch-2.ts
node --env-file=.env --import tsx/esm scripts/designed-experience/seed-batch-3.ts
```

## Scripts and what they touch

| Script | Components (`nodeId`) | Notes |
|--------|------------------------|--------|
| `seed-world-languages.ts` | `world_languages` (+ Spanish / French subs) | Smallest full example: leaps, outcomes, all 7 key-element buckets, learners/adults, snapshot. |
| `seed-batch-2.ts` | `overall` (center), `science`, `english_language_arts`, `student_advisory_seminar` | Center merges new `elementsExpertData` onto existing. Science has Chemistry/Biology/Physics subs. |
| `seed-batch-3.ts` | `algebra`, `teach_to_one_math`, `extra_curriculars`, `college_exposure` | College Exposure merges schedule expert keys; replaces aims/subs with curated data. |

Re-running a script **overwrites** the fields that script sets for those components (except where a script explicitly merges, e.g. center or college exposure schedule).

## API: how updates are applied

`storage.updateComponent` takes the blueprint **`nodeId` string** (e.g. `"science"`), **not** the numeric DB `id`.

```ts
await storage.updateComponent("science", {
  designedExperienceData: { /* ... */ },
  snapshotData: { /* ... */ },
});
```

## Finding a `nodeId` for a new component

Use a small query against storage or the DB, for example:

```bash
node --env-file=.env --import tsx/esm -e "
import { storage } from '../../server/storage.ts';
const all = await storage.getComponents();
for (const c of all) console.log(c.nodeId, '|', c.title);
"
```

Match the `nodeId` you see in the canvas / blueprint to the script.

## Data shape the UI expects

Scripts populate the same shapes the client reads:

- **`designedExperienceData`**
  - `keyDesignElements.aims` — leaps and outcomes with `type`, `label`, `overrideLevel` (`H`/`M`/`L`), `levelMode: "override"`, `level`, `notes`, `selected: true`; outcomes may use `subSelections`, `subPriorities`, `subPrimaries`, `isPrimary`, etc.
  - `elementsExpertData` — nested map: `{ [elementId]: { [questionId__bucketId]: BucketValue } }`  
    Element IDs and bucket keys come from `client/src/components/expert-view/expert-view-schema.ts` (`ALL_ELEMENTS`).
  - `subcomponents` / `adultSubcomponents` — optional; each sub can have its own `elementsExpertData`, `aims`, profiles, etc.
  - `learnersProfile` / `adultsProfile` — same shapes as Designed Experience UI.
- **`snapshotData`** — primary outcomes, duration/frequency, classrooms/students, craft stage, etc., as used by snapshot preview.

Copy builders from `seed-world-languages.ts`: `leap`, `outcome`, `a1Tag` / `a1Val`, `a3Val`, `a3PairVal`, `a5Val`, and the `expertData()` pattern.

## Do **not** populate (outdated)

These are legacy; the current UI uses the **7 key elements** expert buckets instead:

- `aims for learner` (or equivalent legacy learner-aims structures)
- `keyDesignElements.practices` / `keyDesignElements.supports` as standalone “old” practice lists (not the 7-element `elementsExpertData`)

## Adding a new component later

1. Copy `seed-world-languages.ts` (or the smallest section from a batch script) into a new file, e.g. `scripts/designed-experience/seed-my-component.ts`.
2. Set the correct `nodeId` in `storage.updateComponent(...)`.
3. Align bucket keys with `expert-view-schema.ts` so previews and full views match.
4. Run once; commit the script if you want it in version control for reproducibility.

## Optional: extract shared helpers

If you add many scripts, consider moving shared `genId`, `leap`, `outcome`, and archetype helpers into something like `scripts/seed-de-helpers.ts` and import them—today each script is self-contained for easy copy-paste.
