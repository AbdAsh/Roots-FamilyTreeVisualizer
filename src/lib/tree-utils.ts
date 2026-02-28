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
const COL_GAP = 140;
const SPOUSE_OFFSET = 85;

/**
 * Compute a tiered horizontal-grid layout where:
 * - parents sit on the row ABOVE the node
 * - siblings & spouses sit on the SAME row
 * - children sit on the row BELOW
 *
 * Returns positioned nodes and links with pre-computed midpoints for badges.
 */
export function computeTieredLayout(tree: FamilyTree): TieredLayout | null {
  if (!tree || tree.members.length === 0) return null;

  const memberMap = new Map(tree.members.map((m) => [m.id, m]));

  /* Bidirectional adjacency list */
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

  /* BFS — assign generation tiers (0 = root, negative = ancestors, positive = descendants) */
  const tierOf = new Map<string, number>();
  const spousePairs = new Map<string, string>(); // primary → secondary
  const visited = new Set<string>();
  const queue: { id: string; tier: number }[] = [];

  visited.add(tree.rootMemberId);
  tierOf.set(tree.rootMemberId, 0);
  queue.push({ id: tree.rootMemberId, tier: 0 });

  while (queue.length > 0) {
    const { id, tier } = queue.shift()!;
    for (const edge of adj.get(id) ?? []) {
      if (visited.has(edge.targetId)) continue;

      let nextTier: number;
      if (edge.relType === 'spouse') {
        nextTier = tier;
        spousePairs.set(id, edge.targetId);
      } else if (edge.relType === 'parent-child') {
        nextTier = edge.isFrom ? tier + 1 : tier - 1;
      } else {
        nextTier = tier; // sibling
      }

      visited.add(edge.targetId);
      tierOf.set(edge.targetId, nextTier);
      queue.push({ id: edge.targetId, tier: nextTier });
    }
  }

  /* Secondary set = spouse members positioned adjacent to their primary */
  const secondarySet = new Set(spousePairs.values());

  /* Group members by tier */
  const tierGroups = new Map<number, string[]>();
  for (const [mid, t] of tierOf) {
    const g = tierGroups.get(t) ?? [];
    g.push(mid);
    tierGroups.set(t, g);
  }

  /* Position nodes per tier */
  const pos = new Map<string, { x: number; y: number }>();

  for (const [tierNum, members] of tierGroups) {
    const primary = members.filter((id) => !secondarySet.has(id));
    const units: { id: string; spouseId?: string }[] = primary.map((id) => {
      const sp = spousePairs.get(id);
      return {
        id,
        spouseId: sp && tierOf.get(sp) === tierNum ? sp : undefined,
      };
    });

    /* total width of the tier */
    let w = 0;
    for (let i = 0; i < units.length; i++) {
      if (i > 0) w += COL_GAP;
      if (units[i].spouseId) w += SPOUSE_OFFSET;
    }

    const y = tierNum * TIER_GAP;
    let x = -w / 2;

    for (let i = 0; i < units.length; i++) {
      pos.set(units[i].id, { x, y });
      if (units[i].spouseId) {
        pos.set(units[i].spouseId!, { x: x + SPOUSE_OFFSET, y });
        x += SPOUSE_OFFSET;
      }
      if (i < units.length - 1) x += COL_GAP;
    }
  }

  /* Build node list */
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

  /* Build link list */
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

    // For parent-child, source = parent (smaller y = higher on screen)
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
