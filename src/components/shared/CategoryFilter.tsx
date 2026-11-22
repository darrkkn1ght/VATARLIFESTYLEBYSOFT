import { cn } from '@/lib/utilities/cn';

interface CategoryFilterProps<T extends string> {
  categories: readonly T[];
  selected: T;
  onSelect: (category: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function CategoryFilter<T extends string>({
  categories,
  selected,
  onSelect,
  ariaLabel = 'Filter by category',
  className,
}: CategoryFilterProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {categories.map((category) => {
        const isActive = category === selected;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(category)}
            className={cn(
              'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.16em] uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
              isActive
                ? 'border-brand-gold bg-brand-gold text-brand-black'
                : 'hairline-border bg-brand-charcoal/70 text-brand-muted hover:border-brand-gold/50 hover:text-brand-cream',
            )}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
