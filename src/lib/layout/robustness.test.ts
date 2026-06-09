import { describe, test, expect } from 'vitest';
import { computeTieredLayout, type TieredLayout } from '@/lib/tree-utils';
import { assignTiers } from './tiers';
import { buildUnions } from './unions';
import { tree, person, pc } from './fixtures';
import { assertAllPositioned, assertNoOverlap } from './invariants';

/** A linear parent→child lineage of length n (g0 → g1 → … → g{n-1}). */
function chain(n: number) {
  const ids = Array.from({ length: n }, (_, i) => `g${i}`);
  const rels = ids.slice(1).map((id, i) => pc(ids[i], id));
  return tree(
    ids[0],
    ids.map((id) => person(id)),
    rels,
  );
}

describe('layout robustness — large / deep / malformed input', () => {
  // assignTiers must use iterative traversal + a single O(V+E) longest-path
  // relaxation — a recursive DFS overflows here and the old fixed-point loop
  // is O(classes²).
  test('assignTiers handles a 6000-deep chain without overflowing the stack', () => {
    const t = chain(6000);
    const { tierOf } = assignTiers(t, buildUnions(t));
    expect(tierOf.get('g0')).toBe(0);
    expect(tierOf.get('g5999')).toBe(5999);
  });

  // The full pipeline must never throw to the renderer on a deep lineage that a
  // tampered/shared URL hash could carry — it degrades to a best-effort layout.
  test('deep 3000-node lineage lays out (degrades gracefully, never throws)', () => {
    const t = chain(3000);
    let layout: TieredLayout | null = null;
    expect(() => {
      layout = computeTieredLayout(t);
    }).not.toThrow();
    expect(layout).not.toBeNull();
    assertAllPositioned(t, layout!);
  });

  test('parent-child 2-cycle does not throw and positions everyone', () => {
    const t = tree('a', ['a', 'b'].map((id) => person(id)), [pc('a', 'b'), pc('b', 'a')]);
    const layout = computeTieredLayout(t)!;
    assertAllPositioned(t, layout);
    assertNoOverlap(layout);
  });

  test('parent-child 3-cycle does not throw and positions everyone', () => {
    const t = tree('a', ['a', 'b', 'c'].map((id) => person(id)), [pc('a', 'b'), pc('b', 'c'), pc('c', 'a')]);
    const layout = computeTieredLayout(t)!;
    assertAllPositioned(t, layout);
  });

  test('self-parent (own ancestor) does not throw', () => {
    const t = tree('a', ['a', 'b'].map((id) => person(id)), [pc('a', 'a'), pc('a', 'b')]);
    const layout = computeTieredLayout(t)!;
    assertAllPositioned(t, layout);
  });

  test('dangling relationship endpoints (phantom ids) are tolerated', () => {
    const t = tree('a', ['a', 'b'].map((id) => person(id)), [
      pc('a', 'b'),
      pc('a', 'ghost'),
      pc('ghost2', 'b'),
    ]);
    const layout = computeTieredLayout(t)!;
    // Real members are all positioned; phantom ids contribute no nodes.
    assertAllPositioned(t, layout);
  });
});
