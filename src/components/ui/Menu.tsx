/**
 * Dropdown-menu primitives — a conventional vertical menu used by the mobile
 * header burger (and any future overflow menus). Full-width `icon + label`
 * rows, hairline group dividers, and a small section label. Styled to the
 * editorial / green aesthetic (Hanken labels, forest accent for active rows).
 *
 * @module Menu
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MenuRowProps {
  /** Leading lucide icon (use `leading` instead for non-icon glyphs like flags). */
  icon?: LucideIcon;
  /** Custom leading node, overrides `icon` (e.g. a flag emoji). */
  leading?: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Highlights the row in the accent colour (e.g. the current language). */
  active?: boolean;
  /** Muted trailing hint (e.g. a keyboard shortcut). */
  hint?: string;
  /** Trailing node (e.g. a check mark). */
  trailing?: ReactNode;
}

export function MenuRow({
  icon: Icon,
  leading,
  label,
  onClick,
  disabled = false,
  active = false,
  hint,
  trailing,
}: MenuRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full h-11 px-3 rounded-lg text-sm font-body text-start
        transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed
        hover:bg-cream/5 focus-visible:bg-cream/5 focus-visible:outline-none
        ${active ? 'text-amber' : 'text-cream'}`}
    >
      <span
        className={`shrink-0 grid place-items-center w-[18px] ${
          active ? 'text-amber' : 'text-cream-dark'
        }`}
      >
        {leading ?? (Icon ? <Icon size={15} /> : null)}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="text-[10px] text-cream-dark tabular-nums">{hint}</span>
      )}
      {trailing}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-charcoal-lighter/70" role="separator" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-body uppercase tracking-wider text-cream-dark">
      {children}
    </div>
  );
}
