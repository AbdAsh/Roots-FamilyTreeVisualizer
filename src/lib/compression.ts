import brotliPromise, { type BrotliWasmType } from 'brotli-wasm';

let brotli: BrotliWasmType | null = null;

/** Initialise the WASM module (idempotent — safe to call many times). */
async function init(): Promise<BrotliWasmType> {
  if (!brotli) {
    brotli = await brotliPromise;
  }
  return brotli;
}

/**
 * Compress a string with Brotli at maximum quality (11).
 * Quality 11 is slow but gives the best ratio — perfect for our
 * "speed doesn't matter, URL space does" use-case.
 */
export async function compress(input: string): Promise<Uint8Array> {
  const br = await init();
  const encoded = new TextEncoder().encode(input);
  return br.compress(encoded, { quality: 11 });
}

/**
 * Decompress a Brotli-compressed Uint8Array back into the original string.
 */
export async function decompress(data: Uint8Array): Promise<string | null> {
  try {
    const br = await init();
    const decompressed = br.decompress(data);
    return new TextDecoder().decode(decompressed);
  } catch {
    return null;
  }
}

/** Returns approximate byte size of a string */
export function byteSize(str: string): number {
  return new Blob([str]).size;
}

/** Max safe URL hash size (conservative) */
export const MAX_HASH_BYTES = 8_000;
