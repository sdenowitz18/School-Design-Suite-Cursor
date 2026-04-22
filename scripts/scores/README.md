# Score seeding scripts

One-off TypeScript scripts that write **`healthData`** (measures, instances, and scores) to components in the database. These scripts populate what you would otherwise enter through the Status & Health UI: measures, actor instances, sub-dimension weights, and final scores across all five scored dimensions.

> **Distinct from `designed-experience/`** — those scripts populate blueprint design choices (`designedExperienceData`, `snapshotData`). These scripts populate scored performance data (`healthData`).

## Prerequisites

- Project root `.env` with database connection (same as the app).
- Run from the **repository root** so imports resolve.
- The target component must already exist in the DB (run `npm run seed` first if starting fresh).

## How to run

```bash
npm run seed:scores:overall
```

Or directly:

```bash
node --env-file=.env --import tsx/esm scripts/scores/seed-health-scores.ts
```

## Scripts and what they touch

| Script | Components (`nodeId`) | Dimensions seeded |
|--------|-----------------------|-------------------|
| `seed-health-scores.ts` | `overall` | Design, Implementation, Learning & Advancement Outcomes, Wellbeing & Conduct Outcomes, Experience |

## What gets seeded per dimension

Each script creates **measures with current instances** (no period history) in the following `healthData` buckets:

| Dimension | `healthData` key | Sub-dimension tree |
|-----------|------------------|--------------------|
| Design | `designScoreData` | `shared/design-subdimension-tree.ts` |
| Implementation | `implementationScoreData` | `shared/implementation-subdimension-tree.ts` |
| Learning & Advancement | `learningAdvancementOutcomeScoreData` | `shared/outcome-subdimension-tree.ts` |
| Wellbeing & Conduct | `wellbeingConductOutcomeScoreData` | `shared/outcome-subdimension-tree.ts` |
| Experience | `experienceScoreData` | `shared/experience-subdimension-tree.ts` (6 fixed Leap IDs) |

> **Conditions** (`ringConditionsScoreData`) is not seeded here — conditions has no measures or flags; it is managed separately through the Conditions editor in the UI.

## Flag verification

Scores are deliberately spread so that after seeding, switching to "Flags" view in Status & Health shows clear excellence and concern flags (2-point delta from the overall dimension score):

| Dimension | Excellence (score 5) | Concern (score 1) |
|-----------|----------------------|-------------------|
| Design | Richness of learner impact | Alignment to context |
| Implementation | Feasibility/sustainability | Fidelity to adult experience |
| L&A Outcomes | ELA proficiency | Performing arts, Physical skills |
| Wellbeing | Mental & physical health | Behavior & attendance |
| Experience | Whole-child focus | Agency |

## Adding a new component

1. Copy `seed-health-scores.ts` to a new file, e.g. `scripts/scores/seed-health-scores-math.ts`.
2. Change the `nodeId` in `storage.updateComponent(...)`.
3. Adjust measures and scores as needed.
4. Add an npm script alias in `package.json`: `"seed:scores:math": "node --env-file=.env --import tsx/esm scripts/scores/seed-health-scores-math.ts"`.

## API: how updates are applied

```ts
await storage.updateComponent("overall", {
  healthData: {
    ...existingHealth,          // preserves any existing healthData keys
    designScoreData: { ... },
    implementationScoreData: { ... },
    learningAdvancementOutcomeScoreData: { ... },
    wellbeingConductOutcomeScoreData: { ... },
    experienceScoreData: { ... },
  },
});
```

The script merges into existing `healthData` so it will not erase conditions or any other keys already stored.

## Persisted rollups (`final*Score` fields)

The **canvas** (Key Drivers diagram, Learning & Wellbeing footers) reads **saved** numbers on `healthData`, not live recalculation from measures. After building `measures` / `subDimensionWeights`, the seeds call `attach-final-scores.ts`, which:

- sets `filter: { mode: "none" }` on each scored bucket (all instance dates count toward rollups), and
- writes `finalDesignScore`, `finalImplementationScore`, `finalExperienceScore`, `finalOutcomeScore` (L&A and Wellbeing), and if `ringConditionsScoreData.conditions` is non-empty, `finalConditionsScore` and `conditionsSum`

using the same `calcFinal*` / `calcOverallOutcomeScore` helpers as the in-app score editors.

## Measure shape reference

```ts
// Outcome-style (L&A, Wellbeing, Experience)
{
  id: string,
  name: string,
  subDimensionIds: string[],   // L2 IDs from the tree files
  importance: "H" | "M" | "L",
  confidence: "H" | "M" | "L",
  type: "measure" | "perception",
  instances: [{ id, actor, score, asOfDate, retired: false }],
  skipped: false,
}

// Design / Implementation style
{
  id: string,
  name: string,
  subDimensionIds: string[],   // top-level or child dimension IDs
  importance: "H" | "M" | "L",
  instances: [{ id, actor, score, asOfDate, retired: false }],
  skipped: false,
}
```
