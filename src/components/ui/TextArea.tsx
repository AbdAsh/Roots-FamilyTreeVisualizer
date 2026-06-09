import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-[11px] font-medium text-cream-dark uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2.5 text-sm
            bg-charcoal border border-charcoal-lighter
            text-cream placeholder:text-cream-dark
            rounded-md resize-y min-h-[80px]
            transition-colors duration-200
            focus:outline-none focus:border-amber
            ${error ? 'border-error' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';
