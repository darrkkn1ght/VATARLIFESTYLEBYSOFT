import { MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';
import type { ListingAvailability, MarketplaceListing } from '@/types/content';

interface MarketplaceListingCardProps {
  listing: MarketplaceListing;
}

const availabilityStyles: Record<ListingAvailability, { label: string; dot: string; text: string }> = {
  available: {
    label: 'Available',
    dot: 'bg-brand-gold',
    text: 'text-brand-cream',
  },
  reserved: {
    label: 'Reserved',
    dot: 'bg-brand-cream/60',
    text: 'text-brand-muted',
  },
  sold: {
    label: 'Unavailable',
    dot: 'bg-brand-muted/50',
    text: 'text-brand-muted',
  },
};

export function MarketplaceListingCard({ listing }: MarketplaceListingCardProps) {
  const status = availabilityStyles[listing.availability];

  return (
    <article className="flex flex-col justify-between border hairline-border bg-brand-charcoal/70 p-6 transition-colors duration-200 hover:border-brand-gold/45">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="border border-brand-gold/30 bg-brand-black px-2.5 py-1 font-body text-[0.66rem] font-medium tracking-[0.18em] text-brand-gold uppercase">
            {listing.category}
          </span>
          <span className={cn('inline-flex items-center gap-2 font-body text-xs', status.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden="true" />
            {status.label}
          </span>
        </div>

        <h3 className="heading-section mt-4 text-xl text-brand-white">
          {listing.title}
        </h3>

        <p className="mt-2.5 font-body text-sm leading-relaxed text-brand-muted">
          {listing.description}
        </p>
      </div>

      <div className="mt-6 border-t hairline-border pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Listed Price
            </p>
            <p className="mt-1 font-heading text-2xl tracking-[0.04em] text-brand-gold">
              {listing.priceLabel}
            </p>
          </div>

          <div className="text-right">
            <p className="inline-flex items-center gap-1.5 font-body text-xs text-brand-cream">
              <User className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
              {listing.sellerName}
            </p>
            {listing.sellerRole && (
              <p className="mt-0.5 font-body text-[0.68rem] text-brand-muted">
                {listing.sellerRole}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <Button
            to={listing.contactHref ?? ROUTES.contact}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Contact Seller
          </Button>
        </div>
      </div>
    </article>
  );
}
