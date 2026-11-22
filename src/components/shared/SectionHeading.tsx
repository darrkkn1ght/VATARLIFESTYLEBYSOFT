import type { ReactNode } from 'react';
import { cn } from '@/lib/utilities/cn';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  index?: string;
  action?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  index,
  action,
  align = 'left',
  className,
}: SectionHeadingProps) {
  if (align === 'center') {
    return (
      <div className={cn('mx-auto max-w-2xl text-center', className)}>
        <p className="heading-eyebrow">
          {index ? `${index} — ${eyebrow}` : eyebrow}
        </p>
        <h2 className="heading-section mt-3 text-3xl text-brand-white sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {description && <p className="body-lead mt-4">{description}</p>}
        {action && <div className="mt-6 flex justify-center">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-6 border-b hairline-border pb-6 sm:flex-row sm:items-end',
        className,
      )}
    >
      <div className="max-w-2xl">
        <div className="flex items-center gap-3">
          {index && (
            <span className="font-heading text-xs tracking-[0.22em] text-brand-gold">
              {index}
            </span>
          )}
          <span aria-hidden="true" className="h-px w-6 bg-brand-gold/60" />
          <p className="heading-eyebrow">{eyebrow}</p>
        </div>
        <h2 className="heading-section mt-3 text-3xl text-brand-white sm:text-4xl">
          {title}
        </h2>
        {description && <p className="body-lead mt-3">{description}</p>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
