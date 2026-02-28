import type { Gender } from '@/types/family';

interface AvatarProps {
  name: string;
  photoUrl?: string;
  gender: Gender;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const genderColors: Record<Gender, string> = {
  male: 'bg-[#4a6fa5]/30 border-[#4a6fa5]/50 text-[#8ab4f8]',
  female: 'bg-[#a5547a]/30 border-[#a5547a]/50 text-[#f8a0c8]',
  other: 'bg-sage/30 border-sage/50 text-sage-light',
  unknown: 'bg-charcoal-lighter border-charcoal-lighter text-cream/60',
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
