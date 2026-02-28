export type Gender = 'male' | 'female' | 'other' | 'unknown';

export type RelationshipType = 'parent-child' | 'spouse' | 'sibling';

export interface FamilyMember {
  id: string;
  name: string;
  birthDate?: string;
  deathDate?: string;
  gender: Gender;
  photoUrl?: string;
  bio?: string;
  location?: string;
  occupation?: string;
  customFields: Record<string, string>;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  from: string; // memberId — parent, spouse A
  to: string; // memberId — child, spouse B
}

export interface FamilyTree {
  id: string;
  name: string;
  members: FamilyMember[];
  relationships: Relationship[];
  rootMemberId: string;
  createdAt: string;
  updatedAt: string;
}
