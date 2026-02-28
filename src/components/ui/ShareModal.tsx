import { useState, useCallback } from 'react';
import { Copy, Check, Link, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getHashCapacity } from '@/lib/url';
import { useI18n } from '@/lib/i18n';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const { sizeBytes, capacityPercent } = getHashCapacity();
  const { strings } = useI18n();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const capacityColor =
    capacityPercent > 80
      ? 'text-error'
      : capacityPercent > 60
        ? 'text-amber'
        : 'text-sage-light';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={strings.shareModal.title}>
      <div className="flex flex-col gap-5">
        {/* URL display */}
        <div>
          <label className="text-[11px] font-medium text-cream/50 uppercase tracking-wider block mb-1.5">
            {strings.shareModal.shareableLink}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 bg-charcoal border border-charcoal-lighter rounded-lg text-xs text-cream/70 truncate font-mono">
              {window.location.href.length > 80
                ? window.location.href.slice(0, 40) +
                  '…' +
                  window.location.href.slice(-35)
                : window.location.href}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check size={14} className="text-sage" />
              ) : (
                <Copy size={14} />
              )}
              {copied ? strings.shareModal.copied : strings.shareModal.copy}
            </Button>
          </div>
        </div>

        {/* Capacity indicator */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-cream/40">
              {strings.shareModal.capacityUsed}
            </span>
            <span className={`text-xs font-medium ${capacityColor}`}>
              {capacityPercent}% ({(sizeBytes / 1024).toFixed(1)} KB)
            </span>
          </div>
          <div className="w-full h-1.5 bg-charcoal rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                capacityPercent > 80
                  ? 'bg-error'
                  : capacityPercent > 60
                    ? 'bg-amber'
                    : 'bg-sage'
              }`}
              style={{ width: `${Math.min(100, capacityPercent)}%` }}
            />
          </div>
        </div>

        {capacityPercent > 80 && (
          <div className="flex items-start gap-3 p-4 bg-error/5 border border-error/10 rounded-xl">
            <AlertTriangle size={14} className="text-error shrink-0 mt-0.5" />
            <p className="text-[11px] text-error/80 leading-relaxed">
              {strings.shareModal.capacityWarning}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 bg-amber/5 border border-amber/10 rounded-xl">
          <div className="flex items-start gap-3">
            <Link size={14} className="text-amber/60 shrink-0 mt-0.5" />
            <div className="text-[11px] text-cream/50 leading-relaxed space-y-1">
              <p>
                <strong className="text-cream/70">
                  {strings.shareModal.shareInstructions}
                </strong>
              </p>
              <p>{strings.shareModal.shareInstructionsDetail}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
