/**
 * "Push aside on open" — transient displacement for the active node card.
 *
 * The compact tree is laid out densely ({@link computeTieredLayout}), but an
 * *active* node morphs into a much larger editing card (`w-60` + the four
 * directional add-pills) centred on the same coordinate. Left alone it paints
 * over its same-tier neighbours (spouse, siblings) and hides them.
 *
 * Rather than permanently spreading the whole tree out, we displace only the
 * neighbours that would be covered — and only while a card is open. This pure
 * function returns the per-node x-offset needed to clear the active node's
 * footprint; the canvas animates `offset * progress` (0→1 on open, 1→0 on
 * close) so neighbours slide out and snap back. Links read the same offsets so
 * edges stay attached throughout.
 *
 * Only same-tier neighbours move (horizontally). Other tiers — the parent above
 * and children below — sit a full {@link TIER_GAP} away and clear the card body
 * and its top/bottom pills on their own, so they are never displaced.
 *
 * Pure function — no DOM, node-testable.
 *
 * @module push
 */

/** Per-node displacement in layout px. `dy` is always 0 (we never change tiers). */
export interface Offset {
  dx: number;
  dy: number;
}

/**
 * Minimum centre-to-centre distance (px) a same-tier neighbour must keep from
 * the active node. Covers the active card's half-width (~120) plus the outward
 * add-pill reach (~120) so a pushed neighbour is never under the card or a pill.
 */
export const ACTIVE_CLEAR_X = 300;

/**
 * Minimum centre-to-centre gap (px) kept between consecutive *pushed*
 * neighbours, mirroring the layout's own `MIN_SEP` floor so the cascade never
 * introduces a new overlap.
 */
export const PUSH_SEP = 80;

type LayoutPoint = { id: string; x: number; tier: number };

/**
 * Compute the x-offset each node needs so the active node's enlarged card has
 * room. Returns a map keyed by node id; nodes that don't move are omitted
 * (callers treat a missing entry as `{ dx: 0, dy: 0 }`).
 *
 * Neighbours on the active node's tier are swept outward to either side: the
 * nearest must clear `ACTIVE_CLEAR_X`, and each subsequent one keeps `PUSH_SEP`
 * from the previous so the push cascades without collisions. A node already
 * beyond the cursor is left untouched, which also stops the cascade.
 */
export function displaceForActive(
  nodes: readonly LayoutPoint[],
  activeId: string | null,
): Map<string, Offset> {
  const out = new Map<string, Offset>();
  if (activeId == null) return out;

  const active = nodes.find((n) => n.id === activeId);
  if (!active) return out;

  const sameTier = nodes.filter((n) => n.tier === active.tier && n.id !== active.id);
  const right = sameTier.filter((n) => n.x >= active.x).sort((a, b) => a.x - b.x);
  const left = sameTier.filter((n) => n.x < active.x).sort((a, b) => b.x - a.x);

  // Sweep right: each node is pushed to at least `cursor`, never pulled inward.
  let cursor = active.x + ACTIVE_CLEAR_X;
  for (const n of right) {
    const newX = Math.max(n.x, cursor);
    if (newX !== n.x) out.set(n.id, { dx: newX - n.x, dy: 0 });
    cursor = newX + PUSH_SEP;
  }

  // Sweep left (mirror).
  cursor = active.x - ACTIVE_CLEAR_X;
  for (const n of left) {
    const newX = Math.min(n.x, cursor);
    if (newX !== n.x) out.set(n.id, { dx: newX - n.x, dy: 0 });
    cursor = newX - PUSH_SEP;
  }

  return out;
}
