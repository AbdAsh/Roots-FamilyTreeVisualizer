import { useEffect, useRef, useState } from 'react';
import { useTreeStore } from './useTree';
import { useAuthStore } from './useAuth';
import { saveToHash } from '@/lib/url';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Hook that auto-saves the tree to the URL hash whenever it changes.
 * Debounced to avoid excessive hashing on rapid edits.
 * Returns current save status + capacity info.
 */
export function useSave() {
  const tree = useTreeStore((s) => s.tree);
  const passphrase = useAuthStore((s) => s.passphrase);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSavedRef = useRef<string>('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [capacity, setCapacity] = useState({
    sizeBytes: 0,
    capacityPercent: 0,
  });

  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!tree || !passphrase) return;

    const serialized = JSON.stringify(tree);
    // Skip if nothing changed
    if (serialized === lastSavedRef.current) return;

    setStatus('saving');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await saveToHash(tree, passphrase);
        lastSavedRef.current = serialized;
        setCapacity({
          sizeBytes: result.sizeBytes,
          capacityPercent: result.capacityPercent,
        });
        setStatus('saved');
        // Reset to idle after 2s
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        console.error('Failed to save tree to URL:', err);
        setStatus('error');
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [tree, passphrase]);

  return { status, capacity };
}
