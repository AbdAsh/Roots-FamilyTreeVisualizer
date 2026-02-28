import { encryptBytes, decryptBytes } from './crypto';
import { compress, decompress, byteSize, MAX_HASH_BYTES } from './compression';
import { FamilyTreeSchema } from './validation';
import type { FamilyTree } from '@/types/family';

/* ── Base64-URL helpers (RFC 4648 §5) ── */

function uint8ToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlToUint8(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface SaveResult {
  success: boolean;
  url: string;
  sizeBytes: number;
  capacityPercent: number;
}

/**
 * Pipeline: JSON → LZ-compress → AES-encrypt → base64url → URL hash.
 *
 * Compressing BEFORE encryption is critical — structured JSON compresses
 * well (50–70 % reduction) whereas encrypted bytes are essentially random
 * and yield zero compression.
 */
export async function saveToHash(
  tree: FamilyTree,
  passphrase: string,
): Promise<SaveResult> {
  const json = JSON.stringify(tree);
  const compressed = await compress(json); // Uint8Array (Brotli q11)
  const encrypted = await encryptBytes(compressed, passphrase); // Uint8Array
  const encoded = uint8ToBase64url(encrypted); // URL-safe string

  window.location.hash = encoded;

  const size = byteSize(encoded);
  return {
    success: true,
    url: window.location.href,
    sizeBytes: size,
    capacityPercent: Math.round((size / MAX_HASH_BYTES) * 100),
  };
}

/**
 * Pipeline: URL hash → base64url-decode → AES-decrypt → LZ-decompress → JSON.
 */
export async function loadFromHash(
  passphrase: string,
): Promise<FamilyTree | null> {
  const hash = window.location.hash.slice(1); // remove leading #
  if (!hash) return null;

  let encrypted: Uint8Array;
  try {
    encrypted = base64urlToUint8(hash);
  } catch {
    throw new Error('The URL data is malformed.');
  }

  let compressed: Uint8Array;
  try {
    compressed = await decryptBytes(encrypted, passphrase);
  } catch {
    throw new Error('Wrong passphrase or corrupted data.');
  }

  const json = await decompress(compressed);
  if (!json) {
    throw new Error('Failed to decompress data — the URL may be corrupted.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Decrypted data is not valid JSON.');
  }

  const result = FamilyTreeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Data structure is invalid: ' + result.error.message);
  }

  return result.data;
}

/**
 * Check if the current URL has tree data in the hash.
 */
export function hasHashData(): boolean {
  return window.location.hash.length > 1;
}

/**
 * Get the current hash size in bytes and capacity percentage.
 */
export function getHashCapacity(): {
  sizeBytes: number;
  capacityPercent: number;
} {
  const hash = window.location.hash.slice(1);
  const size = byteSize(hash);
  return {
    sizeBytes: size,
    capacityPercent: Math.round((size / MAX_HASH_BYTES) * 100),
  };
}
