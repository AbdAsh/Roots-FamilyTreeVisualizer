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
            className="text-[11px] font-medium text-cream-dark uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2.5 text-sm
            bg-charcoal border border-charcoal-lighter
            text-cream placeholder:text-cream/55
            rounded-md
            transition-colors duration-200
            focus:outline-none focus:border-amber
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-error focus:border-error' : ''}
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
