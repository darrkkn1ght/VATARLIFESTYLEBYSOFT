import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  formatGameFundsShort,
  parseGameFundsInput,
  parseRealPriceInput,
} from '@/features/marketplace/services/marketplaceService';
import {
  MARKETPLACE_CATEGORY_LABELS,
  type ListingFormValues,
} from '@/features/marketplace/types/marketplace.types';
import type {
  MarketplaceCategoryCode,
  MarketplaceListingStatus,
  MarketplaceListingWithSellerRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

const GAME_FUNDS_PRESETS = ['100B', '500B', '1T', '5T', '10T', '50T'] as const;

interface ListingFormModalProps {
  isOpen: boolean;
  editingListing: MarketplaceListingWithSellerRow | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ListingFormValues) => Promise<void>;
}

const CATEGORIES: readonly MarketplaceCategoryCode[] = [
  'lagos_life_funds',
  'digital_goods',
  'digital_services',
  'community_products',
];

function buildInitial(
  listing: MarketplaceListingWithSellerRow | null,
): ListingFormValues {
  if (!listing) {
    return {
      category: 'lagos_life_funds',
      title: '',
      description: '',
      priceAmount: '',
      priceCurrency: 'NGN',
      gameCurrencyAmount: '',
      sellerContactNote: '',
      status: 'available',
    };
  }
  return {
    category: listing.category,
    title: listing.title,
    description: listing.description,
    priceAmount: String(listing.price_amount),
    priceCurrency: listing.price_currency || 'NGN',
    gameCurrencyAmount: listing.game_currency_amount
      ? formatGameFundsShort(listing.game_currency_amount)
      : '',
    sellerContactNote: listing.seller_contact_note ?? '',
    status: listing.status,
  };
}

export function ListingFormModal({
  isOpen,
  editingListing,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ListingFormModalProps) {
  const [values, setValues] = useState<ListingFormValues>(() =>
    buildInitial(editingListing),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(buildInitial(editingListing));
    setLocalError(null);
  }, [isOpen, editingListing]);

  if (!isOpen) return null;

  const parsedGameQty = values.gameCurrencyAmount.trim()
    ? parseGameFundsInput(values.gameCurrencyAmount)
    : null;
  const parsedRealPrice = parseRealPriceInput(values.priceAmount);
  const currencySymbol = values.priceCurrency === 'USD' ? '$' : '₦';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (values.title.trim().length < 4) {
      setLocalError('Title must be at least 4 characters.');
      return;
    }
    if (values.description.trim().length < 10) {
      setLocalError('Description must be at least 10 characters.');
      return;
    }
    if (!parsedRealPrice || parsedRealPrice <= 0) {
      setLocalError('Enter the real-money price the buyer pays (e.g. 1500).');
      return;
    }
    if (values.category === 'lagos_life_funds') {
      if (!parsedGameQty || parsedGameQty <= 0) {
        setLocalError(
          'Select or type how much Game Funds you are selling (e.g. 100B, 500B, or 1T).',
        );
        return;
      }
    } else if (values.gameCurrencyAmount.trim() && !parsedGameQty) {
      setLocalError('Enter a valid Game Funds quantity such as 100B or 1T.');
      return;
    }

    await onSubmit({
      ...values,
      priceAmount: String(parsedRealPrice),
    });
  };

  const displayError = localError ?? error;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close listing form"
          className="absolute top-5 right-5 cursor-pointer p-1 text-brand-muted hover:text-brand-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <p className="heading-eyebrow">
          {editingListing ? 'Edit Vendor Listing' : 'New Vendor Listing'}
        </p>
        <h2
          id="listing-modal-title"
          className="heading-section mt-2 text-2xl text-brand-white"
        >
          {editingListing ? editingListing.title : 'Create Vendor Listing'}
        </h2>
        <p className="mt-2 font-body text-xs text-brand-muted">
          {editingListing
            ? 'Updates apply directly to your listing.'
            : 'Once approved by Admin, buyers can order from your Vendor Page and chat with you directly inside the site.'}
        </p>

        {displayError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 border border-red-400/40 bg-red-950/30 p-3.5 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{displayError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="listing-category"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Category
              </label>
              <select
                id="listing-category"
                disabled={isSubmitting || Boolean(editingListing)}
                value={values.category}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    category: e.target.value as MarketplaceCategoryCode,
                  }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none disabled:opacity-60"
              >
                {CATEGORIES.map((code) => (
                  <option key={code} value={code}>
                    {MARKETPLACE_CATEGORY_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>

            {editingListing && (
              <div>
                <label
                  htmlFor="listing-status"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Availability
                </label>
                <select
                  id="listing-status"
                  disabled={isSubmitting}
                  value={values.status}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      status: e.target.value as MarketplaceListingStatus,
                    }))
                  }
                  className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="listing-title"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Listing Title
            </label>
            <input
              id="listing-title"
              type="text"
              required
              disabled={isSubmitting}
              value={values.title}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g., 1T Lagos Life Funds — Instant Delivery"
              className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          {/* 1. IN-GAME FUNDS QUANTITY (when selling Lagos Life Game Funds) */}
          {values.category === 'lagos_life_funds' && (
            <div className="border hairline-border bg-brand-black/55 p-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="listing-game-qty"
                  className="block font-heading text-xs tracking-[0.16em] text-brand-gold uppercase"
                >
                  1. In-Game Funds Buyer Receives
                </label>
                {parsedGameQty && (
                  <span className="border border-brand-gold/40 bg-brand-gold/15 px-2 py-0.5 font-mono text-[11px] text-brand-gold">
                    {formatGameFundsShort(parsedGameQty)} Game Funds
                  </span>
                )}
              </div>
              <p className="mt-1 font-body text-[11px] text-brand-muted">
                How much LagosLife in-game currency you are selling in this pack (type{' '}
                <strong className="text-brand-cream">100B</strong>,{' '}
                <strong className="text-brand-cream">500B</strong>,{' '}
                <strong className="text-brand-cream">1T</strong>, etc. or tap below).
              </p>

              <input
                id="listing-game-qty"
                type="text"
                inputMode="text"
                required
                disabled={isSubmitting}
                value={values.gameCurrencyAmount}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    gameCurrencyAmount: e.target.value,
                  }))
                }
                placeholder="e.g. 100B, 500B, 1T, 5T"
                className="mt-2.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-heading text-[10px] tracking-[0.14em] text-brand-muted uppercase">
                  Tap Amount:
                </span>
                {GAME_FUNDS_PRESETS.map((preset) => {
                  const isSelected =
                    values.gameCurrencyAmount.trim().toUpperCase() === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          gameCurrencyAmount: preset,
                        }))
                      }
                      className={cn(
                        'cursor-pointer border px-2.5 py-1 font-mono text-xs transition-colors',
                        isSelected
                          ? 'border-brand-gold bg-brand-gold font-semibold text-brand-black'
                          : 'hairline-border bg-brand-charcoal text-brand-cream hover:border-brand-gold hover:text-brand-gold',
                      )}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. REAL-MONEY BANK PRICE BUYER PAYS */}
          <div className="border hairline-border bg-brand-black/55 p-4">
            <label
              htmlFor="listing-price"
              className="block font-heading text-xs tracking-[0.16em] text-brand-cream uppercase"
            >
              {values.category === 'lagos_life_funds'
                ? '2. Real-Money Price Buyer Pays You'
                : 'Real-Money Price Buyer Pays You'}
            </label>
            <p className="mt-1 font-body text-[11px] text-brand-muted">
              How much real cash (bank transfer) the buyer pays for this listing — e.g.{' '}
              <strong className="text-brand-cream">1500</strong> means{' '}
              <strong className="text-brand-gold">₦1,500</strong>.
            </p>

            <div className="mt-2.5 flex items-stretch gap-2">
              <select
                aria-label="Payment currency"
                disabled={isSubmitting}
                value={values.priceCurrency}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, priceCurrency: e.target.value }))
                }
                className="w-28 shrink-0 border hairline-border bg-brand-charcoal px-2.5 py-2.5 font-heading text-xs tracking-[0.12em] text-brand-gold uppercase focus:border-brand-gold focus:outline-none"
              >
                <option value="NGN">₦ NGN</option>
                <option value="USD">$ USD</option>
              </select>

              <input
                id="listing-price"
                type="text"
                inputMode="decimal"
                required
                disabled={isSubmitting}
                value={values.priceAmount}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, priceAmount: e.target.value }))
                }
                placeholder={values.priceCurrency === 'USD' ? 'e.g. 10' : 'e.g. 1500'}
                className="w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          {/* LIVE CLEAR DEAL PREVIEW */}
          {parsedRealPrice && (values.category !== 'lagos_life_funds' || parsedGameQty) && (
            <div className="border border-brand-gold/45 bg-brand-gold/10 px-4 py-3 text-xs text-brand-cream">
              <span className="font-heading tracking-[0.14em] text-brand-gold uppercase">
                Listing Summary:{' '}
              </span>
              {values.category === 'lagos_life_funds' && parsedGameQty ? (
                <>
                  Buyer receives{' '}
                  <strong className="text-brand-white">
                    {formatGameFundsShort(parsedGameQty)} LagosLife Funds
                  </strong>{' '}
                  &rarr; Buyer pays you{' '}
                  <strong className="text-brand-gold">
                    {currencySymbol}
                    {parsedRealPrice.toLocaleString()} ({values.priceCurrency})
                  </strong>{' '}
                  in real money.
                </>
              ) : (
                <>
                  Buyer pays you{' '}
                  <strong className="text-brand-gold">
                    {currencySymbol}
                    {parsedRealPrice.toLocaleString()} ({values.priceCurrency})
                  </strong>{' '}
                  for <strong className="text-brand-white">{values.title || 'this item'}</strong>.
                </>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="listing-description"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Description
            </label>
            <textarea
              id="listing-description"
              rows={3}
              required
              disabled={isSubmitting}
              value={values.description}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe your delivery speed, availability, and terms..."
              className="mt-2 w-full resize-y border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="listing-contact"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Payment / Chat Note (Optional)
            </label>
            <input
              id="listing-contact"
              type="text"
              maxLength={240}
              disabled={isSubmitting}
              value={values.sellerContactNote}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, sellerContactNote: e.target.value }))
              }
              placeholder="e.g., Place order to chat me directly inside the site for bank details"
              className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t hairline-border pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : editingListing ? (
                'Save Listing'
              ) : (
                'Submit For Moderation'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
