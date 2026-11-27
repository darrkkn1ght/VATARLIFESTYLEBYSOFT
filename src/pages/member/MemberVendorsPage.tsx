import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  Copy,
  Edit3,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ListingFormModal } from '@/features/marketplace/components/ListingFormModal';
import {
  ListingAvailabilityBadge,
  ListingModerationBadge,
} from '@/features/marketplace/components/MarketplaceBadges';
import {
  createListing,
  createPurchaseRequest,
  fetchMarketplaceListings,
  formatGameFundsShort,
  updateOwnListing,
} from '@/features/marketplace/services/marketplaceService';
import {
  MARKETPLACE_CATEGORY_LABELS,
  type ListingFormValues,
} from '@/features/marketplace/types/marketplace.types';
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
  const { user, profile } = useAuth();

  const [stores, setStores] = useState<VendorStoreDirectoryRow[]>([]);
  const [listings, setListings] = useState<MarketplaceListingWithSellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Storefront Setup Modal
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
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

  const myStore = useMemo(
    () => (user ? stores.find((s) => s.owner_id === user.id) ?? null : null),
    [stores, user],
  );

  const activeVendorStore = useMemo(
    () => (slug ? stores.find((s) => s.slug.toLowerCase() === slug.toLowerCase()) ?? null : null),
    [slug, stores],
  );

  const openStoreModal = () => {
    setStoreName(myStore?.store_name || profile?.full_name || '');
    setStoreSlug(myStore?.slug || profile?.username || '');
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
        ? 'Listing updated.'
        : 'Listing submitted for admin approval — once approved it appears on your Vendor Page!',
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
    // Immediately open direct In-Site Chat with the vendor!
    setActiveChat({
      orderId: res.order.id,
      orderTitle: targetListing.title,
      counterpartyLabel: `Vendor @${targetListing.seller_username}`,
      agreedPriceLabel: `${targetListing.price_currency} ${targetListing.price_amount.toLocaleString()}`,
    });
  };

  const copyStoreUrl = async (targetSlug: string) => {
    try {
      const url = `${window.location.origin}/dashboard/vendors/${targetSlug}`;
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
          s.tagline.toLowerCase().includes(q),
      );
  }, [stores, searchQuery, user]);

  const storeByOwnerId = useMemo(
    () => new Map(stores.map((s) => [s.owner_id, s])),
    [stores],
  );

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
        l.moderation_status === 'approved' &&
        l.status === 'available' &&
        (!q ||
          l.title.toLowerCase().includes(q) ||
          l.seller_username.toLowerCase().includes(q)),
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
                {activeVendorStore ? activeVendorStore.store_name : 'Community Vendor Stores'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="subtle" size="sm" onClick={() => void loadAll()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
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
                Add Listing
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
                      Store Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-brand-gold" />
                      Share Store Link
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Vendor's Own Listings */}
            <section className="space-y-4">
              <h2 className="font-heading text-sm font-semibold tracking-[0.18em] text-brand-cream uppercase">
                Store Listings ({visibleListings.length})
              </h2>

              {visibleListings.length === 0 ? (
                <p className="border hairline-border bg-brand-charcoal/40 p-6 text-xs text-brand-muted">
                  This vendor has no active approved listings right now.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleListings.map((listing) => {
                    const isMine = listing.seller_id === user?.id;
                    return (
                      <article
                        key={listing.id}
                        className="flex flex-col justify-between border hairline-border bg-brand-charcoal/65 p-5"
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-heading text-[10px] tracking-[0.16em] text-brand-gold uppercase">
                              {MARKETPLACE_CATEGORY_LABELS[listing.category]}
                            </span>
                            {isMine ? (
                              <ListingModerationBadge status={listing.moderation_status} />
                            ) : (
                              <ListingAvailabilityBadge status={listing.status} />
                            )}
                          </div>
                          <h3 className="heading-section mt-2 text-lg text-brand-white">
                            {listing.title}
                          </h3>
                          <p className="mt-1 font-heading text-xl font-semibold text-brand-gold">
                            {listing.price_currency} {listing.price_amount.toLocaleString()}
                            {listing.game_currency_amount ? (
                              <span className="ml-2 font-mono text-xs text-brand-cream">
                                • ₦{formatGameFundsShort(listing.game_currency_amount)} Funds
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-2 line-clamp-3 font-body text-xs leading-relaxed text-brand-muted">
                            {listing.description}
                          </p>
                        </div>

                        <div className="mt-4 border-t hairline-border pt-3">
                          {isMine ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setEditingListing(listing);
                                setListingError(null);
                                setListingModalOpen(true);
                              }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit Listing
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setOrderingListing(listing);
                                setRecipientHandle(profile?.lagos_life_username ?? '');
                              }}
                            >
                              <ShoppingBag className="h-3.5 w-3.5" />
                              Order &amp; Chat Inside Site
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          /* VENDOR DIRECTORY + ALL APPROVED VENDOR LISTINGS */
          <>
            {myStore && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-brand-gold/45 bg-brand-gold/10 px-4 py-3 text-xs">
                <div>
                  <span className="font-heading tracking-[0.16em] text-brand-gold uppercase">
                    Your Vendor Page: {myStore.store_name}
                  </span>
                  <span className="ml-2 text-brand-muted">
                    ({myStore.active_listings_count} active listings &bull;{' '}
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
                    {copiedSlug ? 'Copied!' : 'Copy Link'}
                  </Button>
                </div>
              </div>
            )}

            <div className="max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search vendor pages or listings..."
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
                  to launch your own storefront inside VATAR!
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
                        {store.tagline && (
                          <p className="mt-1 line-clamp-2 font-body text-xs text-brand-muted">
                            {store.tagline}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t hairline-border pt-3 text-[11px] text-brand-muted">
                        <span>
                          {store.active_listings_count} listings &bull;{' '}
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

            {/* All Approved Vendor Listings */}
            {visibleListings.length > 0 && (
              <section className="space-y-3 pt-2">
                <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-cream uppercase">
                  Latest Vendor Listings ({visibleListings.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleListings.slice(0, 12).map((listing) => {
                    const vendorStore = storeByOwnerId.get(listing.seller_id);
                    const isMine = listing.seller_id === user?.id;
                    return (
                      <article
                        key={listing.id}
                        className="flex flex-col justify-between border hairline-border bg-brand-charcoal/60 p-5"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            {vendorStore ? (
                              <Link
                                to={`/dashboard/vendors/${vendorStore.slug}`}
                                className="font-heading text-[11px] tracking-[0.12em] text-brand-gold hover:underline"
                              >
                                {vendorStore.store_name} (@{listing.seller_username})
                              </Link>
                            ) : (
                              <span className="text-brand-gold">
                                @{listing.seller_username}
                              </span>
                            )}
                          </div>
                          <h3 className="heading-section mt-2 text-lg text-brand-white">
                            {listing.title}
                          </h3>
                          <p className="mt-1 font-heading text-lg font-semibold text-brand-gold">
                            {listing.price_currency} {listing.price_amount.toLocaleString()}
                            {listing.game_currency_amount ? (
                              <span className="ml-2 font-mono text-xs text-brand-cream">
                                • ₦{formatGameFundsShort(listing.game_currency_amount)} Funds
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1.5 line-clamp-2 font-body text-xs text-brand-muted">
                            {listing.description}
                          </p>
                        </div>

                        <div className="mt-4 border-t hairline-border pt-3">
                          {isMine ? (
                            <Button
                              to={ROUTES.dashboardMarketplaceOrders}
                              variant="secondary"
                              size="sm"
                              className="w-full"
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                              View Incoming Orders
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setOrderingListing(listing);
                                setRecipientHandle(profile?.lagos_life_username ?? '');
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Order &amp; Chat Vendor
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
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
          <div className="w-full max-w-lg border border-brand-gold/55 bg-brand-charcoal p-6">
            <div className="flex items-center justify-between border-b hairline-border pb-3">
              <h2 className="heading-section text-xl text-brand-white">
                {myStore ? 'Edit Your Vendor Page' : 'Create Your Vendor Page'}
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
                    placeholder="e.g. Lagos Plug Exchange"
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
                    placeholder="lagos-plug"
                    className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
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
                  placeholder="Fast in-game delivery & digital services"
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
                  placeholder="Describe what you sell and your delivery hours..."
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
                  {savingStore ? 'Saving...' : 'Publish Vendor Page'}
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
                  {orderingListing.price_amount.toLocaleString()})
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
              <div>
                <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                  Your LagosLife Username (if applicable)
                </label>
                <input
                  type="text"
                  value={recipientHandle}
                  onChange={(e) => setRecipientHandle(e.target.value)}
                  placeholder="@yourhandle"
                  className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-heading tracking-[0.14em] text-brand-cream uppercase">
                  Opening Message to Vendor
                </label>
                <textarea
                  rows={2}
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Hi, I'm ready to pay — send your payment details in chat!"
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

      <OrderChatModal chat={activeChat} onClose={() => setActiveChat(null)} />
    </div>
  );
}
