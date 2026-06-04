interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'amber' | 'sage' | 'wine' | 'warning';
  className?: string;
}

const variantClasses = {
  default: 'bg-transparent text-cream-dark border-charcoal-lighter',
  amber: 'bg-transparent text-amber border-amber/40',
  sage: 'bg-transparent text-sage border-sage/40',
  wine: 'bg-transparent text-wine border-wine/40',
  warning: 'bg-transparent text-error border-error/40',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-[10px] font-medium uppercase tracking-wider
        rounded-full border
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
