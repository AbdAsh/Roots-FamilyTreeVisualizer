import type { FamilyTree, Relationship } from '@/types/family';
import type { Union } from './unions';

class UF {
  private p = new Map<string, string>();
  find(x: string): string {
    let r = this.p.get(x); if (r === undefined) { this.p.set(x, x); return x; }
    if (r !== x) { r = this.find(r); this.p.set(x, r); } return r;
  }
  union(a: string, b: string): void { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

export function assignTiers(tree: FamilyTree, unions: Union[]): {
  tierOf: Map<string, number>;
  referenceEdges: Relationship[];
} {
  const uf = new UF();
  for (const m of tree.members) uf.find(m.id);
  for (const u of unions) for (let i = 1; i < u.parentIds.length; i++) uf.union(u.parentIds[0], u.parentIds[i]);

  // class DAG: classOf(parent) -> classOf(child)
  const adj = new Map<string, Set<string>>();
  for (const u of unions) {
    if (u.parentIds.length === 0) continue;
    const parentClass = uf.find(u.parentIds[0]);
    for (const c of u.childIds) {
      const cc = uf.find(c);
      if (cc === parentClass) continue;
      let s = adj.get(parentClass);
      if (!s) { s = new Set<string>(); adj.set(parentClass, s); }
      s.add(cc);
    }
  }
  // longest-path layering with DFS back-edge detection (drop cycles)
  const classes = [...new Set(tree.members.map((m) => uf.find(m.id)))];
  const tier = new Map<string, number>(classes.map((c) => [c, 0]));
  const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited 1=onstack 2=done
  const backEdges: [string, string][] = [];
  function dfs(u: string): void {
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      if (state.get(v) === 1) { backEdges.push([u, v]); continue; } // skip cycle edge
      if (state.get(v) !== 2) dfs(v);
      tier.set(v, Math.max(tier.get(v)!, tier.get(u)! + 1));
    }
    state.set(u, 2);
  }
  // iterate to a fixed point for longest path across the DAG (small graphs)
  for (let pass = 0; pass < classes.length; pass++) {
    state.clear();
    for (const c of classes) if (state.get(c) !== 2) dfs(c);
  }
  const tierOf = new Map<string, number>();
  for (const m of tree.members) tierOf.set(m.id, tier.get(uf.find(m.id))!);
  // normalize so min tier = 0
  const min = Math.min(...tierOf.values());
  for (const [k, v] of tierOf) tierOf.set(k, v - min);

  // referenceEdges: parent-child relationships whose class-edge was a back-edge
  const refSet = new Set(backEdges.map(([a, b]) => `${a}->${b}`));
  const referenceEdges = tree.relationships.filter(
    (r) => r.type === 'parent-child' && refSet.has(`${uf.find(r.from)}->${uf.find(r.to)}`),
  );
  return { tierOf, referenceEdges };
}
