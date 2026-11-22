import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel = 'Search',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-brand-gold/80"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full border hairline-border bg-brand-charcoal/80 py-3 pr-10 pl-11 font-body text-sm text-brand-white placeholder:text-brand-muted/70 transition-colors focus:border-brand-gold focus:outline-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-brand-muted transition-colors hover:text-brand-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
