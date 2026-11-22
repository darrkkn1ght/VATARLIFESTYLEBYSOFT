import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/features/marketplace/components/MarketplaceBadges';
import { MarketplaceSafetyBanner } from '@/features/marketplace/components/MarketplaceSafetyBanner';
import {
  fetchMyOrders,
  fetchOrderEvents,
  openOrderDispute,
  transitionOrderStatus,
} from '@/features/marketplace/services/marketplaceService';
import { DISPUTE_REASON_LABELS } from '@/features/marketplace/types/marketplace.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type {
  MarketplaceDisputeReason,
  MarketplaceOrderEventRecord,
  MarketplaceOrderStatus,
  MyMarketplaceOrderRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

const DISPUTE_REASONS: readonly MarketplaceDisputeReason[] = [
  'currency_not_received',
  'incorrect_amount',
  'incorrect_recipient',
  'seller_unresponsive',
  'other',
];

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

export function MemberOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<MyMarketplaceOrderRow[]>([]);
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>('purchases');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Expanded order timeline
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [eventsByOrder, setEventsByOrder] = useState<
    Record<string, MarketplaceOrderEventRecord[]>
  >({});

  // Action modal (seller mark sent / buyer confirm / cancel / etc.)
  const [actionModal, setActionModal] = useState<{
    order: MyMarketplaceOrderRow;
    nextStatus: MarketplaceOrderStatus;
    title: string;
    description: string;
    noteLabel: string;
  } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Dispute modal
  const [disputeOrder, setDisputeOrder] = useState<MyMarketplaceOrderRow | null>(null);
  const [disputeReason, setDisputeReason] =
    useState<MarketplaceDisputeReason>('currency_not_received');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const loadOrders = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const res = await fetchMyOrders();
    if (res.error) setError(res.error);
    else setOrders(res.orders);

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  const purchases = useMemo(
    () => orders.filter((o) => o.buyer_id === user?.id),
    [orders, user?.id],
  );

  const sales = useMemo(
    () => orders.filter((o) => o.seller_id === user?.id),
    [orders, user?.id],
  );

  const displayedOrders = activeTab === 'purchases' ? purchases : sales;

  const toggleTimeline = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    const res = await fetchOrderEvents(orderId);
    if (res.error) {
      setError(`Failed to load order timeline: ${res.error}`);
    } else {
      setEventsByOrder((prev) => ({ ...prev, [orderId]: res.events }));
    }
  };

  const handleConfirmAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!actionModal) return;

    setModalError(null);
    setIsSubmittingAction(true);

    const res = await transitionOrderStatus(
      actionModal.order.id,
      actionModal.nextStatus,
      actionNote,
    );

    setIsSubmittingAction(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    const updatedId = actionModal.order.id;
    setActionModal(null);
    setActionNote('');
    setFeedback(`Order updated to ${actionModal.nextStatus.replaceAll('_', ' ').toUpperCase()}.`);
    await loadOrders(false);

    if (expandedOrderId === updatedId) {
      const ev = await fetchOrderEvents(updatedId);
      if (!ev.error) {
        setEventsByOrder((prev) => ({ ...prev, [updatedId]: ev.events }));
      }
    }
  };

  const handleSubmitDispute = async (event: FormEvent) => {
    event.preventDefault();
    if (!disputeOrder) return;

    if (disputeDesc.trim().length < 10) {
      setModalError('Provide a clear description of at least 10 characters.');
      return;
    }

    setModalError(null);
    setIsSubmittingDispute(true);

    const res = await openOrderDispute({
      orderId: disputeOrder.id,
      reason: disputeReason,
      description: disputeDesc,
    });

    setIsSubmittingDispute(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    setDisputeOrder(null);
    setDisputeDesc('');
    setFeedback(
      'Dispute opened. Ordinary order actions are locked until an administrator reviews and resolves it.',
    );
    await loadOrders(false);
  };

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <Link
            to={ROUTES.dashboardMarketplace}
            className="inline-flex items-center gap-2 font-body text-xs tracking-[0.18em] text-brand-muted uppercase hover:text-brand-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back To Marketplace
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="heading-eyebrow">Manual Fulfilment Tracker</p>
              <h1 className="heading-display mt-3 text-4xl text-brand-white sm:text-5xl">
                Marketplace Orders
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm text-brand-muted">
                Track outgoing purchase requests and incoming sales. Only the buyer can
                confirm receipt after manual delivery.
              </p>
            </div>

            <Button
              variant="subtle"
              size="sm"
              onClick={() => void loadOrders(false)}
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
        <MarketplaceSafetyBanner compact />

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

        {/* Purchases / Sales Tabs */}
        <div className="flex gap-2 border-b hairline-border pb-5">
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={cn(
              'cursor-pointer border px-5 py-2.5 font-heading text-xs tracking-[0.18em] uppercase',
              activeTab === 'purchases'
                ? 'border-brand-gold bg-brand-gold text-brand-black'
                : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
            )}
          >
            Purchases ({purchases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={cn(
              'cursor-pointer border px-5 py-2.5 font-heading text-xs tracking-[0.18em] uppercase',
              activeTab === 'sales'
                ? 'border-brand-gold bg-brand-gold text-brand-black'
                : 'hairline-border bg-brand-charcoal text-brand-muted hover:text-brand-white',
            )}
          >
            Sales ({sales.length})
          </button>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className="h-40 animate-pulse border hairline-border bg-brand-charcoal/45"
              />
            ))}
          </div>
        ) : displayedOrders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
            eyebrow={activeTab === 'purchases' ? 'No Purchases' : 'No Incoming Sales'}
            title={
              activeTab === 'purchases'
                ? 'You Have No Purchase Requests Yet'
                : 'No Buyers Have Requested Your Listings Yet'
            }
            description="Orders appear here as soon as a purchase request is submitted on an approved listing."
            action={
              <Button to={ROUTES.dashboardMarketplace} variant="secondary" size="sm">
                Browse Marketplace
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {displayedOrders.map((order) => {
              const isBuyer = order.buyer_id === user?.id;
              const isExpanded = expandedOrderId === order.id;
              const events = eventsByOrder[order.id] ?? [];

              return (
                <article
                  key={order.id}
                  className="border hairline-border bg-brand-charcoal/65 p-6"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <OrderStatusBadge status={order.status} />
                        <span className="border hairline-border bg-brand-black px-2 py-0.5 font-body text-[0.65rem] tracking-[0.16em] text-brand-muted uppercase">
                          Manual Fulfilment
                        </span>
                      </div>

                      <h2 className="heading-section mt-3 text-2xl text-brand-white">
                        {order.listing_title}
                      </h2>

                      <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-brand-muted uppercase">
                            {isBuyer ? 'Seller' : 'Buyer'}
                          </dt>
                          <dd className="mt-0.5 text-brand-cream">
                            @{isBuyer ? order.seller_username : order.buyer_username}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-brand-muted uppercase">Agreed Price</dt>
                          <dd className="mt-0.5 font-heading text-sm text-brand-gold">
                            {order.agreed_price_currency}{' '}
                            {order.agreed_price_amount.toLocaleString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-brand-muted uppercase">Game Funds</dt>
                          <dd className="mt-0.5 text-brand-cream">
                            {order.requested_game_currency_amount
                              ? `₦${order.requested_game_currency_amount.toLocaleString()}`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-brand-muted uppercase">Recipient</dt>
                          <dd className="mt-0.5 text-brand-cream">
                            {order.recipient_lagos_life_username ?? '—'}
                          </dd>
                        </div>
                      </dl>

                      {(order.buyer_note || order.seller_note) && (
                        <div className="mt-4 space-y-1.5 border-l border-brand-gold/35 pl-3 text-xs text-brand-muted">
                          {order.buyer_note && (
                            <p>
                              <span className="text-brand-cream">Buyer note:</span>{' '}
                              {order.buyer_note}
                            </p>
                          )}
                          {order.seller_note && (
                            <p>
                              <span className="text-brand-gold">Seller note:</span>{' '}
                              {order.seller_note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Role-Gated Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isBuyer &&
                        (order.status === 'requested' || order.status === 'accepted') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setModalError(null);
                              setActionNote('');
                              setActionModal({
                                order,
                                nextStatus: 'cancelled',
                                title: 'Cancel Purchase Request',
                                description: 'Cancel this order before fulfilment starts?',
                                noteLabel: 'Cancellation reason (optional)',
                              });
                            }}
                          >
                            Cancel
                          </Button>
                        )}

                      {isBuyer && order.status === 'seller_marked_sent' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setActionNote('');
                            setActionModal({
                              order,
                              nextStatus: 'buyer_confirmed',
                              title: 'Confirm Receipt',
                              description:
                                'Only confirm receipt after you have verified the exact game currency or item arrived on your account.',
                              noteLabel: 'Confirmation note (optional)',
                            });
                          }}
                        >
                          Confirm Receipt
                        </Button>
                      )}

                      {!isBuyer && order.status === 'requested' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setModalError(null);
                              setActionNote('');
                              setActionModal({
                                order,
                                nextStatus: 'accepted',
                                title: 'Accept Purchase Request',
                                description:
                                  'Accepting notifies the buyer that you are ready to coordinate payment and manual fulfilment.',
                                noteLabel: 'Coordination note for buyer (optional)',
                              });
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setModalError(null);
                              setActionNote('');
                              setActionModal({
                                order,
                                nextStatus: 'rejected',
                                title: 'Reject Request',
                                description: 'Decline this purchase request?',
                                noteLabel: 'Reason for rejecting (optional)',
                              });
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {!isBuyer && order.status === 'accepted' && (
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setActionNote('');
                            setActionModal({
                              order,
                              nextStatus: 'in_progress',
                              title: 'Mark In Progress',
                              description:
                                'Signal to the buyer that manual fulfilment is currently underway.',
                              noteLabel: 'Status update note (optional)',
                            });
                          }}
                        >
                          Mark In Progress
                        </Button>
                      )}

                      {!isBuyer &&
                        (order.status === 'accepted' ||
                          order.status === 'in_progress') &&
                        (order.recipient_lagos_life_username ||
                          order.requested_game_currency_amount) && (
                          <Button
                            to={`${ROUTES.dashboardTreasury}?${new URLSearchParams({
                              ...(order.recipient_lagos_life_username
                                ? { to: order.recipient_lagos_life_username }
                                : {}),
                              ...(order.requested_game_currency_amount
                                ? { amount: String(order.requested_game_currency_amount) }
                                : {}),
                            }).toString()}`}
                            variant="secondary"
                            size="sm"
                          >
                            <Send className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                            Send via MoneySender
                          </Button>
                        )}

                      {!isBuyer &&
                        (order.status === 'accepted' ||
                          order.status === 'in_progress') && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setModalError(null);
                              setActionNote('');
                              setActionModal({
                                order,
                                nextStatus: 'seller_marked_sent',
                                title: 'Mark Delivery Sent',
                                description:
                                  'Marking an order as sent notifies the buyer to verify receipt. It does not automatically complete the order.',
                                noteLabel: 'Fulfilment reference or note (optional)',
                              });
                            }}
                          >
                            Mark Sent
                          </Button>
                        )}

                      {(order.status === 'accepted' ||
                        order.status === 'in_progress' ||
                        order.status === 'seller_marked_sent') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setModalError(null);
                            setDisputeReason('currency_not_received');
                            setDisputeDesc('');
                            setDisputeOrder(order);
                          }}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          Report Dispute
                        </Button>
                      )}

                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => void toggleTimeline(order.id)}
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {isExpanded ? 'Hide Timeline' : 'Timeline'}
                      </Button>
                    </div>
                  </div>

                  {/* Immutable Order Event Timeline */}
                  {isExpanded && (
                    <div className="mt-5 border-t hairline-border pt-5">
                      <p className="heading-eyebrow">Immutable Order History</p>
                      {events.length === 0 ? (
                        <p className="mt-2 font-body text-xs text-brand-muted">
                          Loading order events...
                        </p>
                      ) : (
                        <ol className="mt-3 space-y-2.5 border-l border-brand-gold/30 pl-4">
                          {events.map((ev) => (
                            <li key={ev.id} className="text-xs">
                              <span className="font-heading tracking-[0.14em] text-brand-gold uppercase">
                                {ev.event_type}
                              </span>
                              <span className="ml-2 text-brand-muted">
                                {formatDateTime(ev.created_at)}
                              </span>
                              <p className="mt-0.5 text-brand-cream/85">
                                {ev.event_description}
                              </p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </PageContainer>

      {/* Order Transition Modal */}
      {actionModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => !isSubmittingAction && setActionModal(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="heading-eyebrow">Confirm Order Action</p>
            <h2 className="heading-section mt-2 text-2xl text-brand-white">
              {actionModal.title}
            </h2>
            <p className="mt-2 font-body text-xs leading-relaxed text-brand-muted">
              {actionModal.description}
            </p>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleConfirmAction} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="order-action-note"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  {actionModal.noteLabel}
                </label>
                <textarea
                  id="order-action-note"
                  rows={3}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmittingAction}
                  onClick={() => setActionModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingAction}
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Updating...
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

      {/* Open Dispute Modal */}
      {disputeOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-red-400/50 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => !isSubmittingDispute && setDisputeOrder(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="heading-eyebrow">Report Problem</p>
            <h2 className="heading-section mt-2 text-2xl text-brand-white">
              Open Order Dispute
            </h2>
            <p className="mt-2 font-body text-xs text-brand-muted">
              Opening a dispute locks ordinary status transitions on{' '}
              <span className="text-brand-cream">{disputeOrder.listing_title}</span>{' '}
              until a VATAR administrator reviews it.
            </p>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleSubmitDispute} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="dispute-reason"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Reason
                </label>
                <select
                  id="dispute-reason"
                  value={disputeReason}
                  onChange={(e) =>
                    setDisputeReason(e.target.value as MarketplaceDisputeReason)
                  }
                  className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                >
                  {DISPUTE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {DISPUTE_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="dispute-desc"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Description (Required)
                </label>
                <textarea
                  id="dispute-desc"
                  rows={4}
                  required
                  minLength={10}
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  placeholder="Describe clearly what happened (min 10 characters; never share passwords, PINs, or OTPs)..."
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmittingDispute}
                  onClick={() => setDisputeOrder(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingDispute}
                >
                  {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
