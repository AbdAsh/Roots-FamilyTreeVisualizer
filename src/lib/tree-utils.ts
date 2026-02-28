import * as d3 from 'd3';
import type {
  FamilyTree,
  FamilyMember,
  Relationship,
  RelationshipType,
} from '@/types/family';

/** Node in the D3 hierarchy */
export interface TreeNode {
  id: string;
  member: FamilyMember;
  children?: TreeNode[];
  spouse?: FamilyMember;
  /** How this node connects to its parent in the hierarchy (for link styling). */
  linkType?: 'parent-child' | 'child-parent' | 'sibling';
}

/**
 * Convert a flat FamilyTree into a D3-compatible hierarchy rooted at rootMemberId.
 *
 * Walks ALL relationship types bidirectionally so every connected member
 * (children, parents-of-root, siblings, spouses) appears in the tree.
 * Each child node carries a `linkType` so the renderer can style the edge.
 */
export function toD3Hierarchy(tree: FamilyTree): d3.HierarchyNode<TreeNode> {
  const memberMap = new Map(tree.members.map((m) => [m.id, m]));

  // Bidirectional adjacency across ALL relationship types
  type Edge = { targetId: string; relType: RelationshipType; isFrom: boolean };
  const adj = new Map<string, Edge[]>();

  for (const rel of tree.relationships) {
    const fe = adj.get(rel.from) ?? [];
    fe.push({ targetId: rel.to, relType: rel.type, isFrom: true });
    adj.set(rel.from, fe);

    const te = adj.get(rel.to) ?? [];
    te.push({ targetId: rel.from, relType: rel.type, isFrom: false });
    adj.set(rel.to, te);
  }

  function buildNode(memberId: string, visited: Set<string>): TreeNode | null {
    if (visited.has(memberId)) return null;
    visited.add(memberId);

    const member = memberMap.get(memberId);
    if (!member) return null;

    const treeChildren: TreeNode[] = [];
    let spouse: FamilyMember | undefined;
    const edges = adj.get(memberId) ?? [];

    // First pass — claim one spouse (mark visited early)
    for (const edge of edges) {
      if (visited.has(edge.targetId)) continue;
      if (edge.relType === 'spouse' && !spouse) {
        const sm = memberMap.get(edge.targetId);
        if (sm) {
          spouse = sm;
          visited.add(edge.targetId);
        }
      }
    }

    // Second pass — build child nodes from all non-spouse edges
    for (const edge of edges) {
      if (visited.has(edge.targetId) || edge.relType === 'spouse') continue;
      const child = buildNode(edge.targetId, visited);
      if (child) {
        if (edge.relType === 'parent-child') {
          // isFrom = current node is "from" (parent) → target is a child
          child.linkType = edge.isFrom ? 'parent-child' : 'child-parent';
        } else {
          child.linkType = 'sibling';
        }
        treeChildren.push(child);
      }
    }

    // Third pass — walk the spouse's edges so their relatives appear too
    if (spouse) {
      const spouseEdges = adj.get(spouse.id) ?? [];
      for (const se of spouseEdges) {
        if (visited.has(se.targetId) || se.relType === 'spouse') continue;
        const child = buildNode(se.targetId, visited);
        if (child) {
          if (se.relType === 'parent-child') {
            child.linkType = se.isFrom ? 'parent-child' : 'child-parent';
          } else {
            child.linkType = 'sibling';
          }
          treeChildren.push(child);
        }
      }
    }

    return {
      id: member.id,
      member,
      children: treeChildren.length > 0 ? treeChildren : undefined,
      spouse,
    };
  }

  const rootNode = buildNode(tree.rootMemberId, new Set()) ?? {
    id: tree.rootMemberId,
    member: memberMap.get(tree.rootMemberId) ?? {
      id: tree.rootMemberId,
      name: 'Unknown',
      gender: 'unknown' as const,
      customFields: {},
    },
  };

  return d3.hierarchy(rootNode, (d) => d.children);
}

/**
 * Get all relationships for a specific member.
 */
export function getRelationshipsForMember(
  memberId: string,
  relationships: Relationship[],
): Relationship[] {
  return relationships.filter((r) => r.from === memberId || r.to === memberId);
}

/**
 * Get the parents of a member.
 */
export function getParents(memberId: string, tree: FamilyTree): FamilyMember[] {
  const parentIds = tree.relationships
    .filter((r) => r.type === 'parent-child' && r.to === memberId)
    .map((r) => r.from);
  return tree.members.filter((m) => parentIds.includes(m.id));
}

/**
 * Get the children of a member.
 */
export function getChildren(
  memberId: string,
  tree: FamilyTree,
): FamilyMember[] {
  const childIds = tree.relationships
    .filter((r) => r.type === 'parent-child' && r.from === memberId)
    .map((r) => r.to);
  return tree.members.filter((m) => childIds.includes(m.id));
}

/**
 * Get the spouse of a member.
 */
export function getSpouse(
  memberId: string,
  tree: FamilyTree,
): FamilyMember | undefined {
  const rel = tree.relationships.find(
    (r) => r.type === 'spouse' && (r.from === memberId || r.to === memberId),
  );
  if (!rel) return undefined;
  const spouseId = rel.from === memberId ? rel.to : rel.from;
  return tree.members.find((m) => m.id === spouseId);
}

/**
 * Get siblings of a member (share at least one parent).
 */
export function getSiblings(
  memberId: string,
  tree: FamilyTree,
): FamilyMember[] {
  const parents = getParents(memberId, tree);
  const siblingIds = new Set<string>();

  for (const parent of parents) {
    const children = getChildren(parent.id, tree);
    for (const child of children) {
      if (child.id !== memberId) siblingIds.add(child.id);
    }
  }

  // Also check explicit sibling relationships
  for (const rel of tree.relationships) {
    if (rel.type === 'sibling') {
      if (rel.from === memberId) siblingIds.add(rel.to);
      if (rel.to === memberId) siblingIds.add(rel.from);
    }
  }

  return tree.members.filter((m) => siblingIds.has(m.id));
}

/* ── Inferred-relationship suggestions ── */

/**
 * A relationship that the system suggests creating alongside the primary one.
 * `newMemberIsFrom` indicates which side of the relationship the *new* member
 * occupies — `true` means they are "from" (e.g. parent), `false` means "to" (e.g. child).
 */
export interface InferredRelationship {
  key: string;
  /** English fallback label */
  label: string;
  /** Which i18n key to use: 'alsoChildOf' | 'alsoParentOf' | 'alsoSiblingOf' | 'spouseOf' */
  labelType: 'alsoChildOf' | 'alsoParentOf' | 'alsoSiblingOf' | 'spouseOf';
  /** Name of the existing member (used to interpolate i18n string) */
  existingMemberName: string;
  relType: RelationshipType;
  existingMemberId: string;
  newMemberIsFrom: boolean;
}

/**
 * Given a target member and the type of relative being added, return a list
 * of additional relationships the user probably wants.
 * All suggestions default to ON; the user can uncheck any they don't want
 * (e.g. half-siblings, step-parents, adoption).
 */
export function getInferredRelationships(
  memberId: string,
  relType: 'parent' | 'child' | 'spouse' | 'sibling',
  tree: FamilyTree,
): InferredRelationship[] {
  const suggestions: InferredRelationship[] = [];

  if (relType === 'sibling') {
    // New sibling should share the same parents
    const parents = getParents(memberId, tree);
    for (const p of parents) {
      suggestions.push({
        key: `parent-${p.id}`,
        label: `Also a child of ${p.name}`,
        labelType: 'alsoChildOf',
        existingMemberName: p.name,
        relType: 'parent-child',
        existingMemberId: p.id,
        newMemberIsFrom: false,
      });
    }

    // Also suggest sibling of existing siblings so the graph stays fully connected
    const existingSiblings = getSiblings(memberId, tree);
    for (const sib of existingSiblings) {
      suggestions.push({
        key: `sibling-of-${sib.id}`,
        label: `Also sibling of ${sib.name}`,
        labelType: 'alsoSiblingOf',
        existingMemberName: sib.name,
        relType: 'sibling',
        existingMemberId: sib.id,
        newMemberIsFrom: false,
      });
    }
  }

  if (relType === 'child') {
    // If the target has a spouse, the spouse is probably also a parent
    const spouse = getSpouse(memberId, tree);
    if (spouse) {
      suggestions.push({
        key: `co-parent-${spouse.id}`,
        label: `Also a child of ${spouse.name}`,
        labelType: 'alsoChildOf',
        existingMemberName: spouse.name,
        relType: 'parent-child',
        existingMemberId: spouse.id,
        newMemberIsFrom: false,
      });
    }

    // Existing children of this parent → the new child is probably their sibling
    const existingChildren = getChildren(memberId, tree);
    for (const child of existingChildren) {
      suggestions.push({
        key: `sibling-of-${child.id}`,
        label: `Also sibling of ${child.name}`,
        labelType: 'alsoSiblingOf',
        existingMemberName: child.name,
        relType: 'sibling',
        existingMemberId: child.id,
        newMemberIsFrom: false,
      });
    }
  }

  if (relType === 'parent') {
    // Existing siblings should probably also be children of the new parent
    const siblings = getSiblings(memberId, tree);
    for (const sib of siblings) {
      suggestions.push({
        key: `also-parent-of-${sib.id}`,
        label: `Also parent of ${sib.name}`,
        labelType: 'alsoParentOf',
        existingMemberName: sib.name,
        relType: 'parent-child',
        existingMemberId: sib.id,
        newMemberIsFrom: true,
      });
    }

    // If there's already a parent, the new parent is likely their spouse
    const existingParents = getParents(memberId, tree);
    for (const ep of existingParents) {
      const epSpouse = getSpouse(ep.id, tree);
      if (!epSpouse) {
        suggestions.push({
          key: `spouse-of-${ep.id}`,
          label: `Spouse of ${ep.name}`,
          labelType: 'spouseOf',
          existingMemberName: ep.name,
          relType: 'spouse',
          existingMemberId: ep.id,
          newMemberIsFrom: true,
        });
      }
    }
  }

  if (relType === 'spouse') {
    // The new spouse is probably also a parent of existing children
    const children = getChildren(memberId, tree);
    for (const child of children) {
      suggestions.push({
        key: `also-parent-of-${child.id}`,
        label: `Also parent of ${child.name}`,
        labelType: 'alsoParentOf',
        existingMemberName: child.name,
        relType: 'parent-child',
        existingMemberId: child.id,
        newMemberIsFrom: true,
      });
    }
  }

  return suggestions;
}

/* ═══════ Tiered (horizontal-grid) layout ═══════ */

export interface PositionedNode {
  id: string;
  member: FamilyMember;
  x: number;
  y: number;
  tier: number;
  isRoot: boolean;
}

export interface PositionedLink {
  sourceId: string;
  targetId: string;
  source: { x: number; y: number };
  target: { x: number; y: number };
  mid: { x: number; y: number };
  type: 'parent-child' | 'sibling' | 'spouse';
}

export interface TieredLayout {
  nodes: PositionedNode[];
  links: PositionedLink[];
}

const TIER_GAP = 180;
const COL_GAP = 200;
const SPOUSE_OFFSET = 120;

/* ═══════ Buchheim–Reingold–Tilford with couple containers ═══════
 *
 * The layout tree is built from parent-child edges ONLY.
 * Spouse pairs are merged into single "couple container" nodes whose
 * width accounts for the extra space.  Sibling edges are purely visual
 * and never affect the tree hierarchy — siblings appear as co-children
 * of the same parent unit, which Buchheim handles natively.
 *
 * Guarantees:
 *   • parents centred over children
 *   • subtrees never overlap (contour comparison)
 *   • identical subtrees drawn identically
 *   • middle siblings evenly spaced
 */

interface BNode {
  id: string;
  spouseIds: string[];
  children: BNode[];
  parent: BNode | null;
  tier: number;
  /** How many extra "unit widths" this node occupies to the right (for spouses). */
  size: number;
  x: number;
  mod: number;
  thread: BNode | null;
  ancestor: BNode;
  change: number;
  shift: number;
  number: number;
}

/* ── Buchheim primitives ── */

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
  // 1 base unit + extra for the left node's spouse width
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

/* ═══════ Main layout function ═══════ */

export function computeTieredLayout(tree: FamilyTree): TieredLayout | null {
  if (!tree || tree.members.length === 0) return null;

  const memberMap = new Map(tree.members.map((m) => [m.id, m]));

  /* ── Adjacency list ── */
  type Edge = { targetId: string; relType: RelationshipType; isFrom: boolean };
  const adj = new Map<string, Edge[]>();
  for (const rel of tree.relationships) {
    const fe = adj.get(rel.from) ?? [];
    fe.push({ targetId: rel.to, relType: rel.type, isFrom: true });
    adj.set(rel.from, fe);
    const te = adj.get(rel.to) ?? [];
    te.push({ targetId: rel.from, relType: rel.type, isFrom: false });
    adj.set(rel.to, te);
  }

  /* ── Phase 1 BFS: parent-child + spouse edges ──
   * Assigns tiers and builds the layout tree from parent-child edges ONLY.
   * Spouse pairs are tracked but don't create tree edges.
   */
  const tierOf = new Map<string, number>();
  const spousePairs = new Map<string, string[]>();
  const layoutChildren = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue: { id: string; tier: number }[] = [];

  visited.add(tree.rootMemberId);
  tierOf.set(tree.rootMemberId, 0);
  queue.push({ id: tree.rootMemberId, tier: 0 });

  while (queue.length > 0) {
    const { id, tier } = queue.shift()!;
    // Sort edges: parent-child first, then spouse, then sibling
    const edges = [...(adj.get(id) ?? [])].sort((a, b) => {
      const p: Record<string, number> = {
        'parent-child': 0,
        spouse: 1,
        sibling: 2,
      };
      return (p[a.relType] ?? 3) - (p[b.relType] ?? 3);
    });

    for (const edge of edges) {
      if (visited.has(edge.targetId)) continue;

      let nextTier: number;
      if (edge.relType === 'spouse') {
        nextTier = tier;
        const existing = spousePairs.get(id) ?? [];
        existing.push(edge.targetId);
        spousePairs.set(id, existing);
      } else if (edge.relType === 'parent-child') {
        nextTier = edge.isFrom ? tier + 1 : tier - 1;
      } else {
        // Sibling: same tier
        nextTier = tier;
      }

      visited.add(edge.targetId);
      tierOf.set(edge.targetId, nextTier);

      // ONLY parent-child edges form the layout tree hierarchy
      if (edge.relType === 'parent-child') {
        const ch = layoutChildren.get(id) ?? [];
        ch.push(edge.targetId);
        layoutChildren.set(id, ch);
      }

      queue.push({ id: edge.targetId, tier: nextTier });
    }
  }

  const secondarySet = new Set([...spousePairs.values()].flat());

  /* ── Build the Buchheim layout tree ── */

  // Collect all nodes that are part of the layout tree (reachable via parent-child)
  const inLayoutTree = new Set<string>();
  function markInTree(id: string) {
    inLayoutTree.add(id);
    for (const cid of layoutChildren.get(id) ?? []) {
      if (!secondarySet.has(cid)) markInTree(cid);
    }
    // Spouses are part of the layout tree via their primary
    for (const sp of spousePairs.get(id) ?? []) inLayoutTree.add(sp);
  }
  markInTree(tree.rootMemberId);

  function buildTree(id: string, parent: BNode | null, num: number): BNode {
    const spList = spousePairs.get(id) ?? [];
    const node: BNode = {
      id,
      spouseIds: spList,
      children: [],
      parent,
      tier: tierOf.get(id) ?? 0,
      size: spList.length * (SPOUSE_OFFSET / COL_GAP),
      x: 0,
      mod: 0,
      thread: null,
      ancestor: null!,
      change: 0,
      shift: 0,
      number: num,
    };
    node.ancestor = node;

    // Layout children = direct parent-child children of this node + all spouses'
    // parent-child children, excluding secondary spouses.
    const childIds = [...(layoutChildren.get(id) ?? [])];
    for (const sp of spList) {
      childIds.push(...(layoutChildren.get(sp) ?? []));
    }

    node.children = childIds
      .filter((cid) => !secondarySet.has(cid))
      .map((cid, i) => buildTree(cid, node, i + 1));

    return node;
  }

  const layoutRoot = buildTree(tree.rootMemberId, null, 1);

  /* ── Run Buchheim ── */
  firstWalk(layoutRoot);
  const minX = secondWalk(layoutRoot, 0);
  if (minX < 0) thirdWalk(layoutRoot, -minX);

  /* ── Extract pixel positions ── */
  const pos = new Map<string, { x: number; y: number }>();

  function extractPositions(v: BNode) {
    const px = v.x * COL_GAP;
    const py = v.tier * TIER_GAP;
    pos.set(v.id, { x: px, y: py });
    for (let i = 0; i < v.spouseIds.length; i++) {
      const sid = v.spouseIds[i];
      if (tierOf.has(sid)) {
        pos.set(sid, { x: px + SPOUSE_OFFSET * (i + 1), y: py });
      }
    }
    for (const c of v.children) extractPositions(c);
  }
  extractPositions(layoutRoot);

  /* ── Place orphan nodes ──
   * Nodes reachable only via sibling edges (not in the layout tree).
   * Place each orphan adjacent to its connected peer on the same tier.
   */
  for (const [mid] of tierOf) {
    if (pos.has(mid)) continue; // already positioned
    const myTier = tierOf.get(mid)!;
    const py = myTier * TIER_GAP;

    // Find a positioned peer on the same tier via sibling edge
    let anchorX = 0;
    let foundAnchor = false;
    for (const edge of adj.get(mid) ?? []) {
      if (edge.relType === 'sibling' || edge.relType === 'spouse') {
        const peerPos = pos.get(edge.targetId);
        if (peerPos && tierOf.get(edge.targetId) === myTier) {
          anchorX = peerPos.x;
          foundAnchor = true;
          break;
        }
      }
    }

    // Find the rightmost node on this tier to place orphan after it
    let maxX = foundAnchor ? anchorX : 0;
    for (const [oid, p] of pos) {
      if (tierOf.get(oid) === myTier && p.x > maxX) maxX = p.x;
    }
    pos.set(mid, { x: maxX + COL_GAP, y: py });

    // Also place this orphan's spouses
    const spList = spousePairs.get(mid) ?? [];
    for (let i = 0; i < spList.length; i++) {
      const sid = spList[i];
      if (!pos.has(sid) && tierOf.has(sid)) {
        pos.set(sid, { x: maxX + COL_GAP + SPOUSE_OFFSET * (i + 1), y: py });
      }
    }
  }

  /* ── Centre around x = 0 ── */
  if (pos.size > 0) {
    let xMin = Infinity,
      xMax = -Infinity;
    for (const p of pos.values()) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
    }
    const cx = (xMin + xMax) / 2;
    for (const p of pos.values()) p.x -= cx;
  }

  /* ── Build output ── */
  const nodes: PositionedNode[] = [];
  for (const [mid, p] of pos) {
    const member = memberMap.get(mid);
    if (!member) continue;
    nodes.push({
      id: mid,
      member,
      x: p.x,
      y: p.y,
      tier: tierOf.get(mid) ?? 0,
      isRoot: mid === tree.rootMemberId,
    });
  }

  const links: PositionedLink[] = [];
  for (const rel of tree.relationships) {
    const fp = pos.get(rel.from);
    const tp = pos.get(rel.to);
    if (!fp || !tp) continue;

    const type: PositionedLink['type'] =
      rel.type === 'spouse'
        ? 'spouse'
        : rel.type === 'sibling'
          ? 'sibling'
          : 'parent-child';

    const source =
      type === 'parent-child' && fp.y > tp.y ? { ...tp } : { ...fp };
    const target =
      type === 'parent-child' && fp.y > tp.y ? { ...fp } : { ...tp };
    const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };

    links.push({
      sourceId: rel.from,
      targetId: rel.to,
      source,
      target,
      mid,
      type,
    });
  }

  return { nodes, links };
}
