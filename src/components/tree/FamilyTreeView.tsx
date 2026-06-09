/**
 * Family tree canvas — HTML-over-SVG.
 *
 * Renders the computed Buchheim-Reingold-Tilford layout as two layers inside a
 * single pan/zoom transform:
 *  - an absolutely-positioned SVG {@link EdgeLayer} (relationship links), behind
 *  - HTML {@link NodeCard}s positioned at each `PositionedNode`'s coordinates.
 *
 * Handles:
 * - **Pan & zoom** — manual transform refs driven by POINTER + wheel events.
 *   Panning only starts when the pointer-down target is not inside a `.tree-node`.
 * - **Selection / inline edit** — clicking a node selects it (Active card);
 *   clicking empty canvas deselects.
 * - **Adding relatives** — a single local "draft" descriptor (`'first-person'`
 *   or `{ relativeTo, relType }`) controls where a New card renders.
 * - **Empty state** — a centered "+" prompt when the tree has no members.
 * - **Search highlighting** — dims non-matching compact nodes.
 *
 * @module FamilyTreeView
 */
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { useTreeStore } from '@/hooks/useTree';
import { computeTieredLayout, type PositionedNode } from '@/lib/tree-utils';
import { displaceForActive } from '@/lib/layout/push';
import { useI18n, t } from '@/lib/i18n';
import { EdgeLayer, type EdgeBounds } from '@/components/tree/EdgeLayer';
import { NodeCard } from '@/components/tree/NodeCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { RelType } from '@/components/tree/AddAffordances';

/* ── Constants ── */
const NODE_R = 28; // approx half-extent used for bounds padding
const BOUNDS_PAD = 200; // extra room around nodes for cards/affordances/arcs

/** Draft descriptor: which New card (if any) is currently being created. */
type Draft = null | 'first-person' | { relativeTo: string; relType: RelType };

/** Synthetic empty member for the New card. */
function emptyNode(id: string): PositionedNode {
  return {
    id,
    member: { id, name: '', gender: 'unknown', customFields: {} },
    x: 0,
    y: 0,
    tier: 0,
    isRoot: false,
  };
}

/**
 * Drives the "push aside on open" animation. Returns a `progress` that eases
 * 0→1 when a node becomes active and 1→0 when it's cleared, plus the `anchorId`
 * — the node whose neighbours are being displaced. The anchor is *held* through
 * the close animation (after `activeId` is already null) so neighbours animate
 * back to their resting positions instead of snapping.
 *
 * `prefers-reduced-motion` jumps straight to the target with no tween.
 */
function usePushAnimation(activeId: string | null, reduce: boolean) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const anchorRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeId) anchorRef.current = activeId;
    const target = activeId ? 1 : 0;

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    if (reduce) {
      progressRef.current = target;
      setProgress(target);
      if (target === 0) anchorRef.current = null;
      return;
    }

    const DURATION = 220;
    const from = progressRef.current;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs == null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = from + (target - from) * eased;
      progressRef.current = value;
      setProgress(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        progressRef.current = target;
        setProgress(target);
        if (target === 0) anchorRef.current = null;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [activeId, reduce]);

  return { progress, anchorId: anchorRef.current };
}

/* ═══ Component ═══ */
export function FamilyTreeView({ searchQuery = '' }: { searchQuery?: string }) {
  const tree = useTreeStore((s) => s.tree);
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const selectMember = useTreeStore((s) => s.selectMember);
  const removeMember = useTreeStore((s) => s.removeMember);
  const { strings } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);

  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const activePointer = useRef<number | null>(null);

  /** Local draft for the create flow. */
  const [draft, setDraft] = useState<Draft>(null);

  /** Member pending quick-delete confirmation (drives the ConfirmModal). */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const layoutData = useMemo(() => {
    if (!tree) return null;
    return computeTieredLayout(tree);
  }, [tree]);

  /* ── Layout bounds (for sizing EdgeLayer + fitToView) ── */
  const bounds: EdgeBounds = useMemo(() => {
    if (!layoutData || layoutData.nodes.length === 0) {
      return { x0: 0, y0: 0, width: 0, height: 0 };
    }
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const n of layoutData.nodes) {
      x0 = Math.min(x0, n.x);
      x1 = Math.max(x1, n.x);
      y0 = Math.min(y0, n.y);
      y1 = Math.max(y1, n.y);
    }
    x0 -= NODE_R + BOUNDS_PAD;
    x1 += NODE_R + BOUNDS_PAD;
    y0 -= NODE_R + BOUNDS_PAD;
    y1 += NODE_R + BOUNDS_PAD;
    return { x0, y0, width: x1 - x0, height: y1 - y0 };
  }, [layoutData]);

  /* ── Push-aside: same-tier neighbours slide out while a card is open ──
     The active card morphs much larger than its compact slot, so without this
     it paints over its neighbours. We displace only the covered neighbours,
     only while open, and animate `offset * progress`. Links read the same
     offsets (below) so edges stay attached to nodes throughout. */
  const reduceMotion = useReducedMotion();
  const { progress: pushProgress, anchorId } = usePushAnimation(
    selectedMemberId,
    !!reduceMotion,
  );
  const pushOffsets = useMemo(
    () => displaceForActive(layoutData?.nodes ?? [], anchorId),
    [layoutData, anchorId],
  );
  const offsetX = useCallback(
    (id: string) => (pushOffsets.get(id)?.dx ?? 0) * pushProgress,
    [pushOffsets, pushProgress],
  );

  /* Links shifted by the same push offsets as their endpoint nodes, so edges
     track their nodes during the slide-out/snap-back. Memoized so EdgeLayer
     (memoized) skips re-render while idle — it only recomputes when the layout
     or the push state actually changes, not on every unrelated re-render. */
  const displacedLinks = useMemo(() => {
    if (!layoutData) return [];
    return layoutData.links.map((l) => {
      const sdx = (pushOffsets.get(l.sourceId)?.dx ?? 0) * pushProgress;
      const tdx = (pushOffsets.get(l.targetId)?.dx ?? 0) * pushProgress;
      if (sdx === 0 && tdx === 0) return l;
      return {
        ...l,
        source: { x: l.source.x + sdx, y: l.source.y },
        target: { x: l.target.x + tdx, y: l.target.y },
      };
    });
  }, [layoutData, pushOffsets, pushProgress]);

  /* ── Transform helpers ── */
  const applyTransform = useCallback(() => {
    const g = containerRef.current?.querySelector(
      '.tree-root',
    ) as HTMLElement | null;
    if (!g) return;
    const { x, y, k } = transformRef.current;
    g.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  }, []);

  const fitToView = useCallback(() => {
    if (!containerRef.current || !layoutData || layoutData.nodes.length === 0)
      return;
    const rect = containerRef.current.getBoundingClientRect();
    const pad = 80;

    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const n of layoutData.nodes) {
      x0 = Math.min(x0, n.x - NODE_R - 20);
      x1 = Math.max(x1, n.x + NODE_R + 20);
      y0 = Math.min(y0, n.y - NODE_R - 40); // extra top for sibling arcs
      y1 = Math.max(y1, n.y + NODE_R + 30); // extra bottom for labels
    }

    const bw = x1 - x0 || 1;
    const bh = y1 - y0 || 1;
    const k = Math.min(
      (rect.width - 2 * pad) / bw,
      (rect.height - 2 * pad) / bh,
      1,
    );

    transformRef.current = {
      x: rect.width / 2 - ((x0 + x1) / 2) * k,
      y: rect.height / 2 - ((y0 + y1) / 2) * k,
      k,
    };
    applyTransform();
  }, [layoutData, applyTransform]);

  /* Stable ref so the effect always calls the latest fitToView */
  const fitRef = useRef(fitToView);
  fitRef.current = fitToView;

  const memberCount = tree?.members.length ?? 0;
  useEffect(() => {
    fitRef.current();
  }, [memberCount]);

  /* ── Wheel zoom ──
     Bound as a NON-passive native listener so preventDefault() actually
     suppresses the browser's page scroll/zoom. React 19 registers its
     delegated wheel listener as passive, which makes preventDefault() inside a
     React onWheel handler a no-op (with a console warning). Re-runs when the
     canvas appears (layoutData null→set) so the ref is attached. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? 0.9 : 1.1;
      transformRef.current.k = Math.min(
        3,
        Math.max(0.2, transformRef.current.k * d),
      );
      applyTransform();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyTransform, layoutData]);

  /* ── Pan (pointer events) ── */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't pan when interacting with a node card / affordance / empty-state UI.
    if ((e.target as Element).closest('.tree-node')) return;
    isDragging.current = true;
    dragMoved.current = false;
    activePointer.current = e.pointerId;
    dragStart.current = {
      x: e.clientX - transformRef.current.x,
      y: e.clientY - transformRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || activePointer.current !== e.pointerId) return;
      transformRef.current.x = e.clientX - dragStart.current.x;
      transformRef.current.y = e.clientY - dragStart.current.y;
      dragMoved.current = true;
      applyTransform();
    },
    [applyTransform],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointer.current !== e.pointerId) {
        isDragging.current = false;
        return;
      }
      const wasMoved = dragMoved.current;
      isDragging.current = false;
      activePointer.current = null;
      // A click on empty canvas (no drag) deselects + cancels any draft.
      if (
        !wasMoved &&
        e.type === 'pointerup' &&
        !(e.target as Element).closest('.tree-node')
      ) {
        if (selectedMemberId) selectMember(null);
        if (draft) setDraft(null);
      }
    },
    [selectedMemberId, selectMember, draft],
  );

  /* ── Draft handlers ── */
  const startFirstPerson = useCallback(() => setDraft('first-person'), []);
  const cancelDraft = useCallback(() => setDraft(null), []);
  const handleCommitted = useCallback(() => setDraft(null), []);
  const spawnRelative = useCallback(
    (relativeTo: string, relType: RelType) =>
      setDraft({ relativeTo, relType }),
    [],
  );
  // Stable so the memoized NodeCard isn't invalidated every render.
  const requestDelete = useCallback((id: string) => setDeletingId(id), []);

  /* ── Keyboard pan/zoom — the canvas is focusable so keyboard-only users can
     reach off-screen subtrees that fit/zoom doesn't frame. Only acts when the
     canvas container itself is focused (not a node card / affordance / input). */
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      const PAN = 60;
      switch (e.key) {
        case 'ArrowLeft': transformRef.current.x += PAN; break;
        case 'ArrowRight': transformRef.current.x -= PAN; break;
        case 'ArrowUp': transformRef.current.y += PAN; break;
        case 'ArrowDown': transformRef.current.y -= PAN; break;
        case '+':
        case '=': transformRef.current.k = Math.min(3, transformRef.current.k * 1.1); break;
        case '-':
        case '_': transformRef.current.k = Math.max(0.2, transformRef.current.k * 0.9); break;
        default: return;
      }
      e.preventDefault();
      applyTransform();
    },
    [applyTransform],
  );

  /* ── Empty state (no members and no first-person draft) ── */
  if (!tree) {
    return (
      <div className="flex-1 flex items-center justify-center text-cream-dark text-sm font-body">
        {strings.app.noMembers}
      </div>
    );
  }

  const isEmpty = tree.members.length === 0;

  if (isEmpty && draft !== 'first-person') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <button
          type="button"
          onClick={startFirstPerson}
          aria-label={strings.app.firstPersonPrompt}
          className="group flex flex-col items-center gap-3 cursor-pointer"
        >
          <span
            className="w-16 h-16 rounded-full border border-charcoal-lighter grid place-items-center
              text-2xl text-amber group-hover:border-amber transition-colors"
          >
            +
          </span>
          <span className="font-body text-sm text-cream-dark">
            {strings.app.firstPersonPrompt}
          </span>
        </button>
      </div>
    );
  }

  // First-person New card (empty tree, draft active) — centered.
  if (isEmpty && draft === 'first-person') {
    return (
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <div className="tree-node">
          <NodeCard
            node={emptyNode('__new__')}
            mode="new"
            onCommitted={handleCommitted}
            onCancel={cancelDraft}
            centered
          />
        </div>
      </div>
    );
  }

  if (!layoutData) {
    return (
      <div className="flex-1 flex items-center justify-center text-cream-dark text-sm font-body">
        {strings.app.noMembers}
      </div>
    );
  }

  const draftRelative =
    draft && typeof draft === 'object' ? draft : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing touch-none"
      role="application"
      aria-label={strings.app.canvasLabel}
      tabIndex={0}
      onKeyDown={handleCanvasKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="tree-root absolute left-0 top-0 origin-top-left will-change-transform">
        {/* Links: SVG behind nodes */}
        <EdgeLayer links={displacedLinks} bounds={bounds} />

        {/* Nodes: HTML cards at layout coordinates */}
        {layoutData.nodes.map((n) => {
          const isActive = selectedMemberId === n.id;
          const showDraftHere =
            draftRelative && draftRelative.relativeTo === n.id;
          const ox = offsetX(n.id);
          return (
            <div
              key={n.id}
              className="tree-node absolute"
              style={{
                left: n.x,
                top: n.y,
                transform: `translate(calc(-50% + ${ox}px), -50%)`,
                zIndex: isActive || showDraftHere ? 30 : 1,
              }}
            >
              <NodeCard
                node={n}
                searchQuery={searchQuery}
                onSpawnRelative={spawnRelative}
                onRequestDelete={requestDelete}
                // Hide quick-delete when this is the only member — removeMember
                // refuses to delete the last one (mirrors the keyboard guard).
                canDelete={tree.members.length > 1}
              />

              {/* New relative card spawned by this node's affordance */}
              {showDraftHere && (
                <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 z-40">
                  <NodeCard
                    node={emptyNode('__new__')}
                    mode="new"
                    relativeTo={draftRelative.relativeTo}
                    newRelType={draftRelative.relType}
                    onCommitted={handleCommitted}
                    onCancel={cancelDraft}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 end-4 flex flex-col gap-1 z-10">
        <button
          type="button"
          onClick={() => {
            transformRef.current.k = Math.min(3, transformRef.current.k * 1.2);
            applyTransform();
          }}
          aria-label={strings.app.zoomIn}
          title={strings.app.zoomIn}
          className="w-9 h-9 touch-target rounded-lg bg-charcoal-light border border-charcoal-lighter text-cream-dark hover:text-cream hover:border-amber flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            transformRef.current.k = Math.max(
              0.2,
              transformRef.current.k * 0.8,
            );
            applyTransform();
          }}
          aria-label={strings.app.zoomOut}
          title={strings.app.zoomOut}
          className="w-9 h-9 touch-target rounded-lg bg-charcoal-light border border-charcoal-lighter text-cream-dark hover:text-cream hover:border-amber flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
        >
          −
        </button>
        <button
          type="button"
          onClick={fitToView}
          aria-label={strings.app.fitToView}
          title={strings.app.fitToView}
          className="w-9 h-9 touch-target rounded-lg bg-charcoal-light border border-charcoal-lighter text-cream-dark hover:text-cream hover:border-amber flex items-center justify-center text-[10px] font-medium transition-colors cursor-pointer"
        >
          FIT
        </button>
      </div>

      {/* Quick-delete confirm. Rendered here — inside the OUTER (non-transformed)
          container, NOT inside `.tree-root` — so the fixed-position Modal is
          positioned relative to the viewport rather than the CSS-transformed
          ancestor. */}
      <ConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) removeMember(deletingId);
          setDeletingId(null);
        }}
        variant="danger"
        title={strings.editor.removeConfirmTitle}
        message={t(strings.editor.removeConfirmMessage, {
          name:
            tree.members.find((m) => m.id === deletingId)?.name ??
            strings.editor.unknown,
        })}
      />
    </div>
  );
}
