/**
 * Authentication store for the passphrase-based unlock flow.
 *
 * Roots has no accounts or server auth. Security is handled entirely client-side:
 * - The user provides a passphrase that derives an AES-256-GCM key (PBKDF2, 600k iterations)
 * - The passphrase is **kept in memory only** — never persisted to localStorage/cookies
 * - Failed unlock attempts trigger exponential backoff (managed by `passphrase.ts`)
 * - Locking clears the passphrase from memory immediately
 *
 * @module useAuth
 */
import { create } from 'zustand';
import { loadFromHash, hasHashData } from '@/lib/url';
import {
  recordFailure,
  resetThrottle,
  throttleRemaining,
} from '@/lib/passphrase';
import type { FamilyTree } from '@/types/family';

interface AuthState {
  isUnlocked: boolean;
  passphrase: string | null;
  error: string | null;
  isLoading: boolean;
  isNewTree: boolean;
  /** Seconds remaining before the next unlock attempt is allowed */
  throttleSeconds: number;

  /** Attempt to unlock an existing tree from the URL hash */
  unlock: (passphrase: string) => Promise<FamilyTree | null>;

  /** Set passphrase for a new tree (no hash to decrypt) */
  setNewTreePassphrase: (passphrase: string) => void;

  /** Lock the tree (clear passphrase from memory) */
  lock: () => void;

  /** Clear error message */
  clearError: () => void;

  /** Check if URL has existing tree data */
  checkForExistingTree: () => boolean;
  /** Wipe the URL hash and go to new-tree mode (destructive) */
  resetToNew: () => void;
}

let throttleTimer: ReturnType<typeof setInterval> | null = null;

function startThrottleCountdown(set: (partial: Partial<AuthState>) => void) {
  if (throttleTimer) clearInterval(throttleTimer);
  throttleTimer = setInterval(() => {
    const remaining = Math.ceil(throttleRemaining() / 1000);
    set({ throttleSeconds: remaining });
    if (remaining <= 0 && throttleTimer) {
      clearInterval(throttleTimer);
      throttleTimer = null;
    }
  }, 250);
}

export const useAuthStore = create<AuthState>((set) => ({
  isUnlocked: false,
  passphrase: null,
  error: null,
  isLoading: false,
  isNewTree: !hasHashData(),
  throttleSeconds: 0,

  unlock: async (passphrase: string) => {
    // Enforce throttle
    const wait = throttleRemaining();
    if (wait > 0) {
      set({
        throttleSeconds: Math.ceil(wait / 1000),
        error: null,
        isLoading: false,
      });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const tree = await loadFromHash(passphrase);
      if (tree) {
        resetThrottle();
        set({
          isUnlocked: true,
          passphrase,
          isLoading: false,
          isNewTree: false,
          throttleSeconds: 0,
        });
        return tree;
      }
      set({ error: 'No data found in URL.', isLoading: false });
      return null;
    } catch (err) {
      // Failed → record for backoff
      const delayMs = recordFailure();
      const message = err instanceof Error ? err.message : 'Failed to decrypt.';
      set({ error: message, isLoading: false });
      if (delayMs > 0) {
        set({ throttleSeconds: Math.ceil(delayMs / 1000) });
        startThrottleCountdown(set);
      }
      return null;
    }
  },

  setNewTreePassphrase: (passphrase: string) => {
    set({ isUnlocked: true, passphrase, isNewTree: true });
  },

  resetToNew: () => {
    // Wipe the URL hash so the encrypted tree is no longer accessible
    window.location.hash = '';
    set({
      isUnlocked: false,
      passphrase: null,
      error: null,
      isNewTree: true,
      throttleSeconds: 0,
    });
  },

  lock: () => {
    const hasData = hasHashData();
    set({
      isUnlocked: false,
      passphrase: null,
      error: null,
      isNewTree: !hasData,
    });
  },

  clearError: () => set({ error: null }),

  checkForExistingTree: () => {
    const has = hasHashData();
    set({ isNewTree: !has });
    return has;
  },
}));
