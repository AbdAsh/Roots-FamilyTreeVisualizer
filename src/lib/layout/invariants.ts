import { expect } from 'vitest';
import type { FamilyTree } from '@/types/family';
import type { TieredLayout } from '@/lib/tree-utils';
import { buildUnions } from './unions';

const MIN_SEP = 80; // min horizontal gap between node centers on a tier (NODE_R=28 ⇒ comfortable)
const CENTER_TOL = 2; // px tolerance for the children-centered invariant

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

export function assertTierMonotonic(_tree: FamilyTree, layout: TieredLayout): void {
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

/**
 * Couples adjacent: for every union with ≥2 parents, the parents sit on a
 * single tier and occupy contiguous x-slots — no *non-partner* node on that
 * tier may fall strictly between the leftmost and rightmost parent x.
 * Single-parent / childless-or-not unions trivially pass.
 */
export function assertCouplesAdjacent(tree: FamilyTree, layout: TieredLayout): void {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const unions = buildUnions(tree);
  for (const u of unions) {
    if (u.parentIds.length < 2) continue;
    const parents = u.parentIds.map((p) => byId.get(p)).filter((n): n is NonNullable<typeof n> => !!n);
    if (parents.length < 2) continue; // defensive: not all positioned

    // All parents must share one tier for "adjacent" to be meaningful.
    const tier = parents[0].tier;
    for (const p of parents) {
      expect(p.tier, `union ${u.id} parents on same tier`).toBe(tier);
    }

    const xs = parents.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const parentIds = new Set(u.parentIds);

    for (const node of layout.nodes) {
      if (node.tier !== tier) continue;
      if (parentIds.has(node.id)) continue;
      const between = node.x > minX + 1e-6 && node.x < maxX - 1e-6;
      expect(
        between,
        `union ${u.id}: non-partner ${node.id} (x=${node.x}) sits between partners [${minX}, ${maxX}]`,
      ).toBe(false);
    }
  }
}

/**
 * Centering: for every union with ≥1 child, the midpoint of the children's
 * x-positions equals the midpoint of the union's parents' x-positions, within
 * CENTER_TOL px. Unions whose members aren't all positioned are skipped.
 */
export function assertChildrenCentered(tree: FamilyTree, layout: TieredLayout): void {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const unions = buildUnions(tree);
  for (const u of unions) {
    if (u.childIds.length === 0) continue;
    if (u.parentIds.length === 0) continue;

    const parents = u.parentIds.map((p) => byId.get(p));
    const children = u.childIds.map((c) => byId.get(c));
    if (parents.some((n) => !n) || children.some((n) => !n)) continue; // defensive

    const parentXs = (parents as NonNullable<(typeof parents)[number]>[]).map((n) => n.x);
    const childXs = (children as NonNullable<(typeof children)[number]>[]).map((n) => n.x);
    const parentMid = (Math.min(...parentXs) + Math.max(...parentXs)) / 2;
    const childMid = (Math.min(...childXs) + Math.max(...childXs)) / 2;

    expect(
      Math.abs(childMid - parentMid),
      `union ${u.id}: children mid ${childMid} vs parents mid ${parentMid}`,
    ).toBeLessThanOrEqual(CENTER_TOL);
  }
}
