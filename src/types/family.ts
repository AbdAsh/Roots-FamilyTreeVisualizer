/**
 * Core data types for the family tree.
 *
 * These types define the shape of all family data that gets serialised to JSON,
 * compressed with Brotli, encrypted with AES-256-GCM, and stored in the URL hash.
 *
 * @module family
 */

/**
 * Biological or social gender of a family member.
 * - `'male'` / `'female'` — standard biological genders
 * - `'other'` — non-binary or unspecified
 * - `'unknown'` — gender not yet provided (default for new members)
 */
export type Gender = 'male' | 'female' | 'other' | 'unknown';

/**
 * The type of relationship connecting two family members.
 * - `'parent-child'` — directed: `from` = parent, `to` = child
 * - `'spouse'` — symmetric: order of `from`/`to` is canonical but both directions are checked
 * - `'sibling'` — symmetric: same as spouse regarding direction checks
 */
export type RelationshipType = 'parent-child' | 'spouse' | 'sibling';

/**
 * A single person in the family tree.
 *
 * All fields except `id`, `name`, `gender`, and `customFields` are optional.
 * Be mindful of field sizes — the entire tree must fit in ~8 KB after compression + encryption.
 */
export interface FamilyMember {
  /** Unique identifier (nanoid, 10 chars). */
  id: string;
  /** Display name of the family member. */
  name: string;
  /** Birth date as an ISO 8601 date string (YYYY-MM-DD). */
  birthDate?: string;
  /** Death date as an ISO 8601 date string (YYYY-MM-DD). Absence implies the person is living. */
  deathDate?: string;
  /** Gender of the family member. Defaults to `'unknown'` for new members. */
  gender: Gender;
  /** URL to a photo/avatar. Stored as-is in the tree data (contributes to URL size). */
  photoUrl?: string;
  /** Free-text biography. Keep short to conserve URL space. */
  bio?: string;
  /** Location / place of residence. */
  location?: string;
  /** Occupation or profession. */
  occupation?: string;
  /** Arbitrary key-value pairs for user-defined fields (e.g. "Nickname": "Bobby"). */
  customFields: Record<string, string>;
}

/**
 * A relationship edge connecting two family members.
 *
 * **Direction semantics:**
 * - `parent-child`: `from` is the **parent**, `to` is the **child**. This is a directed edge.
 * - `spouse`: symmetric — `from` and `to` are interchangeable. Stored with a canonical order;
 *   duplicate checks (`hasDuplicate()`) test both directions.
 * - `sibling`: symmetric — same as spouse regarding direction.
 */
export interface Relationship {
  /** Unique identifier (nanoid, 10 chars). */
  id: string;
  /** The kind of relationship. */
  type: RelationshipType;
  /** Source member ID. For `parent-child`, this is the parent. */
  from: string;
  /** Target member ID. For `parent-child`, this is the child. */
  to: string;
}

/**
 * The root data structure representing an entire family tree.
 *
 * This is the object that gets serialised → compressed → encrypted → stored in the URL hash.
 * On load, the reverse pipeline decodes it back into this shape.
 */
export interface FamilyTree {
  /** Unique identifier for this tree (nanoid, 10 chars). */
  id: string;
  /** Display name of the family tree (e.g. "The Smith Family"). */
  name: string;
  /** All family members in this tree. */
  members: FamilyMember[];
  /** All relationship edges between members. */
  relationships: Relationship[];
  /** The ID of the root member used as the origin for the layout algorithm. */
  rootMemberId: string;
  /** ISO 8601 timestamp of when the tree was first created. */
  createdAt: string;
  /** ISO 8601 timestamp of the last modification. */
  updatedAt: string;
}
