/**
 * Animated overlay modal component.
 *
 * Uses Framer Motion for enter/exit animations (respecting reduced-motion).
 * Closes on Escape key or backdrop click. Exposes proper dialog semantics
 * (`role="dialog"`/`alertdialog`, `aria-modal`, an accessible name), moves focus
 * into the dialog on open, traps Tab within it, and restores focus to the
 * trigger on close. Renders through a portal to `document.body` and marks the
 * app root `inert` while open, so the background is hidden from AT (not just the
 * Tab focus trap).
 *
 * @example
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Settings">
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

/**
 * Shared count of open modals so the app root (`#root`) is marked `inert` while
 * any dialog is up — this hides the background canvas/toolbar from a screen
 * reader's virtual cursor and landmark navigation (not just the Tab focus
 * trap). Modals are portaled to `document.body` (outside `#root`), so they stay
 * interactive. A counter handles stacked dialogs correctly.
 */
let openModalCount = 0;
function setRootInert(on: boolean): void {
  const root = document.getElementById('root');
  if (!root) return;
  if (on) root.setAttribute('inert', '');
  else root.removeAttribute('inert');
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Visible header; also becomes the dialog's accessible name. */
  title?: string;
  /** Accessible name when there is no visible `title` header (e.g. ConfirmModal). */
  label?: string;
  /** `'dialog'` (default) or `'alertdialog'` for destructive confirmations. */
  role?: 'dialog' | 'alertdialog';
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  label,
  role = 'dialog',
  children,
}: ModalProps) {
  const { strings } = useI18n();
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Keep the latest onClose without re-running the focus effect each render
  // (callers often pass an inline arrow as onClose).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape-to-close, focus trap, and focus restore — only on open/close edges.
  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const card = cardRef.current;

    // Make the app background inert (AT containment) while this dialog is open.
    openModalCount++;
    if (openModalCount === 1) setRootInert(true);

    // Move focus into the dialog: first focusable element, else the card itself.
    const firstFocusable = card?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? card)?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      const items = Array.from(
        card.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      // Lift inert BEFORE restoring focus, or focusing the (still-inert) trigger fails.
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) setRootInert(false);
      prevFocus?.focus?.();
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="fixed inset-0 z-40 bg-charcoal/80"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={cardRef}
              role={role}
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-label={!title ? label : undefined}
              tabIndex={-1}
              className="pointer-events-auto w-full max-w-md bg-charcoal-light border border-charcoal-lighter rounded-lg shadow-md focus:outline-none"
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-lighter">
                  <h2
                    id={titleId}
                    className="font-display text-xl font-medium text-cream tracking-tight"
                  >
                    {title}
                  </h2>
                  <button
                    onClick={onClose}
                    aria-label={strings.app.close}
                    title={strings.app.close}
                    className="p-1.5 -me-1.5 touch-target grid place-items-center rounded-md text-cream-dark hover:text-cream hover:bg-cream/5 transition-colors cursor-pointer"
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
    </AnimatePresence>,
    document.body,
  );
}
