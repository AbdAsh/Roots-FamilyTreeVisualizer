import { test, expect } from 'vitest';
import { assignTiers } from './tiers';
import { buildUnions } from './unions';
import { tree, person, pc, sp } from './fixtures';

test('child is exactly one tier below parents; spouses share a tier', () => {
  const t = tree('a', ['a','b','c'].map((id) => person(id)), [sp('a','b'), pc('a','c'), pc('b','c')]);
  const { tierOf } = assignTiers(t, buildUnions(t));
  expect(tierOf.get('a')).toBe(tierOf.get('b'));
  expect(tierOf.get('c')! - tierOf.get('a')!).toBe(1);
});

test('cousin marriage terminates and keeps cousins same tier', () => {
  const t = tree('gp', ['gp','p1','p2','c1','c2'].map((id) => person(id)),
    [pc('gp','p1'), pc('gp','p2'), pc('p1','c1'), pc('p2','c2'), sp('c1','c2')]);
  const { tierOf } = assignTiers(t, buildUnions(t));
  expect(tierOf.get('c1')).toBe(tierOf.get('c2'));
  expect(tierOf.get('p1')).toBe(tierOf.get('p2'));
});
