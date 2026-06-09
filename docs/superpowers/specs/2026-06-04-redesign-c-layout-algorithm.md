# Sub-project C — Layout Algorithm Revision

**Date:** 2026-06-04 · **Branch:** `redesign/editorial-paper` · Part of the [redesign overview](2026-06-04-redesign-overview.md).

## Goal

Replace the current Buchheim-Reingold-Tilford-with-couple-containers layout (which silently drops
disconnected members, mixes ancestors/descendants via a hack, and can't group half-siblings by union)
with a **union-aware layered layout** that handles every realistic family-tree case and is **proven
by a fixture test suite**.

## Hard constraint

**No data-model change.** `types/family.ts` (flat `members[]` + `relationships[]`) stays as-is; the
~8 KB encrypted-URL budget must not grow. **Unions are derived at layout time**, never persisted.

## Current bugs to eliminate (from `tree-utils.ts`)

- Members with **no path to `rootMemberId`** get no tier and no position → **never render**.
- **Multiple unions** aren't separated: `buildTree` lumps a node's children with all spouses'
  children, so half-siblings from different partners are mixed and uncentered.
- **Unmarried co-parents:** a child is placed under only the first-visited parent.
- **Ancestors** are treated as Buchheim "children" drawn upward by negative tier — fragile once
  ancestors have couples/siblings of their own.
- **Cycles** (cousin marriage, etc.): the second edge is silently dropped from the hierarchy.

## Model: union-aware layered layout

### Derived structures (built from edges each layout)
- **Union** = `{ id, parentIds: string[], childIds: string[] }`.
  - A union groups **co-parents who share ≥1 child** (parent-set → children).
  - **Childless spouse pairs** form a union with no children (so couples still sit together).
  - A person may belong to **multiple unions** (remarriage, co-parenting).
  - **Single parent** → a union with one parent. **>2 parents** (adoption) → a union with the
    full parent-set for positioning; see reference-links below.
- **Layout graph:** bipartite person ↔ union. Person → unions they parent → children of those unions.
  Sibling-only and spouse-only links are folded into unions (spouse → childless union; explicit
  sibling → shared-parent union if one exists, else a synthetic sibling group).

### Phases
1. **Build unions** from `relationships`.
2. **Generation (tier) assignment** — longest-path layering over the parent→child relation so a
   child is exactly one tier below the **lowest** of its parents; both partners of a union share a
   tier (pull the higher partner down to meet). Compute over a **spanning DAG**: detect and exclude
   **cycle edges** from tiering (they become reference links). Tiers may be negative (ancestors of
   the focus) — normalize later. Deterministic given input.
3. **Connected components** — partition the layout graph. Each component laid out independently.
4. **Ordering within tiers** — per component, order nodes left-to-right to keep:
   - children contiguous under their union, centered;
   - both partners of a union adjacent (union sits between them);
   - sibling order stable (by birth date when present, else by insertion order);
   - subtrees non-overlapping. Use a BRT-style contour pass over the **union tree** of the component
     (treating a union + its partners as the structural unit), or an equivalent priority method.
     Global crossing-minimization is **not** required (trees are small, ≤ ~40 nodes); stable,
     overlap-free, parents-centered output is.
5. **X assignment** — produce pixel `x` per person; partners flank their union; children center under it.
6. **Component packing** — place components side-by-side with a clear gap; normalize so the whole
   layout is centered (as today).
7. **Reference links** — for excluded cycle edges and extra-parent edges (a child's parents beyond
   its positioning union), emit links marked `kind: 'reference'` so the renderer can draw them
   distinctly (thinner/curved) without affecting positions.

## Output API (keep renderer decoupled)

Preserve the signature `computeTieredLayout(tree: FamilyTree): TieredLayout | null` so B's renderer
is unaffected. Extend the types minimally:
- `PositionedLink` gains `kind: 'primary' | 'reference'` (default `'primary'`).
- Optionally expose `components: number` / per-node `component` index for debugging (not required by renderer).
- `PositionedNode` shape unchanged (`id, member, x, y, tier, isRoot`).

## The "every case" checklist (acceptance tests)

Each becomes a Vitest fixture asserting the invariants below:

1. Single person (also: empty tree → `null`).
2. Linear ancestry (focus → parents → grandparents).
3. Linear descent (focus → children → grandchildren).
4. Nuclear family (couple + N children).
5. Many siblings (even spacing, centered under union).
6. **Multiple marriages** — one person, two unions, children grouped per union; half-siblings not mixed.
7. **Single parent** (one-parent union).
8. **Unmarried co-parents** — child centered between two non-spouse parents.
9. **Blended / step family** — partner brings own children from a prior union.
10. **Ancestors with aunts/uncles + their families** — parent's siblings and their unions laid out.
11. **Both partners' ancestors above** — both maternal and paternal grandparents present.
12. **Disconnected components** — a second cluster with no path to root **still renders**, packed apart.
13. **Cycle / cousin marriage** — terminates; positions sane; extra edge is a reference link.
14. **Same-sex couple** — gender-agnostic, lays out identically to any couple.
15. **Adoption / >2 parents** — child positioned under one union; extra parent edge is a reference link.
16. **Wide generation** — many cousins on a tier, no overlap.
17. **Deep tree** — many generations, tiers monotonic.
18. **Arbitrary re-rooting** — same graph rooted at different members lays out validly.

## Invariants (asserted by every fixture)

- **Completeness:** every member in `tree.members` has a position.
- **No overlap:** no two nodes on the same tier are closer than the minimum separation.
- **Tier monotonicity:** for every primary parent-child edge, `child.tier === parent.tier + 1`
  (within a component; reference edges exempt).
- **Couples adjacent:** partners of a union are horizontally adjacent.
- **Centering:** a union's children are centered under the union midpoint (within tolerance).
- **Determinism:** identical input → identical output (snapshot-stable).
- **Termination:** cyclic graphs complete without infinite loops/stack overflow.

## Test setup

- Add **Vitest** + `npm` script `"test": "vitest run"` (and `"test:watch": "vitest"`); wire into
  `package.json` and `tsconfig`/Vite as needed (no test runner exists today).
- `src/lib/tree-utils.test.ts` (+ a `fixtures` module) building the 18 trees and asserting invariants
  via shared helpers (`assertNoOverlap`, `assertTiers`, `assertAllPositioned`, …).
- Keep pure functions pure (no DOM) so tests run fast in node.

## Implementation method

**Test-driven** (`superpowers:test-driven-development`): write the invariant helpers + the simplest
fixtures first, implement phase by phase (unions → tiering → ordering → packing → reference links),
making fixtures pass incrementally. `getParents/getChildren/getSpouse/getSiblings` and
`getInferredRelationships` stay (B depends on them); `toD3Hierarchy` may be removed if unused after
the rewrite (verify no importers first).

## Success criteria

- All 18 fixtures pass with the invariants above; `npx vitest run` green.
- `computeTieredLayout` signature unchanged; B's renderer consumes output with no special-casing
  beyond drawing `kind: 'reference'` links distinctly.
- No persisted schema change; a representative large tree still fits the ~8 KB URL budget.
- `npm run typecheck` + `npm run build` pass.
