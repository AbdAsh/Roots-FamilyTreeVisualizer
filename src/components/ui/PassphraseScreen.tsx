import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock, Plus, TreePine, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/hooks/useAuth';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n, t } from '@/lib/i18n';
import { evaluateStrength, isAcceptable } from '@/lib/passphrase';

const STRENGTH_COLORS: Record<string, string> = {
  weak: 'bg-red-500',
  fair: 'bg-amber',
  good: 'bg-sage',
  strong: 'bg-emerald-500',
};

export function PassphraseScreen() {
  const {
    isNewTree,
    unlock,
    setNewTreePassphrase,
    resetToNew,
    error,
    isLoading,
    clearError,
    throttleSeconds,
  } = useAuthStore();
  const { initTree, setTree } = useTreeStore();
  const { strings } = useI18n();

  const [passphrase, setPassphrase] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [strengthWarning, setStrengthWarning] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const strength = useMemo(() => evaluateStrength(passphrase), [passphrase]);

  const strengthLabel =
    strength.level === 'weak'
      ? strings.auth.strengthWeak
      : strength.level === 'fair'
        ? strings.auth.strengthFair
        : strength.level === 'good'
          ? strings.auth.strengthGood
          : strings.auth.strengthStrong;

  const handleUnlock = useCallback(async () => {
    if (!passphrase.trim()) return;
    if (throttleSeconds > 0) return;
    clearError();
    const tree = await unlock(passphrase.trim());
    if (tree) {
      setTree(tree);
    } else {
      setShakeKey((k) => k + 1);
    }
  }, [passphrase, unlock, setTree, clearError, throttleSeconds]);

  const handleCreate = useCallback(() => {
    if (!passphrase.trim() || !familyName.trim()) return;
    if (!isAcceptable(passphrase.trim())) {
      setStrengthWarning(strings.auth.passphraseTooShort);
      return;
    }
    if (strength.level === 'weak') {
      setStrengthWarning(strings.auth.passphraseTooWeak);
      return;
    }
    setStrengthWarning(null);
    setNewTreePassphrase(passphrase.trim());
    initTree(familyName.trim());
  }, [
    passphrase,
    familyName,
    setNewTreePassphrase,
    initTree,
    strength,
    strings,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isNewTree) handleCreate();
      else handleUnlock();
    }
  };

  const isThrottled = throttleSeconds > 0;

  return (
    <div className="noise-bg min-h-dvh flex items-center justify-center p-4 relative">
      {/* Language switcher — top right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher variant="pill" />
      </div>

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-amber/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 rounded-full bg-sage/5 blur-3xl" />
      </div>

      <motion.div
        key={shakeKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`
          relative z-10 w-full max-w-md
          bg-charcoal-light/80 backdrop-blur-md
          border border-charcoal-lighter/60
          rounded-2xl shadow-2xl
          p-8 sm:p-10
          ${error ? 'animate-shake' : ''}
        `}
      >
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber/10 border border-amber/20 mb-4">
            <TreePine size={28} className="text-amber" />
          </div>
          <h1 className="font-display text-2xl font-bold text-cream tracking-tight">
            {strings.app.title}
          </h1>
          <p className="mt-1 text-sm text-cream/40 font-body">
            {isNewTree ? strings.auth.plantTree : strings.auth.unlockTree}
          </p>
        </div>

        <div className="flex flex-col gap-5" onKeyDown={handleKeyDown}>
          {/* Family name (new tree only) */}
          {isNewTree && (
            <Input
              label={strings.auth.familyName}
              placeholder={strings.auth.familyNamePlaceholder}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              autoFocus
            />
          )}

          {/* Passphrase */}
          <div className="relative">
            <Input
              label={strings.auth.passphrase}
              type={showPass ? 'text' : 'password'}
              placeholder={
                isNewTree
                  ? strings.auth.choosePassphrase
                  : strings.auth.enterPassphrase
              }
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                if (error) clearError();
                if (strengthWarning) setStrengthWarning(null);
              }}
              error={error ?? strengthWarning ?? undefined}
              autoFocus={!isNewTree}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-[34px] text-cream/30 hover:text-cream/60 transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength meter (new tree only) */}
          {isNewTree && passphrase.length > 0 && (
            <div className="flex items-center gap-2 -mt-2">
              <div className="flex-1 h-1 rounded-full bg-charcoal-lighter/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${STRENGTH_COLORS[strength.level]}`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              <span
                className={`text-[10px] font-medium ${
                  strength.level === 'weak'
                    ? 'text-red-400'
                    : strength.level === 'fair'
                      ? 'text-amber'
                      : strength.level === 'good'
                        ? 'text-sage'
                        : 'text-emerald-400'
                }`}
              >
                {strengthLabel}
              </span>
            </div>
          )}

          {/* Throttle warning (unlock mode) */}
          {!isNewTree && isThrottled && (
            <p className="text-[11px] text-red-400/80 animate-fade-in -mt-2">
              {t(strings.auth.throttled, {
                seconds: String(throttleSeconds),
              })}
            </p>
          )}

          {/* Hint for new tree */}
          {isNewTree && (
            <p className="text-[11px] text-cream/30 leading-relaxed">
              {strings.auth.passphraseHint}
            </p>
          )}

          {/* Submit button */}
          <Button
            onClick={isNewTree ? handleCreate : handleUnlock}
            disabled={
              isLoading ||
              isThrottled ||
              !passphrase.trim() ||
              (isNewTree && !familyName.trim())
            }
            className="w-full mt-2"
            size="lg"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-charcoal border-t-transparent rounded-full animate-spin" />
            ) : isNewTree ? (
              <>
                <Plus size={18} /> {strings.auth.createTree}
              </>
            ) : (
              <>
                <Lock size={18} /> {strings.auth.unlock}
              </>
            )}
          </Button>

          {/* Reset link — only on the unlock screen (existing tree in URL) */}
          {!isNewTree && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center gap-1.5 text-[11px] text-cream/25 hover:text-cream/50 transition-colors cursor-pointer group"
              >
                <RotateCcw
                  size={11}
                  className="group-hover:rotate-180 transition-transform duration-300"
                />
                {strings.auth.resetButton}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-cream/20 uppercase tracking-widest">
          {strings.auth.footer}
        </p>
      </motion.div>

      {/* Reset confirmation modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setShowResetConfirm(false);
          resetToNew();
        }}
        title={strings.auth.resetTitle}
        message={strings.auth.resetDisclaimer}
        confirmLabel={strings.auth.resetConfirm}
        variant="danger"
      />
    </div>
  );
}
