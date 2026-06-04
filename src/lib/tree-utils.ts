/**
 * Tree layout engine and graph query helpers.
 *
 * This module contains:
 * - **`computeTieredLayout()`** — the public layout entry point. It orchestrates
 *   the union-aware layered engine in `src/lib/layout/` (unions → tiers →
 *   components → per-component contour + ancestor mirror → packing) and emits
 *   pixel coordinates plus `primary`/`reference` links for the renderer.
 * - **Graph query helpers** — `getParents()`, `getChildren()`, `getSpouse()`, `getSiblings()`,
 *   `getRelationshipsForMember()`.
 * - **`getInferredRelationships()`** — auto-suggests additional relationships when adding
 *   a new relative (e.g. sibling links to existing children).
 *
 * @module tree-utils
 */
import type {
  FamilyTree,
  FamilyMember,
  Relationship,
  RelationshipType,
} from '@/types/family';
import { buildUnions } from '@/lib/layout/unions';
import { assignTiers } from '@/lib/layout/tiers';
import { connectedComponents } from '@/lib/layout/components';
import { computeUnionLayout, COL_GAP } from '@/lib/layout/layout';

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
  /**
   * Whether this edge participates in positioning (`'primary'`) or is an
   * auxiliary edge the layout could not satisfy structurally — a cycle edge
   * (cousin marriage) or an extra-parent edge beyond a child's positioning
   * union (adoption / >2 parents). Reference links are drawn distinctly and
   * never affect node positions. Defaults to `'primary'`.
   */
  kind: 'primary' | 'reference';
}

export interface TieredLayout {
  nodes: PositionedNode[];
  links: PositionedLink[];
}


/* ═══════ Union-aware layered layout orchestrator ═══════ */

/**
 * Compute pixel positions for every member in the family tree.
 *
 * Pipeline (see `src/lib/layout/`):
 *   1. `buildUnions` — derive co-parent / spouse unions from edges.
 *   2. `assignTiers` — union-find generations + longest-path layering;
 *      cycle edges are returned as `referenceEdges`.
 *   3. `connectedComponents` — partition so unreachable clusters still render.
 *   4. `computeUnionLayout` — per-component descendant contour + ancestor
 *      mirror, stitched at the component anchor.
 *   5. Pack components left-to-right with a clear gap; centre around x = 0.
 *   6. Emit `nodes` + `links`; mark cycle/extra-parent edges `kind:'reference'`.
 *
 * @param tree - The family tree to lay out.
 * @returns A {@link TieredLayout}, or `null` if the tree has no members.
 */
export function computeTieredLayout(tree: FamilyTree): TieredLayout | null {
  if (!tree || tree.members.length === 0) return null;

  const memberOrder = new Map(tree.members.map((m, i) => [m.id, i]));

  const unions = buildUnions(tree);
  const { tierOf, referenceEdges } = assignTiers(tree, unions);
  const components = connectedComponents(tree);

  /* ── Lay out each component, then pack left-to-right ── */
  const pos = new Map<string, { x: number; y: number }>();
  let packOffset = 0; // running x-offset for the next component

  for (const component of components) {
    const local = computeUnionLayout(tree, component, unions, tierOf);
    if (local.size === 0) continue;

    let xMin = Infinity;
    let xMax = -Infinity;
    for (const p of local.values()) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
    }
    const shift = packOffset - xMin;
    for (const [id, p] of local) pos.set(id, { x: p.x + shift, y: p.y });
    packOffset += xMax - xMin + COL_GAP * 2;
  }

  /* ── Centre around x = 0 ── */
  if (pos.size > 0) {
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const p of pos.values()) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
    }
    const cx = (xMin + xMax) / 2;
    for (const p of pos.values()) p.x -= cx;
  }

  /* ── Nodes ── */
  const nodes: PositionedNode[] = [];
  for (const m of tree.members) {
    const p = pos.get(m.id);
    if (!p) continue;
    nodes.push({
      id: m.id,
      member: m,
      x: p.x,
      y: p.y,
      tier: tierOf.get(m.id) ?? 0,
      isRoot: m.id === tree.rootMemberId,
    });
  }

  /* ── Reference-edge determination ──
   * An edge is `'reference'` when it is a cycle edge (from `assignTiers`) OR an
   * extra-parent edge: a child with >2 parents has a "positioning pair" (a
   * spouse couple among its parents, else the first two by member order); any
   * parent-child edge from a parent outside that pair is a reference link.
   */
  const refKeys = new Set(referenceEdges.map((r) => r.id));

  // parents-of map + spouse adjacency for positioning-pair detection
  const parentsOf = new Map<string, string[]>();
  for (const r of tree.relationships) {
    if (r.type !== 'parent-child') continue;
    const arr = parentsOf.get(r.to) ?? [];
    if (!arr.includes(r.from)) arr.push(r.from);
    parentsOf.set(r.to, arr);
  }
  const spousePairKey = new Set<string>();
  for (const r of tree.relationships) {
    if (r.type !== 'spouse') continue;
    spousePairKey.add([r.from, r.to].sort().join('|'));
  }

  /** Parents that position the child (≤2). Extra parents → reference. */
  const positioningParents = (childId: string): Set<string> => {
    const ps = (parentsOf.get(childId) ?? [])
      .slice()
      .sort((a, b) => (memberOrder.get(a) ?? 0) - (memberOrder.get(b) ?? 0));
    if (ps.length <= 2) return new Set(ps);
    // Prefer a spouse couple among the parents.
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        if (spousePairKey.has([ps[i], ps[j]].sort().join('|'))) {
          return new Set([ps[i], ps[j]]);
        }
      }
    }
    return new Set([ps[0], ps[1]]);
  };

  /* ── Links ── */
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

    let kind: PositionedLink['kind'] = 'primary';
    if (refKeys.has(rel.id)) {
      kind = 'reference';
    } else if (rel.type === 'parent-child') {
      const pp = positioningParents(rel.to);
      if ((parentsOf.get(rel.to)?.length ?? 0) > 2 && !pp.has(rel.from)) {
        kind = 'reference';
      }
    }

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
      kind,
    });
  }

  return { nodes, links };
}
