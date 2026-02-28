import { useState, useRef, useCallback } from 'react';
import {
  Share2,
  Lock,
  Users,
  TreePine,
  Undo2,
  Redo2,
  Search,
  Check,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PassphraseScreen } from '@/components/ui/PassphraseScreen';
import { ShareModal } from '@/components/ui/ShareModal';
import { RadialTree } from '@/components/tree/RadialTree';
import { EditPanel } from '@/components/editor/EditPanel';
import { AddPanel } from '@/components/editor/AddPanel';
import { Legend } from '@/components/ui/Legend';
import { ExportImportBar } from '@/components/ui/ExportImportBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { useTreeStore } from '@/hooks/useTree';
import { useAuthStore } from '@/hooks/useAuth';
import { useSave } from '@/hooks/useSave';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useI18n, tPlural, t } from '@/lib/i18n';

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

  const { strings } = useI18n();
  const [shareOpen, setShareOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

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
      <Loader2 size={10} className="animate-spin text-amber/60" />
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
    <div className="noise-bg h-dvh flex flex-col relative">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-charcoal-lighter/50 bg-charcoal/80 backdrop-blur-sm z-10 relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TreePine size={18} className="text-amber" />
            <h1 className="font-display text-base font-semibold text-cream tracking-tight">
              {tree?.name ?? strings.app.title}
            </h1>
          </div>
          {tree && (
            <span className="text-[10px] text-cream/30 uppercase tracking-wider flex items-center gap-1">
              <Users size={10} />
              {tPlural(strings.app.memberCount, tree.members.length)}
            </span>
          )}

          {/* Save status */}
          {saveStatusText && (
            <span className="text-[10px] text-cream/30 flex items-center gap-1 animate-fade-in">
              {saveStatusIcon}
              {saveStatusText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          {tree && (
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cream/30 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={strings.app.searchPlaceholder}
                className="h-8 w-40 pl-8 pr-7 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-xs text-cream/80 placeholder:text-cream/25 focus:border-amber/40 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-cream/30 hover:text-cream/60 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Undo / Redo */}
          {tree && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-cream/50 hover:text-cream hover:bg-cream/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                title={`${strings.history.undo} (⌘Z)`}
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-cream/50 hover:text-cream hover:bg-cream/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                title={`${strings.history.redo} (⌘⇧Z)`}
              >
                <Redo2 size={14} />
              </button>
            </div>
          )}

          {/* Export/Import */}
          {tree && <ExportImportBar />}

          {/* Language selector */}
          <LanguageSwitcher />

          <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 size={14} /> {strings.app.share}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLock}>
            <Lock size={14} /> {strings.app.lock}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* Radial Tree */}
        <RadialTree searchQuery={searchQuery} />

        {/* Edit Panel (slides in from right) */}
        <EditPanel />

        {/* Add Relative Panel */}
        <AddPanel />

        {/* Legend */}
        {tree && <Legend />}
      </main>

      {/* Hint bar (bottom) */}
      {tree && tree.members.length === 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
          <div className="px-5 py-2.5 bg-charcoal-light/90 border border-charcoal-lighter rounded-full text-xs text-cream/50 backdrop-blur-sm">
            {strings.app.hintAddRelative}
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />

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
