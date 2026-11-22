import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  MARKETPLACE_CATEGORY_LABELS,
  type ListingFormValues,
} from '@/features/marketplace/types/marketplace.types';
import type {
  MarketplaceCategoryCode,
  MarketplaceListingStatus,
  MarketplaceListingWithSellerRow,
} from '@/lib/supabase/database.types';

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
    priceCurrency: listing.price_currency,
    gameCurrencyAmount: listing.game_currency_amount
      ? String(listing.game_currency_amount)
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
    const price = Number(values.priceAmount);
    if (!Number.isFinite(price) || price <= 0) {
      setLocalError('Enter a valid asking price greater than 0.');
      return;
    }
    if (values.category === 'lagos_life_funds') {
      const qty = Number.parseInt(values.gameCurrencyAmount, 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        setLocalError(
          'Lagos Life Game Funds listings require a positive game-currency quantity.',
        );
        return;
      }
    }

    await onSubmit(values);
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
          {editingListing ? 'Edit Listing' : 'Submit New Listing'}
        </p>
        <h2
          id="listing-modal-title"
          className="heading-section mt-2 text-2xl text-brand-white"
        >
          {editingListing ? editingListing.title : 'Create Marketplace Listing'}
        </h2>
        <p className="mt-2 font-body text-xs text-brand-muted">
          {editingListing
            ? 'Updates apply directly to your eligible listing.'
            : 'All new listings enter pending moderation before becoming visible to the community.'}
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
              placeholder="e.g., 50B Lagos Life Funds — Fast Manual Delivery"
              className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="listing-price"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Asking Price
              </label>
              <input
                id="listing-price"
                type="number"
                step="0.01"
                min="0.01"
                required
                disabled={isSubmitting}
                value={values.priceAmount}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, priceAmount: e.target.value }))
                }
                placeholder="25000"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="listing-currency"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Currency
              </label>
              <input
                id="listing-currency"
                type="text"
                maxLength={10}
                required
                disabled={isSubmitting}
                value={values.priceCurrency}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, priceCurrency: e.target.value }))
                }
                placeholder="NGN"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white uppercase focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="listing-game-qty"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Game Funds Qty
              </label>
              <input
                id="listing-game-qty"
                type="number"
                min="1"
                required={values.category === 'lagos_life_funds'}
                disabled={isSubmitting}
                value={values.gameCurrencyAmount}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    gameCurrencyAmount: e.target.value,
                  }))
                }
                placeholder={
                  values.category === 'lagos_life_funds' ? 'Required' : 'Optional'
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

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
              placeholder="Describe what you are offering, delivery timing, and terms..."
              className="mt-2 w-full resize-y border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="listing-contact"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Seller Contact Note (Optional)
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
              placeholder="How buyers should coordinate payment directly (never post PINs/passwords)"
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
