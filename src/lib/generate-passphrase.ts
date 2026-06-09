/**
 * Memorable, crypto-strong passphrase generator.
 *
 * Produces passphrases like `Maple-River-Lantern-Cobalt-42` — several capitalized
 * words plus a two-digit number, hyphen-joined. This shape is deliberate for Roots:
 * the passphrase has to be *shared* with family (and there is no recovery if lost),
 * so it must be easy to read aloud, write down, and type — while still clearing the
 * app's length + strength checks (it always contains an uppercase letter and a digit)
 * and staying URL/share-friendly (letters, digits, hyphen only).
 *
 * Randomness comes from the Web Crypto CSPRNG with rejection sampling for an unbiased
 * choice — never `Math.random()`.
 *
 * @module generate-passphrase
 */

/**
 * Short, common, family-friendly words (easy to spell and say). Kept to distinct,
 * unambiguous words so a spoken/written passphrase round-trips cleanly.
 */
export const WORDS = [
  'amber', 'anchor', 'apple', 'arbor', 'arrow', 'aspen', 'autumn', 'basil',
  'beacon', 'birch', 'bloom', 'bramble', 'branch', 'breeze', 'bridge', 'brook',
  'canyon', 'cedar', 'cherry', 'clover', 'cobalt', 'comet', 'copper', 'coral',
  'cottage', 'crimson', 'crystal', 'daisy', 'dawn', 'delta', 'ember', 'fable',
  'falcon', 'fern', 'forest', 'garden', 'ginger', 'granite', 'harbor', 'hazel',
  'heron', 'hollow', 'honey', 'indigo', 'island', 'ivory', 'jasmine', 'juniper',
  'kettle', 'lagoon', 'lantern', 'laurel', 'lily', 'linen', 'lotus', 'maple',
  'marble', 'meadow', 'mellow', 'mint', 'monarch', 'moss', 'mulberry', 'nectar',
  'nimbus', 'oak', 'ocean', 'olive', 'opal', 'orchard', 'otter', 'pebble',
  'pepper', 'pewter', 'pine', 'plum', 'poppy', 'prairie', 'quartz', 'quill',
  'quince', 'raven', 'reef', 'ridge', 'river', 'robin', 'rowan', 'saffron',
  'sage', 'sand', 'sequoia', 'shadow', 'shore', 'silver', 'sparrow', 'spruce',
  'storm', 'summit', 'sunset', 'tamarind', 'thicket', 'thistle', 'thunder', 'timber',
  'topaz', 'trellis', 'tulip', 'umber', 'valley', 'velvet', 'violet', 'walnut',
  'willow', 'window', 'winter', 'wisteria', 'wren', 'zephyr', 'almond', 'badger',
  'bayou', 'blossom', 'bluebell', 'bracken', 'buckeye', 'cactus', 'cavern', 'cinder',
  'citron', 'cliff', 'cloud', 'cove', 'cricket', 'dune', 'eagle', 'fjord',
  'flint', 'galaxy', 'glacier', 'grove', 'lark', 'marsh', 'mesa', 'moose',
  'orchid', 'petal', 'pueblo', 'rapids', 'reed', 'sienna', 'stone', 'tundra',
];

/**
 * Uniform random integer in [0, maxExclusive) from the CSPRNG, using rejection
 * sampling to avoid modulo bias.
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % maxExclusive;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Generate a memorable, crypto-strong passphrase.
 *
 * @param wordCount how many words to include (default 4). Each adds ~log2(|WORDS|)
 *   bits of entropy; 4 words + the 2-digit number is a sensible default for a
 *   family-shared secret.
 * @returns e.g. `Maple-River-Lantern-Cobalt-42`
 */
export function generatePassphrase(wordCount = 4): string {
  const parts: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    parts.push(capitalize(WORDS[secureRandomInt(WORDS.length)]));
  }
  // Two-digit number (10–99) guarantees a digit and adds a little entropy.
  parts.push(String(10 + secureRandomInt(90)));
  return parts.join('-');
}
