# Roots Redesign — Overview & Sequencing

**Date:** 2026-06-04
**Branch:** `redesign/editorial-paper` (single branch → single PR)
**Status:** Design approved at decision level; specs awaiting user review.

## Why

Roots works but **reads as "AI-generated"** — it carries the recognizable AI design stack
(blur blobs, glassmorphism, noise texture, glow animation, dark-charcoal + bright-amber,
Playfair Display). The owner wants it to feel like a **deliberately crafted, minimalist tool
in the spirit of [textarea.my](https://textarea.my)** — zero-frills, honest, human-made — while
keeping Roots' actual concept intact (zero-backend, URL-as-database, passphrase-encrypted).

Two further asks expand the work beyond a reskin:
1. **An easier node create/edit UX** — replace the right-side panel with an in-canvas
   "expand the circle into an editable card" interaction; extras in a modal (mobile-friendly).
2. **A revised layout algorithm** that handles every realistic family-tree case.

Plus a **walkthrough** so first-time users understand the unusual concept and know what to do.

## Scope decisions (from brainstorming)

| Question | Decision |
|---|---|
| "Same concept as textarea.my" | **Aesthetic only** — keep the flow; adopt the stripped-down minimalist style. |
| Visual direction | **Editorial paper** (warm minimal): light warm-paper canvas, serif names + grotesk body, hairlines, one ink accent, generous whitespace. |
| Theme | **Light + dark** toggle (disciplined dark variant of the paper theme). |
| Typography | **Spectral** (display/headings/names) + **Hanken Grotesk** (UI/body). |
| Accent | **Forest / olive** (`oklch(~48% .07 145)`), used sparingly. |
| Walkthrough | **Guided empty-state + contextual hints**, concept explained in an About/How-it-works. |
| Add-relative control | **Directional** "+" affordances around the active node (RTL-mirrored). |
| Inferred relationships | **Slim opt-in toggle chips** on the new card. |
| Layout engine | **Rewrite** as a union-aware layered layout (bespoke, fixture-tested). |
| Delivery | **3 specs/plans, one branch, one PR.** |

## Non-goals (hard constraints — do not touch)

- **Crypto / URL pipeline** (`lib/crypto.ts`, `lib/compression.ts`, `lib/url.ts`) — no behavioral change.
- **Data model** (`types/family.ts`) — no schema change. The ~8 KB URL budget must stay safe;
  unions in sub-project C are **derived at layout time**, never persisted.
- **i18n** — English/Arabic(RTL)/Turkish all keep working; new UI strings go through `lib/i18n.tsx`.
- **Auth flow** — passphrase create/unlock stays; only its presentation changes.

## The three sub-projects

- **[A — Design foundation](2026-06-04-redesign-a-design-foundation.md)** — tokens, fonts,
  light/dark theming, removal of AI tells, restyle of all *non-canvas* chrome, walkthrough copy.
  *Deliberately does not restyle tree nodes* (rebuilt in B).
- **[B — Canvas & interaction](2026-06-04-redesign-b-canvas-interaction.md)** — HTML-over-SVG
  nodes, empty-canvas "+", expand-to-card inline editing, directional affordances, details modal,
  export-time SVG renderer, empty-state + hints walkthrough.
- **[C — Layout algorithm](2026-06-04-redesign-c-layout-algorithm.md)** — union-aware layered
  layout handling all enumerated cases, with a Vitest fixture suite proving invariants.

## Build order (on the one branch)

**A → B → C.**
- A establishes the design language so everything is built in it once.
- B builds the new node component (and its visuals) once, on top of A's tokens.
- C hardens layout correctness last and is verified against B's renderer.

The walkthrough is **not** a fourth project: its concept copy lands in A (passphrase line,
About modal) and its in-canvas pieces (empty state, contextual hints) land in B.

## Implementation method

Each sub-project is implemented with **`/frontend-design:frontend-design`** (to establish a
distinctive, non-generic aesthetic) and **`/impeccable:impeccable`** (craft pass: layout rhythm,
typography, motion, accessibility, and an explicit anti-AI audit). Sub-project C additionally
uses **test-driven development** against the fixture suite.

## Definition of done (whole PR)

- `npm run typecheck`, `npm run build`, and `npx vitest run` all pass.
- No AI tells remain (see A's checklist); design audit (impeccable) clean.
- Light/dark works with no flash-of-wrong-theme; contrast meets WCAG AA.
- New create/edit UX works on desktop **and** mobile, in LTR **and** Arabic RTL.
- Every enumerated family-tree case (see C) renders with all members visible and no overlaps.
- Export (JSON/PNG/SVG), import, undo/redo, search, and share all still work.
