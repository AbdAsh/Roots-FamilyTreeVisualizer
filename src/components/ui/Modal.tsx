/**
 * Animated overlay modal component.
 *
 * Uses Framer Motion for enter/exit animations. Closes on Escape key or backdrop click.
 * Content is rendered inside a charcoal card with optional title header.
 *
 * @example
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Settings">
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */
import { type ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md bg-charcoal-light border border-charcoal-lighter rounded-2xl shadow-2xl">
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-lighter">
                  <h2 className="font-display text-lg text-cream">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-cream/40 hover:text-cream hover:bg-cream/5 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="px-6 py-5">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
