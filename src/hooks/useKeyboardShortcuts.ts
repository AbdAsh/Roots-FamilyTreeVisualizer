import { useEffect, useCallback } from 'react';
import { useTreeStore } from './useTree';

interface ShortcutOptions {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onDeleteSelected?: () => void;
}

/**
 * Global keyboard shortcuts:
 * - Escape: close details modal → deselect member → blur search
 * - Delete/Backspace: delete selected member (triggers confirm)
 * - Ctrl/⌘ + Z: undo
 * - Ctrl/⌘ + Shift + Z / Ctrl/⌘ + Y: redo
 * - Ctrl/⌘ + K or /: focus search
 */
export function useKeyboardShortcuts({
  searchInputRef,
  onDeleteSelected,
}: ShortcutOptions) {
  const detailsForId = useTreeStore((s) => s.detailsForId);
  const openDetails = useTreeStore((s) => s.openDetails);
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const selectMember = useTreeStore((s) => s.selectMember);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;
      // Normalize letter keys: with Shift held, KeyboardEvent.key is uppercase
      // (e.g. 'Z'), so compare case-insensitively or the Shift-based shortcuts
      // (⌘⇧Z redo) never match.
      const key = e.key.toLowerCase();

      // Escape — close details modal → deselect node → blur search
      if (e.key === 'Escape') {
        if (detailsForId) {
          openDetails(null);
          return;
        }
        if (selectedMemberId) {
          selectMember(null);
          return;
        }
        if (
          searchInputRef.current &&
          document.activeElement === searchInputRef.current
        ) {
          searchInputRef.current.blur();
        }
        return;
      }

      // Don't intercept shortcuts when typing in inputs (except Escape above)
      if (isInput) return;

      // Ctrl+Z — undo
      if (mod && !e.shiftKey && key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — redo
      if ((mod && e.shiftKey && key === 'z') || (mod && key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+K or / — focus search
      if ((mod && key === 'k') || e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Delete/Backspace — delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMemberId) {
        e.preventDefault();
        onDeleteSelected?.();
        return;
      }
    },
    [
      detailsForId,
      openDetails,
      selectedMemberId,
      selectMember,
      undo,
      redo,
      searchInputRef,
      onDeleteSelected,
    ],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
