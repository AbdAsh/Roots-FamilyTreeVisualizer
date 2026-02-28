/**
 * Slide-in side panel component.
 *
 * Slides in from the right edge of the screen using Framer Motion.
 * Used for the edit panel and other side-docked UI.
 * Z-index layering: backdrop = z-30, panel = z-20.
 */
import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface PanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Panel({ isOpen, onClose, title, children }: PanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="
              absolute top-0 right-0 z-20
              h-full w-full max-w-sm
              bg-charcoal border-l border-charcoal-lighter
              flex flex-col
              shadow-2xl
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-lighter shrink-0">
              {title && (
                <h2 className="font-display text-base text-cream">{title}</h2>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-cream/40 hover:text-cream hover:bg-cream/5 transition-colors ml-auto cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
