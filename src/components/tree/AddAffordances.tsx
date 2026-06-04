/**
 * Directional "add relative" affordances around an Active node card.
 *
 * Four labeled "+" pills encode the relationship by direction *and* by text:
 *   Parent  = top-center
 *   Child   = bottom-center
 *   Partner = inline-end   (mirrors in RTL via logical properties)
 *   Sibling = inline-start (mirrors in RTL via logical properties)
 *
 * Each pill shows a `+` icon plus the localized relationship label so users can
 * tell what each target adds. The top/bottom pills are horizontally centered on
 * the card. The side pills sit just outside the card's inline edges and grow
 * *outward* (away from the card) so a wide label never overlaps the w-60 card
 * body or the spawned New card below it.
 *
 * On narrow viewports the floating pills are replaced by a labeled row beneath
 * the card. Each control carries a localized `aria-label`/`title` and is ≥44px.
 *
 * Clicking an affordance asks the parent (FamilyTreeView, via `onAdd`) to spawn a
 * New NodeCard wired to `{ relativeTo, relType }`.
 *
 * @module AddAffordances
 */
import { Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type RelType = 'parent' | 'child' | 'spouse' | 'sibling';

interface AddAffordancesProps {
  /** Whether to render as a labeled row (mobile/narrow) instead of floating pills. */
  inline?: boolean;
  /** Called with the chosen relationship type when a target is clicked. */
  onAdd: (relType: RelType) => void;
}

// Labeled floating pill: hairline border, paper bg, forest accent on hover.
// min-h ≥44px keeps the touch target comfortable; whitespace-nowrap stops the
// label wrapping when it sits beside the card.
const PILL =
  'inline-flex items-center gap-1 min-h-[44px] px-2.5 rounded-full ' +
  'bg-charcoal-light border border-charcoal-lighter text-cream-dark ' +
  'text-[11px] font-body whitespace-nowrap shadow-sm ' +
  'hover:text-amber hover:border-amber transition-colors cursor-pointer';

export function AddAffordances({ inline = false, onAdd }: AddAffordancesProps) {
  const { strings } = useI18n();

  const items: { type: RelType; label: string }[] = [
    { type: 'parent', label: strings.addRelative.parent },
    { type: 'child', label: strings.addRelative.child },
    { type: 'spouse', label: strings.addRelative.spouseLabel },
    { type: 'sibling', label: strings.addRelative.sibling },
  ];

  if (inline) {
    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {items.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            aria-label={label}
            className="flex items-center gap-1 min-h-[44px] px-2.5 rounded-md
                       border border-charcoal-lighter bg-charcoal-light
                       text-[11px] font-body text-cream-dark
                       hover:text-amber hover:border-amber transition-colors cursor-pointer"
          >
            <Plus size={12} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Parent — top center */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full">
        <button
          type="button"
          onClick={() => onAdd('parent')}
          aria-label={strings.addRelative.parent}
          title={strings.addRelative.parent}
          className={PILL}
        >
          <Plus size={14} aria-hidden="true" />
          {strings.addRelative.parent}
        </button>
      </div>

      {/* Child — bottom center */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full">
        <button
          type="button"
          onClick={() => onAdd('child')}
          aria-label={strings.addRelative.child}
          title={strings.addRelative.child}
          className={PILL}
        >
          <Plus size={14} aria-hidden="true" />
          {strings.addRelative.child}
        </button>
      </div>

      {/* Partner — inline-end. Anchored just outside the card's end edge; the
          pill grows OUTWARD (away from the card) via start:100% so its label
          never overlaps the card body. */}
      <div className="absolute top-1/2 -translate-y-1/2 start-full ms-2">
        <button
          type="button"
          onClick={() => onAdd('spouse')}
          aria-label={strings.addRelative.spouseLabel}
          title={strings.addRelative.spouseLabel}
          className={PILL}
        >
          <Plus size={14} aria-hidden="true" />
          {strings.addRelative.spouseLabel}
        </button>
      </div>

      {/* Sibling — inline-start. Anchored just outside the card's start edge;
          end:100% pins its inline-end to the card edge so the pill grows
          OUTWARD (away from the card). */}
      <div className="absolute top-1/2 -translate-y-1/2 end-full me-2">
        <button
          type="button"
          onClick={() => onAdd('sibling')}
          aria-label={strings.addRelative.sibling}
          title={strings.addRelative.sibling}
          className={PILL}
        >
          <Plus size={14} aria-hidden="true" />
          {strings.addRelative.sibling}
        </button>
      </div>
    </>
  );
}
