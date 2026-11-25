import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Store,
  User,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import { ListingFormModal } from '@/features/marketplace/components/ListingFormModal';
import {
  ListingAvailabilityBadge,
  ListingModerationBadge,
} from '@/features/marketplace/components/MarketplaceBadges';
import { MarketplaceSafetyBanner } from '@/features/marketplace/components/MarketplaceSafetyBanner';
import { MemberMoneyPacksSection } from '@/features/marketplace/components/MemberMoneyPacksSection';
import {
  createListing,
  createPurchaseRequest,
  fetchMarketplaceListings,
  updateOwnListing,
} from '@/features/marketplace/services/marketplaceService';
import {
  MARKETPLACE_CATEGORY_LABELS,
  type ListingFormValues,
} from '@/features/marketplace/types/marketplace.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type {
  MarketplaceCategoryCode,
  MarketplaceListingWithSellerRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

const CATEGORY_FILTER_LABELS = [
  'All',
  'Lagos Life Game Funds',
  'Digital Goods',
  'Digital Services',
  'Community Products & Services',
] as const;
type CategoryFilterLabel = (typeof CATEGORY_FILTER_LABELS)[number];

const LABEL_TO_CODE: Record<
  Exclude<CategoryFilterLabel, 'All'>,
  MarketplaceCategoryCode
> = {
  'Lagos Life Game Funds': 'lagos_life_funds',
  'Digital Goods': 'digital_goods',
  'Digital Services': 'digital_services',
  'Community Products & Services': 'community_products',
};

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function MemberMarketplacePage() {
  const { user, profile } = useAuth();

  const [listings, setListings] = useState<MarketplaceListingWithSellerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'browse' | 'mine'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilterLabel>('All');

  // Create / Edit listing modal
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [editingListing, setEditingListing] =
    useState<MarketplaceListingWithSellerRow | null>(null);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [listingFormError, setListingFormError] = useState<string | null>(null);

  // Inspect / Purchase Request modal
  const [selectedListing, setSelectedListing] =
    useState<MarketplaceListingWithSellerRow | null>(null);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const loadListings = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const res = await fetchMarketplaceListings(null);
    if (res.error) setError(res.error);
    else setListings(res.listings);

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadListings(true);
  }, [loadListings]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((item) => {
      if (viewMode === 'mine') {
        if (item.seller_id !== user?.id) return false;
      } else {
        if (item.moderation_status !== 'approved') return false;
      }

      if (selectedCategory !== 'All') {
        if (item.category !== LABEL_TO_CODE[selectedCategory]) return false;
      }

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.seller_username.toLowerCase().includes(q)
      );
    });
  }, [listings, viewMode, selectedCategory, searchQuery, user?.id]);

  const openOrderModal = (listing: MarketplaceListingWithSellerRow) => {
    setSelectedListing(listing);
    setRecipientUsername(profile?.lagos_life_username ?? '');
    setRequestedQty(
      listing.game_currency_amount ? String(listing.game_currency_amount) : '',
    );
    setBuyerNote('');
    setOrderError(null);
  };

  const handleSaveListing = async (values: ListingFormValues) => {
    setIsSavingListing(true);
    setListingFormError(null);

    const res = editingListing
      ? await updateOwnListing(editingListing.id, values)
      : await createListing(values);

    setIsSavingListing(false);

    if (res.error) {
      setListingFormError(res.error);
      return;
    }

    setListingModalOpen(false);
    setEditingListing(null);
    setFeedback(
      editingListing
        ? 'Listing updated successfully.'
        : 'Listing submitted for administrator moderation.',
    );
    await loadListings(false);
  };

  const handleSubmitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedListing) return;

    if (
      selectedListing.category === 'lagos_life_funds' &&
      recipientUsername.trim().length < 2
    ) {
      setOrderError(
        'Enter the recipient Lagos Life username for game-currency delivery.',
      );
      return;
    }

    const parsedQty = requestedQty.trim()
      ? Number.parseInt(requestedQty.trim(), 10)
      : null;

    setOrderError(null);
    setIsSubmittingOrder(true);

    const res = await createPurchaseRequest({
      listingId: selectedListing.id,
      requestedGameCurrencyAmount: parsedQty,
      recipientLagosLifeUsername: recipientUsername,
      buyerNote,
    });

    setIsSubmittingOrder(false);

    if (res.error) {
      setOrderError(res.error);
      return;
    }

    setSelectedListing(null);
    setFeedback(
      'Purchase request submitted. Track progress and communicate under My Orders.',
    );
  };

  return (
    <div className="bg-brand-black">
      {/* Compact Header */}
      <section className="border-b hairline-border bg-brand-obsidian">
        <PageContainer className="py-5 sm:py-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="heading-display text-2xl text-brand-white sm:text-3xl">
              Marketplace
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadListings(false)}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
              <Button to={ROUTES.dashboardTreasury} variant="secondary" size="sm">
                <Send className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                Money Sender
              </Button>
              <Button to={ROUTES.dashboardMarketplaceOrders} variant="secondary" size="sm">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                My Orders
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingListing(null);
                  setListingFormError(null);
                  setListingModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Listing
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-6 py-6 sm:py-8">
        <MemberMoneyPacksSection />

        {feedback && (
          <div
            role="status"
            className="flex items-center justify-between gap-4 border border-brand-gold/45 bg-brand-charcoal p-4 text-xs text-brand-cream"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <p>{feedback}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="cursor-pointer font-heading text-[0.68rem] tracking-[0.18em] text-brand-muted uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* View Mode + Search + Category Filter */}
        <div className="space-y-4 border-b hairline-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode('browse')}
                className={cn(
                  'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.18em] uppercase',
                  viewMode === 'browse'
                    ? 'border-brand-gold bg-brand-gold text-brand-black'
                    : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
                )}
              >
                Browse Approved
              </button>
              <button
                type="button"
                onClick={() => setViewMode('mine')}
                className={cn(
                  'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.18em] uppercase',
                  viewMode === 'mine'
                    ? 'border-brand-gold bg-brand-gold text-brand-black'
                    : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
                )}
              >
                My Listings
              </button>
            </div>

            <div className="w-full sm:max-w-sm">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search title, description, or @seller..."
                ariaLabel="Search marketplace listings"
              />
            </div>
          </div>

          <CategoryFilter
            categories={CATEGORY_FILTER_LABELS}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            ariaLabel="Filter listings by category"
          />
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((slot) => (
              <div
                key={slot}
                className="h-64 animate-pulse border hairline-border bg-brand-charcoal/45"
              />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <EmptyState
            icon={<Store className="h-4 w-4" aria-hidden="true" />}
            eyebrow={viewMode === 'mine' ? 'Your Listings' : 'Marketplace'}
            title={
              viewMode === 'mine'
                ? 'You Have Not Created Any Listings Yet'
                : 'No Approved Listings Found'
            }
            description={
              viewMode === 'mine'
                ? 'Create a listing to offer Lagos Life game funds, digital goods, digital services, or approved community products.'
                : 'Approved community listings will appear here once submitted and reviewed by VATAR administrators.'
            }
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingListing(null);
                  setListingFormError(null);
                  setListingModalOpen(true);
                }}
              >
                Create Listing
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((listing) => {
              const isOwn = listing.seller_id === user?.id;
              const canEdit =
                isOwn &&
                listing.moderation_status !== 'rejected' &&
                listing.moderation_status !== 'removed';

              return (
                <article
                  key={listing.id}
                  className="flex flex-col justify-between border hairline-border bg-brand-charcoal/65 p-6 transition-colors hover:border-brand-gold/45"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-body text-[0.65rem] tracking-[0.2em] text-brand-gold uppercase">
                        {MARKETPLACE_CATEGORY_LABELS[listing.category]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <ListingAvailabilityBadge status={listing.status} />
                        {viewMode === 'mine' && (
                          <ListingModerationBadge status={listing.moderation_status} />
                        )}
                      </div>
                    </div>

                    <h2 className="heading-section mt-4 text-xl text-brand-white">
                      {listing.title}
                    </h2>
                    <p className="mt-2.5 line-clamp-3 font-body text-sm leading-relaxed text-brand-muted">
                      {listing.description}
                    </p>

                    {listing.game_currency_amount !== null && (
                      <p className="mt-4 inline-block border border-brand-gold/30 bg-brand-black px-3 py-1 font-heading text-xs tracking-[0.14em] text-brand-cream uppercase">
                        Game Funds: ₦{listing.game_currency_amount.toLocaleString()}
                      </p>
                    )}

                    {viewMode === 'mine' && listing.moderation_note && (
                      <p className="mt-3 border-l border-brand-gold/40 pl-3 font-body text-xs text-brand-cream/80">
                        Admin note: {listing.moderation_note}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 border-t hairline-border pt-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="font-body text-[0.62rem] tracking-[0.2em] text-brand-muted uppercase">
                          Asking Price
                        </p>
                        <p className="mt-0.5 font-heading text-2xl text-brand-gold">
                          {formatMoney(listing.price_amount, listing.price_currency)}
                        </p>
                      </div>
                      <p className="inline-flex items-center gap-1.5 font-body text-xs text-brand-cream">
                        <User className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                        @{listing.seller_username}
                      </p>
                    </div>

                    <div className="mt-5 flex gap-2">
                      {isOwn ? (
                        canEdit ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setEditingListing(listing);
                              setListingFormError(null);
                              setListingModalOpen(true);
                            }}
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit / Availability
                          </Button>
                        ) : (
                          <span className="w-full border hairline-border bg-brand-black py-2 text-center font-body text-xs text-brand-muted">
                            Moderation locked ({listing.moderation_status})
                          </span>
                        )
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          disabled={listing.status !== 'available'}
                          onClick={() => openOrderModal(listing)}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                          {listing.status === 'available'
                            ? 'Inspect & Request'
                            : 'Unavailable'}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PageContainer>

      <ListingFormModal
        isOpen={listingModalOpen}
        editingListing={editingListing}
        isSubmitting={isSavingListing}
        error={listingFormError}
        onClose={() => {
          if (!isSavingListing) {
            setListingModalOpen(false);
            setEditingListing(null);
          }
        }}
        onSubmit={handleSaveListing}
      />

      {/* Listing Detail & Purchase Request Modal */}
      {selectedListing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-8">
            <button
              type="button"
              onClick={() => !isSubmittingOrder && setSelectedListing(null)}
              aria-label="Close purchase modal"
              className="absolute top-5 right-5 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <p className="heading-eyebrow">
              {MARKETPLACE_CATEGORY_LABELS[selectedListing.category]}
            </p>
            <h2
              id="purchase-modal-title"
              className="heading-section mt-2 text-2xl text-brand-white"
            >
              {selectedListing.title}
            </h2>
            <p className="mt-2 font-body text-sm text-brand-muted">
              {selectedListing.description}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 border hairline-border bg-brand-black/70 p-4 text-xs">
              <div>
                <dt className="text-brand-muted uppercase">Seller</dt>
                <dd className="mt-0.5 text-brand-cream">
                  @{selectedListing.seller_username}
                </dd>
              </div>
              <div>
                <dt className="text-brand-muted uppercase">Asking Price</dt>
                <dd className="mt-0.5 font-heading text-base text-brand-gold">
                  {formatMoney(
                    selectedListing.price_amount,
                    selectedListing.price_currency,
                  )}
                </dd>
              </div>
              {selectedListing.seller_contact_note && (
                <div className="col-span-2 border-t hairline-border pt-2">
                  <dt className="text-brand-muted uppercase">Seller Contact Note</dt>
                  <dd className="mt-0.5 text-brand-cream/90">
                    {selectedListing.seller_contact_note}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-4">
              <MarketplaceSafetyBanner compact />
            </div>

            {orderError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 border border-red-400/40 bg-red-950/30 p-3 text-xs text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                <p>{orderError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitOrder} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="order-recipient"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Recipient Lagos Life Username
                  {selectedListing.category === 'lagos_life_funds'
                    ? ' (Required)'
                    : ' (Optional)'}
                </label>
                <input
                  id="order-recipient"
                  type="text"
                  required={selectedListing.category === 'lagos_life_funds'}
                  disabled={isSubmittingOrder}
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  placeholder="Exact public in-game username"
                  className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              {selectedListing.category === 'lagos_life_funds' && (
                <div>
                  <label
                    htmlFor="order-qty"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Requested Game Currency Amount
                  </label>
                  <input
                    id="order-qty"
                    type="number"
                    min="1"
                    disabled={isSubmittingOrder}
                    value={requestedQty}
                    onChange={(e) => setRequestedQty(e.target.value)}
                    className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="order-note"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Note To Seller (Optional)
                </label>
                <textarea
                  id="order-note"
                  rows={2}
                  disabled={isSubmittingOrder}
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Coordination note (never include PINs, passwords, or OTPs)"
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmittingOrder}
                  onClick={() => setSelectedListing(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingOrder}
                >
                  {isSubmittingOrder ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Purchase Request'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
