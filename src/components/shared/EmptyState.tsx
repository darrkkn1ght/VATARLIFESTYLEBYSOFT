import type { ReactNode } from 'react';
import { cn } from '@/lib/utilities/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  eyebrow = 'Awaiting Live Data',
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border hairline-border bg-brand-charcoal/55',
        compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-px w-24 bg-brand-gold/60"
      />

      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brand-gold/30 bg-brand-black text-brand-gold">
                {icon}
              </span>
            )}
            <p className="heading-eyebrow">{eyebrow}</p>
          </div>

          <h3 className="heading-section mt-4 text-xl text-brand-cream sm:text-2xl">
            {title}
          </h3>
          <p className="mt-2.5 font-body text-sm leading-relaxed text-brand-muted">
            {description}
          </p>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
