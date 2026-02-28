import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n, LOCALE_META, type Locale } from '@/lib/i18n';

interface LanguageSwitcherProps {
  /** Render as a minimal pill (for login screen) vs icon button (header) */
  variant?: 'pill' | 'icon';
}

export function LanguageSwitcher({ variant = 'icon' }: LanguageSwitcherProps) {
  const { locale, setLocale, strings } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" style={{ zIndex: 9999 }}>
      {variant === 'pill' ? (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream/5 border border-cream/10 text-cream/50 hover:text-cream/80 hover:border-cream/20 transition-all text-xs cursor-pointer"
          title={strings.app.language}
        >
          <Globe size={12} />
          <span>{LOCALE_META[locale].flag}</span>
          <span className="hidden sm:inline">{LOCALE_META[locale].label}</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-cream/50 hover:text-cream hover:bg-cream/5 transition-all cursor-pointer"
          title={strings.app.language}
        >
          <Globe size={14} />
        </button>
      )}

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-36 bg-charcoal-light border border-charcoal-lighter rounded-xl shadow-2xl py-1.5 animate-fade-in">
          {(Object.keys(LOCALE_META) as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-cream/5 transition-colors cursor-pointer ${
                locale === l ? 'text-amber' : 'text-cream/60'
              }`}
            >
              <span>{LOCALE_META[l].flag}</span>
              <span>{LOCALE_META[l].label}</span>
              {locale === l && <Check size={12} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
