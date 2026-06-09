/**
 * In-canvas node — the centerpiece of the Roots redesign.
 *
 * Three states (see B4):
 *  - **compact**  small rounded paper chip (avatar + name + years). Click → select.
 *  - **active**   when `selectedMemberId === node.id`: morphs (Framer Motion
 *                 `layout`) into a card with an inline-editable name, a gender
 *                 segmented control, compact years, a "More details" button
 *                 (→ `openDetails`) and the directional `<AddAffordances>`.
 *  - **new**      (`mode='new'`) creation card: name autofocused, Enter/✓ commits,
 *                 Esc/✕ cancels. First-person commit → `addMember`; relative commit
 *                 → `addRelativeBatch(relativeTo, newRelType, member, inferred)`
 *                 then selects the new member. Inferred-link chips are rendered and
 *                 resolved at commit time.
 *
 * Editorial paper aesthetic: hairline borders, Spectral names, Hanken UI, forest
 * accent used only for selection/affordances. No glow/glass/blur/gradient.
 * Respects `prefers-reduced-motion` (skips the morph, fades instead).
 *
 * @module NodeCard
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, X, Trash2 } from 'lucide-react';

import { getInferredRelationships, type PositionedNode } from '@/lib/tree-utils';
import type { Gender } from '@/types/family';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n, t } from '@/lib/i18n';
import { Avatar } from '@/components/ui/Avatar';
import { AddAffordances, type RelType } from '@/components/tree/AddAffordances';

export interface NodeCardProps {
  /** The positioned node. In `new` mode this is a synthetic node with an empty member. */
  node: PositionedNode;
  /** Active search query — non-matching compact nodes dim. */
  searchQuery?: string;
  /** `'existing'` (default) or `'new'` for the add/first-person flow. */
  mode?: 'existing' | 'new';
  /** Target member for a new relative; `undefined` = first person. */
  relativeTo?: string;
  /** Relationship type when adding a relative. */
  newRelType?: RelType;
  /** Called after a successful commit with the new member id. */
  onCommitted?: (id: string) => void;
  /** Called when a `new` card is cancelled, or when an affordance spawns a draft. */
  onCancel?: () => void;
  /**
   * Asks FamilyTreeView to spawn a New card for the given relationship. Takes the
   * source member id so the callback can stay referentially stable across nodes
   * (keeps the memoized NodeCard from re-rendering every push-animation frame).
   */
  onSpawnRelative?: (id: string, relType: RelType) => void;
  /**
   * Asks FamilyTreeView to begin deleting the given member. The confirm dialog is
   * rendered by FamilyTreeView OUTSIDE the pan/zoom transform — a fixed-position
   * modal mounted inside the transformed `.tree-root` would be positioned
   * relative to that ancestor, not the viewport. Takes the id for stable identity.
   */
  onRequestDelete?: (id: string) => void;
  /** Whether quick-delete is offered (false hides it — e.g. the last remaining member). */
  canDelete?: boolean;
  /** Render the active/new card centered (mobile presents this way). */
  centered?: boolean;
}

/* ── Helpers ── */

function years(node: PositionedNode): string | null {
  const { birthDate, deathDate } = node.member;
  if (!birthDate && !deathDate) return null;
  const b = birthDate?.slice(0, 4) ?? '?';
  const d = deathDate?.slice(0, 4);
  return d ? `${b}–${d}` : `${b}–`;
}

const GENDERS: { value: Gender; symbol: string }[] = [
  { value: 'female', symbol: '♀' },
  { value: 'male', symbol: '♂' },
  { value: 'other', symbol: '⚲' },
  { value: 'unknown', symbol: '?' },
];

/**
 * Bubble↔card morph timing. Matches the neighbour push-aside animation in
 * FamilyTreeView (220ms, easeOutCubic) so the card expands from / collapses to
 * its compact bubble in lockstep with the connected nodes sliding away and back.
 * Applied via a shared `layoutId` (the node id) on both the compact button and
 * the active card, so Framer morphs the box between the two states.
 */
const MORPH_TRANSITION = { duration: 0.22, ease: [0.33, 1, 0.68, 1] as const };

/* ── Gender segmented control ── */
function GenderControl({
  value,
  onChange,
  labels,
  groupLabel,
}: {
  value: Gender;
  onChange: (g: Gender) => void;
  labels: Record<Gender, string>;
  groupLabel: string;
}) {
  // Presented as a group of toggle buttons (aria-pressed) rather than an ARIA
  // radiogroup: a radiogroup implies a single tab stop + arrow-key roving, which
  // this didn't implement. A toggle-button group is fully conformant with plain
  // Tab + Enter/Space and matches the actual interaction.
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex rounded-md border border-charcoal-lighter overflow-hidden w-fit"
    >
      {GENDERS.map((g, i) => {
        const active = value === g.value;
        return (
          <button
            key={g.value}
            type="button"
            aria-pressed={active}
            aria-label={labels[g.value]}
            title={labels[g.value]}
            onClick={() => onChange(g.value)}
            className={`min-w-[36px] h-9 touch-target px-2 text-sm font-body transition-colors cursor-pointer
              ${i > 0 ? 'border-s border-charcoal-lighter' : ''}
              ${
                active
                  ? 'bg-amber/12 text-amber'
                  : 'text-cream-dark hover:text-cream hover:bg-cream/5'
              }`}
          >
            <span aria-hidden="true">{g.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══ Component ═══ */
function NodeCardImpl({
  node,
  searchQuery = '',
  mode = 'existing',
  relativeTo,
  newRelType,
  onCommitted,
  onCancel,
  onSpawnRelative,
  onRequestDelete,
  canDelete = false,
  centered = false,
}: NodeCardProps) {
  const { strings } = useI18n();
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const selectMember = useTreeStore((s) => s.selectMember);
  const updateMember = useTreeStore((s) => s.updateMember);
  const openDetails = useTreeStore((s) => s.openDetails);
  const addMember = useTreeStore((s) => s.addMember);
  const addRelativeBatch = useTreeStore((s) => s.addRelativeBatch);
  const tree = useTreeStore((s) => s.tree);

  const reduce = useReducedMotion();
  const isNew = mode === 'new';
  const isActive = !isNew && selectedMemberId === node.id;

  const genderLabels: Record<Gender, string> = {
    male: strings.editor.male,
    female: strings.editor.female,
    other: strings.editor.other,
    unknown: strings.editor.unknown,
  };

  /* ── New-card local draft state ── */
  const [draftName, setDraftName] = useState('');
  const [draftGender, setDraftGender] = useState<Gender>('unknown');
  const nameInputRef = useRef<HTMLInputElement>(null);

  /* ── Inferred suggestions (new-card, relative path only) ── */
  const suggestions = useMemo(() => {
    if (!isNew || !relativeTo || !newRelType || !tree) return [];
    return getInferredRelationships(relativeTo, newRelType, tree);
  }, [isNew, relativeTo, newRelType, tree]);

  // enabled set: all keys ON by default whenever suggestions change
  const [enabledSuggestions, setEnabledSuggestions] = useState<Set<string>>(
    () => new Set<string>(),
  );
  useEffect(() => {
    setEnabledSuggestions(new Set(suggestions.map((s) => s.key)));
  }, [suggestions]);

  const toggleSuggestion = (key: string) => {
    setEnabledSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (isNew) nameInputRef.current?.focus();
  }, [isNew]);

  /* ── Active-card focus management (a11y) ── */
  // Move focus into the active card when this node transitions from compact→active.
  // We track the previous isActive value to fire only on the rising edge (false→true),
  // not on every re-render while the card is already active.
  const containerRef = useRef<HTMLDivElement>(null);
  const prevActiveRef = useRef(false);

  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      containerRef.current?.focus();
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  const commitNew = () => {
    const name = draftName.trim();
    if (!name) {
      nameInputRef.current?.focus();
      return;
    }
    const data = { name, gender: draftGender, customFields: {} };
    let created;
    if (relativeTo && newRelType) {
      // Map enabled suggestions to the new-signature format expected by addRelativeBatch.
      const resolved = suggestions
        .filter((s) => enabledSuggestions.has(s.key))
        .map((s) => ({
          type: s.relType,
          existingId: s.existingMemberId,
          newIsFrom: s.newMemberIsFrom,
        }));
      created = addRelativeBatch(relativeTo, newRelType, data, resolved);
    } else {
      created = addMember(data); // first person → becomes root
    }
    if (!created) return; // no tree loaded — nothing was added, don't select a phantom
    selectMember(created.id);
    onCommitted?.(created.id);
  };

  const matchesSearch =
    !searchQuery.trim() ||
    node.member.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  const dimmed = !!searchQuery.trim() && !matchesSearch;

  const yrs = years(node);

  const newCardTitle =
    relativeTo && newRelType
      ? strings.addRelative[
          newRelType === 'spouse' ? 'spouseLabel' : newRelType
        ]
      : strings.app.firstPersonPrompt;

  /* ───────────── NEW ───────────── */
  if (isNew) {
    return (
      <motion.div
        layout={!reduce}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        role="dialog"
        aria-label={newCardTitle}
        className={`flex flex-col gap-3 w-60 p-4 rounded-xl bg-charcoal-light
          border border-amber/60 shadow-md ${centered ? 'mx-auto' : ''}`}
      >
        <span className="text-[10px] font-body uppercase tracking-wider text-cream-dark">
          {newCardTitle}
        </span>

        <input
          ref={nameInputRef}
          value={draftName}
          maxLength={80}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitNew();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel?.();
            }
          }}
          placeholder={strings.addRelative.name}
          aria-label={strings.editor.fullName}
          className="w-full h-9 px-2.5 rounded-md bg-charcoal border border-charcoal-lighter
            font-display text-base text-cream placeholder:text-cream-dark
            focus:border-amber focus:outline-none transition-colors"
        />

        <GenderControl
          value={draftGender}
          onChange={setDraftGender}
          labels={genderLabels}
          groupLabel={strings.editor.gender}
        />

        {/* Inferred-link opt-out checkboxes — only shown when there are suggestions.
            Default CHECKED; unchecking opts OUT of the inferred link (e.g. a
            half-sibling with a different parent, or a step-parent). The
            enabledSuggestions Set + commit resolution stay unchanged. */}
        {suggestions.length > 0 && (
          <div
            className="flex flex-col gap-2"
            role="group"
            aria-label={strings.addRelative.additionalRels}
          >
            <span className="text-[10px] font-body uppercase tracking-wider text-cream-dark">
              {strings.addRelative.additionalRels}
            </span>
            <div className="flex flex-col gap-1">
              {suggestions.map((s) => {
                const on = enabledSuggestions.has(s.key);
                const label = t(strings.addRelative[s.labelType], {
                  name: s.existingMemberName,
                });
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleSuggestion(s.key)}
                    className="group flex items-center gap-2 min-h-[28px] touch-target py-1 -mx-1 px-1 rounded-md
                      text-start transition-colors cursor-pointer
                      hover:bg-cream/5 focus-visible:outline focus-visible:outline-2
                      focus-visible:outline-amber focus-visible:outline-offset-1"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid place-items-center shrink-0 w-4 h-4 rounded-[4px] border transition-colors
                        ${
                          on
                            ? 'border-amber bg-amber/15 text-amber'
                            : 'border-charcoal-lighter bg-charcoal group-hover:border-cream-dark/50 text-transparent'
                        }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span
                      className={`text-[11px] font-body leading-tight transition-colors
                        ${on ? 'text-cream' : 'text-cream-dark'}`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] font-body leading-snug text-cream-dark/70">
              {strings.addRelative.specialCaseHint}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={commitNew}
            disabled={!draftName.trim()}
            aria-label={strings.confirm.confirm}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-amber/12 border border-amber/50
              text-amber text-xs font-body hover:bg-amber/20 transition-colors cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={14} aria-hidden="true" />
            {strings.confirm.confirm}
          </button>
          <button
            type="button"
            onClick={() => onCancel?.()}
            aria-label={strings.addRelative.cancel}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-charcoal-lighter
              text-cream-dark text-xs font-body hover:text-cream hover:bg-cream/5
              transition-colors cursor-pointer"
          >
            <X size={14} aria-hidden="true" />
            {strings.addRelative.cancel}
          </button>
        </div>
      </motion.div>
    );
  }

  /* ───────────── ACTIVE ───────────── */
  if (isActive) {
    return (
      <motion.div
        ref={containerRef}
        layout={!reduce}
        layoutId={!reduce ? node.id : undefined}
        transition={{ layout: MORPH_TRANSITION }}
        initial={false}
        role="group"
        aria-label={node.member.name}
        tabIndex={-1}
        className={`relative flex flex-col gap-3 w-60 p-4 rounded-xl bg-charcoal-light
          border border-amber/60 shadow-md ${centered ? 'mx-auto' : ''}`}
      >
        {/* Quick delete — top-end corner. Opens a confirm dialog owned by
            FamilyTreeView (outside the pan/zoom transform). */}
        {onRequestDelete && canDelete && (
          <button
            type="button"
            onClick={() => onRequestDelete(node.id)}
            aria-label={t(strings.editor.remove, { name: node.member.name })}
            title={t(strings.editor.remove, { name: node.member.name })}
            className="absolute top-2 end-2 z-10 grid place-items-center w-7 h-7 touch-target rounded-md
              text-cream-dark hover:text-error hover:bg-error/10
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-error
              focus-visible:outline-offset-1 transition-colors cursor-pointer"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}

        {/* Header: avatar + inline name (pe-7 reserves room for the delete button) */}
        <div className="flex items-center gap-3 pe-7">
          <span className="shrink-0">
            <Avatar
              name={node.member.name || '?'}
              photoUrl={node.member.photoUrl}
              gender={node.member.gender}
              size="md"
            />
          </span>
          <input
            defaultValue={node.member.name}
            key={node.member.name}
            maxLength={80}
            aria-label={strings.editor.fullName}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== node.member.name) updateMember(node.id, { name: v });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                (e.target as HTMLInputElement).value = node.member.name;
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="flex-1 min-w-0 h-8 px-2 rounded-md bg-charcoal border border-charcoal-lighter
              font-display text-base text-cream focus:border-amber focus:outline-none transition-colors"
          />
        </div>

        {/* Gender segmented control */}
        {/* NOTE: each gender change is its own undo step (updateMember snapshots per call). Acceptable for a discrete choice; revisit if field-edit coalescing is added. */}
        <GenderControl
          value={node.member.gender}
          onChange={(g) => updateMember(node.id, { gender: g })}
          labels={genderLabels}
          groupLabel={strings.editor.gender}
        />

        {/* Compact years (read-only; full dates live in DetailsModal) */}
        {yrs && (
          <p className="text-xs font-body text-cream-dark tabular-nums">{yrs}</p>
        )}

        {/* More details */}
        <button
          type="button"
          onClick={() => openDetails(node.id)}
          className="self-start text-xs font-body text-amber hover:text-amber-light
            underline underline-offset-2 transition-colors cursor-pointer"
        >
          {strings.editor.editMember}
        </button>

        {/* Directional add affordances (floating on wide, labeled row on narrow) */}
        {onSpawnRelative && (
          <>
            <div className="hidden sm:block">
              <AddAffordances onAdd={(rt) => onSpawnRelative(node.id, rt)} />
            </div>
            <div className="sm:hidden">
              <AddAffordances inline onAdd={(rt) => onSpawnRelative(node.id, rt)} />
            </div>
          </>
        )}
      </motion.div>
    );
  }

  /* ───────────── COMPACT ───────────── */
  return (
    <motion.button
      layout={!reduce}
      layoutId={!reduce ? node.id : undefined}
      transition={{ layout: MORPH_TRANSITION }}
      type="button"
      onClick={() => selectMember(node.id)}
      aria-label={node.member.name || strings.editor.unknown}
      className={`flex items-center gap-2 max-w-[180px] ps-1.5 pe-3 py-1.5 rounded-full
        bg-charcoal-light border text-start transition-colors cursor-pointer
        hover:border-cream-dark/40
        ${
          selectedMemberId === node.id
            ? 'border-amber'
            : 'border-charcoal-lighter'
        }`}
      style={{ opacity: dimmed ? 0.25 : 1 }}
    >
      <span className="shrink-0">
        <Avatar
          name={node.member.name || '?'}
          photoUrl={node.member.photoUrl}
          gender={node.member.gender}
          size="sm"
        />
      </span>
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="font-display text-sm text-cream truncate">
          {node.member.name || strings.editor.unknown}
        </span>
        {yrs && (
          <span className="font-body text-[10px] text-cream-dark tabular-nums truncate">
            {yrs}
          </span>
        )}
      </span>
    </motion.button>
  );
}

/**
 * Memoized so an open card's compact neighbours don't re-render on every frame
 * of the push-aside animation (which only changes FamilyTreeView's local
 * progress, not these nodes' props). Requires the callbacks passed in to be
 * referentially stable — see `onSpawnRelative`/`onRequestDelete`.
 */
export const NodeCard = memo(NodeCardImpl);
