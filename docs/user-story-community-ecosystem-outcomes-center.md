# User story: Community & ecosystem outcomes (center / overall)

**Scope:** This capability exists only on the **center (overall) Designed Experience** component. There is **no Data Preview Window** or ring-component mirror for this flow; it is school-wide context only.

**Visual reference (target UX):** A two-level pattern—**(Level 3)** a list titled **Community & Ecosystem Outcomes** with each outcome row showing a compact **status** (e.g. On track / Off track), and **(Level 4)** a drill-down for a single outcome with a **description**, plus **Current** and **Target** values so status can be derived. Breadcrumb-style navigation should reflect list → detail. (See product mockup: center component wireframe with Enrollment / Staff retention / Caregiver satisfaction examples.)

---

As a **school leader or design partner**,

I want to **capture and refine community- and ecosystem-level outcomes for the whole school** (including optional narrative, default and custom metrics, evidence, and current vs. target performance),

So that **I can see at a glance how the school is doing on enrollment, staff retention, caregiver satisfaction, and other community-facing signals—and drill into details when I need to adjust goals or evidence**.

---

## User needs

The experience should support:

- **Plain-language intent:** A place to describe community/ecosystem outcomes in everyday language (typed or spoken), with room for a future flow that suggests structured outcomes from that text (not required for v1 beyond capturing the text).
- **Choosing outcomes:** A clear set of **common community and ecosystem outcomes** (starter list) plus the ability to **add custom** outcome labels, without extra chrome separating “common” from “custom add” in the layout.
- **Managing the selected set:** For each selected outcome—**remove** (with confirmation), **upload or replace an optional artifact**, and **open manage details** for richer fields.
- **Detail (drill-down):** For each outcome, **description**, **metric unit** (e.g. number vs. percent), **current value**, **target value**, and a **status** summary consistent with current vs. target (e.g. On track / Off track / Set targets when incomplete).
- **Persistence:** Selections, plain-language text, details, and artifacts **save with the center component’s Designed Experience data** so they survive reload and share context across sessions.

---

## Out of scope (explicit)

- **Data Preview Window** or any ring-component replication of this module.
- **Automated outcome generation** from plain-language text (placeholder UX only until a generation flow is defined).

---

## Acceptance (lite)

- From the **overall** Designed Experience, a user can open **manage** for community & ecosystem outcomes, enter **plain-language** text, toggle **common** outcomes, **add custom** outcomes in the same container as the common list, and see **selected** rows with **artifact**, **manage details**, and **remove**.
- **Manage details** exposes description, unit, current/target, status behavior, and artifact consistent with the **Level 4** mockup intent.
- **Removing** an outcome requires **confirmation** and clears associated detail and artifact for that row.
- Saved data **loads correctly** when reopening the center component (outcomes list, plain text, details, artifacts).
