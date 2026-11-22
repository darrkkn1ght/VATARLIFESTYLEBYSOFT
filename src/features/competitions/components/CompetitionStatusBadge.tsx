import { cn } from '@/lib/utilities/cn';
import type {
  CompetitionRegistrationStatus,
  CompetitionStatus,
} from '@/lib/supabase/database.types';

const COMP_STATUS_STYLES: Record<
  CompetitionStatus,
  { label: string; dot: string; badge: string }
> = {
  draft: {
    label: 'Draft',
    dot: 'bg-brand-muted',
    badge: 'border-brand-muted/35 bg-brand-black text-brand-muted',
  },
  published: {
    label: 'Published',
    dot: 'bg-brand-cream',
    badge: 'border-brand-cream/30 bg-brand-cream/5 text-brand-cream',
  },
  registration_open: {
    label: 'Registration Open',
    dot: 'bg-brand-gold',
    badge: 'border-brand-gold/60 bg-brand-gold/10 text-brand-gold',
  },
  registration_closed: {
    label: 'Registration Closed',
    dot: 'bg-brand-cream/60',
    badge: 'border-brand-cream/25 bg-brand-charcoal text-brand-cream/85',
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-400/45 bg-emerald-950/40 text-emerald-300',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-brand-gold-hover',
    badge: 'border-brand-gold/35 bg-brand-black text-brand-cream',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-red-400',
    badge: 'border-red-400/40 bg-red-950/35 text-red-300',
  },
};

export function CompetitionStatusBadge({
  status,
  className,
}: {
  status: CompetitionStatus;
  className?: string;
}) {
  const cfg = COMP_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 border px-2.5 py-1 font-heading text-[0.68rem] tracking-[0.18em] uppercase',
        cfg.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

const REG_STATUS_STYLES: Record<
  CompetitionRegistrationStatus,
  { label: string; badge: string }
> = {
  registered: {
    label: 'Registered',
    badge: 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300',
  },
  withdrawn: {
    label: 'Withdrawn',
    badge: 'border-brand-muted/35 bg-brand-black text-brand-muted',
  },
  disqualified: {
    label: 'Disqualified',
    badge: 'border-red-400/45 bg-red-950/40 text-red-300',
  },
  removed: {
    label: 'Removed',
    badge: 'border-amber-400/45 bg-amber-950/40 text-amber-300',
  },
};

export function RegistrationStatusBadge({
  status,
  className,
}: {
  status: CompetitionRegistrationStatus;
  className?: string;
}) {
  const cfg = REG_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2.5 py-0.5 font-heading text-[0.66rem] tracking-[0.18em] uppercase',
        cfg.badge,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
