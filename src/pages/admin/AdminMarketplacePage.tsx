import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Store,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import {
  DisputeStatusBadge,
  ListingAvailabilityBadge,
  ListingModerationBadge,
  OrderStatusBadge,
} from '@/features/marketplace/components/MarketplaceBadges';
import {
  fetchAdminMarketplaceOversight,
  fetchOrderEvents,
  moderateListing,
  resolveAdminDispute,
} from '@/features/marketplace/services/marketplaceService';
import {
  DISPUTE_REASON_LABELS,
  MARKETPLACE_CATEGORY_LABELS,
  type AdminDisputeView,
  type AdminOrderView,
} from '@/features/marketplace/types/marketplace.types';
import type {
  MarketplaceListingWithSellerRow,
  MarketplaceModerationStatus,
  MarketplaceOrderEventRecord,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

const MODERATION_FILTERS = ['All', 'Pending', 'Approved', 'Rejected', 'Removed'] as const;
type ModFilter = (typeof MODERATION_FILTERS)[number];

const MOD_MAP: Record<Exclude<ModFilter, 'All'>, MarketplaceModerationStatus> = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Removed: 'removed',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminMarketplacePage() {
  const [activeTab, setActiveTab] = useState<'listings' | 'disputes' | 'orders'>(
    'listings',
  );
  const [listings, setListings] = useState<MarketplaceListingWithSellerRow[]>([]);
  const [disputes, setDisputes] = useState<AdminDisputeView[]>([]);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [modFilter, setModFilter] = useState<ModFilter>('All');

  // Listing moderation modal
  const [moderating, setModerating] = useState<{
    listing: MarketplaceListingWithSellerRow;
    nextStatus: MarketplaceModerationStatus;
  } | null>(null);
  const [modNote, setModNote] = useState('');
  const [isSavingMod, setIsSavingMod] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Dispute resolution modal
  const [resolvingDispute, setResolvingDispute] =
    useState<AdminDisputeView | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState<'resolved' | 'dismissed'>(
    'resolved',
  );
  const [targetOrderStatus, setTargetOrderStatus] = useState<
    'buyer_confirmed' | 'cancelled' | 'rejected' | 'in_progress'
  >('cancelled');
  const [resolutionNote, setResolutionNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Order event inspector
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderEvents, setOrderEvents] = useState<
    Record<string, MarketplaceOrderEventRecord[]>
  >({});

  const loadData = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const res = await fetchAdminMarketplaceOversight();
    if (res.error) {
      setError(res.error);
    } else {
      setListings(res.listings);
      setDisputes(res.disputes);
      setOrders(res.orders);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((l) => {
      if (modFilter !== 'All' && l.moderation_status !== MOD_MAP[modFilter]) {
        return false;
      }
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.seller_username.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      );
    });
  }, [listings, modFilter, searchQuery]);

  const openDisputesCount = disputes.filter(
    (d) => d.dispute.status === 'open' || d.dispute.status === 'under_review',
  ).length;
  const pendingListingsCount = listings.filter(
    (l) => l.moderation_status === 'pending',
  ).length;

  const handleConfirmModeration = async (event: FormEvent) => {
    event.preventDefault();
    if (!moderating) return;

    setModalError(null);
    setIsSavingMod(true);
    const res = await moderateListing(
      moderating.listing.id,
      moderating.nextStatus,
      modNote,
    );
    setIsSavingMod(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    setFeedback(
      `Listing "${moderating.listing.title}" marked ${moderating.nextStatus.toUpperCase()} and logged to audit trail.`,
    );
    setModerating(null);
    setModNote('');
    await loadData(false);
  };

  const handleConfirmResolveDispute = async (event: FormEvent) => {
    event.preventDefault();
    if (!resolvingDispute) return;

    if (resolutionNote.trim().length < 5) {
      setModalError('A resolution note of at least 5 characters is required.');
      return;
    }

    setModalError(null);
    setIsResolving(true);

    const res = await resolveAdminDispute({
      disputeId: resolvingDispute.dispute.id,
      disputeStatus: resolutionOutcome,
      resolutionNote,
      targetOrderStatus,
    });

    setIsResolving(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    setFeedback(
      `Dispute ${resolutionOutcome.toUpperCase()} and order transitioned to ${targetOrderStatus}.`,
    );
    setResolvingDispute(null);
    setResolutionNote('');
    await loadData(false);
  };

  const toggleOrderEvents = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    const res = await fetchOrderEvents(orderId);
    if (res.error) {
      setError(`Failed to load order events: ${res.error}`);
    } else {
      setOrderEvents((prev) => ({ ...prev, [orderId]: res.events }));
    }
  };

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Admin Control Center</p>
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Marketplace Oversight
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Moderate member listings, audit manual-fulfilment order timelines, and
                resolve community disputes with permanent audit trails.
              </p>
            </div>

            <Button
              variant="subtle"
              size="sm"
              onClick={() => void loadData(false)}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-8 py-10 sm:py-14">
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

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 border-b hairline-border pb-5">
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className={cn(
              'cursor-pointer border px-4 py-2.5 font-heading text-xs tracking-[0.18em] uppercase',
              activeTab === 'listings'
                ? 'border-brand-gold bg-brand-gold text-brand-black'
                : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
            )}
          >
            Listings ({listings.length} &bull; {pendingListingsCount} Pending)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('disputes')}
            className={cn(
              'cursor-pointer border px-4 py-2.5 font-heading text-xs tracking-[0.18em] uppercase',
              activeTab === 'disputes'
                ? 'border-brand-gold bg-brand-gold text-brand-black'
                : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
            )}
          >
            Disputes ({openDisputesCount} Open)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={cn(
              'cursor-pointer border px-4 py-2.5 font-heading text-xs tracking-[0.18em] uppercase',
              activeTab === 'orders'
                ? 'border-brand-gold bg-brand-gold text-brand-black'
                : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
            )}
          >
            Orders ({orders.length})
          </button>
        </div>

        {/* TAB 1: LISTINGS MODERATION */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="w-full lg:max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search listing title or @seller..."
                  ariaLabel="Search marketplace listings"
                />
              </div>
              <CategoryFilter
                categories={MODERATION_FILTERS}
                selected={modFilter}
                onSelect={setModFilter}
                ariaLabel="Filter by moderation status"
              />
            </div>

            {isLoading ? (
              <div className="h-44 animate-pulse border hairline-border bg-brand-charcoal/45" />
            ) : filteredListings.length === 0 ? (
              <EmptyState
                icon={<Store className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Listings Queue"
                title="No Matching Listings"
                description="Member-submitted marketplace listings will appear here for moderation."
                compact
              />
            ) : (
              <div className="space-y-4">
                {filteredListings.map((listing) => (
                  <article
                    key={listing.id}
                    className="flex flex-col justify-between gap-4 border hairline-border bg-brand-charcoal/60 p-6 lg:flex-row lg:items-start"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ListingModerationBadge status={listing.moderation_status} />
                        <ListingAvailabilityBadge status={listing.status} />
                        <span className="font-body text-xs text-brand-gold">
                          {MARKETPLACE_CATEGORY_LABELS[listing.category]}
                        </span>
                      </div>

                      <h2 className="heading-section mt-3 text-xl text-brand-white">
                        {listing.title}
                      </h2>
                      <p className="mt-1.5 max-w-2xl font-body text-xs leading-relaxed text-brand-muted">
                        {listing.description}
                      </p>

                      <p className="mt-3 font-body text-xs text-brand-cream/90">
                        Seller: <span className="text-brand-gold">@{listing.seller_username}</span>
                        {' • '}Price: {listing.price_currency}{' '}
                        {listing.price_amount.toLocaleString()}
                        {listing.game_currency_amount
                          ? ` • Funds: ₦${listing.game_currency_amount.toLocaleString()}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {listing.moderation_status !== 'approved' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setModNote('');
                            setModerating({ listing, nextStatus: 'approved' });
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {listing.moderation_status !== 'rejected' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setModNote('');
                            setModerating({ listing, nextStatus: 'rejected' });
                          }}
                        >
                          Reject
                        </Button>
                      )}
                      {listing.moderation_status !== 'removed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setModNote('');
                            setModerating({ listing, nextStatus: 'removed' });
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISPUTES */}
        {activeTab === 'disputes' && (
          <div>
            {isLoading ? (
              <div className="h-44 animate-pulse border hairline-border bg-brand-charcoal/45" />
            ) : disputes.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Dispute Desk"
                title="No Disputes Reported"
                description="Order disputes reported by buyers or sellers will appear here for administrative investigation."
                compact
              />
            ) : (
              <div className="space-y-4">
                {disputes.map((item) => (
                  <article
                    key={item.dispute.id}
                    className="border hairline-border bg-brand-charcoal/65 p-6"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <DisputeStatusBadge status={item.dispute.status} />
                          <span className="font-heading text-xs tracking-[0.16em] text-brand-gold uppercase">
                            {DISPUTE_REASON_LABELS[item.dispute.reason]}
                          </span>
                        </div>

                        <h2 className="heading-section mt-3 text-xl text-brand-white">
                          {item.listingTitle}
                        </h2>
                        <p className="mt-2 max-w-2xl font-body text-sm text-brand-cream/90">
                          {item.dispute.description}
                        </p>

                        <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-3">
                          <div>
                            <dt className="text-brand-muted uppercase">Opened By</dt>
                            <dd className="mt-0.5 text-brand-gold">
                              @{item.openedByUsername}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-brand-muted uppercase">Buyer Profile</dt>
                            <dd className="mt-0.5 text-brand-cream">
                              {item.buyerProfile
                                ? `@${item.buyerProfile.username} (${item.buyerProfile.lagos_life_username})`
                                : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-brand-muted uppercase">Seller Profile</dt>
                            <dd className="mt-0.5 text-brand-cream">
                              {item.sellerProfile
                                ? `@${item.sellerProfile.username} (${item.sellerProfile.lagos_life_username})`
                                : '—'}
                            </dd>
                          </div>
                        </dl>

                        {item.dispute.admin_resolution_note && (
                          <p className="mt-4 border-l-2 border-brand-gold pl-3 font-body text-xs text-brand-muted">
                            Resolution: {item.dispute.admin_resolution_note}
                          </p>
                        )}
                      </div>

                      {(item.dispute.status === 'open' ||
                        item.dispute.status === 'under_review') && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setResolutionOutcome('resolved');
                            setTargetOrderStatus('cancelled');
                            setResolutionNote('');
                            setResolvingDispute(item);
                          }}
                        >
                          Resolve Dispute
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALL ORDERS & EVENT TIMELINES */}
        {activeTab === 'orders' && (
          <div>
            {isLoading ? (
              <div className="h-44 animate-pulse border hairline-border bg-brand-charcoal/45" />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Order Ledger"
                title="No Marketplace Orders Recorded"
                description="All member purchase requests and fulfilment histories will appear here."
                compact
              />
            ) : (
              <div className="space-y-4">
                {orders.map(({ order, listingTitle, buyerUsername, sellerUsername }) => {
                  const isExpanded = expandedOrderId === order.id;
                  const events = orderEvents[order.id] ?? [];
                  return (
                    <article
                      key={order.id}
                      className="border hairline-border bg-brand-charcoal/60 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <OrderStatusBadge status={order.status} />
                            <span className="font-body text-xs text-brand-muted">
                              {formatDateTime(order.created_at)}
                            </span>
                          </div>
                          <h3 className="heading-section mt-2 text-lg text-brand-white">
                            {listingTitle}
                          </h3>
                          <p className="mt-1 font-body text-xs text-brand-muted">
                            Buyer: <span className="text-brand-cream">@{buyerUsername}</span>
                            {' • '}Seller:{' '}
                            <span className="text-brand-gold">@{sellerUsername}</span>
                            {' • '}
                            {order.agreed_price_currency}{' '}
                            {order.agreed_price_amount.toLocaleString()}
                          </p>
                        </div>

                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => void toggleOrderEvents(order.id)}
                        >
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {isExpanded ? 'Hide Events' : 'Inspect Events'}
                        </Button>
                      </div>

                      {isExpanded && (
                        <ol className="mt-4 space-y-2 border-t hairline-border pt-4 text-xs">
                          {events.map((ev) => (
                            <li key={ev.id}>
                              <span className="font-heading text-brand-gold uppercase">
                                {ev.event_type}
                              </span>{' '}
                              <span className="text-brand-muted">
                                ({formatDateTime(ev.created_at)})
                              </span>
                              : <span className="text-brand-cream/85">{ev.event_description}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </PageContainer>

      {/* Listing Moderation Confirmation Modal */}
      {moderating && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => !isSavingMod && setModerating(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-brand-gold">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <p className="heading-eyebrow">Confirm Moderation</p>
            </div>
            <h2 className="heading-section mt-2 text-2xl text-brand-white">
              Set Listing: {moderating.nextStatus}
            </h2>
            <p className="mt-2 font-body text-xs text-brand-muted">
              {moderating.listing.title} (@{moderating.listing.seller_username})
            </p>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleConfirmModeration} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="mod-note"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Moderation Note (Optional)
                </label>
                <textarea
                  id="mod-note"
                  rows={3}
                  value={modNote}
                  onChange={(e) => setModNote(e.target.value)}
                  placeholder="Recorded in the audit log..."
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSavingMod}
                  onClick={() => setModerating(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingMod}>
                  {isSavingMod ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolvingDispute && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => !isResolving && setResolvingDispute(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="heading-eyebrow">Dispute Resolution</p>
            <h2 className="heading-section mt-2 text-2xl text-brand-white">
              {resolvingDispute.listingTitle}
            </h2>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleConfirmResolveDispute} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="disp-outcome"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Dispute Outcome
                  </label>
                  <select
                    id="disp-outcome"
                    value={resolutionOutcome}
                    onChange={(e) =>
                      setResolutionOutcome(e.target.value as 'resolved' | 'dismissed')
                    }
                    className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  >
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="disp-order-status"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Order Status
                  </label>
                  <select
                    id="disp-order-status"
                    value={targetOrderStatus}
                    onChange={(e) =>
                      setTargetOrderStatus(
                        e.target.value as
                          | 'buyer_confirmed'
                          | 'cancelled'
                          | 'rejected'
                          | 'in_progress',
                      )
                    }
                    className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  >
                    <option value="cancelled">Cancelled</option>
                    <option value="buyer_confirmed">Buyer Confirmed</option>
                    <option value="in_progress">Return to In Progress</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="disp-note"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Mandatory Resolution Note
                </label>
                <textarea
                  id="disp-note"
                  rows={3}
                  required
                  minLength={5}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Explain the administrative decision (permanently audited)..."
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isResolving}
                  onClick={() => setResolvingDispute(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isResolving}>
                  {isResolving ? 'Resolving...' : 'Confirm Resolution'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
