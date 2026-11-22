import { cn } from '@/lib/utilities/cn';
import type { AppRole, MembershipStatus } from '@/lib/supabase/database.types';

const STATUS_STYLES: Record<
  MembershipStatus,
  { label: string; dot: string; badge: string }
> = {
  pending: {
    label: 'Pending',
    dot: 'bg-brand-gold',
    badge: 'border-brand-gold/50 bg-brand-gold/10 text-brand-gold',
  },
  approved: {
    label: 'Approved',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-400/35 bg-emerald-950/40 text-emerald-300',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-red-400',
    badge: 'border-red-400/40 bg-red-950/40 text-red-300',
  },
  suspended: {
    label: 'Suspended',
    dot: 'bg-amber-400',
    badge: 'border-amber-400/45 bg-amber-950/40 text-amber-300',
  },
};

interface MembershipStatusBadgeProps {
  status: MembershipStatus;
  className?: string;
}

export function MembershipStatusBadge({
  status,
  className,
}: MembershipStatusBadgeProps) {
  const config = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 border px-2.5 py-1 font-heading text-[0.68rem] tracking-[0.18em] uppercase',
        config.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} aria-hidden="true" />
      {config.label}
    </span>
  );
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
};

interface RoleBadgeProps {
  role: AppRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center border border-brand-gold/40 bg-brand-black px-2 py-0.5 font-body text-[0.62rem] font-medium tracking-[0.16em] text-brand-gold uppercase">
      {ROLE_LABELS[role]}
    </span>
  );
}
