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
