import { useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}: ConfirmModalProps) {
  const { strings } = useI18n();

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  const iconColor = variant === 'danger' ? 'text-error' : 'text-amber';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col items-center text-center gap-4 pt-2">
        {/* Icon */}
        <div className="w-11 h-11 rounded-full border border-charcoal-lighter flex items-center justify-center">
          <AlertTriangle size={20} className={iconColor} />
        </div>

        {/* Title */}
        <h3 className="font-display text-xl font-medium text-cream tracking-tight">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-cream-dark leading-relaxed max-w-xs whitespace-pre-line text-start">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 w-full mt-3">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            className="flex-1"
          >
            {cancelLabel ?? strings.confirm.cancel}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={handleConfirm}
            className="flex-1"
          >
            {confirmLabel ?? strings.confirm.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
