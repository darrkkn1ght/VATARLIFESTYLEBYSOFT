import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  error,
  required = true,
  disabled = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
      >
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'w-full border bg-brand-black py-3 pr-11 pl-4 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
            error ? 'border-red-400/70' : 'hairline-border',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1 text-brand-muted transition-colors hover:text-brand-gold disabled:pointer-events-none"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 font-body text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
