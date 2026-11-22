import { cn } from '@/lib/utilities/cn';
import type {
  MarketplaceDisputeStatus,
  MarketplaceListingStatus,
  MarketplaceModerationStatus,
  MarketplaceOrderStatus,
} from '@/lib/supabase/database.types';

const MODERATION_STYLES: Record<MarketplaceModerationStatus, string> = {
  pending: 'border-brand-gold/50 bg-brand-gold/10 text-brand-gold',
  approved: 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300',
  rejected: 'border-red-400/40 bg-red-950/35 text-red-300',
  removed: 'border-amber-400/45 bg-amber-950/40 text-amber-300',
};

export function ListingModerationBadge({
  status,
  className,
}: {
  status: MarketplaceModerationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-heading text-[0.64rem] tracking-[0.18em] uppercase',
        MODERATION_STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

const AVAILABILITY_STYLES: Record<MarketplaceListingStatus, string> = {
  available: 'border-brand-gold/40 bg-brand-black text-brand-cream',
  unavailable: 'border-brand-muted/35 bg-brand-black text-brand-muted',
  sold: 'border-brand-muted/35 bg-brand-black text-brand-muted',
};

export function ListingAvailabilityBadge({
  status,
}: {
  status: MarketplaceListingStatus;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-heading text-[0.64rem] tracking-[0.18em] uppercase',
        AVAILABILITY_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

const ORDER_STATUS_META: Record<
  MarketplaceOrderStatus,
  { label: string; style: string }
> = {
  requested: {
    label: 'Requested',
    style: 'border-brand-gold/50 bg-brand-gold/10 text-brand-gold',
  },
  accepted: {
    label: 'Accepted',
    style: 'border-brand-cream/35 bg-brand-cream/5 text-brand-cream',
  },
  in_progress: {
    label: 'In Progress',
    style: 'border-brand-gold/40 bg-brand-charcoal text-brand-gold-hover',
  },
  seller_marked_sent: {
    label: 'Seller Marked Sent',
    style: 'border-sky-400/45 bg-sky-950/35 text-sky-300',
  },
  buyer_confirmed: {
    label: 'Confirmed',
    style: 'border-emerald-400/45 bg-emerald-950/40 text-emerald-300',
  },
  cancelled: {
    label: 'Cancelled',
    style: 'border-brand-muted/35 bg-brand-black text-brand-muted',
  },
  rejected: {
    label: 'Rejected',
    style: 'border-red-400/40 bg-red-950/35 text-red-300',
  },
  disputed: {
    label: 'Disputed',
    style: 'border-red-400/60 bg-red-950/50 text-red-200',
  },
};

export function OrderStatusBadge({ status }: { status: MarketplaceOrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2.5 py-0.5 font-heading text-[0.66rem] tracking-[0.18em] uppercase',
        meta.style,
      )}
    >
      {meta.label}
    </span>
  );
}

const DISPUTE_STYLES: Record<MarketplaceDisputeStatus, string> = {
  open: 'border-red-400/60 bg-red-950/45 text-red-200',
  under_review: 'border-brand-gold/50 bg-brand-gold/10 text-brand-gold',
  resolved: 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300',
  dismissed: 'border-brand-muted/35 bg-brand-black text-brand-muted',
};

export function DisputeStatusBadge({ status }: { status: MarketplaceDisputeStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2.5 py-0.5 font-heading text-[0.66rem] tracking-[0.18em] uppercase',
        DISPUTE_STYLES[status],
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
