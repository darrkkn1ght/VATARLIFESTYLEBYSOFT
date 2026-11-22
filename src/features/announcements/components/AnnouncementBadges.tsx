import { Pin } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';
import type {
  AnnouncementPriority,
  AnnouncementStatus,
} from '@/lib/supabase/database.types';

const STATUS_STYLES: Record<AnnouncementStatus, string> = {
  draft: 'border-brand-muted/35 bg-brand-black text-brand-muted',
  published: 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300',
  archived: 'border-amber-400/40 bg-amber-950/35 text-amber-300',
};

export function AnnouncementStatusBadge({
  status,
  className,
}: {
  status: AnnouncementStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-heading text-[0.64rem] tracking-[0.18em] uppercase',
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

const PRIORITY_STYLES: Record<AnnouncementPriority, string> = {
  low: 'border-brand-muted/30 bg-brand-black text-brand-muted',
  normal: 'border-brand-cream/25 bg-brand-black text-brand-cream/85',
  high: 'border-brand-gold/55 bg-brand-gold/10 text-brand-gold',
  urgent: 'border-red-400/60 bg-red-950/45 text-red-200',
};

export function AnnouncementPriorityBadge({
  priority,
}: {
  priority: AnnouncementPriority;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-heading text-[0.64rem] tracking-[0.18em] uppercase',
        PRIORITY_STYLES[priority],
      )}
    >
      {priority}
    </span>
  );
}

export function PinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 border border-brand-gold bg-brand-gold/15 px-2 py-0.5 font-heading text-[0.64rem] tracking-[0.18em] text-brand-gold uppercase">
      <Pin className="h-3 w-3" aria-hidden="true" />
      Pinned
    </span>
  );
}
