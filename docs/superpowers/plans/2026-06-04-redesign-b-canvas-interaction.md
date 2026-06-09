# Redesign B — Canvas & Node Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right-side panel editing flow with in-canvas expand-to-card editing (compact → active → new states), directional add-relative affordances, and a centered details modal; start from an empty canvas with a single "+"; keep export/undo/search/i18n/RTL working.

**Architecture:** `FamilyTreeView` renders two layers inside the existing pan/zoom transform: an SVG **links** layer and an HTML **nodes** layer (absolutely-positioned `NodeCard`s at layout coordinates). Editing happens inline in the `NodeCard`; full details + relationship management move to a `DetailsModal`. The Zustand store starts trees empty and the first committed member becomes the root. Export no longer clones the live DOM — a pure `renderTreeSvg(layout, …)` emits a themed SVG.

**Tech Stack:** React 19, TypeScript, Zustand, Framer Motion (`layout` animations), Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-04-redesign-b-canvas-interaction.md`
**Prereq:** Plan A merged on this branch (tokens, `useTheme`, restyled primitives, `--tree-*` vars).
**Branch:** `redesign/editorial-paper`.

---

## File map

- Modify: `src/hooks/useTree.ts` — empty `initTree`; first-member-becomes-root; one-snapshot batch add; selection model (retire `isEditing`/`addingForMemberId`, add `detailsForId`).
- Modify: `src/lib/validation.ts` — allow empty `members` + empty `rootMemberId` for a fresh tree.
- Rewrite: `src/components/tree/FamilyTreeView.tsx` — HTML-over-SVG layers; pan/zoom retained; empty-state "+"; renders `NodeCard`s + `EdgeLayer`.
- Create: `src/components/tree/NodeCard.tsx` — compact/active/new states, inline edit, gender control, affordances, inferred chips.
- Create: `src/components/tree/EdgeLayer.tsx` — SVG links (primary + reference), extracted from old `FamilyTreeView`.
- Create: `src/components/tree/AddAffordances.tsx` — directional "+" controls (RTL-aware).
- Create: `src/components/editor/DetailsModal.tsx` — full `MemberForm` + relationship management + delete.
- Create: `src/lib/tree-export.ts` — pure `renderTreeSvg(...)` for PNG/SVG export.
- Modify: `src/components/ui/ExportImportBar.tsx` — use `renderTreeSvg`; drop `buildExportClone` DOM hacks.
- Modify: `src/hooks/useKeyboardShortcuts.ts` — new Esc/Enter/Delete model.
- Modify: `src/app/App.tsx` — render `DetailsModal`; drop `EditPanel`/`AddModal`; update store reads.
- Modify: `src/components/ui/PassphraseScreen.tsx` — `initTree` no longer auto-edits (remove `setEditing` reliance).
- Modify: `src/lib/i18n.tsx` — add keys: `app.firstPersonPrompt`, `hints.addRelatives`, `hints.share`, affordance labels.
- Delete: `src/components/editor/AddModal.tsx`, `src/components/editor/AddRelativeForm.tsx`, `src/components/editor/EditPanel.tsx`, `src/components/ui/Panel.tsx` (after their logic is relocated).

---

## Task B1: Store — empty tree, root-on-first, batched add, selection model

**Files:** Modify `src/hooks/useTree.ts`.

- [ ] **Step 1: Empty `initTree`.** Replace the body so it creates an empty tree and does not seed a member or open an editor:

```ts
initTree: (name: string) => {
  const tree: FamilyTree = {
    id: nanoid(10),
    name,
    members: [],
    relationships: [],
    rootMemberId: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  set({ tree, selectedMemberId: null, _past: [], _future: [] });
  return tree;
},
```

- [ ] **Step 2: First member becomes root.** In `addMember`, set `rootMemberId` when the tree was empty:

```ts
addMember: (memberData) => {
  const member: FamilyMember = { ...memberData, id: nanoid(10) };
  set((state) => {
    if (!state.tree) return state;
    const isFirst = state.tree.members.length === 0;
    return {
      ...pushSnapshot(state),
      tree: {
        ...state.tree,
        members: [...state.tree.members, member],
        rootMemberId: isFirst ? member.id : state.tree.rootMemberId,
        updatedAt: new Date().toISOString(),
      },
    };
  });
  return member;
},
```

- [ ] **Step 3: One-undo-step batch add.** Add a store action that creates the member + primary relationship + enabled inferred links under a **single** snapshot. Add to the interface and implementation:

```ts
// interface
addRelativeBatch: (
  relativeTo: string,
  relType: 'parent' | 'child' | 'spouse' | 'sibling',
  member: Omit<FamilyMember, 'id'>,
  inferred: { type: RelationshipType; from: string; to: string }[],
) => FamilyMember;

// implementation
addRelativeBatch: (relativeTo, relType, memberData, inferred) => {
  const member: FamilyMember = { ...memberData, id: nanoid(10) };
  set((state) => {
    if (!state.tree) return state;
    const rels = [...state.tree.relationships];
    const add = (type: RelationshipType, from: string, to: string) => {
      if (!hasDuplicate(rels, type, from, to)) {
        rels.push({ id: nanoid(10), type, from, to });
      }
    };
    // primary
    if (relType === 'parent') add('parent-child', member.id, relativeTo);
    else if (relType === 'child') add('parent-child', relativeTo, member.id);
    else if (relType === 'spouse') add('spouse', relativeTo, member.id);
    else add('sibling', relativeTo, member.id);
    // inferred (already resolved to concrete {type, from, to} by the caller,
    // substituting the new member id where needed)
    for (const r of inferred) add(r.type, r.from, r.to);
    return {
      ...pushSnapshot(state),
      tree: {
        ...state.tree,
        members: [...state.tree.members, member],
        relationships: rels,
        updatedAt: new Date().toISOString(),
      },
    };
  });
  return member;
},
```

- [ ] **Step 4: Selection model.** Replace `isEditing` / `addingForMemberId` with `detailsForId`:
  - In `TreeState`: remove `isEditing` and `addingForMemberId`; add `detailsForId: string | null`.
  - Replace `setEditing`/`setAddingFor` with `openDetails: (id: string | null) => void` (sets `detailsForId`).
  - `selectMember(id)` only sets `selectedMemberId` (the active card); it no longer opens a panel.
  - `removeMember`: when deleting the selected member, also clear `detailsForId` if it pointed at it.

- [ ] **Step 5: Typecheck reveals all readers.** Run `npm run typecheck`. Expected failures in `App.tsx`, `FamilyTreeView.tsx`, `useKeyboardShortcuts.ts`, `PassphraseScreen.tsx`, `AddRelativeForm.tsx`, `EditPanel.tsx` referencing the removed fields. These are fixed in later tasks (and deleted files). For now, ensure `useTree.ts` itself typechecks in isolation by completing the interface.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTree.ts
git commit -m "feat(b): empty initTree, root-on-first-member, batched add, detailsForId selection model"
```

---

## Task B2: Validation allows an empty fresh tree

**Files:** Modify `src/lib/validation.ts`.

- [ ] **Step 1: Inspect** `FamilyTreeSchema`. Ensure `members` is `z.array(FamilyMemberSchema)` with **no `.min(1)`**, and `rootMemberId` is `z.string()` (allowing `''`). If either constrains non-empty, relax it. Keep import validation strict for *non-empty* trees by validating that, when `members.length > 0`, `rootMemberId` matches a member id (use `.refine`):

```ts
export const FamilyTreeSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(FamilyMemberSchema),
  relationships: z.array(RelationshipSchema),
  rootMemberId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).refine(
  (t) => t.members.length === 0 || t.members.some((m) => m.id === t.rootMemberId),
  { message: 'rootMemberId must reference an existing member', path: ['rootMemberId'] },
);
```

- [ ] **Step 2: Verify** save/load of a freshly created (empty) tree round-trips: create a tree, don't add anyone, reload — the empty "+" state appears (after B3). For now confirm `npm run typecheck` passes for `validation.ts`.
- [ ] **Step 3: Commit**

```bash
git add src/lib/validation.ts
git commit -m "feat(b): allow empty/rootless fresh tree in schema, guard non-empty"
```

---

## Task B3: Canvas refactor to HTML-over-SVG + empty state

**Files:** Rewrite `src/components/tree/FamilyTreeView.tsx`; create `src/components/tree/EdgeLayer.tsx`.

- [ ] **Step 1: Extract `EdgeLayer`.** Move the links rendering (the `linkPath`, `sibArcH`, `badgePos`, `linkCls` helpers and the `<g className="links-layer">` markup) into `EdgeLayer.tsx`, which takes `links: PositionedLink[]` and renders an `<svg>` sized to the layout bounds. Draw `kind === 'reference'` links with the `--tree-link-ref` color + a distinct dash (C adds the `kind` field; until then treat all as primary). Remove the old relationship `LinkBadge` glyphs (the editorial style relies on line dash/weight, not amber/wine/sage badge circles) — or restyle badges to a single quiet ink glyph if kept. Recommended: drop badges.

- [ ] **Step 2: New container structure.** Rewrite the render tree so the transform is applied to an **HTML** `.tree-root` div (not an SVG `<g>`):

```tsx
<div ref={containerRef} className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
     onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
     onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
  <div className="tree-root absolute left-0 top-0 origin-top-left will-change-transform">
    {/* Links: absolutely positioned SVG, overflow visible, behind nodes */}
    <EdgeLayer links={layoutData.links} bounds={bounds} />
    {/* Nodes: HTML cards at layout coords */}
    {layoutData.nodes.map((n) => (
      <div key={n.id} className="tree-node absolute" style={{ left: n.x, top: n.y, transform: 'translate(-50%,-50%)' }}>
        <NodeCard node={n} searchQuery={searchQuery} />
      </div>
    ))}
  </div>
  {/* zoom controls unchanged (restyled per A tokens) */}
</div>
```

- [ ] **Step 3: `applyTransform` targets the HTML root.** Change the selector from the SVG `.tree-root` group to the HTML `.tree-root` div and keep `transform: translate(x,y) scale(k)`:

```ts
const applyTransform = useCallback(() => {
  const g = containerRef.current?.querySelector('.tree-root') as HTMLElement | null;
  if (!g) return;
  const { x, y, k } = transformRef.current;
  g.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
}, []);
```

- [ ] **Step 4: Pointer events.** Replace mouse handlers with pointer handlers (better touch). Pan when the pointer-down target is **not** inside `.tree-node` (keep the `closest('.tree-node')` guard). Keep wheel-zoom and the FIT/zoom buttons. Pinch-zoom on touch is optional (note as a follow-up if time-boxed).

- [ ] **Step 5: Empty state.** When `tree.members.length === 0`, render a centered button instead of the canvas content:

```tsx
<div className="flex-1 flex items-center justify-center">
  <button onClick={startFirstPerson} aria-label={strings.app.firstPersonPrompt}
    className="group flex flex-col items-center gap-3 cursor-pointer">
    <span className="w-16 h-16 rounded-full border border-charcoal-lighter grid place-items-center text-2xl text-amber group-hover:border-amber transition-colors">+</span>
    <span className="font-body text-sm text-cream/50">{strings.app.firstPersonPrompt}</span>
  </button>
</div>
```
`startFirstPerson` sets local state that renders a **New** `NodeCard` (no `relativeTo`) centered; committing calls `addMember` (which sets root).

- [ ] **Step 6: `bounds` helper.** Compute layout bounds (min/max x,y over nodes, with padding) for sizing `EdgeLayer`'s SVG and the existing `fitToView`. Keep `fitToView`/`memberCount` effect.

- [ ] **Step 7: Verify** — `npm run dev`: with the old layout still feeding positions, nodes now render as plain HTML boxes (unstyled until B4) and links render as ink paths; pan/zoom/fit work; an empty tree shows the centered "+".

- [ ] **Step 8: Commit**

```bash
git add src/components/tree/FamilyTreeView.tsx src/components/tree/EdgeLayer.tsx
git commit -m "feat(b): HTML-over-SVG canvas, pointer pan/zoom, empty-state +"
```

---

## Task B4: `NodeCard` — compact/active/new states (frontend-design + impeccable)

**Files:** Create `src/components/tree/NodeCard.tsx`, `src/components/tree/AddAffordances.tsx`.

- [ ] **Step 1: Define the component contract** (write this skeleton first so types are fixed):

```tsx
interface NodeCardProps {
  node: PositionedNode;          // when new: a synthetic node with empty member
  searchQuery?: string;
  mode?: 'existing' | 'new';     // 'new' for the add/first-person flow
  relativeTo?: string;           // target member for a new relative; undefined = first person
  newRelType?: 'parent' | 'child' | 'spouse' | 'sibling';
  onCommitted?: (id: string) => void;
  onCancel?: () => void;
}
```
State machine (existing mode): `compact` (default) ↔ `active` (when `selectedMemberId === node.id`). Clicking the card calls `selectMember(node.id)`. New mode renders the editing card directly.

- [ ] **Step 2: Invoke `/frontend-design:frontend-design`** to build the three visual states with these **hard requirements**:
  - **Compact:** small rounded paper chip, hairline border, Spectral initials/avatar, Hanken name + years; quiet gender tint via `--tree-*`/avatar (ink-leaning, not saturated RGBA); selection = accent hairline ring (no glow).
  - **Active:** Framer Motion `layout` morph from chip → card; inline-editable name (autosave on blur/Enter → `updateMember`), gender segmented control, compact birth–death years, a "More details" button (→ `openDetails(node.id)`), and `<AddAffordances>`.
  - **New:** same card in creation mode; name `autoFocus`; Enter/✓ commits, Esc/✕ cancels; renders inferred-link chips (B5).
  - Tokens only; no glass/blur/glow/gradient; respect `prefers-reduced-motion` (skip morph, fade instead).
- [ ] **Step 3: Wire existing-mode behavior** — click → `selectMember`; click-away (a container-level handler or `onPointerDown` outside) → `selectMember(null)`; name edits call `updateMember`; "More details" calls `openDetails`.
- [ ] **Step 4: Invoke `/impeccable:harden`** for long names, missing data (no dates/photo), very small/large zoom, and overflow.
- [ ] **Step 5: Verify** — clicking nodes expands them in place; editing the name persists and re-saves to the URL (watch the save status); collapse works.
- [ ] **Step 6: Commit**

```bash
git add src/components/tree/NodeCard.tsx src/components/tree/AddAffordances.tsx
git commit -m "feat(b): NodeCard compact/active/new states with inline edit"
```

---

## Task B5: Directional affordances + inferred-link chips

**Files:** `src/components/tree/AddAffordances.tsx`, `NodeCard.tsx`, `src/lib/i18n.tsx`.

- [ ] **Step 1: Affordance layout.** In `AddAffordances`, render four "+" targets positioned around the active card: **Parent = top, Child = bottom, Partner = inline-end, Sibling = inline-start.** Use logical properties (`inset-inline-start/end`) so Arabic RTL mirrors automatically. Each has an `aria-label` (localized). On small viewports, render a labeled row (`+Parent +Child +Partner +Sibling`) beneath the card instead.

- [ ] **Step 2: Spawn the new card.** Clicking an affordance opens a **New** `NodeCard` with `relativeTo = node.id`, `newRelType = <relation>`, positioned on that side (or centered+scrim on mobile). Manage this via local state in `FamilyTreeView` (a single "draft" descriptor: `{ relativeTo, relType }` or `'first-person'`).

- [ ] **Step 3: Inferred chips.** In the New card, compute `getInferredRelationships(relativeTo, relType, tree)`; render each as a small toggle chip (default ON), label via `strings.addRelative[labelType]`. On commit, resolve enabled suggestions to concrete `{type, from, to}` (substituting the new member id where `newMemberIsFrom`) and call `addRelativeBatch(relativeTo, relType, memberData, resolved)`; then `selectMember(newId)` and `onCommitted`. (First-person commit has no `relativeTo`: call `addMember` only.)

- [ ] **Step 4: i18n keys.** Add `app.firstPersonPrompt` ("Add the first person — usually you" + ar/tr), and affordance labels (`addRelative.parent/child/spouseLabel/sibling` already exist — reuse).

- [ ] **Step 5: Verify** — add a parent/child/partner/sibling from a node; relationships are correct; inferred chips create the expected extra links; one undo removes the whole add; RTL mirrors the affordance sides.

- [ ] **Step 6: Commit**

```bash
git add src/components/tree/AddAffordances.tsx src/components/tree/NodeCard.tsx src/lib/i18n.tsx
git commit -m "feat(b): directional add affordances + inferred-link chips (RTL-aware, 1-undo)"
```

---

## Task B6: `DetailsModal` + retire the side panel

**Files:** Create `src/components/editor/DetailsModal.tsx`; modify `App.tsx`; delete `EditPanel.tsx`, `AddModal.tsx`, `AddRelativeForm.tsx`, `ui/Panel.tsx`.

- [ ] **Step 1: Build `DetailsModal`** on the A-restyled `Modal`. Open when `detailsForId` is set. Contents:
  - `<MemberForm member={member} />` (unchanged logic — full fields, autosave).
  - **Relationship management** — move the parents/partner/children/siblings list (with navigate + remove-relationship + `ConfirmModal`) out of `EditPanel` into this modal, restyled with tokens.
  - **Delete member** button (→ existing delete `ConfirmModal` flow).
  - On mobile: full-height sheet (Modal variant or responsive classes).
- [ ] **Step 2: Wire into `App.tsx`** — render `<DetailsModal />`; remove `<EditPanel />` and `<AddModal />`; update store reads (`openDetails`, `detailsForId`); keep the keyboard-delete `ConfirmModal`.
- [ ] **Step 3: Delete** `EditPanel.tsx`, `AddModal.tsx`, `AddRelativeForm.tsx`, `ui/Panel.tsx`. Run `npm run typecheck` and fix every remaining importer.
- [ ] **Step 4: Verify** — "More details" opens the modal; full editing + relationship add/remove/navigate + delete work; no right-side panel exists anywhere; mobile shows a sheet.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(b): DetailsModal (full edit + relationships + delete); retire side panel"
```

---

## Task B7: Export via pure SVG renderer

**Files:** Create `src/lib/tree-export.ts`; modify `src/components/ui/ExportImportBar.tsx`.

- [ ] **Step 1: Write `renderTreeSvg`** — a pure function building a self-contained, themed SVG from layout data (no live DOM):

```ts
import type { TieredLayout, PositionedNode, PositionedLink } from '@/lib/tree-utils';

interface ExportTheme {
  bg: string; ink: string; inkDim: string; surface: string;
  hairline: string; accent: string; link: string; linkRef: string;
  fontDisplay: string; fontBody: string;
}

const NODE_R = 28;

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c]!));
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function linkD(l: PositionedLink): string {
  const { source: s, target: t, type } = l;
  if (type === 'parent-child') { const my = (s.y + t.y) / 2; return `M${s.x},${s.y} C${s.x},${my} ${t.x},${my} ${t.x},${t.y}`; }
  if (type === 'sibling') { const h = Math.max(30, Math.min(60, Math.abs(t.x - s.x) * 0.2)); return `M${s.x},${s.y} Q${(s.x + t.x) / 2},${s.y - h} ${t.x},${t.y}`; }
  return `M${s.x},${s.y} L${t.x},${t.y}`;
}

export function renderTreeSvg(layout: TieredLayout, theme: ExportTheme): { svg: string; width: number; height: number } {
  const pad = 60;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of layout.nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
  x0 -= NODE_R + pad; x1 += NODE_R + pad; y0 -= NODE_R + pad; y1 += NODE_R + pad;
  const w = x1 - x0, h = y1 - y0;

  const links = layout.links.map((l) => {
    const dash = l.type === 'spouse' ? ' stroke-dasharray="5 4"' : l.type === 'sibling' ? ' stroke-dasharray="1.5 3"' : '';
    const ref = (l as PositionedLink & { kind?: string }).kind === 'reference';
    const stroke = ref ? theme.linkRef : theme.link;
    const refDash = ref ? ' stroke-dasharray="2 4"' : dash;
    return `<path d="${linkD(l)}" fill="none" stroke="${stroke}" stroke-width="${l.type === 'sibling' ? 1 : 1.4}"${refDash} opacity="0.8"/>`;
  }).join('');

  const nodes = layout.nodes.map((n: PositionedNode) => {
    const yrs = (n.member.birthDate || n.member.deathDate)
      ? `<text x="${n.x}" y="${n.y + NODE_R + 26}" text-anchor="middle" font-family="${theme.fontBody}" font-size="8" fill="${theme.inkDim}">${esc((n.member.birthDate?.slice(0,4) ?? '?'))} — ${esc(n.member.deathDate?.slice(0,4) ?? '')}</text>` : '';
    return `<g>
<circle cx="${n.x}" cy="${n.y}" r="${NODE_R}" fill="${theme.surface}" stroke="${theme.hairline}" stroke-width="1.4"/>
<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central" font-family="${theme.fontDisplay}" font-size="13" font-weight="600" fill="${theme.ink}">${esc(initials(n.member.name))}</text>
<text x="${n.x}" y="${n.y + NODE_R + 14}" text-anchor="middle" font-family="${theme.fontBody}" font-size="10" fill="${theme.ink}">${esc(n.member.name.length > 16 ? n.member.name.slice(0,15) + '…' : n.member.name)}</text>
${yrs}
</g>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}">
<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${theme.bg}"/>
${links}
${nodes}
</svg>`;
  return { svg, width: w, height: h };
}
```

- [ ] **Step 2: Add a theme reader** in `ExportImportBar` that resolves the current `--color-*`/`--tree-*`/`--font-*` vars from `getComputedStyle(document.documentElement)` into an `ExportTheme`, then calls `renderTreeSvg(computeTieredLayout(tree)!, theme)`. Replace `buildExportClone` and update `handleExportSvg`/`handleExportPng` to use the returned `svg`/`width`/`height` (keep the data-URI → `<img>` → canvas 2× path for PNG).

- [ ] **Step 3: Delete `buildExportClone`** and its CSS-var/font hardcoding.

- [ ] **Step 4: Verify** — export PNG and SVG in both light and dark; the file shows **nodes and links**, themed correctly (paper/ink in light, ink-on-dark in dark), Spectral initials, Hanken labels. JSON export/import unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tree-export.ts src/components/ui/ExportImportBar.tsx
git commit -m "feat(b): themed export via pure renderTreeSvg (no DOM cloning)"
```

---

## Task B8: Keyboard shortcuts + walkthrough hints + final B verification

**Files:** Modify `src/hooks/useKeyboardShortcuts.ts`, `src/app/App.tsx`, `src/lib/i18n.tsx`; create a small `src/components/ui/HintBar.tsx`.

- [ ] **Step 1: Rework shortcuts** for the new model:

```ts
// Esc precedence: cancel draft card → close details modal → deselect node → blur search
if (e.key === 'Escape') {
  if (onCancelDraft?.()) return;          // returns true if a draft was open
  if (detailsForId) { openDetails(null); return; }
  if (selectedMemberId) { selectMember(null); return; }
  if (document.activeElement === searchInputRef.current) searchInputRef.current?.blur();
  return;
}
```
Keep undo/redo, focus-search (⌘K / `/`), Delete/Backspace-to-delete. Remove all `setEditing`/`setAddingFor` references; read `detailsForId`/`openDetails` from the store; thread an `onCancelDraft` callback from `App`/`FamilyTreeView` for the open draft card.

- [ ] **Step 2: `HintBar`** — a bottom-center, dismissible, paper-styled hint. Show hint 1 (`hints.addRelatives`) when `members.length >= 1` and not dismissed (`localStorage["roots-tour.addRelatives"]`); hint 2 (`hints.share`) when `members.length >= 2` and not dismissed (`roots-tour.share`). One at a time; respect `prefers-reduced-motion`. Add i18n keys (en/ar/tr):
  - `hints.addRelatives`: "Tap a person, then use + to add parents, a partner, children, or siblings."
  - `hints.share`: "Share copies a link — anyone with it and the passphrase can view and edit."
- [ ] **Step 3: Render `HintBar` in `App.tsx`** (replaces the old single member-count hint pill).
- [ ] **Step 4: Fix `PassphraseScreen`** — it must not call the removed `setEditing`; after `initTree` the user lands on the empty "+" canvas. Remove the `setEditing(true)` reliance.
- [ ] **Step 5: Full verification of B**
  - `npm run typecheck && npm run build` pass; no references to deleted files/fields.
  - New tree → empty "+" → first person becomes root.
  - Click node → inline card; edit name persists; More details → modal (full edit + relationships + delete).
  - Affordances add correct relations; inferred chips work; 1 undo per add.
  - Export PNG/SVG themed, nodes+links, light+dark.
  - Search dimming, undo/redo, share all work; Arabic RTL mirrors; mobile shows centered card + sheet; ≥44px targets; reduced-motion honored.
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(b): keyboard model + walkthrough hints; passphrase lands on empty canvas"
```

**B is done when:** every task complete, typecheck+build green, the manual checklist in B8 Step 5 passes on desktop and a mobile viewport, LTR and RTL.
