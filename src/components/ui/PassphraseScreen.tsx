import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock, Plus, Eye, EyeOff, RotateCcw, Sun, Moon, Dices } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RootsMark } from '@/components/ui/RootsMark';
import { Input } from '@/components/ui/Input';
import { generatePassphrase } from '@/lib/generate-passphrase';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/hooks/useAuth';
import { useTreeStore } from '@/hooks/useTree';
import { useThemeStore } from '@/hooks/useTheme';
import { useI18n, t } from '@/lib/i18n';
import { evaluateStrength, isAcceptable } from '@/lib/passphrase';

const STRENGTH_COLORS: Record<string, string> = {
  weak: 'bg-error',
  fair: 'bg-amber',
  good: 'bg-sage',
  strong: 'bg-sage',
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
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

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

  const handleGenerate = useCallback(() => {
    setPassphrase(generatePassphrase());
    setShowPass(true); // reveal so the user can read and save it (no recovery if lost)
    if (error) clearError();
    setStrengthWarning(null);
  }, [error, clearError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isNewTree) handleCreate();
      else handleUnlock();
    }
  };

  const isThrottled = throttleSeconds > 0;

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 relative">
      {/* Language switcher + theme toggle — top right */}
      <div className="absolute top-5 end-5 z-20 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="touch-target"
          onClick={toggleTheme}
          aria-label={strings.app.toggleTheme}
          title={strings.app.toggleTheme}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </Button>
        <LanguageSwitcher variant="pill" />
      </div>

      <motion.div
        key={shakeKey}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`relative z-10 w-full max-w-sm ${error ? 'animate-shake' : ''}`}
      >
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <RootsMark size={32} className="text-amber mx-auto mb-5" />
          <h1 className="sr-only">{strings.app.seoH1}</h1>
          <div
            aria-hidden="true"
            className="font-display text-4xl font-medium text-cream tracking-tight"
          >
            {strings.app.title}
          </div>
          <p className="mt-2 text-sm text-cream-dark font-body">
            {isNewTree ? strings.auth.plantTree : strings.auth.unlockTree}
          </p>
          <p className="mt-4 text-xs text-cream-dark font-body leading-relaxed max-w-xs mx-auto">
            {strings.auth.conceptLine}
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
              className="absolute end-4 top-[36px] text-cream-dark hover:text-cream transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {isNewTree && (
              <button
                type="button"
                onClick={handleGenerate}
                className="absolute end-0 top-0 flex items-center gap-1 text-xs font-medium text-amber hover:text-amber-light transition-colors cursor-pointer"
              >
                <Dices size={13} />
                {strings.auth.generatePassphrase}
              </button>
            )}
          </div>

          {/* Strength meter (new tree only) */}
          {isNewTree && passphrase.length > 0 && (
            <div className="flex items-center gap-2 -mt-2">
              <div className="flex-1 h-1 rounded-full bg-charcoal-lighter overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${STRENGTH_COLORS[strength.level]}`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              <span
                className={`text-[10px] font-medium ${
                  strength.level === 'weak'
                    ? 'text-error'
                    : strength.level === 'fair'
                      ? 'text-amber'
                      : 'text-cream-dark'
                }`}
              >
                {strengthLabel}
              </span>
            </div>
          )}

          {/* Throttle warning (unlock mode) */}
          {!isNewTree && isThrottled && (
            <p className="text-[11px] text-error animate-fade-in -mt-2">
              {t(strings.auth.throttled, {
                seconds: String(throttleSeconds),
              })}
            </p>
          )}

          {/* Hint for new tree */}
          {isNewTree && (
            <p className="text-[11px] text-cream-dark leading-relaxed">
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
              <span className="inline-block w-4 h-4 border-2 border-charcoal-light border-t-transparent rounded-full animate-spin" />
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
                className="inline-flex items-center gap-1.5 text-[11px] text-cream-dark hover:text-cream transition-colors cursor-pointer group"
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
        <p className="mt-8 text-center text-[10px] text-cream-dark uppercase tracking-widest">
          {strings.auth.footer}
        </p>
      </motion.div>

      {/* Developer credit */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 whitespace-nowrap">
        <a
          href="https://abdash.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-cream-dark hover:text-cream transition-colors"
        >
          Built by Abdulrahman Mahmutoglu
        </a>
        <span className="text-[10px] text-cream-dark/50" aria-hidden="true">·</span>
        <a
          href="/privacy.html"
          className="text-[10px] text-cream-dark hover:text-cream transition-colors"
        >
          {strings.app.privacy}
        </a>
      </div>

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
