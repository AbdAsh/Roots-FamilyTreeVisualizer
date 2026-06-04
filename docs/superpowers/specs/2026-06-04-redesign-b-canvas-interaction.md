# Sub-project B — Canvas & Node Interaction

**Date:** 2026-06-04 · **Branch:** `redesign/editorial-paper` · Part of the [redesign overview](2026-06-04-redesign-overview.md).

## Goal

Replace the right-side panel editing flow with an **in-canvas, expand-to-card** interaction that's
fast and mobile-friendly: click a node and it grows into an inline-editable card; add relatives via
**directional "+" affordances**; put full/extra details in a **centered modal**, not a side panel.
Start from an **empty canvas with a single "+"** instead of a pre-seeded root.

## Architecture change — HTML-over-SVG nodes

Re-architect `FamilyTreeView`:
- A single transform container (the existing `translate/scale` pan-zoom) holds **two layers**:
  1. **SVG links layer** — paths (parent-child / spouse / sibling / reference), as today but
     ink-toned per A.
  2. **HTML nodes layer** — each node is an absolutely-positioned HTML element at
     `(x, y)` from the layout (`PositionedNode`). Scales with the container transform.
- Rationale: HTML nodes hold inputs, animate via Framer Motion `layout`, expose real focus/tab/ARIA,
  and give ≥44px touch targets. Pan/zoom math is unchanged (still manual transform refs).
- **Hit-testing/pan:** dragging the canvas pans; pointer-down on a node/card/affordance does not pan
  (preserve the current `.closest('.tree-node')` guard, adapted to the HTML node root class).

## The node — three states (new `NodeCard` component)

1. **Compact** (default): small rounded chip — avatar/initials (Spectral initials), name, birth–death
   years. Click/Enter → Active. Keyboard focusable.
2. **Active** (selected): morphs (Framer Motion `layout`) into a card containing:
   - **Name** — inline-editable text field (autosaves on blur/Enter via `updateMember`).
   - **Gender** — compact segmented control (♀ ♂ ⚲ / unknown).
   - **Birth–death years** — compact inline (full dates live in the modal).
   - **"More details"** button → opens `DetailsModal`.
   - **Directional add affordances** (see below).
   - Click-away / Esc → collapse to Compact.
3. **New** (adding): a card in creation mode spawned by an affordance or the empty-canvas "+".
   Name auto-focused; **Enter / ✓ commits** (creates the member + wires the relationship +
   any enabled inferred links), **Esc / ✕ cancels** and the card shrinks away. Shows the
   **slim inferred-link chips** (below).

The Active and New cards render at the node's transformed position on **desktop**. On **mobile**
(narrow viewport), they present as a **centered card with a light scrim** so they're never cramped
or off-screen.

## Adding relatives — directional affordances

When a node is Active, four quiet "+" targets appear positioned so **direction encodes the relationship**:

```
              (+ Parent)        ↑ above
                  |
 (+ Sibling) — [ CARD ] — (+ Partner)   ← start-side / end-side →
                  |
              (+ Child)         ↓ below
```

- Mapping: **Parent = top, Child = bottom, Partner = inline-end, Sibling = inline-start.**
- **RTL:** Partner/Sibling sides mirror (use logical inline-start/end so Arabic flips correctly).
- Clicking an affordance spawns a **New** card on that side, relationship pre-wired:
  parent → `addRelationship('parent-child', new, target)`; child → `('parent-child', target, new)`;
  partner → `('spouse', target, new)`; sibling → `('sibling', target, new)`.
- On mobile, affordances render as a labeled row beneath the card (`+Parent +Child +Partner +Sibling`).

## Inferred links — slim opt-in chips

Reuse `getInferredRelationships()`. On the **New** card, render the suggestions as small **toggle
chips** (default ON), e.g. "Also child of Maria", "Sibling of Omar". The user can toggle any off
before committing. On commit, create the primary relationship + each enabled inferred relationship
(the existing `AddRelativeForm` logic, relocated into `NodeCard`). This replaces the modal checklist.

## Full details — `DetailsModal` (new), retire the side panel

- "More details" opens a **centered modal** (built on A's `Modal`; **full-height sheet on mobile**)
  containing:
  - The complete member form (today's `MemberForm`: name, gender, birth/death dates, photo URL,
    location, occupation, bio, custom fields) — keep autosave-on-change.
  - **Relationship management** — the list currently in `EditPanel` (parents/partner/children/
    siblings with navigate + remove-relationship), restyled.
  - **Delete member** action (with `ConfirmModal`).
- **Retire** `AddModal`, `AddRelativeForm`, `EditPanel`, and the `Panel` primitive. Their logic moves
  into `NodeCard` (create/quick-edit + inferred chips) and `DetailsModal` (full edit + relationships).

## Empty canvas & first person

- `initTree(name)` in `useTree.ts` no longer seeds "Root Person". It creates a tree with
  **`members: []`, `relationships: []`, `rootMemberId: ''`** (+ name/timestamps).
- `FamilyTreeView` empty state: a single centered **"+"** with a one-line prompt
  (*"Add the first person — usually you"*, localized). Clicking it spawns a **New** card.
  On commit, the created member becomes `rootMemberId`.
- `computeTieredLayout` must handle 0 members (return `null` → empty state) — already does for empty,
  but verify the new "no root yet" path.
- Validation: confirm `FamilyTreeSchema` (Zod) permits an empty members array / empty rootMemberId
  for a freshly created tree, or set root on first commit before any save. (Saving an empty tree to
  the URL is fine; loading it shows the empty "+" state.)

## Store changes (`useTree.ts`)

- `initTree` → empty (above).
- Selection model: keep `selectedMemberId` as the Active node. **Retire** `isEditing` /
  `addingForMemberId` (panel/modal-trigger flags) in favor of: `selectedMemberId` (active card) +
  local `NodeCard` "new" state + a `detailsForMemberId`-style flag for the modal. Update all readers
  (`App.tsx`, `FamilyTreeView`, `useKeyboardShortcuts`, `PassphraseScreen` which calls `setEditing`).
- Add a small helper for "create member + relationship + enabled inferred links" if it simplifies
  `NodeCard` (or reuse `addRelative` + loop as today).
- Preserve `pushSnapshot` undo semantics for every mutation; a single "add relative" (member + rels)
  should ideally be **one undo step** — batch the snapshot so undo removes the whole add at once
  (today it snapshots per-call, producing multiple undo steps; improve to one).

## Export under HTML nodes (must-fix)

The current PNG/SVG export (`ExportImportBar.buildExportClone`) clones the live `#tree-svg` — with
HTML nodes it would export links only, and it hardcodes Playfair/DM Sans, `#1a1a1a`, and
amber/wine/sage links. Replace with an **export-time SVG renderer**:
- A pure function `renderTreeSvg(layout, theme): string` that emits a self-contained SVG (nodes as
  SVG `<g>` + text, links as paths) from `PositionedNode`/`PositionedLink`, using **A's theme tokens**
  (Spectral/Hanken, paper/ink, forest accent, ink links). No live-DOM cloning, no CSS-var resolution hacks.
- PNG export rasterizes that SVG string (keep the data-URI → `<img>` → canvas 2× approach).
- This also future-proofs export against B's HTML refactor and C's reference links.

## Keyboard shortcuts (`useKeyboardShortcuts.ts`)

Rework for the new model:
- **Esc:** cancel a New card → else close `DetailsModal` → else deselect Active node → else blur search.
- **Enter** on a focused compact node → Active; on a New card → commit.
- Delete/Backspace on selected → delete (unchanged, still via `ConfirmModal`).
- Undo/redo, focus-search (⌘K / `/`) unchanged.
- Remove references to `setEditing` / `setAddingFor`.

## Walkthrough (B's portion)

- **Empty state** prompt (above).
- **Contextual hints** — one line, near the relevant control, dismissible, remembered in
  `localStorage` (per-hint keys under `roots-tour`):
  1. After first person exists: *"Tap a person, then use + to add parents, a partner, children, or siblings."*
  2. When ≥2 members: *"Share copies a link — anyone with it and the passphrase can view and edit."*
- Calm, paper-styled, never modal/intrusive. Honors reduced-motion.

## Mobile & a11y

- Active/New card centered with scrim on narrow viewports; affordances become a labeled row.
- `DetailsModal` is a full-height sheet on mobile.
- All interactive targets ≥ 44px; visible focus rings; ARIA labels on icon-only controls;
  card uses a dialog/region role as appropriate; respect `prefers-reduced-motion` for the
  expand/morph animations.

## Preserved (no behavior change)

Undo/redo, autosave (`useSave`), search dimming, export/import, share, i18n (en/ar/tr) incl. **RTL**,
and all crypto/URL behavior.

## Implementation method

`/frontend-design:frontend-design` for the `NodeCard`/`DetailsModal` aesthetic and the expand
interaction; `/impeccable:impeccable` (`animate`, `adapt`, `harden`, `audit`) for motion polish,
responsive behavior, edge cases (long names, many relatives, overflow), and accessibility.

## Success criteria

- Land on a new tree → empty canvas with one "+"; commit the first person → it becomes root.
- Click a node → it expands in place (desktop) / centered (mobile) into an editable card.
- Directional affordances add the correct relationship; inferred chips work; RTL mirrors correctly.
- "More details" opens the modal with full fields + relationship management + delete; no right panel anywhere.
- One "add relative" = one undo step.
- Export PNG/SVG shows nodes **and** links, themed correctly, in light and dark.
- Keyboard model works; ≥44px targets; reduced-motion respected.
- `npm run typecheck` + `npm run build` pass.
