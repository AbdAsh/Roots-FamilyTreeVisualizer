import type { FamilyTree, Relationship } from '@/types/family';
import type { Union } from './unions';

class UF {
  private p = new Map<string, string>();
  /** Iterative find with path compression — safe on long parent chains (no recursion). */
  find(x: string): string {
    if (!this.p.has(x)) {
      this.p.set(x, x);
      return x;
    }
    let r = x;
    while (this.p.get(r)! !== r) r = this.p.get(r)!;
    // Compress the path so repeated lookups stay flat.
    let cur = x;
    while (cur !== r) {
      const next = this.p.get(cur)!;
      this.p.set(cur, r);
      cur = next;
    }
    return r;
  }
  union(a: string, b: string): void {
    const ra = this.find(a),
      rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  }
}

export function assignTiers(tree: FamilyTree, unions: Union[]): {
  tierOf: Map<string, number>;
  referenceEdges: Relationship[];
} {
  const uf = new UF();
  for (const m of tree.members) uf.find(m.id);
  for (const u of unions) for (let i = 1; i < u.parentIds.length; i++) uf.union(u.parentIds[0], u.parentIds[i]);

  // class DAG: classOf(parent) -> classOf(child)
  const adj = new Map<string, string[]>();
  for (const u of unions) {
    if (u.parentIds.length === 0) continue;
    const parentClass = uf.find(u.parentIds[0]);
    for (const c of u.childIds) {
      const cc = uf.find(c);
      if (cc === parentClass) continue;
      let arr = adj.get(parentClass);
      if (!arr) { arr = []; adj.set(parentClass, arr); }
      if (!arr.includes(cc)) arr.push(cc);
    }
  }

  const classes = [...new Set(tree.members.map((m) => uf.find(m.id)))];

  // ── Longest-path layering ──
  // Iterative DFS (explicit stack — no recursion, so a multi-thousand-deep
  // lineage can't overflow) produces a finish order and flags back-edges
  // (cycles). Reverse-finish order is a topological order of the DAG, so a
  // SINGLE relaxation pass computes longest paths in O(V+E) — the previous
  // fixed-point loop was O(classes²·E) and degraded badly on large trees.
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, 0 | 1 | 2>();
  const finishOrder: string[] = [];
  const backEdges = new Set<string>(); // `${u}->${v}`

  for (const start of classes) {
    if ((color.get(start) ?? WHITE) !== WHITE) continue;
    const stack: { u: string; i: number }[] = [{ u: start, i: 0 }];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const nbrs = adj.get(frame.u);
      if (nbrs && frame.i < nbrs.length) {
        const v = nbrs[frame.i++];
        const cv = color.get(v) ?? WHITE;
        if (cv === GRAY) {
          backEdges.add(`${frame.u}->${v}`); // cycle edge — skip in relaxation
        } else if (cv === WHITE) {
          color.set(v, GRAY);
          stack.push({ u: v, i: 0 });
        }
        // BLACK: forward/cross edge to a finished node — fine, no action
      } else {
        color.set(frame.u, BLACK);
        finishOrder.push(frame.u);
        stack.pop();
      }
    }
  }

  const tier = new Map<string, number>(classes.map((c) => [c, 0]));
  // Relax in topological (reverse-finish) order; predecessors are finalised
  // before each node, so one pass suffices.
  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const u = finishOrder[i];
    const nbrs = adj.get(u);
    if (!nbrs) continue;
    const tu = tier.get(u)!;
    for (const v of nbrs) {
      if (backEdges.has(`${u}->${v}`)) continue;
      if (tu + 1 > (tier.get(v) ?? 0)) tier.set(v, tu + 1);
    }
  }

  const tierOf = new Map<string, number>();
  for (const m of tree.members) tierOf.set(m.id, tier.get(uf.find(m.id))!);
  // normalize so min tier = 0 (loop, not Math.min(...spread), to stay safe on large trees)
  let min = Infinity;
  for (const v of tierOf.values()) if (v < min) min = v;
  if (min !== 0 && min !== Infinity) for (const [k, v] of tierOf) tierOf.set(k, v - min);

  // referenceEdges: parent-child relationships whose class-edge was a back-edge
  const referenceEdges = tree.relationships.filter(
    (r) => r.type === 'parent-child' && backEdges.has(`${uf.find(r.from)}->${uf.find(r.to)}`),
  );
  return { tierOf, referenceEdges };
}
