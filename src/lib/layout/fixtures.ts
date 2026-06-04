import type { FamilyTree, FamilyMember, Relationship, RelationshipType } from '@/types/family';

let n = 0;
const rid = () => `r${n++}`;
export function person(id: string, extra: Partial<FamilyMember> = {}): FamilyMember {
  return { id, name: id, gender: 'unknown', customFields: {}, ...extra };
}
export function rel(type: RelationshipType, from: string, to: string): Relationship {
  return { id: rid(), type, from, to };
}
export function tree(rootId: string, members: FamilyMember[], rels: Relationship[]): FamilyTree {
  return { id: 't', name: 'T', members, relationships: rels, rootMemberId: rootId,
           createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}
// shorthands
export const pc = (parent: string, child: string) => rel('parent-child', parent, child);
export const sp = (a: string, b: string) => rel('spouse', a, b);
export const sib = (a: string, b: string) => rel('sibling', a, b);
