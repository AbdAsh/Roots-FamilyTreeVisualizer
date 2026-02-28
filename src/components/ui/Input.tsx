/**
 * Styled text input with optional label and error message.
 *
 * Wraps a native `<input>` element with the project's charcoal/cream theme.
 * Supports all standard HTML input attributes via spread props.
 */
import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium text-cream/50 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 text-sm
            bg-charcoal-light border border-charcoal-lighter
            text-cream placeholder:text-cream/30
            rounded-lg
            transition-all duration-200
            focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/20
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-error/50 focus:border-error focus:ring-error/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
