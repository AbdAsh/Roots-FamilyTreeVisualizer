/**
 * Union-aware layered layout engine.
 *
 * Founder-based descendant layout: there is no separate ancestor pass. For each
 * connected component we find its genealogical tops (founders — members with no
 * in-component parent), then lay each founder's lineage out DOWNWARD with a
 * Buchheim–Reingold–Tilford contour pass and pack the founder trees
 * left-to-right.
 *
 * The Buchheim tree alternates PERSON and UNION nodes:
 *  - A person node's geometry-children are UNION nodes (one per down-union).
 *  - A union node's geometry-children are the PERSON nodes of that union's kids.
 *  - A union node is centred over its children, and its two (or more) parents
 *    are placed symmetrically straddling that centre — so the couple's midpoint
 *    sits over the children's midpoint ("Centering"), and the parents occupy
 *    contiguous slots ("Couples adjacent"). Spacing reservations on each side
 *    keep the symmetric couple from overlapping neighbouring subtrees.
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
 * contract. Layout runs in "units" where 1 unit = COL_GAP px; the Buchheim x of
 * a node is its geometric centre. Partner offsets within a couple = SPOUSE_OFFSET px.
 */
export const TIER_GAP = 180;
export const COL_GAP = 200;
export const SPOUSE_OFFSET = 120;

/** Minimum centre-to-centre gap (px) between any two nodes on a tier. */
const MIN_SEP = 80;
/** Same gap expressed in layout units. */
const MIN_SEP_UNITS = MIN_SEP / COL_GAP;
/** Partner offset expressed in layout units. */
const SPOUSE_UNITS = SPOUSE_OFFSET / COL_GAP;

/* ═══════ Buchheim–Reingold–Tilford primitives ═══════ */

export interface BNode {
  /** 'person' nodes render a member; 'union' nodes are virtual couple anchors. */
  kind: 'person' | 'union';
  /** Person id (person nodes) or union id (union nodes). */
  id: string;
  /**
   * Union nodes only: the couple's member ids in render order (left→right). The
   * union node's x is the couple midpoint; members straddle it symmetrically.
   */
  coupleIds: string[];
  /** Union nodes only: the member whose lineage anchors this union (one of `coupleIds`). */
  primaryId: string;
  /**
   * Person nodes only: a spouse merged into this node as a co-anchor (separate
   * family). Its unions sit to the right with the spouse couple adjacent in the
   * middle; null when there is no merged co-spouse.
   */
  coSpouseId: string | null;
  children: BNode[];
  parent: BNode | null;
  tier: number;
  /**
   * Half-widths (in layout units) reserved either side of this node's centre,
   * so symmetric couples never collide with neighbouring subtrees.
   */
  halfLeft: number;
  halfRight: number;
  x: number;
  mod: number;
  thread: BNode | null;
  ancestor: BNode;
  change: number;
  shift: number;
  number: number;
  /**
   * Offset (in units) of this node's own centre from the centroid of its
   * children. A person whose couple straddles the children's midpoint sits to
   * the LEFT of that midpoint by half the couple span, so its rendered x lines
   * up with what an ancestor union centres over. 0 for union nodes (centred).
   */
  centerBias: number;
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

/**
 * Minimum centre-to-centre separation between two adjacent sibling nodes
 * (in layout units): the right half-width of the left node + a base gap + the
 * left half-width of the right node. Symmetric couples reserve space on both
 * sides via their half-widths, so this prevents overlap at the new placement.
 */
function sep(left: BNode, right: BNode): number {
  return left.halfRight + Math.max(1, MIN_SEP_UNITS) + right.halfLeft;
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
    // The node's own centre sits `centerBias` from the children's centroid; the
    // children's centroid is therefore `v.x - centerBias`.
    const lb = leftBro(v);
    if (lb) {
      v.x = lb.x + sep(lb, v);
      v.mod = v.x - v.centerBias - mid;
    } else {
      v.x = mid + v.centerBias;
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

/** Allocate a blank BNode with Buchheim bookkeeping fields zeroed. */
function makeBNode(kind: 'person' | 'union', id: string, tier: number, parent: BNode | null): BNode {
  const node: BNode = {
    kind,
    id,
    coupleIds: [],
    primaryId: kind === 'person' ? id : '',
    coSpouseId: null,
    children: [],
    parent,
    tier,
    halfLeft: 0,
    halfRight: 0,
    x: 0,
    mod: 0,
    thread: null,
    ancestor: null!,
    change: 0,
    shift: 0,
    number: 0,
    centerBias: 0,
  };
  node.ancestor = node;
  return node;
}

/**
 * Build the descendant tree from `anchorId` downward as an alternating
 * person/union BNode tree.
 *
 * A person node's geometry-children are UNION nodes (one per down-union that
 * has children placeable on the next tier). A union node's geometry-children
 * are the person nodes of that union's children. A partner that has its own
 * in-tree lineage (an up-union with another in-component parent) is NOT pulled
 * in here — it is positioned by its own founder line; this union only records
 * it in `coupleIds` for centering, drawing the spouse edge as-is.
 */
function buildDescendant(
  anchorId: string,
  idx: UnionIndex,
  tierOf: Map<string, number>,
  placed: Set<string>,
  spousePairs: Set<string>,
  parent: BNode | null,
): BNode {
  placed.add(anchorId);
  const myTier = tierOf.get(anchorId) ?? 0;
  const person = makeBNode('person', anchorId, myTier, parent);

  // ── Co-spouse detection (before consuming partners) ──
  // If the anchor has a same-tier spouse `co` that is also an unplaced founder
  // with its OWN child-bearing union(s), pull `co` into this person node as a
  // co-anchor so the spouse couple renders adjacent (e.g. blended: pa·a·b·pb).
  let coSpouseId: string | null = null;
  for (const u of idx.downUnionsOf.get(anchorId) ?? []) {
    if (u.childIds.length > 0) continue; // a child-bearing couple already adjoins
    for (const pid of u.parentIds) {
      if (pid === anchorId) continue;
      if (placed.has(pid)) continue;
      if ((tierOf.get(pid) ?? myTier) !== myTier) continue;
      if (!spousePairs.has([anchorId, pid].sort().join('|'))) continue;
      const coHasOwnLineage = idx.upUnionOf.has(pid)
        ? idx.upUnionOf.get(pid)!.parentIds.some((p) => p !== pid)
        : false;
      // The co-spouse must head its OWN separate family — a child-bearing union
      // that the anchor is NOT part of. (Excludes adoption, where the spouses
      // co-parent the same child.)
      const coHasSeparateFamily = (idx.downUnionsOf.get(pid) ?? []).some(
        (cu) => cu.childIds.length > 0 && !cu.parentIds.includes(anchorId),
      );
      if (!coHasOwnLineage && coHasSeparateFamily) {
        coSpouseId = pid;
        break;
      }
    }
    if (coSpouseId) break;
  }
  // Reserve the co-spouse so the anchor's childless spouse-union does not
  // consume it as a plain trailing partner.
  if (coSpouseId) placed.add(coSpouseId);

  /**
   * Build the UNION nodes for one primary parent (the anchor or a co-spouse
   * merged into the same person node). Mutates `placed` and recurses into the
   * unions' children. Childless spouse partners (with no own lineage) are
   * recorded on `person.coupleIds` so they still get a slot.
   */
  const buildUnionNodesFor = (primaryId: string): BNode[] => {
    // Child-bearing unions before childless ones so a partner shared between a
    // marriage with children and a bare spouse-record is claimed by the union
    // that positions the children (e.g. {a,b,x}→c, not the {a,b} spouse edge).
    const downUnions = (idx.downUnionsOf.get(primaryId) ?? [])
      .map((u, i) => ({ u, i }))
      .sort((a, b) => {
        const ac = a.u.childIds.length > 0 ? 0 : 1;
        const bc = b.u.childIds.length > 0 ? 0 : 1;
        return ac !== bc ? ac - bc : a.i - b.i;
      })
      .map((e) => e.u);
    const nodes: BNode[] = [];

    for (const u of downUnions) {
      // Partners of this union on the same tier. A partner with its own
      // in-component lineage is positioned by that lineage, not as a couple
      // member here — only "married-in" leaf spouses are co-placed; the other
      // parent is still recorded so the post-pass can re-centre the children.
      const partners: string[] = [];
      for (const pid of u.parentIds) {
        if (pid === primaryId) continue;
        if ((tierOf.get(pid) ?? myTier) !== myTier) continue;
        const hasOwnLineage = idx.upUnionOf.has(pid)
          ? idx.upUnionOf.get(pid)!.parentIds.some((p) => p !== pid)
          : false;
        if (hasOwnLineage) continue; // positioned by its own founder tree
        if (placed.has(pid)) continue;
        placed.add(pid);
        partners.push(pid);
      }
      // Spouse-partners flank the primary; extras (e.g. an adoptive third
      // parent) go to the far end so the spouse couple stays adjacent.
      partners.sort((p1, p2) => {
        const s1 = spousePairs.has([primaryId, p1].sort().join('|')) ? 0 : 1;
        const s2 = spousePairs.has([primaryId, p2].sort().join('|')) ? 0 : 1;
        return s1 - s2;
      });

      const childPersons: BNode[] = [];
      for (const cid of u.childIds) {
        if (placed.has(cid)) continue;
        if ((tierOf.get(cid) ?? myTier + 1) !== myTier + 1) continue; // cycle/back-edge guard
        childPersons.push(buildDescendant(cid, idx, tierOf, placed, spousePairs, null));
      }

      if (childPersons.length === 0) {
        person.coupleIds.push(...partners);
        continue;
      }

      const coupleIds = [primaryId, ...partners];
      const union = makeBNode('union', `union:${primaryId}:${u.id}`, myTier, person);
      union.coupleIds = coupleIds;
      union.primaryId = primaryId;
      union.children = childPersons;
      childPersons.forEach((c, i) => {
        c.parent = union;
        c.number = i + 1;
      });
      const span = (coupleIds.length - 1) * SPOUSE_UNITS;
      union.halfLeft = span / 2;
      union.halfRight = span / 2;
      nodes.push(union);
    }
    return nodes;
  };

  const unionNodes = buildUnionNodesFor(anchorId);

  let coUnionNodes: BNode[] = [];
  if (coSpouseId) {
    coUnionNodes = buildUnionNodesFor(coSpouseId);
    person.coSpouseId = coSpouseId;
    // `person.coupleIds` records the spouse so the edge is drawn; the anchor's
    // families sit left, the co-spouse's right, with the couple adjacent in the
    // middle (union-node ordering below).
    if (!person.coupleIds.includes(coSpouseId)) person.coupleIds.push(coSpouseId);
  }

  // Order union nodes so the spouse couple sits in the middle: anchor's unions
  // ascending then co-spouse's unions. This yields rows like pa·a·b·pb.
  person.children = [...unionNodes, ...coUnionNodes];
  person.children.forEach((u, i) => (u.number = i + 1));

  if (coSpouseId) {
    // The person node represents the spouse couple; centre it over its unions.
    person.centerBias = 0;
    person.halfLeft = Math.max(person.halfLeft, SPOUSE_UNITS);
    person.halfRight = Math.max(person.halfRight, SPOUSE_UNITS);
  } else if (unionNodes.length === 1) {
    // Single down-union: the person is the leftmost couple member, so it sits
    // half the couple span LEFT of the children's centroid. Bias its own centre
    // accordingly and reserve the partner span on its right for spacing.
    const partnerCount = unionNodes[0].coupleIds.length - 1;
    const halfSpan = (partnerCount * SPOUSE_UNITS) / 2;
    person.centerBias = -halfSpan;
    person.halfLeft = Math.max(person.halfLeft, halfSpan);
    person.halfRight = Math.max(person.halfRight, halfSpan + halfSpan);
  } else if (person.children.length === 0 && person.coupleIds.length > 0) {
    // Childless person carrying partner slots reserves room for them (trailing
    // the person in the row).
    person.halfRight = person.coupleIds.length * SPOUSE_UNITS;
  }
  return person;
}

/**
 * Extract pixel positions from a laid-out person/union BNode tree.
 *
 * Person nodes carry no geometry of their own beyond their Buchheim x; the
 * actual rendered positions of a couple are derived from each union node's
 * centre so the couple straddles it symmetrically (Centering + Couples
 * adjacent). A person shared between two unions is placed once, as the pivot
 * between them.
 */
function extractPositions(root: BNode, pos: Map<string, Pos>): void {
  const setPos = (id: string, x: number, y: number) => {
    if (!pos.has(id)) pos.set(id, { x, y });
  };

  const walk = (v: BNode) => {
    if (v.kind === 'person') {
      const py = v.tier * TIER_GAP;
      const unions = v.children; // union nodes
      const px = v.x * COL_GAP;

      if (unions.length === 0) {
        // Leaf person (possibly with trailing childless partners).
        setPos(v.id, px, py);
        v.coupleIds.forEach((sid, i) => setPos(sid, px + SPOUSE_OFFSET * (i + 1), py));
      } else if (v.coSpouseId) {
        // Merged spouse couple (separate families): the anchor is the RIGHT
        // member of its own (left) families, the co-spouse the LEFT member of
        // its (right) families, so the couple is adjacent: …pa·a·b·pb…. Each
        // union's partner is offset to the outer side; the post-pass re-centres
        // the children under the true couple midpoints.
        const anchor = v.id;
        const co = v.coSpouseId;
        const anchorUnions = unions.filter((u) => u.primaryId === anchor).sort((a, b) => a.x - b.x);
        const coUnions = unions.filter((u) => u.primaryId === co).sort((a, b) => a.x - b.x);
        // The spouse couple is adjacent in the middle; each spouse's other
        // partners step OUTWARD (anchor's to the left, co-spouse's to the
        // right). The post-pass re-centres each union's children under its
        // couple midpoint, so only the side/ordering matters here.
        const anchorX = v.x * COL_GAP;
        const coX = anchorX + SPOUSE_OFFSET;
        setPos(anchor, anchorX, py);
        setPos(co, coX, py);
        anchorUnions.forEach((u, i) => {
          const partner = u.coupleIds.find((id) => id !== anchor);
          if (partner !== undefined) setPos(partner, anchorX - SPOUSE_OFFSET * (i + 1), py);
        });
        coUnions.forEach((u, i) => {
          const partner = u.coupleIds.find((id) => id !== co);
          if (partner !== undefined) setPos(partner, coX + SPOUSE_OFFSET * (i + 1), py);
        });
      } else {
        // One or more unions, possibly across two merged primaries (a spouse
        // couple). Each union's couple straddles its own union centre; shared
        // primaries are placed once. The post-pass then re-centres children
        // and restores spacing, so we only need correct positions + ordering.
        const primaries = [...new Set(unions.map((u) => u.primaryId))];

        if (primaries.length === 1 && unions.length === 1) {
          // Single couple: primary renders at its (biased) x as the leftmost
          // member; partners trail it so the couple midpoint hits union centre.
          const u = unions[0];
          const partners = u.coupleIds.filter((id) => id !== u.primaryId);
          setPos(u.primaryId, px, py);
          partners.forEach((sid, i) => setPos(sid, px + SPOUSE_OFFSET * (i + 1), py));
        } else {
          // Place each union's couple symmetrically around its union centre.
          const sorted = [...unions].sort((a, b) => a.x - b.x);
          // Anchor each primary at the centroid of the unions it heads.
          for (const primary of primaries) {
            const own = sorted.filter((u) => u.primaryId === primary);
            const lo = own[0].x;
            const hi = own[own.length - 1].x;
            setPos(primary, ((lo + hi) / 2) * COL_GAP, py);
          }
          for (const u of sorted) {
            const cx = u.x * COL_GAP;
            const primaryX = pos.get(u.primaryId)!.x;
            const partner = u.coupleIds.find((id) => id !== u.primaryId);
            if (partner !== undefined) setPos(partner, 2 * cx - primaryX, py);
          }
        }
      }

      for (const u of unions) for (const c of u.children) walk(c);
    }
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

  // Spouse pairs (for keeping marriage couples adjacent when a union has extra
  // co-parents, e.g. adoption).
  const spousePairs = new Set<string>();
  for (const r of tree.relationships) {
    if (r.type === 'spouse') spousePairs.add([r.from, r.to].sort().join('|'));
  }

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
    const root = buildDescendant(founder, idx, tierOf, placed, spousePairs, null);
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

  recenterUnions(compUnions, pos);

  return pos;
}

/**
 * Top-down re-centring pass.
 *
 * The founder layout produces a valid (ordered, non-overlapping) placement but
 * a couple bridging two founder lineages — or a partner positioned by its own
 * line — can leave a union's children off the couple midpoint. Sweeping tiers
 * from the top down, we centre each union's child-block under the (now final)
 * midpoint of its parents, then restore MIN_SEP across the tier preserving
 * order. Because parents are finalised before their children's tier is touched,
 * one pass suffices and never disturbs an already-correct tier above.
 */
function recenterUnions(unions: Union[], pos: Map<string, Pos>): void {
  const tiers = [...new Set([...pos.values()].map((p) => p.y))].sort((a, b) => a - b);

  for (const y of tiers) {
    // Members rendered on this tier.
    const onTier = [...pos.entries()].filter(([, p]) => p.y === y);
    if (onTier.length === 0) continue;

    // For each union whose children sit on this tier, shift the child-block so
    // its midpoint equals the parents' midpoint.
    for (const u of unions) {
      const childPos = u.childIds.map((c) => pos.get(c)).filter((p): p is Pos => !!p && p.y === y);
      if (childPos.length === 0) continue;
      const parentPos = u.parentIds.map((p) => pos.get(p)).filter((p): p is Pos => !!p);
      if (parentPos.length === 0) continue;
      const parentMid = (Math.min(...parentPos.map((p) => p.x)) + Math.max(...parentPos.map((p) => p.x))) / 2;
      const childMid = (Math.min(...childPos.map((p) => p.x)) + Math.max(...childPos.map((p) => p.x))) / 2;
      const delta = parentMid - childMid;
      if (Math.abs(delta) < 1e-6) continue;
      for (const p of childPos) p.x += delta;
    }

    // Restore MIN_SEP across the tier, preserving left-to-right order. Resolve
    // by pushing rightwards from the left, then shifting the whole tier back so
    // its mean is unchanged (keeps the tier centred under what's above it).
    const sorted = onTier.sort((a, b) => a[1].x - b[1].x);
    const before = sorted.reduce((s, [, p]) => s + p.x, 0) / sorted.length;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1][1].x;
      if (sorted[i][1].x < prev + MIN_SEP) sorted[i][1].x = prev + MIN_SEP;
    }
    const after = sorted.reduce((s, [, p]) => s + p.x, 0) / sorted.length;
    const shift = before - after;
    if (Math.abs(shift) > 1e-6) for (const [, p] of sorted) p.x += shift;
  }
}
