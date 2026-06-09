import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Share2,
  Lock,
  Users,
  Undo2,
  Redo2,
  Search,
  Check,
  Loader2,
  AlertCircle,
  X,
  Info,
  Sun,
  Moon,
  Menu,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PassphraseScreen } from '@/components/ui/PassphraseScreen';
import { ShareModal } from '@/components/ui/ShareModal';
import { AboutModal } from '@/components/ui/AboutModal';
import { FamilyTreeView } from '@/components/tree/FamilyTreeView';
import { DetailsModal } from '@/components/editor/DetailsModal';
import { Legend } from '@/components/ui/Legend';
import { ExportImportBar } from '@/components/ui/ExportImportBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { HintBar } from '@/components/ui/HintBar';
import { Button } from '@/components/ui/Button';
import { RootsMark } from '@/components/ui/RootsMark';
import { useTreeStore } from '@/hooks/useTree';
import { useAuthStore } from '@/hooks/useAuth';
import { useThemeStore } from '@/hooks/useTheme';
import { useSave } from '@/hooks/useSave';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { MenuRow, MenuDivider, MenuLabel } from '@/components/ui/Menu';
import { useI18n, tPlural, t, LOCALE_META, type Locale } from '@/lib/i18n';

export default function App() {
  const isUnlocked = useAuthStore((s) => s.isUnlocked);
  const lock = useAuthStore((s) => s.lock);
  const tree = useTreeStore((s) => s.tree);
  const clearTree = useTreeStore((s) => s.clearTree);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const canUndo = useTreeStore((s) => s.canUndo);
  const canRedo = useTreeStore((s) => s.canRedo);
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const removeMember = useTreeStore((s) => s.removeMember);

  const { strings, locale, setLocale } = useI18n();
  const reduceMotion = useReducedMotion();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [shareOpen, setShareOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the mobile burger menu on outside-click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Auto-save with status
  const { status: saveStatus } = useSave();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    searchInputRef,
    onDeleteSelected: () => {
      if (selectedMemberId && (tree?.members.length ?? 0) > 1) {
        setDeleteConfirmOpen(true);
      }
    },
  });

  const handleConfirmDeleteSelected = useCallback(() => {
    if (selectedMemberId) {
      removeMember(selectedMemberId);
      setDeleteConfirmOpen(false);
    }
  }, [selectedMemberId, removeMember]);

  const deletingMemberName = tree?.members.find(
    (m) => m.id === selectedMemberId,
  )?.name;

  // Show passphrase screen if not unlocked
  if (!isUnlocked) {
    return <PassphraseScreen />;
  }

  const handleLock = () => {
    lock();
    clearTree();
  };

  const saveStatusIcon =
    saveStatus === 'saving' ? (
      <Loader2 size={10} className="animate-spin text-amber" />
    ) : saveStatus === 'saved' ? (
      <Check size={10} className="text-sage" />
    ) : saveStatus === 'error' ? (
      <AlertCircle size={10} className="text-error" />
    ) : null;

  const saveStatusText =
    saveStatus === 'saving'
      ? strings.save.saving
      : saveStatus === 'saved'
        ? strings.save.saved
        : saveStatus === 'error'
          ? strings.save.error
          : null;

  return (
    <div className="h-dvh flex flex-col relative">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-3.5 border-b border-charcoal-lighter bg-charcoal z-40 relative">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <RootsMark size={18} className="text-amber shrink-0" />
            <h1 className="font-display text-base sm:text-lg font-medium text-cream tracking-tight truncate">
              {tree?.name ?? strings.app.title}
            </h1>
          </div>
          {tree && (
            <span className="hidden sm:flex text-[10px] text-cream-dark uppercase tracking-wider items-center gap-1 whitespace-nowrap shrink-0">
              <Users size={10} />
              {tPlural(strings.app.memberCount, tree.members.length)}
            </span>
          )}

          {/* Save status */}
          {saveStatusText && (
            <span className="hidden sm:flex text-[10px] text-cream-dark items-center gap-1 whitespace-nowrap shrink-0 animate-fade-in">
              {saveStatusIcon}
              {saveStatusText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Search — always visible (live canvas filter) */}
          {tree && (
            <div className="relative">
              <Search
                size={13}
                className="absolute start-2.5 top-1/2 -translate-y-1/2 text-cream-dark pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={strings.app.searchPlaceholder}
                aria-label={strings.app.searchPlaceholder}
                className="h-8 w-28 sm:w-44 ps-8 pe-7 rounded-md bg-charcoal border border-charcoal-lighter text-xs text-cream placeholder:text-cream-dark focus:border-amber focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label={strings.app.clearSearch}
                  title={strings.app.clearSearch}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-cream-dark hover:text-cream cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Theme — always visible */}
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

          {/* Full inline toolbar — lg and up */}
          <div className="hidden lg:flex items-center gap-2">
            {tree && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={undo}
                  disabled={!canUndo()}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-cream-dark hover:text-cream hover:bg-cream/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title={`${strings.history.undo} (⌘Z)`}
                >
                  <Undo2 size={14} />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo()}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-cream-dark hover:text-cream hover:bg-cream/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title={`${strings.history.redo} (⌘⇧Z)`}
                >
                  <Redo2 size={14} />
                </button>
              </div>
            )}
            {tree && <ExportImportBar />}
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAboutOpen(true)}
              aria-label={strings.about.title}
              title={strings.about.title}
            >
              <Info size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShareOpen(true)}
              aria-label={strings.app.share}
              title={strings.app.share}
            >
              <Share2 size={14} /> {strings.app.share}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLock}
              aria-label={strings.app.lock}
              title={strings.app.lock}
            >
              <Lock size={14} /> {strings.app.lock}
            </Button>
          </div>

          {/* Burger menu — below lg */}
          <div className="relative lg:hidden" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={strings.app.menu}
              title={strings.app.menu}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </Button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  aria-label={strings.app.menu}
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, scale: 0.97 }
                  }
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, scale: 1 }
                  }
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, scale: 0.98 }
                  }
                  transition={{ duration: 0.16, ease: [0.33, 1, 0.68, 1] }}
                  className="absolute end-0 top-[calc(100%+0.5rem)] w-60 origin-top-right
                    max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain
                    rounded-xl border border-charcoal-lighter bg-charcoal-light
                    shadow-xl shadow-black/20 p-1.5 z-50"
                >
                  {tree && (
                    <>
                      <MenuRow
                        icon={Undo2}
                        label={strings.history.undo}
                        disabled={!canUndo()}
                        onClick={() => undo()}
                      />
                      <MenuRow
                        icon={Redo2}
                        label={strings.history.redo}
                        disabled={!canRedo()}
                        onClick={() => redo()}
                      />
                      <MenuDivider />
                      <ExportImportBar
                        variant="menu"
                        onAction={() => setMenuOpen(false)}
                      />
                      <MenuDivider />
                    </>
                  )}

                  <MenuLabel>{strings.app.language}</MenuLabel>
                  {(Object.keys(LOCALE_META) as Locale[]).map((l) => (
                    <MenuRow
                      key={l}
                      leading={
                        <span className="text-[15px] leading-none">
                          {LOCALE_META[l].flag}
                        </span>
                      }
                      label={LOCALE_META[l].label}
                      active={locale === l}
                      onClick={() => {
                        setLocale(l);
                        setMenuOpen(false);
                      }}
                      trailing={
                        locale === l ? (
                          <Check size={14} className="text-amber" />
                        ) : undefined
                      }
                    />
                  ))}

                  <MenuDivider />
                  <MenuRow
                    icon={Info}
                    label={strings.about.title}
                    onClick={() => {
                      setAboutOpen(true);
                      setMenuOpen(false);
                    }}
                  />
                  <MenuRow
                    icon={Share2}
                    label={strings.app.share}
                    onClick={() => {
                      setShareOpen(true);
                      setMenuOpen(false);
                    }}
                  />
                  <MenuRow
                    icon={Lock}
                    label={strings.app.lock}
                    onClick={() => {
                      handleLock();
                      setMenuOpen(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* Family Tree View */}
        <FamilyTreeView searchQuery={searchQuery} />

        {/* Centered details modal (full edit + relationships + delete) */}
        <DetailsModal />

        {/* Legend */}
        {tree && <Legend />}
      </main>

      {/* Hint bar (bottom) — walkthrough HintBar replaces the old single-member pill */}
      <HintBar />

      {/* Share Modal */}
      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />

      {/* About Modal */}
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Keyboard delete confirm */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteSelected}
        title={strings.editor.removeConfirmTitle}
        message={t(strings.editor.removeConfirmMessage, {
          name: deletingMemberName ?? '',
        })}
        variant="danger"
      />
    </div>
  );
}
