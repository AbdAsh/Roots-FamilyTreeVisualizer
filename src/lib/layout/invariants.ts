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
