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

interface TreeState {
  tree: FamilyTree | null;
  selectedMemberId: string | null;
  isEditing: boolean;
  addingForMemberId: string | null;

  /* history stacks (serialised tree snapshots) */
  _past: string[];
  _future: string[];

  // Tree lifecycle
  initTree: (name: string) => FamilyTree;
  setTree: (tree: FamilyTree) => void;
  clearTree: () => void;

  // Member operations
  addMember: (member: Omit<FamilyMember, 'id'>) => FamilyMember;
  updateMember: (id: string, updates: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;

  // Relationship operations
  addRelationship: (
    type: RelationshipType,
    from: string,
    to: string,
  ) => Relationship;
  removeRelationship: (id: string) => void;

  // Selection
  selectMember: (id: string | null) => void;
  setEditing: (editing: boolean) => void;
  setAddingFor: (memberId: string | null) => void;

  // Convenience: add relative (creates member + relationship in one step)
  addRelative: (
    relativeTo: string,
    relType: 'parent' | 'child' | 'spouse' | 'sibling',
    member: Omit<FamilyMember, 'id'>,
  ) => FamilyMember;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

/* ── Helpers ── */

/** Push the current tree onto the _past stack (call BEFORE mutating). */
function pushSnapshot(state: TreeState): Partial<TreeState> {
  if (!state.tree) return {};
  const snap = JSON.stringify(state.tree);
  const past = [...state._past, snap];
  if (past.length > MAX_HISTORY) past.shift();
  return { _past: past, _future: [] };
}

/** Check if a relationship already exists (duplicate guard). */
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
