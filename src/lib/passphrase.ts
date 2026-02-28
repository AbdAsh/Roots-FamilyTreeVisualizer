/**
 * Passphrase strength evaluation & brute-force throttle.
 *
 * Strength scoring uses a simple entropy-like rubric rather than pulling in
 * a heavy library — the goal is to nudge users toward reasonable passphrases
 * without being overly prescriptive.
 */

/* ── Strength meter ── */

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface StrengthResult {
  level: StrengthLevel;
  /** 0-100 numeric score for the progress bar */
  score: number;
}

const MIN_LENGTH = 8;

/**
 * Returns a coarse strength assessment:
 * - weak   (0-25):  too short or only one char class
 * - fair   (26-50): two char classes, ≥8 chars
 * - good   (51-75): three char classes, ≥10 chars
 * - strong (76-100): four char classes, ≥12 chars OR passphrase ≥20 chars
 */
export function evaluateStrength(passphrase: string): StrengthResult {
  const len = passphrase.length;
  if (len === 0) return { level: 'weak', score: 0 };

  let classes = 0;
  if (/[a-z]/.test(passphrase)) classes++;
  if (/[A-Z]/.test(passphrase)) classes++;
  if (/\d/.test(passphrase)) classes++;
  if (/[^a-zA-Z0-9]/.test(passphrase)) classes++;

  // Long passphrase (space-separated words) is inherently strong
  if (len >= 20) return { level: 'strong', score: 100 };

  if (len < MIN_LENGTH) {
    // Scale 0–25 based on how close to min length
    return { level: 'weak', score: Math.round((len / MIN_LENGTH) * 25) };
  }

  if (classes >= 4 && len >= 12) return { level: 'strong', score: 100 };
  if (classes >= 3 && len >= 10) return { level: 'good', score: 70 };
  if (classes >= 2) return { level: 'fair', score: 45 };

  // Single char class but ≥8
  return { level: 'weak', score: 25 };
}

export function isAcceptable(passphrase: string): boolean {
  return passphrase.length >= MIN_LENGTH;
}

/* ── Brute-force throttle ── */
// Exponential backoff: 0, 0, 1, 2, 4, 8, 16, 30, 30, 30, … seconds

const BACKOFF_SCHEDULE = [0, 0, 1, 2, 4, 8, 16, 30];
const MAX_BACKOFF = 30; // seconds

let failCount = 0;
let lockedUntil = 0;

/** Record a failed unlock attempt; returns delay in ms before next try is allowed */
export function recordFailure(): number {
  failCount++;
  const delaySec =
    failCount < BACKOFF_SCHEDULE.length
      ? BACKOFF_SCHEDULE[failCount]
      : MAX_BACKOFF;
  lockedUntil = Date.now() + delaySec * 1000;
  return delaySec * 1000;
}

/** Returns remaining lock-out ms (0 if allowed to try now) */
export function throttleRemaining(): number {
  return Math.max(0, lockedUntil - Date.now());
}

/** Reset after a successful unlock */
export function resetThrottle(): void {
  failCount = 0;
  lockedUntil = 0;
}
