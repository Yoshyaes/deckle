import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  /** Inline error message rendered below the input. Sets aria-invalid. */
  error?: string;
  /** Optional trailing icon or button. */
  trailing?: ReactNode;
}

/**
 * Themed text input. Pairs the input with a programmatically-tied
 * label and an `aria-describedby` for description / error so screen
 * readers announce them on focus.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, trailing, className = '', id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-text-muted mb-1.5"
        >
          {label}
        </label>
      )}
      {description && (
        <p id={descId} className="text-xs text-text-dim mb-1.5">
          {description}
        </p>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'w-full bg-[#0D0D0F] border rounded-lg px-3 py-2 text-sm text-text-primary outline-none transition-colors',
            error ? 'border-red focus:border-red' : 'border-border-subtle focus:border-accent/50',
            trailing ? 'pr-10' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-2 flex items-center text-text-dim">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p id={errId} className="mt-1.5 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
});
