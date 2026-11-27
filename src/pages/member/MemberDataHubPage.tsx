import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Receipt,
  RefreshCw,
  Send,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  TransferReceiptModal,
  type TransferReceiptData,
} from '@/components/shared/TransferReceiptModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  buildDataWhatsAppUrl,
  cancelDataOrder,
  createDataOrder,
  DATA_ORDER_STATUS_LABELS,
  fetchDataHubCatalog,
  fetchMyDataOrders,
  markDataTransferSent,
} from '@/features/datahub/services/dataHubService';
import type {
  DataHubSettingsRecord,
  DataOrderRecord,
  DataOrderStatus,
  DataPlanCategory,
  DataPlanRecord,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

function statusBadgeClass(status: DataOrderStatus): string {
  switch (status) {
    case 'delivered':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
    case 'delivering':
    case 'transfer_sent':
      return 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold';
    case 'failed':
    case 'rejected':
    case 'cancelled':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
    default:
      return 'border-brand-cream/25 bg-brand-black text-brand-cream';
  }
}

export function MemberDataHubPage() {
  const { profile } = useAuth();

  const [settings, setSettings] = useState<DataHubSettingsRecord | null>(null);
  const [plans, setPlans] = useState<DataPlanRecord[]>([]);
  const [orders, setOrders] = useState<DataOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryTab, setCategoryTab] = useState<DataPlanCategory>('daily');
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [lagosUsername, setLagosUsername] = useState(profile?.lagos_life_username ?? '');
  const [submitting, setSubmitting] = useState(false);

  const [activeOrder, setActiveOrder] = useState<DataOrderRecord | null>(null);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<TransferReceiptData | null>(null);

  useEffect(() => {
    if (profile?.lagos_life_username && !lagosUsername) {
      setLagosUsername(profile.lagos_life_username);
    }
  }, [profile?.lagos_life_username, lagosUsername]);

  const loadData = useCallback(async () => {
    setError(null);
    const [catalogRes, ordersRes] = await Promise.all([
      fetchDataHubCatalog(),
      fetchMyDataOrders(),
    ]);

    if (catalogRes.error) {
      setError(catalogRes.error);
    } else {
      setSettings(catalogRes.settings);
      setPlans(catalogRes.plans);
      if (!selectedPlanCode && catalogRes.plans.length > 0) {
        setSelectedPlanCode(catalogRes.plans[0].code);
      }
    }

    if (!ordersRes.error) {
      setOrders(ordersRes.orders);
      const open = ordersRes.orders.find((o) => o.status === 'awaiting_transfer');
      setActiveOrder((prev) => {
        if (prev) return ordersRes.orders.find((o) => o.id === prev.id) ?? prev;
        return open ?? null;
      });
    }
    setLoading(false);
  }, [selectedPlanCode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visiblePlans = useMemo(
    () => plans.filter((p) => p.category === categoryTab),
    [plans, categoryTab],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.code === selectedPlanCode) ?? visiblePlans[0] ?? null,
    [plans, selectedPlanCode, visiblePlans],
  );

  const receivingHandle = (settings?.receiving_lagos_life_handle || 'softCollins').replace(/^@/, '');

  const handleCopyHandle = async () => {
    try {
      await navigator.clipboard.writeText(`@${receivingHandle}`);
      setCopiedHandle(true);
      window.setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOrder = async () => {
    if (!selectedPlan) return;
    setError(null);
    setSubmitting(true);
    const res = await createDataOrder({
      planCode: selectedPlan.code,
      phoneNumber,
      lagosLifeUsername: lagosUsername,
    });
    setSubmitting(false);

    if (res.error || !res.order) {
      setError(res.error || 'Could not create data order.');
      return;
    }

    setActiveOrder(res.order);
    setOrders((prev) => [res.order!, ...prev]);
  };

  const handleSentAndNotify = async (order: DataOrderRecord) => {
    const waUrl = buildDataWhatsAppUrl(
      settings?.whatsapp_number ?? '',
      order,
      receivingHandle,
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    if (order.status === 'awaiting_transfer') {
      setBusyId(order.id);
      const res = await markDataTransferSent(order.id);
      setBusyId(null);
      if (res.order) {
        setActiveOrder(res.order);
        setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      }
    }
  };

  const handleCancel = async (orderId: string) => {
    setBusyId(orderId);
    const res = await cancelDataOrder(orderId);
    setBusyId(null);
    if (res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      if (activeOrder?.id === orderId) setActiveOrder(null);
    }
  };

  return (
    <div className="bg-brand-black">
      {/* Compact Header */}
      <section className="border-b hairline-border bg-brand-obsidian">
        <PageContainer className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="heading-eyebrow flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-brand-gold" />
                MTN Data Using LagosLife Funds
              </p>
              <h1 className="heading-display mt-1 text-2xl text-brand-white sm:text-3xl">
                VATAR Data Hub
              </h1>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-6 py-6 sm:py-8">
        {error && (
          <div className="flex items-center gap-2.5 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="border hairline-border bg-brand-charcoal/50 p-6 text-sm text-brand-muted">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-brand-gold" />
            Loading MTN Data Plans...
          </div>
        ) : settings && !settings.is_enabled ? (
          <div className="border hairline-border bg-brand-charcoal/50 p-6 text-sm text-brand-muted">
            VATAR Data Hub is temporarily paused. Please check back shortly.
          </div>
        ) : (
          <div className="border border-brand-gold/40 bg-brand-charcoal/70 p-5 sm:p-7 space-y-6">
            {/* Active Transfer Payment Instructions */}
            {activeOrder &&
              (activeOrder.status === 'awaiting_transfer' ||
                activeOrder.status === 'transfer_sent' ||
                activeOrder.status === 'delivering') && (
                <div className="border border-brand-gold bg-brand-black/90 p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-xs tracking-[0.18em] text-brand-gold">
                          {activeOrder.order_code}
                        </span>
                        <span
                          className={cn(
                            'border px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.14em] uppercase',
                            statusBadgeClass(activeOrder.status),
                          )}
                        >
                          {DATA_ORDER_STATUS_LABELS[activeOrder.status]}
                        </span>
                      </div>
                      <h2 className="mt-1 font-heading text-xl text-brand-white">
                        {activeOrder.plan_label} &mdash; {activeOrder.in_game_label}
                      </h2>
                      <p className="mt-0.5 font-body text-xs text-brand-muted">
                        MTN Phone: <strong className="text-brand-cream">{activeOrder.phone_number}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveOrder(null)}
                      className="cursor-pointer p-1 text-brand-muted hover:text-brand-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 border-t border-b hairline-border py-3 sm:grid-cols-2">
                    <div>
                      <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-muted uppercase">
                        Send LagosLife Funds To
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-heading text-base text-brand-gold">
                          @{receivingHandle}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyHandle()}
                          className="inline-flex cursor-pointer items-center gap-1 border border-brand-gold/40 bg-brand-charcoal px-2 py-0.5 font-heading text-[0.62rem] uppercase text-brand-cream hover:border-brand-gold"
                        >
                          {copiedHandle ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-muted uppercase">
                        Exact In-Game Amount
                      </p>
                      <p className="mt-1 font-heading text-base text-brand-white">
                        {activeOrder.in_game_label}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      to={`${ROUTES.dashboardTreasury}?to=${encodeURIComponent(receivingHandle)}&amount=${encodeURIComponent(activeOrder.in_game_label)}`}
                      variant="secondary"
                      size="sm"
                    >
                      <Send className="h-3.5 w-3.5 text-brand-gold" />
                      Send via Treasury
                    </Button>

                    <button
                      type="button"
                      disabled={busyId === activeOrder.id}
                      onClick={() => void handleSentAndNotify(activeOrder)}
                      className="inline-flex cursor-pointer items-center gap-2 border border-brand-gold bg-brand-gold px-4 py-2 font-heading text-xs font-semibold tracking-[0.16em] text-brand-black uppercase hover:bg-brand-cream"
                    >
                      <MessageCircle className="h-4 w-4" />
                      I&apos;ve Sent {activeOrder.in_game_label} — Notify Admin
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>

                    {(activeOrder.status === 'awaiting_transfer' ||
                      activeOrder.status === 'transfer_sent') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === activeOrder.id}
                        onClick={() => void handleCancel(activeOrder.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>

                  {activeOrder.status === 'transfer_sent' && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-brand-gold">
                      <CheckCircle2 className="h-4 w-4" />
                      Marked sent — admin will verify &amp; auto-deliver MTN data to {activeOrder.phone_number}.
                    </p>
                  )}
                </div>
              )}

            {/* Category Tabs: MTN Daily vs MTN Weekly */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryTab('daily');
                    const first = plans.find((p) => p.category === 'daily');
                    if (first) setSelectedPlanCode(first.code);
                  }}
                  className={cn(
                    'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.16em] uppercase',
                    categoryTab === 'daily'
                      ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                      : 'hairline-border bg-brand-black text-brand-muted hover:text-brand-white',
                  )}
                >
                  MTN Daily Plans
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryTab('weekly');
                    const first = plans.find((p) => p.category === 'weekly');
                    if (first) setSelectedPlanCode(first.code);
                  }}
                  className={cn(
                    'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.16em] uppercase',
                    categoryTab === 'weekly'
                      ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                      : 'hairline-border bg-brand-black text-brand-muted hover:text-brand-white',
                  )}
                >
                  MTN Weekly Plans
                </button>
              </div>
              <span className="font-mono text-xs text-brand-muted">
                Pay in LagosLife Funds &bull; Delivered to MTN Line
              </span>
            </div>

            {/* Plan Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {visiblePlans.map((plan) => {
                const selected = selectedPlan?.code === plan.code;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlanCode(plan.code)}
                    className={cn(
                      'flex cursor-pointer flex-col items-start border px-4 py-3 text-left transition-all',
                      selected
                        ? 'border-brand-gold bg-brand-gold/15 ring-1 ring-brand-gold'
                        : 'hairline-border bg-brand-black/60 hover:border-brand-gold/50',
                    )}
                  >
                    <span className="font-heading text-lg font-semibold text-brand-white">
                      {plan.data_label}
                    </span>
                    <span className="font-body text-[11px] text-brand-muted">
                      {plan.validity_label}
                    </span>
                    <span className="mt-1.5 font-mono text-xs font-semibold text-brand-gold">
                      {plan.in_game_label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Phone Number + LagosLife Username + Order CTA */}
            <div className="grid gap-4 border-t hairline-border pt-5 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-4">
                <label className="block font-heading text-[0.68rem] tracking-[0.18em] text-brand-cream uppercase">
                  MTN Phone Number
                </label>
                <div className="relative mt-1.5">
                  <Smartphone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-brand-gold" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="08031234567"
                    maxLength={14}
                    className="w-full border hairline-border bg-brand-black py-2.5 pr-3 pl-9 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block font-heading text-[0.68rem] tracking-[0.18em] text-brand-cream uppercase">
                  Your LagosLife Handle
                </label>
                <input
                  type="text"
                  value={lagosUsername}
                  onChange={(e) => setLagosUsername(e.target.value)}
                  placeholder="@yourhandle"
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={submitting || !selectedPlan}
                  onClick={() => void handleOrder()}
                >
                  {submitting
                    ? 'Creating Order...'
                    : selectedPlan
                      ? `Order ${selectedPlan.data_label} — ${selectedPlan.in_game_label}`
                      : 'Select a Plan'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Data Orders + Receipts */}
        {orders.length > 0 && (
          <section className="border hairline-border bg-brand-charcoal/50 p-5">
            <p className="font-heading text-xs tracking-[0.18em] text-brand-muted uppercase">
              Your Data Hub Orders ({orders.length})
            </p>
            <div className="mt-3 space-y-2">
              {orders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 border hairline-border bg-brand-black/60 px-4 py-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-heading tracking-[0.14em] text-brand-gold">
                      {order.order_code}
                    </span>
                    <span className="font-medium text-brand-white">
                      {order.plan_label} ({order.in_game_label})
                    </span>
                    <span className="font-mono text-brand-muted">{order.phone_number}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'border px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.14em] uppercase',
                        statusBadgeClass(order.status),
                      )}
                    >
                      {DATA_ORDER_STATUS_LABELS[order.status]}
                    </span>
                    {(order.status === 'awaiting_transfer' ||
                      order.status === 'transfer_sent') && (
                      <button
                        type="button"
                        onClick={() => setActiveOrder(order)}
                        className="cursor-pointer font-heading text-[0.65rem] tracking-[0.14em] text-brand-gold uppercase hover:underline"
                      >
                        Pay
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveReceipt({
                          title: `Data Hub — ${order.plan_label}`,
                          reference: order.vtu_reference || order.order_code,
                          recipient: `${order.phone_number} (@${order.lagos_life_username})`,
                          senders: ['VATAR Data Hub'],
                          totalAmount: order.in_game_amount,
                          sentAmount: order.status === 'delivered' ? order.in_game_amount : 0,
                          status: DATA_ORDER_STATUS_LABELS[order.status],
                          timestamp: order.delivered_at || order.created_at,
                          note: order.vtu_response_note,
                        })
                      }
                      className="inline-flex cursor-pointer items-center gap-1 border hairline-border bg-brand-charcoal px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.12em] text-brand-cream uppercase hover:border-brand-gold hover:text-brand-gold"
                    >
                      <Receipt className="h-3 w-3 text-brand-gold" />
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </PageContainer>

      <TransferReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
