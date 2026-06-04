import type { FamilyTree } from '@/types/family';

export function connectedComponents(tree: FamilyTree): Set<string>[] {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) { s = new Set<string>(); adj.set(a, s); }
    s.add(b);
  };
  for (const m of tree.members) adj.set(m.id, new Set());
  for (const r of tree.relationships) { link(r.from, r.to); link(r.to, r.from); }
  const seen = new Set<string>();
  const comps: Set<string>[] = [];
  for (const m of tree.members) {
    if (seen.has(m.id)) continue;
    const comp = new Set<string>(); const stack = [m.id];
    while (stack.length) {
      const id = stack.pop()!; if (comp.has(id)) continue;
      comp.add(id); seen.add(id);
      for (const nb of adj.get(id) ?? []) if (!comp.has(nb)) stack.push(nb);
    }
    comps.push(comp);
  }
  // deterministic: order components by their earliest member index, root component first
  const order = new Map(tree.members.map((m, i) => [m.id, i]));
  comps.sort((c1, c2) => Math.min(...[...c1].map((x) => order.get(x)!)) - Math.min(...[...c2].map((x) => order.get(x)!)));
  return comps;
}
