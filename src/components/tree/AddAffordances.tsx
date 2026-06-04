/**
 * Directional "add relative" affordances around an Active node card.
 *
 * Four quiet "+" targets encode the relationship by direction:
 *   Parent  = top
 *   Child   = bottom
 *   Partner = inline-end   (mirrors in RTL via logical properties)
 *   Sibling = inline-start (mirrors in RTL via logical properties)
 *
 * On narrow viewports the floating targets are replaced by a labeled row beneath
 * the card. Each control carries a localized `aria-label` and is ≥44px.
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
  /** Whether to render as a labeled row (mobile/narrow) instead of floating targets. */
  inline?: boolean;
  /** Called with the chosen relationship type when a target is clicked. */
  onAdd: (relType: RelType) => void;
}

const FLOAT_BTN =
  'absolute z-20 grid place-items-center w-9 h-9 rounded-full ' +
  'bg-charcoal-light border border-charcoal-lighter text-cream-dark ' +
  'hover:text-amber hover:border-amber transition-colors cursor-pointer ' +
  'shadow-sm';

// A larger transparent hit area (>=44px) wraps each visible 36px disc.
const HIT = 'grid place-items-center w-11 h-11';

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
        <span className={HIT}>
          <button
            type="button"
            onClick={() => onAdd('parent')}
            aria-label={strings.addRelative.parent}
            title={strings.addRelative.parent}
            className={`${FLOAT_BTN} static`}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* Child — bottom center */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full">
        <span className={HIT}>
          <button
            type="button"
            onClick={() => onAdd('child')}
            aria-label={strings.addRelative.child}
            title={strings.addRelative.child}
            className={`${FLOAT_BTN} static`}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* Partner — inline-end (logical: right in LTR, left in RTL). The
          negative logical inset places it just outside the card's end edge. */}
      <div className="absolute top-1/2 -translate-y-1/2 -end-11">
        <span className={HIT}>
          <button
            type="button"
            onClick={() => onAdd('spouse')}
            aria-label={strings.addRelative.spouseLabel}
            title={strings.addRelative.spouseLabel}
            className={`${FLOAT_BTN} static`}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* Sibling — inline-start (logical: left in LTR, right in RTL). */}
      <div className="absolute top-1/2 -translate-y-1/2 -start-11">
        <span className={HIT}>
          <button
            type="button"
            onClick={() => onAdd('sibling')}
            aria-label={strings.addRelative.sibling}
            title={strings.addRelative.sibling}
            className={`${FLOAT_BTN} static`}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </span>
      </div>
    </>
  );
}
