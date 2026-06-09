import { describe, test, expect } from 'vitest';
import { computeTieredLayout } from '@/lib/tree-utils';
import { displaceForActive, ACTIVE_CLEAR_X, PUSH_SEP } from './push';
import { CASES } from './fixtures';

type N = { id: string; x: number; tier: number };

/** Apply the offset map to produce post-push x positions. */
const apply = (nodes: N[], activeId: string | null) => {
  const off = displaceForActive(nodes, activeId);
  return nodes.map((n) => ({ ...n, x: n.x + (off.get(n.id)?.dx ?? 0) }));
};

describe('displaceForActive', () => {
  test('no active node → no displacement', () => {
    const nodes: N[] = [
      { id: 'a', x: 0, tier: 0 },
      { id: 'b', x: 100, tier: 0 },
    ];
    expect(displaceForActive(nodes, null).size).toBe(0);
  });

  test('active node itself is never moved', () => {
    const nodes: N[] = [
      { id: 'a', x: 0, tier: 0 },
      { id: 'b', x: 100, tier: 0 },
    ];
    expect(displaceForActive(nodes, 'a').get('a')).toBeUndefined();
  });

  test('a same-tier neighbor inside the footprint is pushed clear of it', () => {
    const nodes: N[] = [
      { id: 'a', x: 0, tier: 0 },
      { id: 'b', x: 100, tier: 0 }, // 100px away — well inside ACTIVE_CLEAR_X
    ];
    const b = apply(nodes, 'a').find((n) => n.id === 'b')!;
    expect(Math.abs(b.x - 0)).toBeGreaterThanOrEqual(ACTIVE_CLEAR_X - 1e-6);
  });

  test('CORE: no other same-tier node sits within ACTIVE_CLEAR_X of the active node', () => {
    // Dense tier: 5 nodes 120px apart (tight siblings/spouse). Activate the middle.
    const nodes: N[] = [0, 1, 2, 3, 4].map((i) => ({ id: `n${i}`, x: i * 120, tier: 0 }));
    const result = apply(nodes, 'n2');
    const active = result.find((n) => n.id === 'n2')!;
    for (const n of result) {
      if (n.id === 'n2') continue;
      expect(
        Math.abs(n.x - active.x),
        `${n.id} must clear the active footprint`,
      ).toBeGreaterThanOrEqual(ACTIVE_CLEAR_X - 1e-6);
    }
  });

  test('pushed neighbors never overlap each other (≥ PUSH_SEP apart)', () => {
    const nodes: N[] = [0, 1, 2, 3, 4].map((i) => ({ id: `n${i}`, x: i * 120, tier: 0 }));
    const result = apply(nodes, 'n2').sort((a, b) => a.x - b.x);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x - result[i - 1].x).toBeGreaterThanOrEqual(PUSH_SEP - 1e-6);
    }
  });

  test('nodes already clear of the footprint are not moved', () => {
    const nodes: N[] = [
      { id: 'a', x: 0, tier: 0 },
      { id: 'far', x: 1000, tier: 0 },
    ];
    expect(displaceForActive(nodes, 'a').get('far')).toBeUndefined();
  });

  test('nodes on other tiers are never moved', () => {
    const nodes: N[] = [
      { id: 'parent', x: 0, tier: 0 },
      { id: 'a', x: 0, tier: 1 },
      { id: 'child', x: 0, tier: 2 },
    ];
    const off = displaceForActive(nodes, 'a');
    expect(off.get('parent')).toBeUndefined();
    expect(off.get('child')).toBeUndefined();
  });

  test('left neighbors move left, right neighbors move right (push is symmetric)', () => {
    const nodes: N[] = [
      { id: 'L', x: -100, tier: 0 },
      { id: 'a', x: 0, tier: 0 },
      { id: 'R', x: 100, tier: 0 },
    ];
    const off = displaceForActive(nodes, 'a');
    expect(off.get('L')!.dx).toBeLessThan(0);
    expect(off.get('R')!.dx).toBeGreaterThan(0);
  });

  test('integration: activating any node clears its tier across real layouts', () => {
    for (const { tree } of CASES) {
      const layout = computeTieredLayout(tree);
      if (!layout) continue;
      for (const target of layout.nodes) {
        const off = displaceForActive(layout.nodes, target.id);
        const xOf = (n: { id: string; x: number }) => n.x + (off.get(n.id)?.dx ?? 0);
        const ax = xOf(target);
        for (const n of layout.nodes) {
          if (n.id === target.id || n.tier !== target.tier) continue;
          expect(
            Math.abs(xOf(n) - ax),
            `case clears tier: ${target.id} vs ${n.id}`,
          ).toBeGreaterThanOrEqual(ACTIVE_CLEAR_X - 1e-6);
        }
      }
    }
  });
});
