/**
 * Configurable button component with variant and size presets.
 *
 * Variants: `primary` (amber CTA), `secondary` (outlined), `ghost` (transparent), `danger` (red).
 * Sizes: `sm`, `md`, `lg`.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" onClick={handleSave}>Save</Button>
 * ```
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-amber text-charcoal-light hover:bg-amber-dark active:bg-amber-dark font-semibold',
  secondary:
    'bg-transparent text-cream border border-charcoal-lighter hover:border-amber/60 hover:text-amber',
  ghost: 'bg-transparent text-cream-dark hover:text-cream hover:bg-cream/5',
  danger:
    'bg-transparent text-error border border-error/30 hover:bg-error/10 hover:border-error/60',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-3 text-base rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className = '',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-body font-medium
          transition-all duration-200 ease-out
          cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
