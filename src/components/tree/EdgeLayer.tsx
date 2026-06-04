/**
 * SVG links layer for the family tree canvas.
 *
 * Renders the relationship edges (parent-child / spouse / sibling, plus future
 * `reference` links added in sub-project C) as ink-toned SVG paths. It sits
 * *behind* the HTML `NodeCard`s inside the shared pan/zoom transform, sized to
 * the layout bounds with `overflow: visible` so paths extending past the box
 * still draw.
 *
 * Edges are differentiated purely by dash/weight/colour (editorial style) — the
 * old amber/wine/sage badge glyphs were dropped.
 *
 * @module EdgeLayer
 */
import type { PositionedLink } from '@/lib/tree-utils';

/** A link may carry a `kind` discriminator once sub-project C lands; until then it is undefined. */
type LinkWithKind = PositionedLink & { kind?: 'primary' | 'reference' };

export interface EdgeBounds {
  x0: number;
  y0: number;
  width: number;
  height: number;
}

interface EdgeLayerProps {
  links: PositionedLink[];
  bounds: EdgeBounds;
}

/* ── Link geometry (extracted from the old SVG renderer) ── */

/** Height of the sibling arc, clamped so it stays subtle. */
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

function linkCls(l: LinkWithKind): string {
  if (l.kind === 'reference') return 'tree-link-reference';
  return l.type === 'spouse'
    ? 'tree-link-spouse'
    : l.type === 'sibling'
      ? 'tree-link-sibling'
      : 'tree-link-parent-child';
}

export function EdgeLayer({ links, bounds }: EdgeLayerProps) {
  const { x0, y0, width, height } = bounds;

  return (
    <svg
      id="tree-svg"
      className="absolute pointer-events-none"
      style={{
        left: x0,
        top: y0,
        width,
        height,
        overflow: 'visible',
      }}
      viewBox={`${x0} ${y0} ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <g className="links-layer">
        {links.map((l, i) => {
          const lk = l as LinkWithKind;
          return (
            <path
              key={`${l.sourceId}-${l.targetId}-${i}`}
              d={linkPath(l)}
              className={linkCls(lk)}
            />
          );
        })}
      </g>
    </svg>
  );
}
