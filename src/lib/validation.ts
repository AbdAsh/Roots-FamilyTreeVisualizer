/**
 * Zod validation schemas for all core data types.
 *
 * These schemas mirror the TypeScript interfaces in `types/family.ts` and are used
 * for runtime validation of imported JSON data and form inputs.
 *
 * @module validation
 */
import { z } from 'zod';

/** Schema for the {@link Gender} type. */
export const GenderSchema = z.enum(['male', 'female', 'other', 'unknown']);

/** Schema for a {@link FamilyMember} object. Validates all fields including optional ones. */
export const FamilyMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  gender: GenderSchema,
  photoUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().optional(),
  location: z.string().optional(),
  occupation: z.string().optional(),
  customFields: z.record(z.string(), z.string()),
});

/** Schema for the {@link RelationshipType} type. */
export const RelationshipTypeSchema = z.enum([
  'parent-child',
  'spouse',
  'sibling',
]);

/** Schema for a {@link Relationship} edge. */
export const RelationshipSchema = z.object({
  id: z.string().min(1),
  type: RelationshipTypeSchema,
  from: z.string().min(1),
  to: z.string().min(1),
});

/**
 * Schema for the complete {@link FamilyTree} object. Used to validate JSON imports.
 *
 * `members` and `rootMemberId` intentionally have no `.min(1)` so that a freshly
 * created (empty) tree round-trips correctly. The `.refine` guard ensures that once
 * members exist, `rootMemberId` must reference one of them.
 */
export const FamilyTreeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Family name is required'),
  members: z.array(FamilyMemberSchema),
  relationships: z.array(RelationshipSchema),
  rootMemberId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).refine(
  (t) => t.members.length === 0 || t.members.some((m) => m.id === t.rootMemberId),
  { message: 'rootMemberId must reference an existing member', path: ['rootMemberId'] },
);

/** Inferred type from FamilyMemberSchema — useful for form input typing. */
export type FamilyMemberInput = z.infer<typeof FamilyMemberSchema>;
/** Inferred type from FamilyTreeSchema — useful for import validation. */
export type FamilyTreeInput = z.infer<typeof FamilyTreeSchema>;
