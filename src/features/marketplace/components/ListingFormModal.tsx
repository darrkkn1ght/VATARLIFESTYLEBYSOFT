import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, ImagePlus, Loader2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  compressAndUploadListingPhoto,
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
const LOCATION_PRESETS = [
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Ibadan',
  'Nationwide Delivery',
  'Online / Instant Digital',
] as const;

interface ListingFormModalProps {
  isOpen: boolean;
  editingListing: MarketplaceListingWithSellerRow | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ListingFormValues) => Promise<void>;
}

const CATEGORIES: readonly MarketplaceCategoryCode[] = [
  'digital_goods',
  'digital_services',
  'cars_vehicles',
  'fashion_clothing',
  'gadgets_electronics',
  'real_estate',
  'community_products',
  'lagos_life_funds',
];

function buildInitial(
  listing: MarketplaceListingWithSellerRow | null,
): ListingFormValues {
  if (!listing) {
    return {
      category: 'digital_goods',
      title: '',
      description: '',
      priceAmount: '',
      priceCurrency: 'NGN',
      gameCurrencyAmount: '',
      sellerContactNote: '',
      location: '',
      imageUrls: [],
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
    location: listing.location ?? '',
    imageUrls: Array.isArray(listing.image_urls) ? listing.image_urls : [],
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
  const { user, isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<ListingFormValues>(() =>
    buildInitial(editingListing),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setValues(buildInitial(editingListing));
    setLocalError(null);
    setManualImageUrl('');
  }, [isOpen, editingListing]);

  if (!isOpen) return null;

  const parsedGameQty = values.gameCurrencyAmount.trim()
    ? parseGameFundsInput(values.gameCurrencyAmount)
    : null;
  const parsedRealPrice = parseRealPriceInput(values.priceAmount);
  const currencySymbol = values.priceCurrency === 'USD' ? '$' : '₦';

  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !user) return;

    const remainingSlots = Math.max(0, 4 - values.imageUrls.length);
    if (remainingSlots === 0) {
      setLocalError('You can attach up to 4 product photos per listing.');
      return;
    }

    setUploadingPhotos(true);
    setLocalError(null);

    const nextUrls: string[] = [];
    for (const file of files.slice(0, remainingSlots)) {
      const res = await compressAndUploadListingPhoto(file, user.id);
      if (res.error || !res.url) {
        setLocalError(res.error || 'Could not upload photo.');
        break;
      }
      nextUrls.push(res.url);
    }

    if (nextUrls.length > 0) {
      setValues((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...nextUrls].slice(0, 4),
      }));
    }
    setUploadingPhotos(false);
  };

  const handleAddManualUrl = () => {
    const trimmed = manualImageUrl.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setLocalError('Image link must start with https:// or http://');
      return;
    }
    if (values.imageUrls.length >= 4) {
      setLocalError('Maximum 4 product photos allowed.');
      return;
    }
    setLocalError(null);
    setValues((prev) => ({
      ...prev,
      imageUrls: [...prev.imageUrls, trimmed].slice(0, 4),
    }));
    setManualImageUrl('');
  };

  const handleRemoveImage = (idx: number) => {
    setValues((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== idx),
    }));
  };

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
      setLocalError('Enter the real-money price the buyer pays (e.g. 15000).');
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
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-8">
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
          {editingListing ? 'Edit Product / Listing' : 'Post to VATAR Marketplace'}
        </p>
        <h2
          id="listing-modal-title"
          className="heading-section mt-2 text-2xl text-brand-white"
        >
          {editingListing
            ? editingListing.title
            : 'Sell Digital Products, Cars, Fashion, Gadgets or Game Funds'}
        </h2>
        <p className="mt-1.5 font-body text-xs text-brand-muted">
          {editingListing
            ? 'Updates apply directly to your listing.'
            : isAdmin
              ? 'Admin listing: goes live on the public Marketplace immediately!'
              : 'Once approved, your product appears publicly with photos, location, likes, comments & social share links.'}
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none disabled:opacity-60"
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
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
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
              Product / Service Title
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
              placeholder={
                values.category === 'cars_vehicles'
                  ? 'e.g., 2020 Mercedes-Benz GLE 450 — Foreign Used'
                  : values.category === 'fashion_clothing'
                    ? 'e.g., Luxury Designer Two-Piece Set (All Sizes)'
                    : values.category === 'digital_goods'
                      ? 'e.g., Complete Digital Marketing Course & Templates'
                      : values.category === 'lagos_life_funds'
                        ? 'e.g., 1T Lagos Life Funds — Instant Delivery'
                        : 'What are you selling?'
              }
              className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          {/* PRODUCT PHOTOS UPLOADER (Up to 4 images) */}
          <div className="border hairline-border bg-brand-black/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-heading text-xs tracking-[0.16em] text-brand-gold uppercase">
                  Product Photos ({values.imageUrls.length}/4)
                </p>
                <p className="mt-0.5 font-body text-[11px] text-brand-muted">
                  Upload clear photos of your car, clothes, gadget, or digital product cover.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handlePhotoSelect(e)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingPhotos || values.imageUrls.length >= 4}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingPhotos ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-gold" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-3.5 w-3.5 text-brand-gold" />
                      Upload Photos
                    </>
                  )}
                </Button>
              </div>
            </div>

            {values.imageUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {values.imageUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="group relative aspect-square overflow-hidden border hairline-border bg-brand-charcoal"
                  >
                    <img
                      src={url}
                      alt={`Product preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 cursor-pointer bg-black/80 p-1 text-rose-300 hover:text-rose-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {values.imageUrls.length < 4 && (
              <div className="mt-3 flex gap-2">
                <input
                  type="url"
                  value={manualImageUrl}
                  onChange={(e) => setManualImageUrl(e.target.value)}
                  placeholder="Or paste an image link (https://...)"
                  className="flex-1 border hairline-border bg-brand-black px-3 py-1.5 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddManualUrl}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Link
                </Button>
              </div>
            )}
          </div>

          {/* IN-GAME FUNDS QUANTITY (when selling Lagos Life Game Funds) */}
          {values.category === 'lagos_life_funds' && (
            <div className="border hairline-border bg-brand-black/55 p-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="listing-game-qty"
                  className="block font-heading text-xs tracking-[0.16em] text-brand-gold uppercase"
                >
                  In-Game Funds Buyer Receives
                </label>
                {parsedGameQty && (
                  <span className="border border-brand-gold/40 bg-brand-gold/15 px-2 py-0.5 font-mono text-[11px] text-brand-gold">
                    {formatGameFundsShort(parsedGameQty)} Game Funds
                  </span>
                )}
              </div>
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
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                        'cursor-pointer border px-2.5 py-0.5 font-mono text-xs transition-colors',
                        isSelected
                          ? 'border-brand-gold bg-brand-gold font-semibold text-brand-black'
                          : 'hairline-border bg-brand-charcoal text-brand-cream hover:border-brand-gold',
                      )}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PRICE TAG + STORE / ITEM LOCATION */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border hairline-border bg-brand-black/55 p-4">
              <label
                htmlFor="listing-price"
                className="block font-heading text-xs tracking-[0.16em] text-brand-cream uppercase"
              >
                Price Tag (Real Money)
              </label>
              <p className="mt-0.5 font-body text-[11px] text-brand-muted">
                e.g. <strong className="text-brand-cream">15000</strong> ={' '}
                <strong className="text-brand-gold">₦15,000</strong>
              </p>
              <div className="mt-2 flex items-stretch gap-2">
                <select
                  aria-label="Payment currency"
                  disabled={isSubmitting}
                  value={values.priceCurrency}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, priceCurrency: e.target.value }))
                  }
                  className="w-24 shrink-0 border hairline-border bg-brand-charcoal px-2 py-2 font-heading text-xs text-brand-gold uppercase focus:border-brand-gold focus:outline-none"
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
                  placeholder={values.priceCurrency === 'USD' ? 'e.g. 50' : 'e.g. 25000'}
                  className="w-full border hairline-border bg-brand-black px-3 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>
            </div>

            <div className="border hairline-border bg-brand-black/55 p-4">
              <label
                htmlFor="listing-location"
                className="flex items-center gap-1.5 font-heading text-xs tracking-[0.16em] text-brand-cream uppercase"
              >
                <MapPin className="h-3.5 w-3.5 text-brand-gold" />
                Store / Item Location
              </label>
              <p className="mt-0.5 font-body text-[11px] text-brand-muted">
                Physical store address/city, or Online for digital items.
              </p>
              <input
                id="listing-location"
                type="text"
                maxLength={120}
                disabled={isSubmitting}
                value={values.location}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="e.g. Lekki Phase 1, Lagos"
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-heading text-[10px] tracking-[0.14em] text-brand-muted uppercase">
              Quick Location:
            </span>
            {LOCATION_PRESETS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, location: loc }))}
                className={cn(
                  'cursor-pointer border px-2 py-0.5 font-body text-[11px]',
                  values.location === loc
                    ? 'border-brand-gold bg-brand-gold font-semibold text-brand-black'
                    : 'hairline-border bg-brand-black text-brand-cream hover:border-brand-gold',
                )}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* LIVE CLEAR DEAL PREVIEW */}
          {parsedRealPrice && (values.category !== 'lagos_life_funds' || parsedGameQty) && (
            <div className="border border-brand-gold/45 bg-brand-gold/10 px-4 py-2.5 text-xs text-brand-cream">
              <span className="font-heading tracking-[0.14em] text-brand-gold uppercase">
                Preview:{' '}
              </span>
              <strong className="text-brand-white">
                {values.title || MARKETPLACE_CATEGORY_LABELS[values.category]}
              </strong>{' '}
              &mdash;{' '}
              <strong className="text-brand-gold">
                {currencySymbol}
                {parsedRealPrice.toLocaleString()} ({values.priceCurrency})
              </strong>
              {values.location ? ` • 📍 ${values.location}` : ''}
            </div>
          )}

          <div>
            <label
              htmlFor="listing-description"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Full Product / Service Details
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
              placeholder="Describe specifications, condition, how to learn/download (for digital), or inspection/delivery details..."
              className="mt-1.5 w-full resize-y border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="listing-contact"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Store Contact / Delivery Note (Optional)
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
              placeholder="e.g., Walk-in inspection at Lekki or click Order to chat me directly inside VATAR"
              className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t hairline-border pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSubmitting || uploadingPhotos}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || uploadingPhotos}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Publishing...
                </>
              ) : editingListing ? (
                'Save Changes'
              ) : isAdmin ? (
                'Publish Live Now'
              ) : (
                'Submit Product'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
