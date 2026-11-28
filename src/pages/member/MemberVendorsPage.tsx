import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  ShoppingCart,
  Store,
  X,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
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
import type { ListingFormValues } from '@/features/marketplace/types/marketplace.types';
import {
  OrderChatModal,
  type OrderChatContext,
} from '@/features/vendors/components/OrderChatModal';
import {
  fetchVendorStores,
  sendOrderChatMessage,
  upsertMyVendorStore,
} from '@/features/vendors/services/vendorService';
import type {
  MarketplaceListingWithSellerRow,
  VendorStoreDirectoryRow,
} from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

export function MemberVendorsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAdmin } = useAuth();

  const [stores, setStores] = useState<VendorStoreDirectoryRow[]>([]);
  const [listings, setListings] = useState<MarketplaceListingWithSellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Shopping Cart
  const [cartItems, setCartItems] = useState<MarketplaceCartItem[]>(() =>
    loadMarketplaceCart(),
  );
  const [cartOpen, setCartOpen] = useState(false);

  // Storefront Setup Modal
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  // Listing Create/Edit Modal
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [editingListing, setEditingListing] =
    useState<MarketplaceListingWithSellerRow | null>(null);
  const [savingListing, setSavingListing] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);

  // Order + Instant In-Site Chat
  const [orderingListing, setOrderingListing] =
    useState<MarketplaceListingWithSellerRow | null>(null);
  const [recipientHandle, setRecipientHandle] = useState(
    profile?.lagos_life_username ?? '',
  );
  const [buyerNote, setBuyerNote] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeChat, setActiveChat] = useState<OrderChatContext | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    const [storesRes, listingsRes] = await Promise.all([
      fetchVendorStores(),
      fetchMarketplaceListings(null),
    ]);
    if (storesRes.error) setError(storesRes.error);
    else setStores(storesRes.stores);

    if (!listingsRes.error) setListings(listingsRes.listings);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const syncCart = () => setCartItems(loadMarketplaceCart());
    window.addEventListener('vatar:cart-updated', syncCart);
    return () => window.removeEventListener('vatar:cart-updated', syncCart);
  }, []);

  // Auto-open Order modal when redirected via ?buy=<listingId>
  useEffect(() => {
    const buyId = searchParams.get('buy');
    if (!buyId || listings.length === 0) return;
    const found = listings.find((l) => l.id === buyId);
    if (found && found.seller_id !== user?.id) {
      setOrderingListing(found);
      setRecipientHandle(profile?.lagos_life_username ?? '');
      const next = new URLSearchParams(searchParams);
      next.delete('buy');
      setSearchParams(next, { replace: true });
    }
  }, [listings, profile?.lagos_life_username, searchParams, setSearchParams, user?.id]);

  const cartIds = useMemo(
    () => new Set(cartItems.map((i) => i.listingId)),
    [cartItems],
  );

  const myStore = useMemo(
    () => (user ? stores.find((s) => s.owner_id === user.id) ?? null : null),
    [stores, user],
  );

  const activeVendorStore = useMemo(
    () =>
      slug ? stores.find((s) => s.slug.toLowerCase() === slug.toLowerCase()) ?? null : null,
    [slug, stores],
  );

  const openStoreModal = () => {
    setStoreName(myStore?.store_name || profile?.full_name || '');
    setStoreSlug(myStore?.slug || profile?.username || '');
    setStoreLocation(myStore?.store_location || '');
    setTagline(myStore?.tagline || '');
    setDescription(myStore?.description || '');
    setBankName(myStore?.bank_name || '');
    setAccountNumber(myStore?.account_number || '');
    setAccountName(myStore?.account_name || '');
    setStoreModalOpen(true);
  };

  const handleSaveStore = async (e: FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    setError(null);
    const res = await upsertMyVendorStore({
      storeName,
      slug: storeSlug,
      tagline,
      description,
      bankName,
      accountNumber,
      accountName,
      storeLocation,
    });
    setSavingStore(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStoreModalOpen(false);
    setFeedback('Your Vendor Storefront is live!');
    await loadAll();
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
        ? 'Listing updated!'
        : isAdmin
          ? 'Your product is live immediately!'
          : 'Product submitted — once approved by Admin it appears on your Vendor Page & the public Marketplace!',
    );
    await loadAll();
  };

  const handlePlaceOrderAndOpenChat = async (e: FormEvent) => {
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

    const targetListing = orderingListing;
    const firstMsg = buyerNote.trim();
    if (firstMsg) {
      await sendOrderChatMessage(res.order.id, firstMsg);
    }
    setOrderingListing(null);
    setBuyerNote('');
    setActiveChat({
      orderId: res.order.id,
      orderTitle: targetListing.title,
      counterpartyLabel: `Vendor @${targetListing.seller_username}`,
      agreedPriceLabel: `${targetListing.price_currency} ${Number(targetListing.price_amount).toLocaleString()}`,
    });
  };

  const copyStoreUrl = async (targetSlug: string) => {
    try {
      const url = `${window.location.origin}/marketplace?vendor=${targetSlug}`;
      await navigator.clipboard.writeText(url);
      setCopiedSlug(true);
      window.setTimeout(() => setCopiedSlug(false), 2000);
    } catch {
      // ignore
    }
  };

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stores
      .filter((s) => s.status === 'approved' || s.owner_id === user?.id)
      .filter(
        (s) =>
          !q ||
          s.store_name.toLowerCase().includes(q) ||
          s.owner_username.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q) ||
          (s.store_location || '').toLowerCase().includes(q),
      );
  }, [stores, searchQuery, user]);

  const visibleListings = useMemo(() => {
    if (activeVendorStore) {
      const isOwnStore = activeVendorStore.owner_id === user?.id;
      return listings.filter(
        (l) =>
          l.seller_id === activeVendorStore.owner_id &&
          (isOwnStore || (l.moderation_status === 'approved' && l.status === 'available')),
      );
    }
    const q = searchQuery.trim().toLowerCase();
    return listings.filter(
      (l) =>
        (l.seller_id === user?.id ||
          (l.moderation_status === 'approved' && l.status === 'available')) &&
        (!q ||
          l.title.toLowerCase().includes(q) ||
          l.seller_username.toLowerCase().includes(q) ||
          (l.location || '').toLowerCase().includes(q)),
    );
  }, [activeVendorStore, listings, searchQuery, user]);

  return (
    <div className="bg-brand-black">
      {/* Compact Header */}
      <section className="border-b hairline-border bg-brand-obsidian">
        <PageContainer className="py-5 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {slug ? (
                <Link
                  to={ROUTES.dashboardVendors}
                  className="mb-1.5 inline-flex items-center gap-1.5 font-heading text-[0.68rem] tracking-[0.18em] text-brand-gold uppercase hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Vendor Stores
                </Link>
              ) : null}
              <h1 className="heading-display text-2xl text-brand-white sm:text-3xl">
                {activeVendorStore
                  ? activeVendorStore.store_name
                  : 'Vendor Stores & Marketplace Hub'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="subtle" size="sm" onClick={() => void loadAll()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingCart className="h-3.5 w-3.5 text-brand-gold" />
                Cart ({cartItems.length})
              </Button>
              <Button
                to={ROUTES.dashboardMarketplaceOrders}
                variant="secondary"
                size="sm"
              >
                <MessageSquare className="h-3.5 w-3.5 text-brand-gold" />
                Orders &amp; Chats
              </Button>
              <Button variant="secondary" size="sm" onClick={openStoreModal}>
                <Store className="h-3.5 w-3.5 text-brand-gold" />
                {myStore ? 'Edit My Store' : 'Create Vendor Page'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingListing(null);
                  setListingError(null);
                  setListingModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product / Listing
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-6 py-6 sm:py-8">
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

        {loading ? (
          <div className="border hairline-border bg-brand-charcoal/50 p-6 text-sm text-brand-muted">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-brand-gold" />
            Loading Vendor Storefronts...
          </div>
        ) : slug && !activeVendorStore ? (
          <div className="border hairline-border bg-brand-charcoal/50 p-6 text-sm text-brand-muted">
            Vendor store not found.{' '}
            <Link to={ROUTES.dashboardVendors} className="text-brand-gold underline">
              Return to Vendor Directory
            </Link>
          </div>
        ) : activeVendorStore ? (
          /* SINGLE DEDICATED VENDOR STOREFRONT PAGE */
          <>
            <section className="border border-brand-gold/45 bg-brand-charcoal/75 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-xs tracking-[0.18em] text-brand-gold uppercase">
                      @{activeVendorStore.owner_username}
                    </span>
                    {activeVendorStore.is_verified && (
                      <span className="inline-flex items-center gap-1 border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 font-heading text-[10px] tracking-[0.14em] text-emerald-300 uppercase">
                        <BadgeCheck className="h-3 w-3" />
                        Verified Vendor
                      </span>
                    )}
                    {activeVendorStore.store_location && (
                      <span className="inline-flex items-center gap-1 border hairline-border bg-brand-black px-2 py-0.5 text-xs text-brand-cream">
                        <MapPin className="h-3 w-3 text-brand-gold" />
                        {activeVendorStore.store_location}
                      </span>
                    )}
                    <span className="font-mono text-xs text-brand-muted">
                      {activeVendorStore.completed_sales_count} completed sales
                    </span>
                  </div>
                  {activeVendorStore.tagline && (
                    <p className="mt-2 font-heading text-base text-brand-white">
                      {activeVendorStore.tagline}
                    </p>
                  )}
                  {activeVendorStore.description && (
                    <p className="mt-2 max-w-2xl font-body text-xs leading-relaxed text-brand-muted">
                      {activeVendorStore.description}
                    </p>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyStoreUrl(activeVendorStore.slug)}
                >
                  {copiedSlug ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Public Store Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-brand-gold" />
                      Share Public Store Link
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Vendor's Products */}
            <section className="space-y-4">
              <h2 className="font-heading text-sm font-semibold tracking-[0.18em] text-brand-cream uppercase">
                Store Products &amp; Listings ({visibleListings.length})
              </h2>

              {visibleListings.length === 0 ? (
                <p className="border hairline-border bg-brand-charcoal/40 p-6 text-xs text-brand-muted">
                  This vendor has no active listings right now.
                </p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleListings.map((listing) => (
                    <SocialProductCard
                      key={listing.id}
                      listing={listing}
                      inCart={cartIds.has(listing.id)}
                      onToggleCart={(item) => setCartItems(toggleMarketplaceCartItem(item).items)}
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
            </section>
          </>
        ) : (
          /* VENDOR DIRECTORY + ALL PRODUCTS */
          <>
            {myStore && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-brand-gold/45 bg-brand-gold/10 px-4 py-3 text-xs">
                <div>
                  <span className="font-heading tracking-[0.16em] text-brand-gold uppercase">
                    Your Vendor Page: {myStore.store_name}
                  </span>
                  {myStore.store_location ? (
                    <span className="ml-2 text-brand-cream">• 📍 {myStore.store_location}</span>
                  ) : null}
                  <span className="ml-2 text-brand-muted">
                    ({myStore.active_listings_count} active &bull;{' '}
                    {myStore.completed_sales_count} sales)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    to={`/dashboard/vendors/${myStore.slug}`}
                    variant="primary"
                    size="sm"
                  >
                    Open My Page
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void copyStoreUrl(myStore.slug)}
                  >
                    {copiedSlug ? 'Copied!' : 'Copy Public Link'}
                  </Button>
                </div>
              </div>
            )}

            <div className="max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search vendor stores, products, or city..."
                ariaLabel="Search vendors"
              />
            </div>

            {/* Vendor Storefront Cards */}
            <section className="space-y-3">
              <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-cream uppercase">
                Vendor Pages ({filteredStores.length})
              </h2>

              {filteredStores.length === 0 ? (
                <div className="border hairline-border bg-brand-charcoal/45 p-6 text-xs text-brand-muted">
                  No vendor pages created yet. Click <strong>Create Vendor Page</strong> above
                  to launch your own real-life or digital storefront inside VATAR!
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredStores.map((store) => (
                    <Link
                      key={store.id}
                      to={`/dashboard/vendors/${store.slug}`}
                      className="group flex flex-col justify-between border hairline-border bg-brand-charcoal/65 p-5 transition-colors hover:border-brand-gold"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-brand-gold">
                            @{store.owner_username}
                          </span>
                          {store.is_verified && (
                            <span className="inline-flex items-center gap-1 border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 font-heading text-[9px] tracking-[0.14em] text-emerald-300 uppercase">
                              <BadgeCheck className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </div>
                        <h3 className="heading-section mt-2 text-xl text-brand-white group-hover:text-brand-gold">
                          {store.store_name}
                        </h3>
                        {store.store_location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-brand-cream/85">
                            <MapPin className="h-3 w-3 shrink-0 text-brand-gold" />
                            {store.store_location}
                          </p>
                        )}
                        {store.tagline && (
                          <p className="mt-1 line-clamp-2 font-body text-xs text-brand-muted">
                            {store.tagline}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t hairline-border pt-3 text-[11px] text-brand-muted">
                        <span>
                          {store.active_listings_count} products &bull;{' '}
                          {store.completed_sales_count} sales
                        </span>
                        <span className="inline-flex items-center gap-1 font-heading text-[10px] tracking-[0.16em] text-brand-gold uppercase">
                          Visit Store
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* All Products & Listings */}
            {visibleListings.length > 0 && (
              <section className="space-y-3 pt-2">
                <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-cream uppercase">
                  Products &amp; Services ({visibleListings.length})
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleListings.map((listing) => (
                    <SocialProductCard
                      key={listing.id}
                      listing={listing}
                      inCart={cartIds.has(listing.id)}
                      onToggleCart={(item) => setCartItems(toggleMarketplaceCartItem(item).items)}
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
              </section>
            )}
          </>
        )}
      </PageContainer>

      {/* Create / Edit Vendor Storefront Modal */}
      {storeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-brand-gold/55 bg-brand-charcoal p-6">
            <div className="flex items-center justify-between border-b hairline-border pb-3">
              <h2 className="heading-section text-xl text-brand-white">
                {myStore ? 'Edit Your Vendor Store' : 'Create Your Vendor Store'}
              </h2>
              <button
                type="button"
                onClick={() => setStoreModalOpen(false)}
                className="cursor-pointer text-brand-muted hover:text-brand-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveStore(e)} className="mt-4 space-y-3.5 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                    Store Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Soft Autos & Digital Hub"
                    className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                    Custom URL Slug
                  </label>
                  <input
                    type="text"
                    maxLength={48}
                    value={storeSlug}
                    onChange={(e) => setStoreSlug(e.target.value)}
                    placeholder="soft-autos"
                    className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-heading tracking-[0.14em] text-brand-cream uppercase">
                  <MapPin className="h-3.5 w-3.5 text-brand-gold" />
                  Physical Store Address / City (or Online)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={storeLocation}
                  onChange={(e) => setStoreLocation(e.target.value)}
                  placeholder="e.g. Lekki Phase 1, Lagos • Nationwide Delivery"
                  className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                  Short Tagline
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Luxury cars, designer fashion & digital guides"
                  className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                  About Your Store
                </label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you sell, physical showroom hours, and delivery options..."
                  className="mt-1 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStoreModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={savingStore}>
                  {savingStore ? 'Saving...' : 'Publish Vendor Store'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Order -> Opens Direct In-Site Chat Modal */}
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
              onSubmit={(e) => void handlePlaceOrderAndOpenChat(e)}
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
                  Opening Message to Vendor
                </label>
                <textarea
                  rows={2}
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Hi! Ready to buy — let's coordinate payment & delivery right here in chat."
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
                  {placingOrder ? 'Opening Chat...' : 'Place Order & Open Chat'}
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
