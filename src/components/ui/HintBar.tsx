/**
 * Bottom-center walkthrough hint bar.
 *
 * Shows one hint at a time (highest-priority applicable, not yet dismissed):
 *  1. `hints.addRelatives` — when the tree has ≥ 1 member (localStorage key: `roots-tour.addRelatives`)
 *  2. `hints.share`        — when the tree has ≥ 2 members (localStorage key: `roots-tour.share`)
 *
 * Paper-styled (tokens only, no glass/blur/glow). Dismissible via a small ×.
 * Respects `prefers-reduced-motion`.
 */
import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';

const HINT_ADD_RELATIVES_KEY = 'roots-tour.addRelatives';
const HINT_SHARE_KEY = 'roots-tour.share';

function isDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'dismissed';
  } catch {
    return false;
  }
}

function dismiss(key: string): void {
  try {
    localStorage.setItem(key, 'dismissed');
  } catch {
    // storage unavailable — silently ignore
  }
}

export function HintBar() {
  const tree = useTreeStore((s) => s.tree);
  const { strings } = useI18n();

  // Track dismissals in local state so the bar hides immediately on click
  const [dismissedAddRelatives, setDismissedAddRelatives] = useState(() =>
    isDismissed(HINT_ADD_RELATIVES_KEY),
  );
  const [dismissedShare, setDismissedShare] = useState(() =>
    isDismissed(HINT_SHARE_KEY),
  );

  const handleDismissAddRelatives = useCallback(() => {
    dismiss(HINT_ADD_RELATIVES_KEY);
    setDismissedAddRelatives(true);
  }, []);

  const handleDismissShare = useCallback(() => {
    dismiss(HINT_SHARE_KEY);
    setDismissedShare(true);
  }, []);

  if (!tree) return null;

  const memberCount = tree.members.length;

  // Determine which hint to show (highest-priority not-yet-dismissed applicable)
  let hintText: string | null = null;
  let onDismiss: (() => void) | null = null;

  if (memberCount >= 1 && !dismissedAddRelatives) {
    hintText = strings.hints.addRelatives;
    onDismiss = handleDismissAddRelatives;
  } else if (memberCount >= 2 && !dismissedShare) {
    hintText = strings.hints.share;
    onDismiss = handleDismissShare;
  }

  if (!hintText || !onDismiss) return null;

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 motion-safe:animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 bg-charcoal-light border border-charcoal-lighter rounded-full text-xs text-cream-dark shadow-sm max-w-xs sm:max-w-sm">
        <span className="flex-1 text-center leading-snug">{hintText}</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss hint"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-cream-dark hover:text-cream hover:bg-cream/10 transition-colors cursor-pointer"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
