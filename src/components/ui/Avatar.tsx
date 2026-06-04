import type { Gender } from '@/types/family';

interface AvatarProps {
  name: string;
  photoUrl?: string;
  gender: Gender;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const genderColors: Record<Gender, string> = {
  male: 'bg-charcoal border-amber/30 text-amber',
  female: 'bg-charcoal border-wine/40 text-wine',
  other: 'bg-charcoal border-sage/40 text-sage',
  unknown: 'bg-charcoal border-charcoal-lighter text-cream-dark',
};

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({
  name,
  photoUrl,
  gender,
  size = 'md',
  className = '',
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const colorClass = genderColors[gender];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border-2 ${colorClass.split(' ').find((c) => c.startsWith('border-'))} ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        ${sizeClass} rounded-full border
        flex items-center justify-center
        font-display font-semibold
        ${colorClass}
        ${className}
      `}
    >
      {getInitials(name)}
    </div>
  );
}
