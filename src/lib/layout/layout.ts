/**
 * Union-aware layered layout engine.
 *
 * Lays out ONE connected component at a time:
 *  1. Choose an anchor (the root member if present, else lowest-tier / lowest-index).
 *  2. Build a DESCENDANT union-tree from the anchor downward and run a
 *     Buchheim–Reingold–Tilford contour pass (`firstWalk`/`secondWalk`/`thirdWalk`).
 *  3. Build an ANCESTOR union-tree from the anchor upward (aunts/uncles + their
 *     families included) and lay it out with the same contour growing upward.
 *  4. Stitch the two layouts at the anchor (descendant-x wins) and union the maps.
 *
 * The orchestrator (`computeTieredLayout` in `tree-utils.ts`) then packs the
 * per-component maps side by side and centres the whole thing.
 *
 * Pure functions — no DOM, node-testable.
 *
 * @module layout
 */
import type { FamilyTree } from '@/types/family';
import type { Union } from './unions';

/* ── Spacing constants ──
 * COL_GAP / SPOUSE_OFFSET are tuned so the real horizontal spacing between two
 * node centres on a tier is always ≥ MIN_SEP (80) — the `assertNoOverlap`
 * contract. A 1-unit `sep()` gap = COL_GAP px; partner offsets = SPOUSE_OFFSET px.
 */
export const TIER_GAP = 180;
export const COL_GAP = 200;
export const SPOUSE_OFFSET = 120;

/* ═══════ Buchheim–Reingold–Tilford primitives ═══════ */

export interface BNode {
  id: string;
  /** Partners that flank this node (one per attached down/up union, deduped). */
  spouseIds: string[];
  children: BNode[];
  parent: BNode | null;
  tier: number;
  /** Extra "unit widths" this node occupies to the right (for partners). */
  size: number;
  x: number;
  mod: number;
  thread: BNode | null;
  ancestor: BNode;
  change: number;
  shift: number;
  number: number;
}

function leftBro(v: BNode): BNode | null {
  if (!v.parent) return null;
  const sibs = v.parent.children;
  for (let i = 1; i < sibs.length; i++) {
    if (sibs[i] === v) return sibs[i - 1];
  }
  return null;
}

function leftmostSib(v: BNode): BNode | null {
  if (!v.parent || v === v.parent.children[0]) return null;
  return v.parent.children[0];
}

function nLeft(v: BNode): BNode | null {
  return v.children.length > 0 ? v.children[0] : v.thread;
}

function nRight(v: BNode): BNode | null {
  return v.children.length > 0 ? v.children[v.children.length - 1] : v.thread;
}

/** Minimum separation between two adjacent sibling nodes (in layout units). */
function sep(left: BNode, _right: BNode): number {
  // 1 base unit + extra for the left node's partner width
  return 1 + left.size;
}

function moveSub(wl: BNode, wr: BNode, sh: number) {
  const n = wr.number - wl.number;
  if (n > 0) {
    wr.change -= sh / n;
    wr.shift += sh;
    wl.change += sh / n;
  }
  wr.x += sh;
  wr.mod += sh;
}

function execShifts(v: BNode) {
  let s = 0,
    c = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i];
    w.x += s;
    w.mod += s;
    c += w.change;
    s += w.shift + c;
  }
}

function findAnc(vil: BNode, v: BNode, da: BNode): BNode {
  return v.parent && v.parent.children.includes(vil.ancestor)
    ? vil.ancestor
    : da;
}

function apportion(v: BNode, da: BNode): BNode {
  const w = leftBro(v);
  if (!w) return da;

  let vir: BNode = v,
    vor: BNode = v,
    vil: BNode = w;
  let vol: BNode = leftmostSib(v) ?? v;
  let sir = vir.mod,
    sor = vor.mod,
    sil = vil.mod,
    sol = vol.mod;

  let nr = nRight(vil),
    nl = nLeft(vir);
  while (nr && nl) {
    vil = nr;
    vir = nl;
    const nlv = nLeft(vol);
    const nrv = nRight(vor);
    if (!nlv || !nrv) break;
    vol = nlv;
    vor = nrv;
    vor.ancestor = v;

    const shift = vil.x + sil - (vir.x + sir) + sep(vil, vir);
    if (shift > 0) {
      moveSub(findAnc(vil, v, da), v, shift);
      sir += shift;
      sor += shift;
    }

    sil += vil.mod;
    sir += vir.mod;
    sol += vol.mod;
    sor += vor.mod;
    nr = nRight(vil);
    nl = nLeft(vir);
  }

  if (nr && !nRight(vor)) {
    vor.thread = nr;
    vor.mod += sil - sor;
  }
  if (nl && !nLeft(vol)) {
    vol.thread = nl;
    vol.mod += sir - sol;
  }
  return v;
}

function firstWalk(v: BNode) {
  if (v.children.length === 0) {
    const lb = leftBro(v);
    v.x = lb ? lb.x + sep(lb, v) : 0;
  } else {
    let da = v.children[0];
    for (const c of v.children) {
      firstWalk(c);
      da = apportion(c, da);
    }
    execShifts(v);
    const mid = (v.children[0].x + v.children[v.children.length - 1].x) / 2;
    const lb = leftBro(v);
    if (lb) {
      v.x = lb.x + sep(lb, v);
      v.mod = v.x - mid;
    } else {
      v.x = mid;
    }
  }
}

function secondWalk(v: BNode, m: number): number {
  v.x += m;
  let min = v.x;
  for (const c of v.children) min = Math.min(min, secondWalk(c, m + v.mod));
  return min;
}

function thirdWalk(v: BNode, n: number) {
  v.x += n;
  for (const c of v.children) thirdWalk(c, n);
}

/** Run the full Buchheim pass and normalise so the minimum x is 0. */
function runBuchheim(root: BNode): void {
  firstWalk(root);
  const minX = secondWalk(root, 0);
  if (minX !== 0) thirdWalk(root, -minX);
}

/* ═══════ Union-aware tree construction ═══════ */

export interface Pos {
  x: number;
  y: number;
}

interface UnionIndex {
  /** unions a person parents, in deterministic order */
  downUnionsOf: Map<string, Union[]>;
  /** the union whose childIds include the person (their up-union) */
  upUnionOf: Map<string, Union>;
}

/** Index unions by person for fast descendant/ancestor traversal. */
function indexUnions(unions: Union[], memberOrder: Map<string, number>): UnionIndex {
  const downUnionsOf = new Map<string, Union[]>();
  const upUnionOf = new Map<string, Union>();
  // Deterministic union order: by first child index, then by parent index.
  const unionRank = (u: Union): number => {
    const childRanks = u.childIds.map((c) => memberOrder.get(c) ?? Infinity);
    const parentRanks = u.parentIds.map((p) => memberOrder.get(p) ?? Infinity);
    const minChild = childRanks.length ? Math.min(...childRanks) : Infinity;
    const minParent = parentRanks.length ? Math.min(...parentRanks) : Infinity;
    return minChild !== Infinity ? minChild : minParent;
  };
  const sorted = [...unions].sort((a, b) => unionRank(a) - unionRank(b));
  for (const u of sorted) {
    for (const p of u.parentIds) {
      const arr = downUnionsOf.get(p) ?? [];
      arr.push(u);
      downUnionsOf.set(p, arr);
    }
    for (const c of u.childIds) {
      if (!upUnionOf.has(c)) upUnionOf.set(c, u);
    }
  }
  return { downUnionsOf, upUnionOf };
}

/**
 * Build the descendant union-tree from `anchorId` downward.
 *
 * A person's layout-children are the children of each down-union they parent.
 * Partners in each down-union attach as couple-offset spouses (per union, so
 * half-siblings stay grouped under the correct partner offset). Children are
 * ordered union-by-union so they remain contiguous under their union.
 */
function buildDescendant(
  anchorId: string,
  idx: UnionIndex,
  tierOf: Map<string, number>,
  placed: Set<string>,
  parent: BNode | null,
): BNode {
  placed.add(anchorId);
  const node: BNode = {
    id: anchorId,
    spouseIds: [],
    children: [],
    parent,
    tier: tierOf.get(anchorId) ?? 0,
    size: 0,
    x: 0,
    mod: 0,
    thread: null,
    ancestor: null!,
    change: 0,
    shift: 0,
    number: 0,
  };
  node.ancestor = node;

  const myTier = node.tier;
  const downUnions = idx.downUnionsOf.get(anchorId) ?? [];
  const partners: string[] = [];
  const childNodes: BNode[] = [];

  for (const u of downUnions) {
    // Attach the OTHER parents of this union as partners (couple-offset) iff
    // they share this person's tier and aren't already placed elsewhere.
    for (const pid of u.parentIds) {
      if (pid === anchorId) continue;
      if (placed.has(pid)) continue;
      if ((tierOf.get(pid) ?? myTier) !== myTier) continue;
      placed.add(pid);
      partners.push(pid);
    }
    // Children of this down-union, in deterministic union order.
    for (const cid of u.childIds) {
      if (placed.has(cid)) continue;
      if ((tierOf.get(cid) ?? myTier + 1) !== myTier + 1) continue; // cycle/back edge guard
      childNodes.push(buildDescendant(cid, idx, tierOf, placed, node));
    }
  }

  node.spouseIds = partners;
  node.size = partners.length * (SPOUSE_OFFSET / COL_GAP);
  // Re-number children for Buchheim shift bookkeeping.
  node.children = childNodes;
  node.children.forEach((c, i) => (c.number = i + 1));
  return node;
}

/** Extract pixel positions from a laid-out Buchheim tree into `pos`. */
function extractPositions(root: BNode, pos: Map<string, Pos>): void {
  const walk = (v: BNode) => {
    const px = v.x * COL_GAP;
    const py = v.tier * TIER_GAP;
    if (!pos.has(v.id)) pos.set(v.id, { x: px, y: py });
    for (let i = 0; i < v.spouseIds.length; i++) {
      const sid = v.spouseIds[i];
      if (!pos.has(sid)) pos.set(sid, { x: px + SPOUSE_OFFSET * (i + 1), y: py });
    }
    for (const c of v.children) walk(c);
  };
  walk(root);
}

/**
 * Lay out a single connected component.
 *
 * @returns a map of member id → local position (not yet packed/centred).
 */
export function computeUnionLayout(
  tree: FamilyTree,
  component: Set<string>,
  unions: Union[],
  tierOf: Map<string, number>,
): Map<string, Pos> {
  const memberOrder = new Map(tree.members.map((m, i) => [m.id, i]));

  // Unions confined to this component.
  const compUnions = unions.filter(
    (u) =>
      u.parentIds.some((p) => component.has(p)) ||
      u.childIds.some((c) => component.has(c)),
  );
  const idx = indexUnions(compUnions, memberOrder);

  // ── Anchor: rootMemberId if in component, else lowest tier then lowest index.
  // Used only to bias founder ordering so the focus's lineage renders first. ──
  let anchor: string;
  if (component.has(tree.rootMemberId)) {
    anchor = tree.rootMemberId;
  } else {
    anchor = [...component].sort((a, b) => {
      const ta = tierOf.get(a) ?? 0;
      const tb = tierOf.get(b) ?? 0;
      if (ta !== tb) return ta - tb;
      return (memberOrder.get(a) ?? 0) - (memberOrder.get(b) ?? 0);
    })[0];
  }

  // ── Founders: genealogical tops of the component (no in-component parent). ──
  const hasInCompParent = (id: string): boolean => {
    const up = idx.upUnionOf.get(id);
    if (!up) return false;
    return up.parentIds.some((p) => component.has(p) && p !== id);
  };
  const founders = [...component].filter((id) => !hasInCompParent(id));

  // Founders on the anchor's ancestral path render first; then by tier, then
  // member index — deterministic.
  const anchorAncestry = new Set<string>();
  {
    let cur: string | undefined = anchor;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      anchorAncestry.add(cur);
      const up = idx.upUnionOf.get(cur);
      cur = up?.parentIds.find((p) => component.has(p) && !guard.has(p));
    }
  }
  founders.sort((a, b) => {
    const aa = anchorAncestry.has(a) ? 0 : 1;
    const ab = anchorAncestry.has(b) ? 0 : 1;
    if (aa !== ab) return aa - ab;
    const ta = tierOf.get(a) ?? 0;
    const tb = tierOf.get(b) ?? 0;
    if (ta !== tb) return ta - tb;
    return (memberOrder.get(a) ?? 0) - (memberOrder.get(b) ?? 0);
  });

  // ── Lay out a descendant tree per founder; pack founder-trees left-to-right
  // within the component. A `placed` set shared across founders prevents
  // double-placing people reached as a partner of an earlier founder's line. ──
  const placed = new Set<string>();
  const pos = new Map<string, Pos>();
  let packX = 0;

  for (const founder of founders) {
    if (placed.has(founder)) continue;
    if (!component.has(founder)) continue;
    const root = buildDescendant(founder, idx, tierOf, placed, null);
    runBuchheim(root);
    const local = new Map<string, Pos>();
    extractPositions(root, local);
    if (local.size === 0) continue;

    let xMin = Infinity;
    let xMax = -Infinity;
    for (const p of local.values()) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
    }
    const shift = packX - xMin;
    for (const [id, p] of local) {
      if (!pos.has(id)) pos.set(id, { x: p.x + shift, y: p.y });
    }
    packX += xMax - xMin + COL_GAP;
  }

  // ── Fallback: place any component member not yet positioned ──
  // (defensive — handles cycle-pruned subtrees / sibling-only links / a
  // partner whose own lineage was a separate founder tree).
  for (const id of component) {
    if (pos.has(id)) continue;
    const t = tierOf.get(id) ?? 0;
    const py = t * TIER_GAP;
    let maxX = -Infinity;
    for (const [oid, p] of pos) {
      if ((tierOf.get(oid) ?? 0) === t) maxX = Math.max(maxX, p.x);
    }
    const x = maxX === -Infinity ? packX : maxX + COL_GAP;
    pos.set(id, { x, y: py });
  }

  return pos;
}
