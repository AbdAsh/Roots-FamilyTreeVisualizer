import { useEffect, useCallback } from 'react';
import { useTreeStore } from './useTree';

interface ShortcutOptions {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onDeleteSelected?: () => void;
}

/**
 * Global keyboard shortcuts:
 * - Escape: close panels / clear search
 * - Delete/Backspace: delete selected member (triggers confirm)
 * - Ctrl/⌘ + Z: undo
 * - Ctrl/⌘ + Shift + Z / Ctrl/⌘ + Y: redo
 * - Ctrl/⌘ + K or /: focus search
 */
export function useKeyboardShortcuts({
  searchInputRef,
  onDeleteSelected,
}: ShortcutOptions) {
  const setEditing = useTreeStore((s) => s.setEditing);
  const setAddingFor = useTreeStore((s) => s.setAddingFor);
  const selectMember = useTreeStore((s) => s.selectMember);
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const isEditing = useTreeStore((s) => s.isEditing);
  const addingFor = useTreeStore((s) => s.addingForMemberId);
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

      // Escape — close panels
      if (e.key === 'Escape') {
        if (addingFor) {
          setAddingFor(null);
        } else if (isEditing) {
          setEditing(false);
          selectMember(null);
        } else if (
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
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — redo
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+K or / — focus search
      if ((mod && e.key === 'k') || e.key === '/') {
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
      addingFor,
      isEditing,
      selectedMemberId,
      setAddingFor,
      setEditing,
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
