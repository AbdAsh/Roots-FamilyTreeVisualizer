import { Info } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

const ITEMS = [
  {
    key: 'parentChild' as const,
    symbol: '↓',
    lineClass: 'bg-amber',
    symbolBg: 'bg-amber/15 border-amber/40 text-amber',
  },
  {
    key: 'spouseRel' as const,
    symbol: '♥',
    lineClass: 'bg-wine',
    symbolBg: 'bg-wine/15 border-wine/40 text-[#d48a9e]',
    dashed: true,
  },
  {
    key: 'siblingRel' as const,
    symbol: '↔',
    lineClass: 'bg-sage',
    symbolBg: 'bg-sage/15 border-sage/40 text-sage-light',
    dotted: true,
  },
];

export function Legend() {
  const [open, setOpen] = useState(false);
  const { strings } = useI18n();

  return (
    <div className="absolute bottom-4 left-4 z-10">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-cream/60 hover:text-cream hover:border-amber/30 flex items-center justify-center transition-all cursor-pointer"
        title={strings.legend.title}
      >
        <Info size={14} />
      </button>

      {/* Legend panel */}
      {open && (
        <div className="absolute bottom-10 left-0 w-48 bg-charcoal-light/95 border border-charcoal-lighter rounded-xl p-3 backdrop-blur-sm animate-fade-in">
          <h4 className="text-[10px] font-medium text-cream/50 uppercase tracking-wider mb-2.5">
            {strings.legend.title}
          </h4>
          <div className="flex flex-col gap-2">
            {ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2.5">
                {/* Badge */}
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${item.symbolBg}`}
                >
                  {item.symbol}
                </div>
                {/* Line sample */}
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className={`flex-1 h-px ${item.lineClass} ${item.dashed ? 'opacity-60' : item.dotted ? 'opacity-50' : 'opacity-60'}`}
                    style={
                      item.dashed
                        ? {
                            backgroundImage:
                              'repeating-linear-gradient(to right, currentColor 0, currentColor 6px, transparent 6px, transparent 10px)',
                            height: '1.5px',
                            backgroundColor: 'transparent',
                          }
                        : item.dotted
                          ? {
                              backgroundImage:
                                'repeating-linear-gradient(to right, currentColor 0, currentColor 2px, transparent 2px, transparent 5px)',
                              height: '1px',
                              backgroundColor: 'transparent',
                            }
                          : {}
                    }
                  />
                  <span className="text-[10px] text-cream/50 whitespace-nowrap">
                    {strings.legend[item.key]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
