# Redesign C — Layout Algorithm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Use superpowers:test-driven-development throughout — write the failing test, watch it fail, implement, watch it pass. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace `computeTieredLayout` with a union-aware layered layout that positions every member for all 18 enumerated family-tree cases, proven by a Vitest fixture suite.

**Architecture:** Derive **unions** (parent-sets sharing children, plus childless spouse pairs) from the existing edges — no schema change. Assign **generations** via union-find (partners/co-parents share a tier) + longest-path layering with cycle-edge detection. Split into **connected components**; lay each out by reusing the existing Buchheim contour primitives on a per-union descendant tree, mirror the focus's ancestors upward, stitch at the focus, then **pack** components side by side. Cycle/extra-parent edges become `kind:'reference'` links.

**Tech Stack:** TypeScript, Vitest (new), existing `tree-utils.ts` Buchheim primitives (`firstWalk`, `apportion`, `secondWalk`, `thirdWalk`, `execShifts`, `moveSub`).

**Spec:** `docs/superpowers/specs/2026-06-04-redesign-c-layout-algorithm.md`
**Prereq:** Plans A + B on this branch. `computeTieredLayout` signature is unchanged so B's renderer is unaffected; B already draws `kind:'reference'` links distinctly (B7/EdgeLayer).
**Branch:** `redesign/editorial-paper`.

---

## File map

- Create: `vitest.config.ts` — test config (node env).
- Modify: `package.json` — add `vitest` devDep + `test`/`test:watch` scripts.
- Create: `src/lib/layout/unions.ts` — `buildUnions`.
- Create: `src/lib/layout/tiers.ts` — `assignTiers` (union-find + longest path + cycle edges).
- Create: `src/lib/layout/components.ts` — `connectedComponents`.
- Create: `src/lib/layout/layout.ts` — `computeUnionLayout` (per-component contour + ancestor stitch + pack).
- Modify: `src/lib/tree-utils.ts` — `computeTieredLayout` delegates to `layout.ts`; `PositionedLink` gains `kind`. Keep `getParents/Children/Spouse/Siblings/getInferredRelationships`. Remove `toD3Hierarchy` only if no importers.
- Create: `src/lib/layout/fixtures.ts` — the 18 case trees.
- Create: `src/lib/layout/invariants.ts` — shared assertion helpers.
- Create: `src/lib/layout/layout.test.ts` — the suite.

---

## Task C1: Vitest setup

**Files:** Create `vitest.config.ts`; modify `package.json`.

- [ ] **Step 1: Install Vitest** — `npm i -D vitest@^3`.
- [ ] **Step 2: Create `vitest.config.ts`:**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 3: Add scripts** to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **Step 4: Smoke test** — create a throwaway `src/lib/layout/smoke.test.ts` with `import {test,expect} from 'vitest'; test('ok',()=>expect(1).toBe(1));`. Run `npx vitest run` → 1 passing. Delete the smoke file.
- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test(c): add Vitest with @ alias and test scripts"
```

---

## Task C2: Invariant helpers + fixtures scaffold

**Files:** Create `src/lib/layout/invariants.ts`, `src/lib/layout/fixtures.ts`.

- [ ] **Step 1: Fixture builder utilities** (`fixtures.ts`) — concise helpers to construct trees:

```ts
import type { FamilyTree, FamilyMember, Relationship, RelationshipType } from '@/types/family';

let n = 0;
const rid = () => `r${n++}`;
export function person(id: string, extra: Partial<FamilyMember> = {}): FamilyMember {
  return { id, name: id, gender: 'unknown', customFields: {}, ...extra };
}
export function rel(type: RelationshipType, from: string, to: string): Relationship {
  return { id: rid(), type, from, to };
}
export function tree(rootId: string, members: FamilyMember[], rels: Relationship[]): FamilyTree {
  return { id: 't', name: 'T', members, relationships: rels, rootMemberId: rootId,
           createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}
// shorthands
export const pc = (parent: string, child: string) => rel('parent-child', parent, child);
export const sp = (a: string, b: string) => rel('spouse', a, b);
export const sib = (a: string, b: string) => rel('sibling', a, b);
```

- [ ] **Step 2: Invariant helpers** (`invariants.ts`) — operate on `TieredLayout`:

```ts
import { expect } from 'vitest';
import type { FamilyTree } from '@/types/family';
import type { TieredLayout } from '@/lib/tree-utils';

const MIN_SEP = 80; // min horizontal gap between node centers on a tier (NODE_R=28 ⇒ comfortable)

export function assertAllPositioned(tree: FamilyTree, layout: TieredLayout): void {
  const ids = new Set(layout.nodes.map((n) => n.id));
  for (const m of tree.members) expect(ids.has(m.id), `member ${m.id} positioned`).toBe(true);
  expect(layout.nodes.length).toBe(tree.members.length);
}

export function assertNoOverlap(layout: TieredLayout): void {
  const byTier = new Map<number, number[]>();
  for (const node of layout.nodes) {
    const arr = byTier.get(node.tier) ?? [];
    arr.push(node.x); byTier.set(node.tier, arr);
  }
  for (const [tier, xs] of byTier) {
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1], `tier ${tier} spacing`).toBeGreaterThanOrEqual(MIN_SEP - 0.5);
    }
  }
}

export function assertTierMonotonic(tree: FamilyTree, layout: TieredLayout): void {
  const tierOf = new Map(layout.nodes.map((n) => [n.id, n.tier]));
  for (const l of layout.links) {
    if (l.type !== 'parent-child' || (l as { kind?: string }).kind === 'reference') continue;
    const a = tierOf.get(l.sourceId)!, b = tierOf.get(l.targetId)!;
    expect(Math.abs(a - b), `parent-child tier delta for ${l.sourceId}->${l.targetId}`).toBe(1);
  }
}

export function assertDeterministic(run: () => TieredLayout): void {
  const a = JSON.stringify(run().nodes.map((n) => [n.id, n.x, n.y]).sort());
  const b = JSON.stringify(run().nodes.map((n) => [n.id, n.x, n.y]).sort());
  expect(a).toBe(b);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/layout/invariants.ts src/lib/layout/fixtures.ts
git commit -m "test(c): layout invariant helpers + fixture builders"
```

---

## Task C3: The 18 fixtures + the suite (failing)

**Files:** Modify `src/lib/layout/fixtures.ts` (add `CASES`); create `src/lib/layout/layout.test.ts`.

- [ ] **Step 1: Define `CASES`** — an array `{ name, tree }`. Representative entries (add all 18; samples shown):

```ts
export const CASES: { name: string; tree: FamilyTree }[] = [
  { name: 'single', tree: tree('a', [person('a')], []) },
  { name: 'nuclear', tree: tree('a',
      ['a','b','c1','c2'].map((id) => person(id)),
      [sp('a','b'), pc('a','c1'), pc('b','c1'), pc('a','c2'), pc('b','c2')]) },
  { name: 'many-siblings', tree: tree('a',
      ['a','b','c1','c2','c3','c4'].map((id) => person(id)),
      [sp('a','b'), ...['c1','c2','c3','c4'].flatMap((c) => [pc('a',c), pc('b',c)])]) },
  { name: 'multiple-marriages', tree: tree('a',
      ['a','b1','b2','x1','y1'].map((id) => person(id)),
      [sp('a','b1'), sp('a','b2'), pc('a','x1'), pc('b1','x1'), pc('a','y1'), pc('b2','y1')]) },
  { name: 'single-parent', tree: tree('a', ['a','c'].map(person), [pc('a','c')]) },
  { name: 'unmarried-coparents', tree: tree('a',
      ['a','b','c'].map(person), [pc('a','c'), pc('b','c')]) },
  { name: 'ancestors-chain', tree: tree('a',
      ['a','p','gp'].map(person), [pc('p','a'), pc('gp','p')]) },
  { name: 'both-sides-ancestors', tree: tree('a',
      ['a','f','m','gf1','gm1','gf2','gm2'].map(person),
      [sp('f','m'), pc('f','a'), pc('m','a'),
       sp('gf1','gm1'), pc('gf1','f'), pc('gm1','f'),
       sp('gf2','gm2'), pc('gf2','m'), pc('gm2','m')]) },
  { name: 'aunts-uncles', tree: tree('a',
      ['a','f','m','unc','gf','gm','cous'].map(person),
      [sp('f','m'), pc('f','a'), pc('m','a'),
       sp('gf','gm'), pc('gf','f'), pc('gm','f'), pc('gf','unc'), pc('gm','unc'),
       pc('unc','cous')]) },
  { name: 'disconnected', tree: tree('a',
      ['a','b','x','y'].map(person), [sp('a','b'), sp('x','y')]) }, // x,y unreachable from a
  { name: 'cousin-marriage', tree: tree('gp',
      ['gp','p1','p2','c1','c2'].map(person),
      [pc('gp','p1'), pc('gp','p2'), pc('p1','c1'), pc('p2','c2'), sp('c1','c2')]) },
  { name: 'same-sex-couple', tree: tree('a',
      ['a','b','c'].map(person), [sp('a','b'), pc('a','c'), pc('b','c')]) },
  { name: 'adoption-three-parents', tree: tree('a',
      ['a','b','x','c'].map(person), [sp('a','b'), pc('a','c'), pc('b','c'), pc('x','c')]) },
  { name: 'wide-generation', tree: tree('gp',
      ['gp', ...Array.from({length: 8}, (_, i) => `k${i}`)].map(person),
      Array.from({length: 8}, (_, i) => pc('gp', `k${i}`))) },
  { name: 'deep', tree: tree('g0',
      Array.from({length: 6}, (_, i) => `g${i}`).map(person),
      Array.from({length: 5}, (_, i) => pc(`g${i}`, `g${i+1}`))) },
  { name: 'blended', tree: tree('a',
      ['a','b','pa','pb','k1','k2'].map(person),
      // a + b now partnered; a's child k1 is from prior partner pa; b's child k2 from prior partner pb
      [sp('a','b'), pc('a','k1'), pc('pa','k1'), pc('b','k2'), pc('pb','k2')]) },
  { name: 'linear-descent', tree: tree('a', ['a','c','gc'].map(person), [pc('a','c'), pc('c','gc')]) },
  { name: 'reroot', tree: tree('c', // same as nuclear but rooted at a child
      ['a','b','c1','c2'].map(person),
      [sp('a','b'), pc('a','c1'), pc('b','c1'), pc('a','c2'), pc('b','c2')]) },
];
```
(Finalize the `blended` fixture to a realistic shape: `a` with new partner `b`, `a`'s child `k1` from prior partner `pa`, `b`'s child `k2` from prior partner `pb`.)

- [ ] **Step 2: Write the suite** (`layout.test.ts`):

```ts
import { describe, test } from 'vitest';
import { computeTieredLayout } from '@/lib/tree-utils';
import { CASES } from './fixtures';
import { assertAllPositioned, assertNoOverlap, assertTierMonotonic, assertDeterministic } from './invariants';

describe('computeTieredLayout — every case', () => {
  for (const { name, tree } of CASES) {
    test(name, () => {
      const layout = computeTieredLayout(tree)!;
      assertAllPositioned(tree, layout);
      assertNoOverlap(layout);
      assertTierMonotonic(tree, layout);
      assertDeterministic(() => computeTieredLayout(tree)!);
    });
  }
});
```

- [ ] **Step 3: Run** — `npx vitest run`. Expected: several FAIL against the current algorithm (notably `disconnected` — unreachable members unpositioned; `multiple-marriages` — overlap/mixing; `cousin-marriage`/`adoption` — possible). Record which fail; these are the target.
- [ ] **Step 4: Commit** (red baseline)

```bash
git add src/lib/layout/fixtures.ts src/lib/layout/layout.test.ts
git commit -m "test(c): 18 family-tree fixtures + invariant suite (red baseline)"
```

---

## Task C4: `buildUnions` (TDD)

**Files:** Create `src/lib/layout/unions.ts`, `src/lib/layout/unions.test.ts`.

- [ ] **Step 1: Failing test** (`unions.test.ts`):

```ts
import { test, expect } from 'vitest';
import { buildUnions } from './unions';
import { tree, person, pc, sp } from './fixtures';

test('groups children by parent-set; half-siblings split', () => {
  const t = tree('a', ['a','b1','b2','x','y'].map(person),
    [sp('a','b1'), sp('a','b2'), pc('a','x'), pc('b1','x'), pc('a','y'), pc('b2','y')]);
  const u = buildUnions(t);
  // unions: {a,b1}->[x], {a,b2}->[y]
  const ab1 = u.find((z) => z.parentIds.join() === 'a,b1');
  const ab2 = u.find((z) => z.parentIds.join() === 'a,b2');
  expect(ab1?.childIds).toEqual(['x']);
  expect(ab2?.childIds).toEqual(['y']);
});

test('childless spouses form a union', () => {
  const t = tree('a', ['a','b'].map(person), [sp('a','b')]);
  expect(buildUnions(t)).toHaveLength(1);
  expect(buildUnions(t)[0].childIds).toEqual([]);
});

test('single parent → one-parent union', () => {
  const t = tree('a', ['a','c'].map(person), [pc('a','c')]);
  const u = buildUnions(t);
  expect(u[0].parentIds).toEqual(['a']);
  expect(u[0].childIds).toEqual(['c']);
});
```

- [ ] **Step 2: Run → fail** (`buildUnions` undefined).
- [ ] **Step 3: Implement** (`unions.ts`):

```ts
import type { FamilyTree } from '@/types/family';

export interface Union { id: string; parentIds: string[]; childIds: string[]; }

const keyOf = (ids: string[]) => [...ids].sort().join('|');

export function buildUnions(tree: FamilyTree): Union[] {
  const parentsOf = new Map<string, string[]>();
  for (const r of tree.relationships) {
    if (r.type !== 'parent-child') continue;
    const arr = parentsOf.get(r.to) ?? [];
    if (!arr.includes(r.from)) arr.push(r.from);
    parentsOf.set(r.to, arr);
  }
  const byKey = new Map<string, Union>();
  // deterministic child order: by tree.members order
  const order = new Map(tree.members.map((m, i) => [m.id, i]));
  const sortedChildren = [...parentsOf.keys()].sort((a, b) => (order.get(a)! - order.get(b)!));
  for (const child of sortedChildren) {
    const parents = parentsOf.get(child)!;
    const key = keyOf(parents);
    let u = byKey.get(key);
    if (!u) { u = { id: `u_${key}`, parentIds: [...parents].sort(), childIds: [] }; byKey.set(key, u); }
    u.childIds.push(child);
  }
  for (const r of tree.relationships) {
    if (r.type !== 'spouse') continue;
    const key = keyOf([r.from, r.to]);
    if (!byKey.has(key)) byKey.set(key, { id: `u_${key}`, parentIds: [r.from, r.to].sort(), childIds: [] });
  }
  return [...byKey.values()];
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit** `test(c): buildUnions — parent-set grouping`.

---

## Task C5: `assignTiers` (union-find + longest path + cycle edges) (TDD)

**Files:** Create `src/lib/layout/tiers.ts`, `src/lib/layout/tiers.test.ts`.

- [ ] **Step 1: Failing tests:**

```ts
import { test, expect } from 'vitest';
import { assignTiers } from './tiers';
import { buildUnions } from './unions';
import { tree, person, pc, sp } from './fixtures';

test('child is exactly one tier below parents; spouses share a tier', () => {
  const t = tree('a', ['a','b','c'].map(person), [sp('a','b'), pc('a','c'), pc('b','c')]);
  const { tierOf } = assignTiers(t, buildUnions(t));
  expect(tierOf.get('a')).toBe(tierOf.get('b'));
  expect(tierOf.get('c')! - tierOf.get('a')!).toBe(1);
});

test('cousin marriage terminates and keeps cousins same tier', () => {
  const t = tree('gp', ['gp','p1','p2','c1','c2'].map(person),
    [pc('gp','p1'), pc('gp','p2'), pc('p1','c1'), pc('p2','c2'), sp('c1','c2')]);
  const { tierOf } = assignTiers(t, buildUnions(t));
  expect(tierOf.get('c1')).toBe(tierOf.get('c2'));
  expect(tierOf.get('p1')).toBe(tierOf.get('p2'));
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** (`tiers.ts`):

```ts
import type { FamilyTree, Relationship } from '@/types/family';
import type { Union } from './unions';

class UF {
  private p = new Map<string, string>();
  find(x: string): string {
    let r = this.p.get(x); if (r === undefined) { this.p.set(x, x); return x; }
    if (r !== x) { r = this.find(r); this.p.set(x, r); } return r;
  }
  union(a: string, b: string): void { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

export function assignTiers(tree: FamilyTree, unions: Union[]): {
  tierOf: Map<string, number>;
  referenceEdges: Relationship[];
} {
  const uf = new UF();
  for (const m of tree.members) uf.find(m.id);
  for (const u of unions) for (let i = 1; i < u.parentIds.length; i++) uf.union(u.parentIds[0], u.parentIds[i]);

  // class DAG: classOf(parent) -> classOf(child)
  const adj = new Map<string, Set<string>>();
  for (const u of unions) {
    if (u.parentIds.length === 0) continue;
    const pc = uf.find(u.parentIds[0]);
    for (const c of u.childIds) {
      const cc = uf.find(c);
      if (cc === pc) continue;
      (adj.get(pc) ?? adj.set(pc, new Set()).get(pc)!).add(cc);
    }
  }
  // longest-path layering with DFS back-edge detection (drop cycles)
  const classes = [...new Set(tree.members.map((m) => uf.find(m.id)))];
  const tier = new Map<string, number>(classes.map((c) => [c, 0]));
  const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited 1=onstack 2=done
  const backEdges: [string, string][] = [];
  function dfs(u: string): void {
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      if (state.get(v) === 1) { backEdges.push([u, v]); continue; } // skip cycle edge
      if (state.get(v) !== 2) dfs(v);
      tier.set(v, Math.max(tier.get(v)!, tier.get(u)! + 1));
    }
    state.set(u, 2);
  }
  // iterate to a fixed point for longest path across the DAG (small graphs)
  for (let pass = 0; pass < classes.length; pass++) {
    state.clear();
    for (const c of classes) if (state.get(c) !== 2) dfs(c);
  }
  const tierOf = new Map<string, number>();
  for (const m of tree.members) tierOf.set(m.id, tier.get(uf.find(m.id))!);
  // normalize so min tier = 0
  const min = Math.min(...tierOf.values());
  for (const [k, v] of tierOf) tierOf.set(k, v - min);

  // referenceEdges: parent-child relationships whose class-edge was a back-edge
  const refSet = new Set(backEdges.map(([a, b]) => `${a}->${b}`));
  const referenceEdges = tree.relationships.filter(
    (r) => r.type === 'parent-child' && refSet.has(`${uf.find(r.from)}->${uf.find(r.to)}`),
  );
  return { tierOf, referenceEdges };
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit** `test(c): assignTiers — union-find generations + cycle guard`.

---

## Task C6: `connectedComponents` (TDD)

**Files:** Create `src/lib/layout/components.ts`, `src/lib/layout/components.test.ts`.

- [ ] **Step 1: Failing test:**

```ts
import { test, expect } from 'vitest';
import { connectedComponents } from './components';
import { tree, person, sp } from './fixtures';

test('splits unreachable clusters', () => {
  const t = tree('a', ['a','b','x','y'].map(person), [sp('a','b'), sp('x','y')]);
  const comps = connectedComponents(t);
  expect(comps).toHaveLength(2);
  expect(comps.map((c) => c.size).sort()).toEqual([2, 2]);
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** (`components.ts`):

```ts
import type { FamilyTree } from '@/types/family';

export function connectedComponents(tree: FamilyTree): Set<string>[] {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
  for (const m of tree.members) adj.set(m.id, new Set());
  for (const r of tree.relationships) { link(r.from, r.to); link(r.to, r.from); }
  const seen = new Set<string>();
  const comps: Set<string>[] = [];
  for (const m of tree.members) {
    if (seen.has(m.id)) continue;
    const comp = new Set<string>(); const stack = [m.id];
    while (stack.length) {
      const id = stack.pop()!; if (comp.has(id)) continue;
      comp.add(id); seen.add(id);
      for (const nb of adj.get(id) ?? []) if (!comp.has(nb)) stack.push(nb);
    }
    comps.push(comp);
  }
  // deterministic: order components by their earliest member index, root component first
  const order = new Map(tree.members.map((m, i) => [m.id, i]));
  comps.sort((c1, c2) => Math.min(...[...c1].map((x) => order.get(x)!)) - Math.min(...[...c2].map((x) => order.get(x)!)));
  return comps;
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit** `test(c): connectedComponents`.

---

## Task C7: `computeUnionLayout` — per-component contour (TDD against tree-shaped cases)

**Files:** Create `src/lib/layout/layout.ts`; export the Buchheim primitives from `tree-utils.ts` (or copy them into `layout.ts`).

- [ ] **Step 1: Expose primitives.** In `tree-utils.ts`, `export` the existing `firstWalk`, `secondWalk`, `thirdWalk`, `apportion`, `execShifts`, `moveSub`, `findAnc`, `leftBro`, `leftmostSib`, `nLeft`, `nRight`, `sep`, and the `BNode` interface — OR move them verbatim into `layout.ts`. Choose move-into-`layout.ts` to keep the new engine self-contained; leave `tree-utils.ts` re-exporting types.

- [ ] **Step 2: Implement descendant layout** in `layout.ts`. For one component, given `tierOf` and `unions`:
  - Choose the component **anchor**: `rootMemberId` if in this component, else the member with the lowest tier then lowest member-index.
  - Build a **descendant union-tree** from the anchor downward: a `BNode` per person; a person's layout-children = the children of each **down-union** the person parents (a union where the person ∈ `parentIds` and the union sits one tier below). The person's **partners** in each down-union attach as couple-offset spouses (reuse the `spouseIds`/`size` mechanism, but per-union so each union's children group under the correct partner offset). Skip nodes already placed (visited set) to avoid cycles.
  - Run `firstWalk` → `secondWalk` → `thirdWalk`; extract `x = bnode.x * COL_GAP`, `y = tier * TIER_GAP`, with partner offsets `+ SPOUSE_OFFSET*(i+1)`.

  Make these pass: `single`, `nuclear`, `many-siblings`, `single-parent`, `linear-descent`, `wide-generation`, `deep`, `same-sex-couple`, `multiple-marriages` (half-siblings now grouped per union), `unmarried-coparents` (child centered between two non-spouse parents — treat co-parents as a couple-block for positioning), `adoption-three-parents` (position under the primary union; the third parent edge is a reference link added in C9).

- [ ] **Step 3: Run the suite** focusing on the above cases — `npx vitest run`. Iterate until they pass the invariants. Commit `feat(c): per-component descendant contour layout`.

---

## Task C8: Ancestor mirror + stitch (TDD against ancestor cases)

**Files:** Modify `src/lib/layout/layout.ts`.

- [ ] **Step 1: Build the ancestor tree** upward from the anchor: the anchor's **up-union** (the union whose `childIds` include the anchor) has the anchor's parents; recurse upward (parents' parents), and include parents' **siblings** (other children of the grandparents' union = aunts/uncles) and their down-unions/children. Lay this out as a Buchheim tree that grows **upward** (negative tiers) — run the same contour, then place at `y = tier * TIER_GAP` (tiers already negative-relative via C5 normalization → use the real tier value, not a re-zeroed one, for y).
- [ ] **Step 2: Stitch at the anchor.** The anchor appears in both the descendant and ancestor layouts. Compute the x-delta between the anchor's descendant-x and ancestor-x and shift the ancestor subtree so the anchor's x coincides. Union the two position maps (anchor keeps the descendant-x).
- [ ] **Step 3: Make pass** `ancestors-chain`, `both-sides-ancestors`, `aunts-uncles`, `reroot`. Verify `assertTierMonotonic` and `assertNoOverlap` hold across the stitched layout (ancestors above, descendants below). Iterate.
- [ ] **Step 4: Commit** `feat(c): ancestor mirror layout + stitch at focus`.

---

## Task C9: Component packing, reference links, output integration (TDD — full green)

**Files:** Modify `src/lib/layout/layout.ts`, `src/lib/tree-utils.ts`.

- [ ] **Step 1: `PositionedLink.kind`.** In `tree-utils.ts`, add `kind: 'primary' | 'reference'` to `PositionedLink` (default `'primary'`). Confirm B's `EdgeLayer` already branches on it (B7); if not, that's a B follow-up — here just emit it.
- [ ] **Step 2: Pack components.** Lay out each component (C7+C8) into its own local position map; compute each component's bounding box; place components left-to-right with a fixed gap (e.g. `COL_GAP * 2`) between bounding boxes; offset each component's positions accordingly. Root component first (C6 ordering).
- [ ] **Step 3: Assemble `computeTieredLayout`.** Rewrite it in `tree-utils.ts` to: handle `members.length === 0 → null`; `buildUnions` → `assignTiers` → `connectedComponents` → per-component `computeUnionLayout` → pack → center around x=0 (keep existing centering) → emit `nodes` and `links`. For each relationship, set `kind: 'reference'` when it's in `assignTiers().referenceEdges` **or** it's an extra parent edge beyond a child's positioning union (a child with >2 parents: the parents not in the positioning union's `parentIds`). All other links `'primary'`. Keep `source/target/mid` geometry as today.
- [ ] **Step 4: Run the full suite** — `npx vitest run`. Expected: **all 18 green**. Fix any remaining overlap/tier failures (tune `MIN_SEP` vs `COL_GAP`/`SPOUSE_OFFSET` so the invariant threshold matches the real spacing; they must be consistent).
- [ ] **Step 5: Dead code.** Grep importers of `toD3Hierarchy` (`grep -rn toD3Hierarchy src/`). If none (B removed the old renderer), delete it and its `TreeNode` type. Keep `getParents/Children/Spouse/Siblings/getInferredRelationships`.
- [ ] **Step 6: Typecheck + build + integration** — `npm run typecheck && npm run build && npx vitest run` all green. Then `npm run dev`: verify in the real app (with B's renderer) that disconnected branches now appear, half-siblings group, ancestors lay out cleanly, and cousin-marriage/adoption draw a distinct reference link.
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(c): union-aware layered layout — components, packing, reference links; all fixtures green"
```

**C is done when:** `npx vitest run` is fully green (18 cases × invariants), `computeTieredLayout` keeps its signature, no schema change, typecheck+build pass, and the live app renders every case correctly via B's renderer.

---

## Self-review notes (author)

- **Spec coverage:** unions (C4), tiers + cycles (C5), components (C6), descendant + ancestor + stitch (C7–C8), packing + reference links + Vitest (C1–C3, C9) — all 18 spec cases mapped to fixtures.
- **Type consistency:** `Union`, `assignTiers` return shape, `connectedComponents` (Set<string>[]), and the added `PositionedLink.kind` are used consistently across tasks; `computeTieredLayout` signature is preserved for B.
- **Risk flagged:** C7/C8 contour+stitch math is the iterative heart — the fixtures + invariants are the contract; the implementer tunes `MIN_SEP`/`COL_GAP`/`SPOUSE_OFFSET` together so `assertNoOverlap` matches real spacing.
