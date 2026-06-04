import { test, expect } from 'vitest';
import { connectedComponents } from './components';
import { tree, person, sp } from './fixtures';

test('splits unreachable clusters', () => {
  const t = tree('a', ['a','b','x','y'].map(person), [sp('a','b'), sp('x','y')]);
  const comps = connectedComponents(t);
  expect(comps).toHaveLength(2);
  expect(comps.map((c) => c.size).sort()).toEqual([2, 2]);
});
