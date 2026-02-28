interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'amber' | 'sage' | 'wine' | 'warning';
  className?: string;
}

const variantClasses = {
  default: 'bg-cream/10 text-cream/70 border-cream/10',
  amber: 'bg-amber/10 text-amber border-amber/20',
  sage: 'bg-sage/10 text-sage-light border-sage/20',
  wine: 'bg-wine/10 text-[#d48a9e] border-wine/20',
  warning: 'bg-error/10 text-error border-error/20',
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
