/**
 * SVG-based family tree renderer.
 *
 * Renders the computed Buchheim-Reingold-Tilford layout as an interactive SVG.
 * Handles:
 * - **Pan & zoom** — via manual transform refs (not D3-zoom)
 * - **Node interactions** — click to select/edit, “+” button to add relatives, “×” button to delete
 * - **Link paths** — cubic beziers for parent-child, quadratic arcs for siblings, straight lines for spouses
 * - **Search highlighting** — dims non-matching nodes when a search query is active
 * - **Animated transitions** — smooth zoom-to-fit on first render and member additions
 *
 * @module FamilyTreeView
 */
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';

import { useTreeStore } from '@/hooks/useTree';
import { computeTieredLayout, type PositionedLink } from '@/lib/tree-utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useI18n, t } from '@/lib/i18n';

/* ── Constants ── */
const NODE_R = 28;
const ADD_BTN_R = 10;
const ADD_BTN_OFFSET = NODE_R + 2; // distance from centre to "+" button centre
const DEL_BTN_R = 10;
const DEL_BTN_OFFSET = NODE_R + 2;

/* ── Helpers ── */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const genderFill: Record<string, string> = {
  male: 'rgba(74, 111, 165, 0.25)',
  female: 'rgba(165, 84, 122, 0.25)',
  other: 'rgba(143, 166, 138, 0.25)',
  unknown: 'rgba(58, 58, 58, 0.6)',
};

const genderStroke: Record<string, string> = {
  male: 'rgba(74, 111, 165, 0.6)',
  female: 'rgba(165, 84, 122, 0.6)',
  other: 'rgba(143, 166, 138, 0.5)',
  unknown: 'rgba(90, 90, 90, 0.6)',
};

/* ── Badge config ── */
const BADGE: Record<
  string,
  { symbol: string; bg: string; stroke: string; color: string }
> = {
  'parent-child': {
    symbol: '↓',
    bg: 'rgba(212,165,116,0.15)',
    stroke: 'rgba(212,165,116,0.4)',
    color: 'rgba(212,165,116,0.9)',
  },
  sibling: {
    symbol: '↔',
    bg: 'rgba(143,166,138,0.15)',
    stroke: 'rgba(143,166,138,0.4)',
    color: 'rgba(143,166,138,0.9)',
  },
  spouse: {
    symbol: '♥',
    bg: 'rgba(139,69,87,0.18)',
    stroke: 'rgba(139,69,87,0.45)',
    color: 'rgba(139,69,87,0.9)',
  },
};

function LinkBadge({ x, y, type }: { x: number; y: number; type: string }) {
  const cfg = BADGE[type] ?? BADGE['parent-child'];
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={11} fill={cfg.bg} stroke={cfg.stroke} strokeWidth={1} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={cfg.color}
        fontSize={type === 'spouse' ? 10 : 11}
        fontWeight={700}
        fontFamily="var(--font-body)"
      >
        {cfg.symbol}
      </text>
    </g>
  );
}

/* ── Link geometry ── */
function sibArcH(sx: number, tx: number): number {
  return Math.max(30, Math.min(60, Math.abs(tx - sx) * 0.2));
}

function linkPath(l: PositionedLink): string {
  const { source: s, target: t, type } = l;

  if (type === 'parent-child') {
    // Smooth S-curve between tiers
    const my = (s.y + t.y) / 2;
    return `M${s.x},${s.y} C${s.x},${my} ${t.x},${my} ${t.x},${t.y}`;
  }

  if (type === 'sibling') {
    // Arc above the tier
    const h = sibArcH(s.x, t.x);
    return `M${s.x},${s.y} Q${(s.x + t.x) / 2},${s.y - h} ${t.x},${t.y}`;
  }

  // Spouse — straight horizontal line
  return `M${s.x},${s.y} L${t.x},${t.y}`;
}

function badgePos(l: PositionedLink): { x: number; y: number } {
  const { source: s, target: t, type } = l;

  if (type === 'sibling') {
    // Parametric midpoint of the quadratic bezier at t=0.5
    return { x: (s.x + t.x) / 2, y: s.y - sibArcH(s.x, t.x) / 2 };
  }

  // parent-child / spouse: geometric midpoint
  return { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
}

function linkCls(type: PositionedLink['type']): string {
  return type === 'spouse'
    ? 'tree-link-spouse'
    : type === 'sibling'
      ? 'tree-link-sibling'
      : 'tree-link-parent-child';
}

/* ═══ Component ═══ */
export function FamilyTreeView({ searchQuery = '' }: { searchQuery?: string }) {
  const tree = useTreeStore((s) => s.tree);
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const selectMember = useTreeStore((s) => s.selectMember);
  const setEditing = useTreeStore((s) => s.setEditing);
  const setAddingFor = useTreeStore((s) => s.setAddingFor);
  const removeMember = useTreeStore((s) => s.removeMember);
  const { strings } = useI18n();

  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const deletingMember = tree?.members.find((m) => m.id === deletingMemberId);
  const isOnlyMember = (tree?.members.length ?? 0) <= 1;

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const layoutData = useMemo(() => {
    if (!tree) return null;
    return computeTieredLayout(tree);
  }, [tree]);

  /* ── Transform helpers ── */
  const applyTransform = useCallback(() => {
    const g = svgRef.current?.querySelector('.tree-root') as SVGGElement | null;
    if (!g) return;
    const { x, y, k } = transformRef.current;
    g.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
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

  /* ── Pan / Zoom ── */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? 0.9 : 1.1;
      transformRef.current.k = Math.min(
        3,
        Math.max(0.2, transformRef.current.k * d),
      );
      applyTransform();
    },
    [applyTransform],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('.tree-node')) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - transformRef.current.x,
      y: e.clientY - transformRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      transformRef.current.x = e.clientX - dragStart.current.x;
      transformRef.current.y = e.clientY - dragStart.current.y;
      applyTransform();
    },
    [applyTransform],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleNodeClick = useCallback(
    (memberId: string) => {
      selectMember(memberId);
      setEditing(true);
    },
    [selectMember, setEditing],
  );

  const handleAddClick = useCallback(
    (e: React.MouseEvent, memberId: string) => {
      e.stopPropagation();
      setAddingFor(memberId);
    },
    [setAddingFor],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, memberId: string) => {
      e.stopPropagation();
      setDeletingMemberId(memberId);
    },
    [],
  );

  const handleConfirmDelete = useCallback(() => {
    if (deletingMemberId) {
      removeMember(deletingMemberId);
      setDeletingMemberId(null);
    }
  }, [deletingMemberId, removeMember]);

  const lowerSearch = searchQuery.toLowerCase().trim();

  if (!tree || !layoutData) {
    return (
      <div className="flex-1 flex items-center justify-center text-cream/30 text-sm">
        {strings.app.noMembers}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        id="tree-svg"
        className="absolute inset-0 w-full h-full"
      >
        <g className="tree-root">
          {/* ── Links (behind everything) ── */}
          <g className="links-layer">
            {layoutData.links.map((l, i) => (
              <path
                key={`l-${i}`}
                d={linkPath(l)}
                className={linkCls(l.type)}
              />
            ))}
          </g>

          {/* ── Badges (relationship icons at link midpoints) ── */}
          <g className="badges-layer" pointerEvents="none">
            {layoutData.links.map((l, i) => {
              const p = badgePos(l);
              return <LinkBadge key={`b-${i}`} x={p.x} y={p.y} type={l.type} />;
            })}
          </g>

          {/* ── Nodes (on top) ── */}
          <g className="nodes-layer">
            {layoutData.nodes.map((node) => {
              const { member, x, y } = node;
              const sel = selectedMemberId === member.id;
              const matchesSearch =
                !lowerSearch || member.name.toLowerCase().includes(lowerSearch);
              const dimmed = lowerSearch && !matchesSearch;

              return (
                <g
                  key={member.id}
                  className="tree-node cursor-pointer"
                  transform={`translate(${x},${y})`}
                  onClick={() => handleNodeClick(member.id)}
                  opacity={dimmed ? 0.2 : 1}
                >
                  {/* Selection glow */}
                  {sel && (
                    <circle
                      r={NODE_R + 4}
                      fill="none"
                      stroke="rgba(212,165,116,0.3)"
                      strokeWidth={2}
                      className="animate-pulse-glow"
                    />
                  )}

                  {/* Search highlight ring */}
                  {lowerSearch && matchesSearch && (
                    <circle
                      r={NODE_R + 5}
                      fill="none"
                      stroke="rgba(212,165,116,0.6)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Opaque background (prevents links bleeding through) */}
                  <circle r={NODE_R} fill="var(--color-charcoal)" />

                  {/* Colored fill */}
                  <circle
                    r={NODE_R}
                    fill={genderFill[member.gender]}
                    stroke={
                      sel
                        ? 'rgba(212,165,116,0.9)'
                        : genderStroke[member.gender]
                    }
                    strokeWidth={sel ? 2.5 : 1.5}
                  />

                  {/* Initials */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(245,240,232,0.9)"
                    fontSize={12}
                    fontFamily="var(--font-display)"
                    fontWeight={600}
                  >
                    {getInitials(member.name)}
                  </text>

                  {/* Name label */}
                  <text
                    textAnchor="middle"
                    y={NODE_R + 12}
                    fill="rgba(245,240,232,0.55)"
                    fontSize={10}
                    fontFamily="var(--font-body)"
                    fontWeight={500}
                  >
                    {member.name.length > 14
                      ? member.name.slice(0, 13) + '…'
                      : member.name}
                  </text>

                  {/* Birth-death years */}
                  {(member.birthDate || member.deathDate) && (
                    <text
                      textAnchor="middle"
                      y={NODE_R + 24}
                      fill="rgba(245,240,232,0.25)"
                      fontSize={8}
                      fontFamily="var(--font-body)"
                    >
                      {member.birthDate?.slice(0, 4) ?? '?'} —{' '}
                      {member.deathDate?.slice(0, 4) ?? ''}
                    </text>
                  )}

                  {/* "+" add-relative button (bottom-right of node) */}
                  <g
                    className="add-btn"
                    transform={`translate(${ADD_BTN_OFFSET * Math.cos(Math.PI / 4)},${ADD_BTN_OFFSET * Math.sin(Math.PI / 4)})`}
                    onClick={(e) => handleAddClick(e, member.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      r={ADD_BTN_R}
                      fill="var(--color-charcoal-light, #2a2a2a)"
                      stroke="rgba(212,165,116,0.5)"
                      strokeWidth={1.2}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(212,165,116,0.9)"
                      fontSize={14}
                      fontWeight={700}
                      style={{ pointerEvents: 'none' }}
                    >
                      +
                    </text>
                  </g>

                  {/* "🗑" delete button (bottom-left of node) — hidden when only 1 member */}
                  {!isOnlyMember && (
                    <g
                      className="del-btn"
                      transform={`translate(${-DEL_BTN_OFFSET * Math.cos(Math.PI / 4)},${DEL_BTN_OFFSET * Math.sin(Math.PI / 4)})`}
                      onClick={(e) => handleDeleteClick(e, member.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        r={DEL_BTN_R}
                        fill="var(--color-charcoal-light, #2a2a2a)"
                        stroke="rgba(212,84,84,0.5)"
                        strokeWidth={1.2}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="rgba(212,84,84,0.9)"
                        fontSize={9}
                        fontWeight={700}
                        style={{ pointerEvents: 'none' }}
                      >
                        ✕
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => {
            transformRef.current.k = Math.min(3, transformRef.current.k * 1.2);
            applyTransform();
          }}
          className="w-8 h-8 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-cream/60 hover:text-cream hover:border-amber/30 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
        >
          +
        </button>
        <button
          onClick={() => {
            transformRef.current.k = Math.max(
              0.2,
              transformRef.current.k * 0.8,
            );
            applyTransform();
          }}
          className="w-8 h-8 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-cream/60 hover:text-cream hover:border-amber/30 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
        >
          −
        </button>
        <button
          onClick={fitToView}
          className="w-8 h-8 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-cream/60 hover:text-cream hover:border-amber/30 flex items-center justify-center text-[10px] font-medium transition-all cursor-pointer"
        >
          FIT
        </button>
      </div>

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={!!deletingMemberId}
        onClose={() => setDeletingMemberId(null)}
        onConfirm={handleConfirmDelete}
        title={strings.editor.removeConfirmTitle}
        message={t(strings.editor.removeConfirmMessage, {
          name: deletingMember?.name ?? '',
        })}
        variant="danger"
      />
    </div>
  );
}
