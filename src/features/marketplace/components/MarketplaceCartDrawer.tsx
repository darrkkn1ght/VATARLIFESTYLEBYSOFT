import { MapPin, MessageSquare, ShoppingCart, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MarketplaceCartItem } from '@/features/marketplace/services/marketplaceService';
import { ROUTES } from '@/routes/paths';

interface MarketplaceCartDrawerProps {
  isOpen: boolean;
  items: MarketplaceCartItem[];
  onClose: () => void;
  onRemoveItem: (listingId: string) => void;
  onCheckoutItem?: (listingId: string) => void;
}

export function MarketplaceCartDrawer({
  isOpen,
  items,
  onClose,
  onRemoveItem,
  onCheckoutItem,
}: MarketplaceCartDrawerProps) {
  const navigate = useNavigate();
  const { isApprovedMember, isAdmin } = useAuth();

  if (!isOpen) return null;

  const totalNgn = items
    .filter((i) => i.priceCurrency !== 'USD')
    .reduce((sum, i) => sum + i.priceAmount, 0);
  const totalUsd = items
    .filter((i) => i.priceCurrency === 'USD')
    .reduce((sum, i) => sum + i.priceAmount, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-xs"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-brand-gold/45 bg-brand-charcoal p-5 sm:p-6">
        <div className="flex items-center justify-between border-b hairline-border pb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-brand-gold" />
            <h2 className="font-heading text-sm font-semibold tracking-[0.18em] text-brand-white uppercase">
              Your Shopping Cart ({items.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-brand-muted hover:text-brand-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="py-10 text-center font-body text-xs text-brand-muted">
              Your cart is empty. Tap <strong>Cart</strong> on any product to save it here.
            </p>
          ) : (
            items.map((item) => {
              const sym = item.priceCurrency === 'USD' ? '$' : '₦';
              return (
                <div
                  key={item.listingId}
                  className="flex gap-3 border hairline-border bg-brand-black/80 p-3 text-xs"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-16 w-16 shrink-0 border hairline-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm text-brand-white">
                      {item.title}
                    </p>
                    <p className="mt-0.5 font-heading font-semibold text-brand-gold">
                      {sym}
                      {item.priceAmount.toLocaleString()}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-brand-muted">
                      @{item.sellerUsername}
                      {item.location ? (
                        <>
                          {' • '}
                          <MapPin className="inline h-2.5 w-2.5 text-brand-gold" />{' '}
                          {item.location}
                        </>
                      ) : null}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      {isApprovedMember || isAdmin ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            onClose();
                            if (onCheckoutItem) onCheckoutItem(item.listingId);
                            else navigate(`/dashboard/vendors?buy=${item.listingId}`);
                          }}
                        >
                          <MessageSquare className="h-3 w-3" />
                          Order &amp; Chat
                        </Button>
                      ) : (
                        <Button to={ROUTES.login} variant="primary" size="sm">
                          Sign In to Order
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.listingId)}
                        className="cursor-pointer p-1 text-brand-muted hover:text-rose-400"
                        aria-label="Remove from cart"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-4 border-t hairline-border pt-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-heading tracking-[0.14em] text-brand-muted uppercase">
                Cart Total
              </span>
              <span className="font-heading text-base font-semibold text-brand-gold">
                {totalNgn > 0 ? `₦${totalNgn.toLocaleString()}` : ''}
                {totalNgn > 0 && totalUsd > 0 ? ' + ' : ''}
                {totalUsd > 0 ? `$${totalUsd.toLocaleString()}` : ''}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-brand-muted">
              Click <strong>Order &amp; Chat</strong> on each item to coordinate payment &amp;
              delivery directly inside the site with the vendor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
