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
