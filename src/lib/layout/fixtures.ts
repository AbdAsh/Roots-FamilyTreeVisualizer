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
/** Single-arg wrapper safe to use as Array.map callback */
const p = (id: string) => person(id);

export const CASES: { name: string; tree: FamilyTree }[] = [
  { name: 'single', tree: tree('a', [person('a')], []) },
  { name: 'nuclear', tree: tree('a',
      ['a','b','c1','c2'].map(p),
      [sp('a','b'), pc('a','c1'), pc('b','c1'), pc('a','c2'), pc('b','c2')]) },
  { name: 'many-siblings', tree: tree('a',
      ['a','b','c1','c2','c3','c4'].map(p),
      [sp('a','b'), ...['c1','c2','c3','c4'].flatMap((c) => [pc('a',c), pc('b',c)])]) },
  { name: 'multiple-marriages', tree: tree('a',
      ['a','b1','b2','x1','y1'].map(p),
      [sp('a','b1'), sp('a','b2'), pc('a','x1'), pc('b1','x1'), pc('a','y1'), pc('b2','y1')]) },
  { name: 'single-parent', tree: tree('a', ['a','c'].map(p), [pc('a','c')]) },
  { name: 'unmarried-coparents', tree: tree('a',
      ['a','b','c'].map(p), [pc('a','c'), pc('b','c')]) },
  { name: 'ancestors-chain', tree: tree('a',
      ['a','p','gp'].map(p), [pc('p','a'), pc('gp','p')]) },
  { name: 'both-sides-ancestors', tree: tree('a',
      ['a','f','m','gf1','gm1','gf2','gm2'].map(p),
      [sp('f','m'), pc('f','a'), pc('m','a'),
       sp('gf1','gm1'), pc('gf1','f'), pc('gm1','f'),
       sp('gf2','gm2'), pc('gf2','m'), pc('gm2','m')]) },
  { name: 'aunts-uncles', tree: tree('a',
      ['a','f','m','unc','gf','gm','cous'].map(p),
      [sp('f','m'), pc('f','a'), pc('m','a'),
       sp('gf','gm'), pc('gf','f'), pc('gm','f'), pc('gf','unc'), pc('gm','unc'),
       pc('unc','cous')]) },
  { name: 'disconnected', tree: tree('a',
      ['a','b','x','y'].map(p), [sp('a','b'), sp('x','y')]) }, // x,y unreachable from a
  { name: 'cousin-marriage', tree: tree('gp',
      ['gp','p1','p2','c1','c2'].map(p),
      [pc('gp','p1'), pc('gp','p2'), pc('p1','c1'), pc('p2','c2'), sp('c1','c2')]) },
  { name: 'same-sex-couple', tree: tree('a',
      ['a','b','c'].map(p), [sp('a','b'), pc('a','c'), pc('b','c')]) },
  { name: 'adoption-three-parents', tree: tree('a',
      ['a','b','x','c'].map(p), [sp('a','b'), pc('a','c'), pc('b','c'), pc('x','c')]) },
  { name: 'wide-generation', tree: tree('gp',
      ['gp', ...Array.from({length: 8}, (_, i) => `k${i}`)].map(p),
      Array.from({length: 8}, (_, i) => pc('gp', `k${i}`))) },
  { name: 'deep', tree: tree('g0',
      Array.from({length: 6}, (_, i) => `g${i}`).map(p),
      Array.from({length: 5}, (_, i) => pc(`g${i}`, `g${i+1}`))) },
  { name: 'blended', tree: tree('a',
      ['a','b','pa','pb','k1','k2'].map(p),
      // a + b now partnered; a's child k1 is from prior partner pa; b's child k2 from prior partner pb
      [sp('a','b'), pc('a','k1'), pc('pa','k1'), pc('b','k2'), pc('pb','k2')]) },
  { name: 'linear-descent', tree: tree('a', ['a','c','gc'].map(p), [pc('a','c'), pc('c','gc')]) },
  { name: 'reroot', tree: tree('c', // same as nuclear but rooted at a child
      ['a','b','c1','c2'].map(p),
      [sp('a','b'), pc('a','c1'), pc('b','c1'), pc('a','c2'), pc('b','c2')]) },
];
