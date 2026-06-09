import { describe, it, expect } from 'vitest';
import { generatePassphrase, WORDS } from './generate-passphrase';

describe('generatePassphrase', () => {
  it('produces a reasonably long passphrase (>= 12 chars)', () => {
    expect(generatePassphrase().length).toBeGreaterThanOrEqual(12);
  });

  it('includes an uppercase letter and a digit so it clears strength checks', () => {
    // Run a batch since the digit/word content varies per call.
    for (let i = 0; i < 25; i++) {
      const p = generatePassphrase();
      expect(p, `"${p}" should contain an uppercase letter`).toMatch(/[A-Z]/);
      expect(p, `"${p}" should contain a digit`).toMatch(/[0-9]/);
    }
  });

  it('uses only share/URL-friendly characters (letters, digits, hyphen)', () => {
    for (let i = 0; i < 25; i++) {
      expect(generatePassphrase()).toMatch(/^[A-Za-z0-9-]+$/);
    }
  });

  it('respects the requested word count (N words + a trailing number)', () => {
    expect(generatePassphrase(4).split('-')).toHaveLength(5);
    expect(generatePassphrase(5).split('-')).toHaveLength(6);
  });

  it('is unpredictable — 30 calls yield mostly distinct values', () => {
    const set = new Set(Array.from({ length: 30 }, () => generatePassphrase()));
    expect(set.size).toBeGreaterThan(25);
  });

  it('has a fully distinct wordlist (no duplicates skewing entropy)', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});
