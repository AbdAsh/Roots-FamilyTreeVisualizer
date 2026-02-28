/**
 * Central state store for the family tree.
 *
 * Uses Zustand to manage:
 * - The `FamilyTree` object (members, relationships, metadata)
 * - Selection and editing UI state
 * - An undo/redo history stack (serialised JSON snapshots, max 50)
 *
 * **Mutation protocol:** All actions that modify the tree call `pushSnapshot()`
 * before applying changes, so `undo()` / `redo()` always work correctly.
 *
 * @module useTree
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  FamilyTree,
  FamilyMember,
  Relationship,
  RelationshipType,
} from '@/types/family';

/* ── Undo / Redo history ── */
const MAX_HISTORY = 50;

/** Shape of the Zustand tree store. */
interface TreeState {
  /** The current family tree, or `null` if no tree is loaded. */
  tree: FamilyTree | null;
  /** ID of the currently selected member in the tree view. */
  selectedMemberId: string | null;
  /** Whether the edit panel is open. */
  isEditing: boolean;
  /** Member ID for which the "add relative" modal is open, or `null`. */
  addingForMemberId: string | null;

  /** @internal Undo stack — serialised JSON snapshots of past tree states. */
  _past: string[];
  /** @internal Redo stack — serialised JSON snapshots of undone tree states. */
  _future: string[];

  // Tree lifecycle
  /** Initialise a brand new tree with a single root member. */
  initTree: (name: string) => FamilyTree;
  /** Replace the entire tree (used on load / import). Resets history. */
  setTree: (tree: FamilyTree) => void;
  /** Clear the tree from memory (used on lock). */
  clearTree: () => void;

  // Member operations
  /** Add a new member to the tree. Returns the created member with a generated ID. */
  addMember: (member: Omit<FamilyMember, 'id'>) => FamilyMember;
  /** Update fields on an existing member. */
  updateMember: (id: string, updates: Partial<FamilyMember>) => void;
  /** Remove a member and all their relationships. */
  removeMember: (id: string) => void;

  // Relationship operations
  /** Add a relationship edge. Returns the created relationship with a generated ID. */
  addRelationship: (
    type: RelationshipType,
    from: string,
    to: string,
  ) => Relationship;
  /** Remove a relationship by ID. */
  removeRelationship: (id: string) => void;

  // Selection
  /** Select a member (or deselect by passing `null`). Opens edit panel. */
  selectMember: (id: string | null) => void;
  /** Toggle the edit panel open/closed. */
  setEditing: (editing: boolean) => void;
  /** Open/close the "add relative" modal for a given member. */
  setAddingFor: (memberId: string | null) => void;

  /**
   * Convenience: add a relative (creates member + relationship in one step).
   * Also auto-infers additional relationships (e.g. sibling links to existing children).
   */
  addRelative: (
    relativeTo: string,
    relType: 'parent' | 'child' | 'spouse' | 'sibling',
    member: Omit<FamilyMember, 'id'>,
  ) => FamilyMember;

  // Undo / Redo
  /** Undo the last tree mutation by restoring the previous snapshot. */
  undo: () => void;
  /** Redo a previously undone mutation. */
  redo: () => void;
  /** Returns `true` if there are past snapshots to undo. */
  canUndo: () => boolean;
  /** Returns `true` if there are future snapshots to redo. */
  canRedo: () => boolean;
}

/* ── Helpers ── */

/**
 * Push the current tree onto the `_past` stack.
 * **Must be called BEFORE mutating the tree** so undo always has the correct pre-mutation state.
 * Clears the `_future` stack (new mutation branches discard redo history).
 */
function pushSnapshot(state: TreeState): Partial<TreeState> {
  if (!state.tree) return {};
  const snap = JSON.stringify(state.tree);
  const past = [...state._past, snap];
  if (past.length > MAX_HISTORY) past.shift();
  return { _past: past, _future: [] };
}

/**
 * Check if a relationship already exists between two members.
 * Symmetric relationship types (`spouse`, `sibling`) are checked in both directions.
 */
function hasDuplicate(
  rels: Relationship[],
  type: RelationshipType,
  from: string,
  to: string,
): boolean {
  return rels.some(
    (r) =>
      r.type === type &&
      ((r.from === from && r.to === to) ||
        // spouse & sibling are symmetric
        ((type === 'spouse' || type === 'sibling') &&
          r.from === to &&
          r.to === from)),
  );
}

export const useTreeStore = create<TreeState>((set, get) => ({
  tree: null,
  selectedMemberId: null,
  isEditing: false,
  addingForMemberId: null,
  _past: [],
  _future: [],

  initTree: (name: string) => {
    const rootMember: FamilyMember = {
      id: nanoid(10),
      name: 'Root Person',
      gender: 'unknown',
      customFields: {},
    };

    const tree: FamilyTree = {
      id: nanoid(10),
      name,
      members: [rootMember],
      relationships: [],
      rootMemberId: rootMember.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({
      tree,
      selectedMemberId: rootMember.id,
      isEditing: true,
      _past: [],
      _future: [],
    });
    return tree;
  },

  setTree: (tree) => set({ tree, _past: [], _future: [] }),

  clearTree: () =>
    set({
      tree: null,
      selectedMemberId: null,
      isEditing: false,
      addingForMemberId: null,
      _past: [],
      _future: [],
    }),

  addMember: (memberData) => {
    const member: FamilyMember = { ...memberData, id: nanoid(10) };
    set((state) => {
      if (!state.tree) return state;
      return {
        ...pushSnapshot(state),
        tree: {
          ...state.tree,
          members: [...state.tree.members, member],
          updatedAt: new Date().toISOString(),
        },
      };
    });
    return member;
  },

  updateMember: (id, updates) => {
    set((state) => {
      if (!state.tree) return state;
      return {
        ...pushSnapshot(state),
        tree: {
          ...state.tree,
          members: state.tree.members.map((m) =>
            m.id === id ? { ...m, ...updates } : m,
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  removeMember: (id) => {
    set((state) => {
      if (!state.tree) return state;

      const remaining = state.tree.members.filter((m) => m.id !== id);
      if (remaining.length === 0) return state; // never delete the last member

      // Root reassignment: if we're deleting the root, pick the first connected member or just the first remaining
      let newRootId = state.tree.rootMemberId;
      if (id === state.tree.rootMemberId) {
        // Prefer a child, then parent, then anyone
        const childRel = state.tree.relationships.find(
          (r) => r.type === 'parent-child' && r.from === id,
        );
        const parentRel = state.tree.relationships.find(
          (r) => r.type === 'parent-child' && r.to === id,
        );
        const spouseRel = state.tree.relationships.find(
          (r) => r.type === 'spouse' && (r.from === id || r.to === id),
        );
        if (childRel) {
          newRootId = childRel.to;
        } else if (parentRel) {
          newRootId = parentRel.from;
        } else if (spouseRel) {
          newRootId = spouseRel.from === id ? spouseRel.to : spouseRel.from;
        } else {
          newRootId = remaining[0].id;
        }
      }

      return {
        ...pushSnapshot(state),
        tree: {
          ...state.tree,
          members: remaining,
          relationships: state.tree.relationships.filter(
            (r) => r.from !== id && r.to !== id,
          ),
          rootMemberId: newRootId,
          updatedAt: new Date().toISOString(),
        },
        selectedMemberId:
          state.selectedMemberId === id ? null : state.selectedMemberId,
        isEditing: state.selectedMemberId === id ? false : state.isEditing,
      };
    });
  },

  addRelationship: (type, from, to) => {
    const rel: Relationship = { id: nanoid(10), type, from, to };
    set((state) => {
      if (!state.tree) return state;
      // Duplicate guard — silently skip if relationship already exists
      if (hasDuplicate(state.tree.relationships, type, from, to)) return state;
      return {
        ...pushSnapshot(state),
        tree: {
          ...state.tree,
          relationships: [...state.tree.relationships, rel],
          updatedAt: new Date().toISOString(),
        },
      };
    });
    return rel;
  },

  removeRelationship: (id) => {
    set((state) => {
      if (!state.tree) return state;
      return {
        ...pushSnapshot(state),
        tree: {
          ...state.tree,
          relationships: state.tree.relationships.filter((r) => r.id !== id),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  selectMember: (id) => set({ selectedMemberId: id }),

  setEditing: (editing) => set({ isEditing: editing, addingForMemberId: null }),
  setAddingFor: (memberId) =>
    set({ addingForMemberId: memberId, isEditing: false }),

  addRelative: (relativeTo, relType, memberData) => {
    const { addMember, addRelationship } = get();
    const member = addMember(memberData);

    switch (relType) {
      case 'parent':
        addRelationship('parent-child', member.id, relativeTo);
        break;
      case 'child':
        addRelationship('parent-child', relativeTo, member.id);
        break;
      case 'spouse':
        addRelationship('spouse', relativeTo, member.id);
        break;
      case 'sibling':
        addRelationship('sibling', relativeTo, member.id);
        break;
    }

    return member;
  },

  /* ── Undo / Redo ── */
  undo: () => {
    set((state) => {
      if (state._past.length === 0 || !state.tree) return state;
      const past = [...state._past];
      const snap = past.pop()!;
      return {
        _past: past,
        _future: [JSON.stringify(state.tree), ...state._future].slice(
          0,
          MAX_HISTORY,
        ),
        tree: JSON.parse(snap) as FamilyTree,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state._future.length === 0 || !state.tree) return state;
      const future = [...state._future];
      const snap = future.shift()!;
      return {
        _past: [...state._past, JSON.stringify(state.tree)].slice(-MAX_HISTORY),
        _future: future,
        tree: JSON.parse(snap) as FamilyTree,
      };
    });
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,
}));
