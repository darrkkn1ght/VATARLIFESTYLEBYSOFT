import { ArrowUpRight, Calendar, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';
import type { CompetitionItem, CompetitionStatus } from '@/types/content';

interface CompetitionCardProps {
  competition: CompetitionItem;
}

const statusConfig: Record<CompetitionStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'border-brand-gold/60 bg-brand-gold/10 text-brand-gold',
  },
  upcoming: {
    label: 'Upcoming',
    className: 'border-brand-cream/25 bg-brand-cream/5 text-brand-cream',
  },
  completed: {
    label: 'Completed',
    className: 'border-brand-muted/30 bg-brand-black text-brand-muted',
  },
};

export function CompetitionCard({ competition }: CompetitionCardProps) {
  const status = statusConfig[competition.status];

  return (
    <article className="group flex flex-col justify-between border hairline-border bg-brand-charcoal/70 p-6 transition-colors duration-200 hover:border-brand-gold/45 sm:p-7">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[0.68rem] font-medium tracking-[0.22em] text-brand-muted uppercase">
            {competition.category}
          </span>
          <span
            className={cn(
              'border px-2.5 py-0.5 font-heading text-[0.68rem] tracking-[0.18em] uppercase',
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>

        <h3 className="heading-section mt-4 text-2xl text-brand-white transition-colors group-hover:text-brand-cream">
          {competition.title}
        </h3>

        <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
          {competition.summary}
        </p>
      </div>

      <div className="mt-6 border-t hairline-border pt-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-brand-cream/80">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
            {competition.scheduleLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
            {competition.format}
          </span>
        </div>

        <Link
          to={ROUTES.register}
          className="mt-5 inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.18em] text-brand-gold uppercase transition-colors hover:text-brand-cream"
        >
          Register Interest
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
