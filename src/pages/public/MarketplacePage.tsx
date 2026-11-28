import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Bookmark,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Share2,
  ShoppingCart,
  Store,
  X,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ListingFormModal } from '@/features/marketplace/components/ListingFormModal';
import { MarketplaceCartDrawer } from '@/features/marketplace/components/MarketplaceCartDrawer';
import { SocialProductCard } from '@/features/marketplace/components/SocialProductCard';
import {
  createListing,
  createPurchaseRequest,
  fetchMarketplaceListings,
  loadMarketplaceCart,
  removeFromMarketplaceCart,
  toggleMarketplaceCartItem,
  updateOwnListing,
  type MarketplaceCartItem,
} from '@/features/marketplace/services/marketplaceService';
import {
  MARKETPLACE_CATEGORY_LABELS,
  type ListingFormValues,
} from '@/features/marketplace/types/marketplace.types';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import {
  OrderChatModal,
  type OrderChatContext,
} from '@/features/vendors/components/OrderChatModal';
import {
  fetchVendorStores,
  sendOrderChatMessage,
} from '@/features/vendors/services/vendorService';
import type {
  MarketplaceCategoryCode,
  MarketplaceListingWithSellerRow,
  VendorStoreDirectoryRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

const CATEGORY_TABS: readonly { key: 'all' | MarketplaceCategoryCode; label: string }[] = [
  { key: 'all', label: 'All Items' },
  { key: 'digital_goods', label: 'Digital Products' },
  { key: 'digital_services', label: 'Digital Services' },
  { key: 'cars_vehicles', label: 'Cars & Autos' },
  { key: 'fashion_clothing', label: 'Fashion & Clothes' },
  { key: 'gadgets_electronics', label: 'Phones & Gadgets' },
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'community_products', label: 'Store Items' },
  { key: 'lagos_life_funds', label: 'LagosLife Funds' },
];

export function MarketplacePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAuthenticated, isApprovedMember, isAdmin } = useAuth();

  const deepLinkItemId = searchParams.get('item');
  const vendorSlugFilter = searchParams.get('vendor');

  const [listings, setListings] = useState<MarketplaceListingWithSellerRow[]>([]);
  const [stores, setStores] = useState<VendorStoreDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | MarketplaceCategoryCode>(
    'all',
  );
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<MarketplaceCartItem[]>(() =>
    loadMarketplaceCart(),
  );
  const [cartOpen, setCartOpen] = useState(false);

  // Post / Edit Listing modal
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [editingListing, setEditingListing] =
    useState<MarketplaceListingWithSellerRow | null>(null);
  const [savingListing, setSavingListing] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);

  // Order + Direct In-Site Chat modal
  const [orderingListing, setOrderingListing] =
    useState<MarketplaceListingWithSellerRow | null>(null);
  const [recipientHandle, setRecipientHandle] = useState(
    profile?.lagos_life_username ?? '',
  );
  const [buyerNote, setBuyerNote] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeChat, setActiveChat] = useState<OrderChatContext | null>(null);

  const loadMarketplace = useCallback(async () => {
    setError(null);
    const [listingsRes, storesRes] = await Promise.all([
      fetchMarketplaceListings(null),
      fetchVendorStores(),
    ]);
    if (listingsRes.error) {
      setError(listingsRes.error);
    } else {
      setListings(listingsRes.listings);
    }
    if (!storesRes.error) {
      setStores(storesRes.stores);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    const syncCart = () => setCartItems(loadMarketplaceCart());
    window.addEventListener('vatar:cart-updated', syncCart);
    return () => window.removeEventListener('vatar:cart-updated', syncCart);
  }, []);

  const cartIds = useMemo(
    () => new Set(cartItems.map((i) => i.listingId)),
    [cartItems],
  );

  const activeVendorFilter = useMemo(
    () =>
      vendorSlugFilter
        ? stores.find((s) => s.slug.toLowerCase() === vendorSlugFilter.toLowerCase()) ?? null
        : null,
    [stores, vendorSlugFilter],
  );

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((item) => {
      const isOwn = Boolean(user && item.seller_id === user.id);
      if (!isOwn && (item.moderation_status !== 'approved' || item.status !== 'available')) {
        return false;
      }
      if (activeVendorFilter && item.seller_id !== activeVendorFilter.owner_id) {
        return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (onlyFavorites && !item.viewer_has_favorited) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.seller_username.toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.vendor_store_name || '').toLowerCase().includes(q) ||
        MARKETPLACE_CATEGORY_LABELS[item.category].toLowerCase().includes(q)
      );
    });
  }, [listings, user, activeVendorFilter, selectedCategory, onlyFavorites, searchQuery]);

  const handleToggleCart = (listing: MarketplaceListingWithSellerRow) => {
    const res = toggleMarketplaceCartItem(listing);
    setCartItems(res.items);
  };

  const handleFavoriteChanged = (listingId: string, favorited: boolean) => {
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, viewer_has_favorited: favorited } : l)),
    );
  };

  const handleSaveListing = async (values: ListingFormValues) => {
    setListingError(null);
    setSavingListing(true);

    const res = editingListing
      ? await updateOwnListing(editingListing.id, values)
      : await createListing(values);

    setSavingListing(false);
    if (res.error) {
      setListingError(res.error);
      return;
    }

    setListingModalOpen(false);
    setEditingListing(null);
    setFeedback(
      editingListing
        ? 'Product listing updated!'
        : isAdmin
          ? 'Your product is now live on the public Marketplace!'
          : 'Product submitted for moderation — once approved, it appears live on the public Marketplace!',
    );
    await loadMarketplace();
  };

  const handlePlaceOrderAndChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderingListing) return;

    setPlacingOrder(true);
    setError(null);
    const res = await createPurchaseRequest({
      listingId: orderingListing.id,
      requestedGameCurrencyAmount: orderingListing.game_currency_amount,
      recipientLagosLifeUsername: recipientHandle,
      buyerNote,
    });
    setPlacingOrder(false);

    if (res.error || !res.order) {
      setError(res.error || 'Could not place order.');
      return;
    }

    const target = orderingListing;
    if (buyerNote.trim()) {
      await sendOrderChatMessage(res.order.id, buyerNote.trim());
    }
    setOrderingListing(null);
    setBuyerNote('');
    setActiveChat({
      orderId: res.order.id,
      orderTitle: target.title,
      counterpartyLabel: `Vendor @${target.seller_username}`,
      agreedPriceLabel: `${target.price_currency} ${Number(target.price_amount).toLocaleString()}`,
    });
  };

  const handleShareMarketplace = async () => {
    const url = `${window.location.origin}${ROUTES.marketplace}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'VATAR Marketplace — Cars, Fashion, Gadgets, Digital Products & Funds',
          text: 'Shop verified vendors, digital products, cars, clothes & LagosLife funds on VATAR Marketplace!',
          url,
        });
        return;
      } catch {
        // ignore
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Marketplace share link copied to clipboard!');
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-brand-black">
      {/* Compact High-Impact Marketplace Hero */}
      <section className="border-b hairline-border bg-brand-obsidian py-8 sm:py-12">
        <PageContainer>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="heading-eyebrow">Real-Life &bull; Digital &bull; Game Commerce</p>
              <h1 className="heading-display mt-2 text-3xl text-brand-white sm:text-5xl">
                VATAR Marketplace
              </h1>
              <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Buy &amp; sell digital products, courses, services, cars, fashion, gadgets,
                and LagosLife funds — with store locations, likes, comments, cart, and direct
                in-site vendor chat.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingCart className="h-3.5 w-3.5 text-brand-gold" />
                Cart ({cartItems.length})
              </Button>

              <Button
                variant="subtle"
                size="sm"
                onClick={() => void handleShareMarketplace()}
              >
                <Share2 className="h-3.5 w-3.5 text-brand-gold" />
                Share Market
              </Button>

              {isApprovedMember || isAdmin ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingListing(null);
                    setListingError(null);
                    setListingModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Sell a Product
                </Button>
              ) : (
                <Button
                  to={isAuthenticated ? ROUTES.membershipStatus : ROUTES.login}
                  variant="primary"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Sign In to Sell
                </Button>
              )}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Safety Notice */}
      <section className="border-b hairline-border bg-brand-charcoal/80">
        <PageContainer className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs">
          <div className="flex items-center gap-2.5 text-brand-cream/90">
            <AlertTriangle className="h-4 w-4 shrink-0 text-brand-gold" />
            <span>
              Verify physical items at safe public locations and keep vendor order chats inside
              VATAR. Never share banking PINs or OTPs.
            </span>
          </div>
          <Link
            to={ROUTES.dashboardMarketplace}
            className="font-heading tracking-[0.16em] text-brand-gold uppercase hover:underline"
          >
            Official Currency Store &rarr;
          </Link>
        </PageContainer>
      </section>

      <PageContainer className="space-y-8 py-8 sm:py-10">
        {feedback && (
          <div className="flex items-center justify-between border border-brand-gold/45 bg-brand-charcoal px-4 py-3 text-xs text-brand-cream">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 border border-rose-500/40 bg-rose-950/35 px-4 py-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Active Vendor Filter Banner (when visiting /marketplace?vendor=slug) */}
        {activeVendorFilter && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-brand-gold/55 bg-brand-charcoal p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-sm font-semibold text-brand-white">
                  {activeVendorFilter.store_name}
                </span>
                <span className="font-mono text-xs text-brand-gold">
                  @{activeVendorFilter.owner_username}
                </span>
                {activeVendorFilter.is_verified && (
                  <BadgeCheck className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              {activeVendorFilter.store_location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-brand-muted">
                  <MapPin className="h-3 w-3 text-brand-gold" />
                  {activeVendorFilter.store_location}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('vendor');
                setSearchParams(next);
              }}
            >
              Show All Vendors
            </Button>
          </div>
        )}

        {/* Search + Favorites Toggle + Refresh */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search cars, clothes, digital products, city, or @seller..."
              ariaLabel="Search marketplace"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 border px-3 py-2 font-heading text-xs tracking-[0.14em] uppercase',
                  onlyFavorites
                    ? 'border-brand-gold bg-brand-gold font-semibold text-brand-black'
                    : 'hairline-border bg-brand-charcoal text-brand-cream hover:border-brand-gold',
                )}
              >
                <Bookmark className={cn('h-3.5 w-3.5', onlyFavorites && 'fill-current')} />
                Saved Favorites
              </button>
            )}
            <Button variant="subtle" size="sm" onClick={() => void loadMarketplace()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedCategory(tab.key)}
              className={cn(
                'shrink-0 cursor-pointer border px-3.5 py-2 font-heading text-[0.68rem] tracking-[0.15em] uppercase transition-colors',
                selectedCategory === tab.key
                  ? 'border-brand-gold bg-brand-gold font-semibold text-brand-black'
                  : 'hairline-border bg-brand-charcoal/70 text-brand-muted hover:text-brand-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="border hairline-border bg-brand-charcoal/45 p-8 text-sm text-brand-muted">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-brand-gold" />
            Loading Marketplace products...
          </div>
        ) : filteredListings.length === 0 ? (
          <EmptyState
            icon={<Store className="h-4 w-4" aria-hidden="true" />}
            eyebrow="VATAR Marketplace"
            title={
              searchQuery.trim()
                ? `No Products Match "${searchQuery.trim()}"`
                : 'No Products Listed In This Category Yet'
            }
            description="Be the first to upload digital products, cars, clothes, gadgets, or services with photos and your store location!"
            action={
              isApprovedMember || isAdmin ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingListing(null);
                    setListingModalOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Post First Product
                </Button>
              ) : (
                <Button to={ROUTES.login} variant="primary" size="sm">
                  Sign In to Post a Product
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((listing) => (
              <SocialProductCard
                key={listing.id}
                listing={listing}
                inCart={cartIds.has(listing.id)}
                onToggleCart={handleToggleCart}
                onFavoriteChanged={handleFavoriteChanged}
                autoOpenDetail={deepLinkItemId === listing.id}
                onCloseAutoDetail={() => {
                  if (deepLinkItemId === listing.id) {
                    const next = new URLSearchParams(searchParams);
                    next.delete('item');
                    setSearchParams(next, { replace: true });
                  }
                }}
                onEditClick={(item) => {
                  setEditingListing(item);
                  setListingError(null);
                  setListingModalOpen(true);
                }}
                onOrderClick={(item) => {
                  setOrderingListing(item);
                  setRecipientHandle(profile?.lagos_life_username ?? '');
                }}
              />
            ))}
          </div>
        )}

        {/* Featured Vendor Storefronts Strip */}
        {stores.filter((s) => s.status === 'approved').length > 0 && (
          <section className="space-y-3 border-t hairline-border pt-8">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-cream uppercase">
                Verified &amp; Community Vendor Stores
              </h2>
              {isAuthenticated && (
                <Link
                  to={ROUTES.dashboardVendors}
                  className="font-heading text-xs tracking-[0.14em] text-brand-gold uppercase hover:underline"
                >
                  Launch Your Store &rarr;
                </Link>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stores
                .filter((s) => s.status === 'approved')
                .slice(0, 8)
                .map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() =>
                      isAuthenticated
                        ? navigate(`/dashboard/vendors/${store.slug}`)
                        : setSearchParams({ vendor: store.slug })
                    }
                    className="cursor-pointer border hairline-border bg-brand-charcoal/60 p-4 text-left transition-colors hover:border-brand-gold"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-heading text-sm font-semibold text-brand-white">
                        {store.store_name}
                      </span>
                      {store.is_verified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-brand-gold">
                      @{store.owner_username}
                    </p>
                    {store.store_location && (
                      <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-brand-muted">
                        <MapPin className="h-3 w-3 shrink-0 text-brand-gold" />
                        {store.store_location}
                      </p>
                    )}
                  </button>
                ))}
            </div>
          </section>
        )}

        {/* Public Verified Reviews (Visible Outside Authentication!) */}
        <ReviewsSection />
      </PageContainer>

      {/* Order + Instant In-Site Chat Modal */}
      {orderingListing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md border border-brand-gold/55 bg-brand-charcoal p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-gold uppercase">
                  Order From @{orderingListing.seller_username}
                </p>
                <h3 className="mt-1 font-heading text-lg text-brand-white">
                  {orderingListing.title} ({orderingListing.price_currency}{' '}
                  {Number(orderingListing.price_amount).toLocaleString()})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOrderingListing(null)}
                className="cursor-pointer text-brand-muted hover:text-brand-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handlePlaceOrderAndChat(e)}
              className="mt-4 space-y-3.5 text-xs"
            >
              {orderingListing.category === 'lagos_life_funds' && (
                <div>
                  <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                    Your LagosLife Username
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientHandle}
                    onChange={(e) => setRecipientHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                  Message to Seller (Opens Live In-Site Chat)
                </label>
                <textarea
                  rows={2}
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Hi! Is this still available? Let's arrange payment & delivery here."
                  className="mt-1 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrderingListing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={placingOrder}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  {placingOrder ? 'Opening Chat...' : 'Place Order & Chat Seller'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ListingFormModal
        isOpen={listingModalOpen}
        editingListing={editingListing}
        isSubmitting={savingListing}
        error={listingError}
        onClose={() => {
          if (!savingListing) {
            setListingModalOpen(false);
            setEditingListing(null);
          }
        }}
        onSubmit={handleSaveListing}
      />

      <MarketplaceCartDrawer
        isOpen={cartOpen}
        items={cartItems}
        onClose={() => setCartOpen(false)}
        onRemoveItem={(id) => setCartItems(removeFromMarketplaceCart(id))}
        onCheckoutItem={(id) => {
          const found = listings.find((l) => l.id === id);
          if (found) {
            setOrderingListing(found);
            setRecipientHandle(profile?.lagos_life_username ?? '');
          }
        }}
      />

      <OrderChatModal chat={activeChat} onClose={() => setActiveChat(null)} />
    </div>
  );
}
