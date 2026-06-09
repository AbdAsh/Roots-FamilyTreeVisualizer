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

/**
 * Shape-based gender cue. The ring tints (amber/wine/sage) are near-isoluminant
 * greens that collapse together under red-green colour-vision deficiency, so we
 * pair the colour with a small ♀/♂/⚲ glyph — a non-colour differentiator. No
 * badge for `unknown` (nothing to disambiguate).
 */
const genderSymbol: Record<Gender, string | null> = {
  male: '♂',
  female: '♀',
  other: '⚲',
  unknown: null,
};

const genderText: Record<Gender, string> = {
  male: 'text-amber',
  female: 'text-wine',
  other: 'text-sage',
  unknown: 'text-cream-dark',
};

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
};

const badgeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-3 h-3 text-[7px]',
  md: 'w-3.5 h-3.5 text-[8px]',
  lg: 'w-4 h-4 text-[10px]',
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
  const symbol = genderSymbol[gender];

  const inner = photoUrl ? (
    <img
      src={photoUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      className={`${sizeClass} rounded-full object-cover border-2 ${colorClass.split(' ').find((c) => c.startsWith('border-'))}`}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-full border flex items-center justify-center font-display font-semibold ${colorClass}`}
    >
      {getInitials(name)}
    </div>
  );

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {inner}
      {symbol && (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 end-0 grid place-items-center rounded-full bg-charcoal border border-charcoal-lighter leading-none ${badgeClasses[size]} ${genderText[gender]}`}
        >
          {symbol}
        </span>
      )}
    </span>
  );
}
