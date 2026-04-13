/**
 * School-wide learner experience module library catalog.
 * Sourced from Excel "Common components of the learne" (Design tags_updatedv2),
 * with invented secondary tags where the sheet has none (prototype data only).
 */

export type LECatalogSecondary = { id: string; label: string };

export type LECatalogPrimary = {
  id: string;
  label: string;
  /** When empty in Excel, filled with plausible samples for UI testing. */
  secondaries: LECatalogSecondary[];
};

export type LECatalogBucket = {
  id: string;
  /** Short tab label in the module library */
  tabLabel: string;
  /** Full dimension name from design spreadsheet */
  dimensionLabel: string;
  primaries: LECatalogPrimary[];
};

function sec(id: string, label: string): LECatalogSecondary {
  return { id, label };
}

/** Four top-level buckets → tabs in the module library. */
export const LEARNER_EXPERIENCE_CATALOG: LECatalogBucket[] = [
  {
    id: "targeted_outcome",
    tabLabel: "Target outcomes",
    dimensionLabel: "Primary targeted learner outcome",
    primaries: [
      {
        id: "math_exp",
        label: "Math experiences",
        secondaries: [
          sec("math_alg", "Algebra readiness pathway"),
          sec("math_geom", "Geometry & spatial reasoning block"),
          sec("math_data", "Data literacy & statistics lab"),
        ],
      },
      {
        id: "ela_exp",
        label: "ELA experiences",
        secondaries: [
          sec("ela_lit", "Literature circles & discourse"),
          sec("ela_wr", "Writing workshop studio"),
          sec("ela_lang", "Language development intensives"),
        ],
      },
      {
        id: "sci_soc_exp",
        label: "Science & social studies experiences",
        secondaries: [
          sec("ss_int", "Integrated phenomena-based units"),
          sec("ss_civ", "Civic inquiry & action projects"),
          sec("ss_field", "Field-based science investigations"),
        ],
      },
      {
        id: "artistic_exp",
        label: "Artistic experiences",
        secondaries: [
          sec("art_vis", "Visual arts studio"),
          sec("art_perf", "Performance & theatre ensemble"),
          sec("art_mus", "Music composition & ensemble"),
        ],
      },
      {
        id: "wellbeing_exp",
        label: "Wellbeing-focused experiences",
        secondaries: [
          sec("wb_sel", "SEL & advisory integration"),
          sec("wb_mh", "Mental health supports rotation"),
          sec("wb_mind", "Mindfulness & regulation lab"),
        ],
      },
      {
        id: "wayfinding_exp",
        label: "Wayfinding-focused experiences",
        secondaries: [sec("way_college", "College readiness"), sec("way_career", "Career pathway exploration")],
      },
      {
        id: "capstone_syn",
        label: "Capstone/synthesis experiences",
        secondaries: [sec("cap_inter", "Interdisciplinary"), sec("cap_senior", "Senior synthesis defense")],
      },
    ],
  },
  {
    id: "time_block",
    tabLabel: "Time & format",
    dimensionLabel: "Format of the time block",
    primaries: [
      {
        id: "core_acad",
        label: "Core academics courses",
        secondaries: [
          sec("core_block", "90-minute core block"),
          sec("core_rot", "Rotating A/B day schedule"),
          sec("core_int", "Interdisciplinary team-taught core"),
        ],
      },
      {
        id: "electives",
        label: "Electives & extracurriculars",
        secondaries: [
          sec("el_club", "Club & affinity electives"),
          sec("el_comp", "Competition teams block"),
          sec("el_stem", "STEM elective pathways"),
        ],
      },
      {
        id: "advisory",
        label: "Advisory",
        secondaries: [
          sec("adv_loop", "Looping advisory structure"),
          sec("adv_goal", "Goal-setting advisory protocol"),
        ],
      },
      {
        id: "cap_rites",
        label: "Capstones & rites of passage",
        secondaries: [
          sec("rites_mid", "Middle school transition ceremony"),
          sec("rites_grad", "Graduation portfolio defense"),
        ],
      },
      {
        id: "community_gath",
        label: "Community gatherings",
        secondaries: [
          sec("cg_all", "All-school community meeting"),
          sec("cg_celebrate", "Celebration of learning days"),
        ],
      },
      {
        id: "flex_time",
        label: "Flex times",
        secondaries: [
          sec("flex_int", "Intervention flex"),
          sec("flex_enr", "Enrichment flex"),
          sec("flex_off", "Office hours & choice time"),
        ],
      },
    ],
  },
  {
    id: "instructional_practice",
    tabLabel: "Instruction",
    dimensionLabel: "Primary instructional practice",
    primaries: [
      {
        id: "direct_inst",
        label: "Direct instruction",
        secondaries: [
          sec("di_explicit", "Explicit instruction cycles"),
          sec("di_model", "Model–guided–independent release"),
        ],
      },
      {
        id: "pbl",
        label: "Project-based learning",
        secondaries: [
          sec("pbl_pub", "Public product exhibitions"),
          sec("pbl_drv", "Driving question studios"),
        ],
      },
      {
        id: "goal_conf",
        label: "Goal setting & conferencing",
        secondaries: [
          sec("gc_1on1", "1:1 learner conferences"),
          sec("gc_port", "Portfolio reflection cycles"),
        ],
      },
      {
        id: "wbl",
        label: "Work-based learning",
        secondaries: [
          sec("wbl_intern", "Internship placements"),
          sec("wbl_app", "Apprenticeship partnerships"),
        ],
      },
      {
        id: "circles",
        label: "Circles",
        secondaries: [
          sec("circ_rest", "Restorative circles"),
          sec("circ_acad", "Academic dialogue circles"),
        ],
      },
    ],
  },
  /**
   * "Other less common dimensions" — sheet `Common components of the le (2)` rows 20–25:
   * six primary tags in column "Primary tags", secondaries in following columns.
   */
  {
    id: "additional",
    tabLabel: "More dimensions",
    dimensionLabel: "What additional common components do you want to lay out (other less common dimensions)",
    primaries: [
      {
        id: "learners",
        label: "Learners",
        secondaries: [
          sec("ell_exp", "Experiences for ELLs"),
          sec("newcomer", "Newcomer experiences"),
        ],
      },
      {
        id: "facilitator_role",
        label: "Facilitator role",
        secondaries: [
          sec("core_instructional", "Core instructional experiences"),
          sec("mentoring", "Mentoring experiences"),
          sec("career_embedded", "Career-embedded experiences"),
        ],
      },
      {
        id: "partnerships",
        label: "Partnerships",
        secondaries: [
          sec("community_showcase", "Community showcase"),
          sec("sl_ptc", "Student-led parent-teacher conferences"),
        ],
      },
      {
        id: "culture_community",
        label: "Culture & community",
        secondaries: [
          sec("restorative_justice", "Restorative justice experiences"),
          sec("pbis", "PBIS experiences"),
        ],
      },
      {
        id: "infrastructure_operations",
        label: "Infrastructure & operations",
        secondaries: [
          sec("vr_based", "VR-based experiences"),
          sec("nature_based", "Nature-based experiences"),
          sec("home_based", "Home-based experiences"),
          sec("transport_transitions", "Experiences during transportation and transitions"),
        ],
      },
      {
        id: "improvement_design",
        label: "Improvement & design",
        secondaries: [
          sec("youth_codesign", "Youth co-design experiences"),
          sec("ypar", "YPAR experiences"),
        ],
      },
    ],
  },
];

export type LECatalogPick = {
  /** Stable key for selection persistence */
  key: string;
  bucketId: string;
  primaryId: string;
  secondaryId: string;
  /** Title for the new component */
  title: string;
  subtitle: string;
};

export function flattenBucketForFilter(
  bucket: LECatalogBucket,
  primaryIdFilter: string | "all",
): LECatalogPick[] {
  const out: LECatalogPick[] = [];
  for (const p of bucket.primaries) {
    if (primaryIdFilter !== "all" && p.id !== primaryIdFilter) continue;
    for (const s of p.secondaries) {
      out.push({
        key: `${bucket.id}::${p.id}::${s.id}`,
        bucketId: bucket.id,
        primaryId: p.id,
        secondaryId: s.id,
        title: s.label,
        subtitle: `${p.label} · ${bucket.tabLabel}`,
      });
    }
  }
  return out;
}

export function findBucket(bucketId: string): LECatalogBucket | undefined {
  return LEARNER_EXPERIENCE_CATALOG.find((b) => b.id === bucketId);
}

/** Resolve a catalog octagon key to its pick (all buckets / primaries). */
export function getCatalogPickByKey(key: string): LECatalogPick | undefined {
  for (const b of LEARNER_EXPERIENCE_CATALOG) {
    for (const p of flattenBucketForFilter(b, "all")) {
      if (p.key === key) return p;
    }
  }
  return undefined;
}
