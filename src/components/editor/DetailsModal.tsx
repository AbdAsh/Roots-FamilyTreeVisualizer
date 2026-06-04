/**
 * Centered details modal — the full edit surface for a single member.
 *
 * Opens whenever the store's `detailsForId` resolves to a member. Built on the
 * editorial-paper design language (hairline borders, Spectral title, Hanken body,
 * one forest/amber accent — no glass/blur/glow/gradient).
 *
 * Layout:
 *  - **Desktop** centered dialog card (max-w-2xl) with an internal scroll region.
 *  - **Narrow viewports** a full-height sheet (responsive classes; sits flush to
 *    the inline-end edge so RTL mirrors automatically).
 *
 * Contents:
 *  - `<MemberForm member={member} />` — the full field set, keeps its autosave.
 *  - **Relationship management** (ported from the retired `EditPanel`): parents /
 *    partner / children / siblings. Each related person is a button that NAVIGATES
 *    the modal to that member (`openDetails(otherId)`), plus an X control that
 *    confirms via `ConfirmModal` then `removeRelationship`.
 *  - **Delete member** — destructive action; confirms via `ConfirmModal` then
 *    `removeMember(member.id)` and closes the modal. This is now the primary delete
 *    UI (the in-canvas delete button was removed in the canvas rewrite).
 *
 * a11y: dialog semantics, focus moves into the dialog on open and is restored to
 * the previously-focused element on close, focus is trapped while open, Escape /
 * backdrop close, ≥44px targets, logical (RTL-aware) properties, reduced-motion
 * respected (fade instead of morph).
 *
 * @module DetailsModal
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X as XIcon, Trash2 } from 'lucide-react';

import { MemberForm } from './MemberForm';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Avatar } from '@/components/ui/Avatar';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n, t } from '@/lib/i18n';
import type { FamilyMember, FamilyTree } from '@/types/family';
import {
  getParents,
  getChildren,
  getSpouse,
  getSiblings,
} from '@/lib/tree-utils';

/* ── Focusable selector for the focus trap ── */
const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* ── A single related-person row: navigate + remove ── */
function RelationRow({
  person,
  accent,
  onNavigate,
  onRemove,
  removeTitle,
}: {
  person: FamilyMember;
  /** Tailwind text/border accent class fragment, e.g. 'sage'. */
  accent: 'sage' | 'wine' | 'amber' | 'cream';
  onNavigate: () => void;
  onRemove: () => void;
  removeTitle: string;
}) {
  const navClass: Record<typeof accent, string> = {
    sage: 'text-sage hover:text-sage-light',
    wine: 'text-wine hover:text-[#e8a0b4]',
    amber: 'text-amber hover:text-amber-light',
    cream: 'text-cream hover:text-cream',
  };

  return (
    <span className="inline-flex items-center rounded-full border border-charcoal-lighter bg-charcoal-light/60 group focus-within:border-amber/50 transition-colors">
      <button
        type="button"
        onClick={onNavigate}
        className={`ps-3 pe-1 py-1.5 min-h-11 text-xs font-body truncate max-w-[160px] transition-colors cursor-pointer ${navClass[accent]}`}
      >
        {person.name || '—'}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeTitle}: ${person.name}`}
        title={removeTitle}
        className="grid place-items-center w-11 h-11 -ms-1 me-0.5 rounded-full text-cream-dark/50 hover:text-error focus-visible:text-error transition-colors cursor-pointer"
      >
        <XIcon size={13} aria-hidden="true" />
      </button>
    </span>
  );
}

/* ── A labelled group of relation rows ── */
function RelationGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className="text-[10px] font-body text-cream-dark uppercase tracking-wider w-16 shrink-0 pt-2">
        {label}
      </span>
      <div className="flex flex-wrap gap-2 flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* ═══ Component ═══ */
export function DetailsModal() {
  const tree = useTreeStore((s) => s.tree);
  const detailsForId = useTreeStore((s) => s.detailsForId);
  const openDetails = useTreeStore((s) => s.openDetails);
  const removeRelationship = useTreeStore((s) => s.removeRelationship);
  const removeMember = useTreeStore((s) => s.removeMember);
  const { strings } = useI18n();
  const reduce = useReducedMotion();

  const member = tree?.members.find((m) => m.id === detailsForId);
  const isOpen = !!member;

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  /* Pending remove-relationship confirmation. */
  const [removingRel, setRemovingRel] = useState<{
    id: string;
    fromName: string;
    toName: string;
    type: string;
  } | null>(null);
  /* Pending member-delete confirmation. */
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleClose = useCallback(() => {
    openDetails(null);
  }, [openDetails]);

  /* ── Find a relationship id between the open member and another ── */
  const findRelId = useCallback(
    (otherId: string, type: string): string | undefined => {
      if (!tree || !member) return undefined;
      return tree.relationships.find(
        (r) =>
          r.type === type &&
          ((r.from === member.id && r.to === otherId) ||
            (r.from === otherId && r.to === member.id)),
      )?.id;
    },
    [tree, member],
  );

  const requestRemoveRel = (otherId: string, otherName: string, type: string) => {
    const relId = findRelId(otherId, type);
    if (!relId || !member) return;
    setRemovingRel({
      id: relId,
      fromName: member.name,
      toName: otherName,
      type,
    });
  };

  const confirmRemoveRel = () => {
    if (removingRel) {
      removeRelationship(removingRel.id);
      setRemovingRel(null);
    }
  };

  const confirmRemoveMember = () => {
    if (member) {
      removeMember(member.id);
      handleClose();
    }
  };

  /* ── Lock background scroll while open (esp. the mobile full-height sheet) ── */
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  /* ── Focus management: remember opener, move focus in, restore on close ── */
  useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      // Defer until the dialog has mounted.
      const id = requestAnimationFrame(() => {
        const el = dialogRef.current;
        if (!el) return;
        const first = el.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? el).focus();
      });
      return () => cancelAnimationFrame(id);
    }
    // On close, restore focus to whatever opened the modal (e.g. the node card).
    restoreFocusRef.current?.focus?.();
  }, [isOpen]);

  /* ── Escape to close + focus trap (Tab cycles within the dialog) ── */
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Let an open confirm dialog handle its own Escape first.
        if (removingRel || confirmDelete) return;
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // When a stacked ConfirmModal is open, let it own focus — do not trap.
      if (removingRel || confirmDelete) return;
      const el = dialogRef.current;
      if (!el) return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, removingRel, confirmDelete, handleClose]);

  /* Relationship data (only when a member is resolved). */
  const rel = member && tree ? gatherRelations(member, tree) : null;

  const relTypeLabel: Record<string, string> = {
    'parent-child': strings.legend.parentChild,
    spouse: strings.legend.spouseRel,
    sibling: strings.legend.siblingRel,
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && member && rel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="fixed inset-0 z-40 bg-charcoal/80"
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Positioner: centered on desktop, inline-end full-height sheet on narrow */}
            <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4 pointer-events-none">
              <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={member.name || strings.editor.editMember}
                tabIndex={-1}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.97, y: 16 }
                }
                animate={
                  reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
                }
                exit={
                  reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 16 }
                }
                transition={{
                  duration: reduce ? 0 : 0.25,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="pointer-events-auto flex flex-col
                  w-full h-full ms-auto max-w-md
                  sm:h-auto sm:max-h-[88vh] sm:max-w-2xl sm:mx-auto
                  bg-charcoal-light border-s border-charcoal-lighter
                  sm:border sm:rounded-lg shadow-md overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-charcoal-lighter shrink-0">
                  <span className="shrink-0">
                    <Avatar
                      name={member.name || '?'}
                      photoUrl={member.photoUrl}
                      gender={member.gender}
                      size="md"
                    />
                  </span>
                  <h2 className="flex-1 min-w-0 font-display text-xl font-medium text-cream tracking-tight truncate">
                    {member.name || strings.editor.editMember}
                  </h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label={strings.confirm.cancel}
                    title={strings.confirm.cancel}
                    className="grid place-items-center w-11 h-11 -me-2.5 rounded-md text-cream-dark hover:text-cream hover:bg-cream/5 focus-visible:text-cream transition-colors cursor-pointer"
                  >
                    <XIcon size={18} aria-hidden="true" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
                  {/* Full member form (autosave) */}
                  <MemberForm member={member} />

                  {/* Relationship management */}
                  <section className="flex flex-col gap-4">
                    <span className="text-[11px] font-body font-medium text-cream/60 uppercase tracking-wider">
                      {strings.editor.relationships}
                    </span>

                    <div className="flex flex-col gap-3">
                      {rel.parents.length > 0 && (
                        <RelationGroup label={strings.editor.parents}>
                          {rel.parents.map((p) => (
                            <RelationRow
                              key={p.id}
                              person={p}
                              accent="sage"
                              onNavigate={() => openDetails(p.id)}
                              onRemove={() =>
                                requestRemoveRel(p.id, p.name, 'parent-child')
                              }
                              removeTitle={strings.editor.removeRelConfirmTitle}
                            />
                          ))}
                        </RelationGroup>
                      )}

                      {rel.spouse && (
                        <RelationGroup label={strings.editor.spouse}>
                          <RelationRow
                            person={rel.spouse}
                            accent="wine"
                            onNavigate={() => openDetails(rel.spouse!.id)}
                            onRemove={() =>
                              requestRemoveRel(
                                rel.spouse!.id,
                                rel.spouse!.name,
                                'spouse',
                              )
                            }
                            removeTitle={strings.editor.removeRelConfirmTitle}
                          />
                        </RelationGroup>
                      )}

                      {rel.children.length > 0 && (
                        <RelationGroup label={strings.editor.children}>
                          {rel.children.map((c) => (
                            <RelationRow
                              key={c.id}
                              person={c}
                              accent="amber"
                              onNavigate={() => openDetails(c.id)}
                              onRemove={() =>
                                requestRemoveRel(c.id, c.name, 'parent-child')
                              }
                              removeTitle={strings.editor.removeRelConfirmTitle}
                            />
                          ))}
                        </RelationGroup>
                      )}

                      {rel.siblings.length > 0 && (
                        <RelationGroup label={strings.editor.siblings}>
                          {rel.siblings.map((s) => (
                            <RelationRow
                              key={s.id}
                              person={s}
                              accent="cream"
                              onNavigate={() => openDetails(s.id)}
                              onRemove={() =>
                                requestRemoveRel(s.id, s.name, 'sibling')
                              }
                              removeTitle={strings.editor.removeRelConfirmTitle}
                            />
                          ))}
                        </RelationGroup>
                      )}

                      {rel.parents.length === 0 &&
                        !rel.spouse &&
                        rel.children.length === 0 &&
                        rel.siblings.length === 0 && (
                          <p className="text-xs font-body text-cream-dark/60 italic">
                            {strings.editor.noRelationships}
                          </p>
                        )}
                    </div>
                  </section>
                </div>

                {/* Footer: destructive delete */}
                <div className="shrink-0 px-6 py-4 border-t border-charcoal-lighter">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-md border border-charcoal-lighter
                      text-xs font-body text-cream-dark hover:text-error hover:border-error/40
                      focus-visible:text-error transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {strings.editor.removeConfirmTitle}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Confirm: remove a relationship */}
      <ConfirmModal
        isOpen={!!removingRel}
        onClose={() => setRemovingRel(null)}
        onConfirm={confirmRemoveRel}
        title={strings.editor.removeRelConfirmTitle}
        message={
          removingRel
            ? t(strings.editor.removeRelConfirmMessage, {
                type: relTypeLabel[removingRel.type] ?? removingRel.type,
                from: removingRel.fromName,
                to: removingRel.toName,
              })
            : ''
        }
        variant="warning"
      />

      {/* Confirm: delete this member */}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={confirmRemoveMember}
        title={strings.editor.removeConfirmTitle}
        message={t(strings.editor.removeConfirmMessage, {
          name: member?.name ?? '',
        })}
        variant="danger"
      />
    </>
  );
}

/* ── Gather a member's relations in one pass ── */
function gatherRelations(member: FamilyMember, tree: FamilyTree) {
  return {
    parents: getParents(member.id, tree),
    children: getChildren(member.id, tree),
    spouse: getSpouse(member.id, tree),
    siblings: getSiblings(member.id, tree),
  };
}
