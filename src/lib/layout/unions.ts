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
