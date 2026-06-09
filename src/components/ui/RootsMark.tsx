/**
 * Roots brand mark — a node-graph "family tree": a couple joined by a union
 * link, branching down to two children. It mirrors how the app itself draws the
 * union-aware layout, so the logo *is* the product.
 *
 * The mark is a single colour via `currentColor`, so it inherits the surrounding
 * text colour (e.g. `text-amber`) and recolours cleanly across light/dark themes.
 * API mirrors the lucide icons it replaces (`size` + `className`).
 *
 * @module RootsMark
 */

interface RootsMarkProps {
  /** Rendered width & height in px (square). Defaults to 20. */
  size?: number;
  className?: string;
  /**
   * Accessible label. When provided the mark is exposed to assistive tech as an
   * image; when omitted it is decorative (`aria-hidden`).
   */
  title?: string;
}

export function RootsMark({ size = 20, className, title }: RootsMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g stroke="currentColor" strokeWidth={5} strokeLinecap="round">
        <line x1="34" y1="25" x2="66" y2="25" />
        <line x1="50" y1="25" x2="50" y2="55" />
        <line x1="30" y1="55" x2="70" y2="55" />
        <line x1="30" y1="55" x2="30" y2="65" />
        <line x1="70" y1="55" x2="70" y2="65" />
      </g>
      <g fill="currentColor">
        <circle cx="34" cy="25" r="10" />
        <circle cx="66" cy="25" r="10" />
        <circle cx="30" cy="75" r="10" />
        <circle cx="70" cy="75" r="10" />
      </g>
    </svg>
  );
}
