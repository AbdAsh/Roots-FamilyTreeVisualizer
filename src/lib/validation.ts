import { z } from 'zod';

export const GenderSchema = z.enum(['male', 'female', 'other', 'unknown']);

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

export const RelationshipTypeSchema = z.enum([
  'parent-child',
  'spouse',
  'sibling',
]);

export const RelationshipSchema = z.object({
  id: z.string().min(1),
  type: RelationshipTypeSchema,
  from: z.string().min(1),
  to: z.string().min(1),
});

export const FamilyTreeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Family name is required'),
  members: z.array(FamilyMemberSchema),
  relationships: z.array(RelationshipSchema),
  rootMemberId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FamilyMemberInput = z.infer<typeof FamilyMemberSchema>;
export type FamilyTreeInput = z.infer<typeof FamilyTreeSchema>;
