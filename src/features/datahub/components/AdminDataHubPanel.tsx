import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Receipt,
  RefreshCw,
  Settings,
  Wallet,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  TransferReceiptModal,
  type TransferReceiptData,
} from '@/components/shared/TransferReceiptModal';
import { Button } from '@/components/ui/Button';
import {
  adminUpdateDataHubSettings,
  adminUpdateDataOrder,
  adminUpdateDataPlanVariation,
  DATA_ORDER_STATUS_LABELS,
  fetchAdminDataOrders,
  fetchDataHubCatalog,
  fetchVtpassVariations,
  fetchVtpassWalletBalance,
  triggerAutoDataDelivery,
  type AdminDataOrderView,
  type VtpassVariationItem,
} from '@/features/datahub/services/dataHubService';
import type {
  DataHubSettingsRecord,
  DataOrderStatus,
  DataPlanRecord,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

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

export function AdminDataHubPanel() {
  const [orders, setOrders] = useState<AdminDataOrderView[]>([]);
  const [plans, setPlans] = useState<DataPlanRecord[]>([]);
  const [settings, setSettings] = useState<DataHubSettingsRecord | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [vtpassEnv, setVtpassEnv] = useState<string | null>(null);
  const [vtpassConfigured, setVtpassConfigured] = useState(false);
  const [vtpassNote, setVtpassNote] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<TransferReceiptData | null>(null);

  // Settings & VTpass variation mapper
  const [showSettings, setShowSettings] = useState(false);
  const [receivingHandle, setReceivingHandle] = useState('softCollins');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [vtpassVariations, setVtpassVariations] = useState<VtpassVariationItem[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const loadAll = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setLoading(true);
    else setRefreshing(true);

    const [ordersRes, catalogRes, walletRes] = await Promise.all([
      fetchAdminDataOrders(),
      fetchDataHubCatalog(),
      fetchVtpassWalletBalance(),
    ]);

    if (ordersRes.error) {
      setBanner({ type: 'error', text: ordersRes.error });
    } else {
      setOrders(ordersRes.orders);
    }

    if (!catalogRes.error) {
      setPlans(catalogRes.plans);
      if (catalogRes.settings) {
        setSettings(catalogRes.settings);
        setReceivingHandle(catalogRes.settings.receiving_lagos_life_handle);
        setWhatsappNumber(catalogRes.settings.whatsapp_number);
        setIsEnabled(catalogRes.settings.is_enabled);
      }
    }

    setWalletBalance(walletRes.balance);
    setVtpassEnv(walletRes.env);
    setVtpassConfigured(walletRes.configured);
    setVtpassNote(walletRes.error);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const pendingOrders = useMemo(
    () =>
      orders.filter((o) =>
        ['awaiting_transfer', 'transfer_sent', 'delivering', 'failed'].includes(o.status),
      ),
    [orders],
  );

  const visibleOrders = filterMode === 'pending' ? pendingOrders : orders;

  const handleCopyPhone = async (id: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneId(id);
      window.setTimeout(() => setCopiedPhoneId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleAutoDeliver = async (order: AdminDataOrderView) => {
    setBusyOrderId(order.id);
    setBanner(null);

    const res = await triggerAutoDataDelivery(order.id);
    setBusyOrderId(null);

    if (!res.ok) {
      setBanner({ type: 'error', text: res.error || 'Auto-delivery failed.' });
      if (res.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...res.order! } : o)));
      }
      return;
    }

    if (res.order) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...res.order! } : o)));
    }
    setBanner({
      type: 'success',
      text: res.message || `Delivered ${order.plan_label} to ${order.phone_number}!`,
    });
    void loadAll(false);
  };

  const handleManualStatus = async (
    order: AdminDataOrderView,
    nextStatus: 'delivered' | 'rejected',
  ) => {
    setBusyOrderId(order.id);
    const res = await adminUpdateDataOrder({
      orderId: order.id,
      nextStatus,
      vtuResponseNote:
        nextStatus === 'delivered'
          ? 'Marked delivered manually by admin.'
          : 'Rejected by admin.',
    });
    setBusyOrderId(null);

    if (res.error) {
      setBanner({ type: 'error', text: res.error });
    } else if (res.order) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...res.order! } : o)));
      setBanner({
        type: 'success',
        text: `Order ${order.order_code} marked ${nextStatus}.`,
      });
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const res = await adminUpdateDataHubSettings({
      receivingHandle,
      whatsappNumber,
      isEnabled,
    });
    setSavingSettings(false);
    if (res.error) {
      setBanner({ type: 'error', text: res.error });
    } else if (res.settings) {
      setSettings(res.settings);
      setBanner({ type: 'success', text: 'Data Hub settings saved.' });
    }
  };

  const handleLoadVariations = async () => {
    setLoadingVariations(true);
    const res = await fetchVtpassVariations();
    setLoadingVariations(false);
    if (res.error) {
      setBanner({ type: 'error', text: res.error });
    } else {
      setVtpassVariations(res.variations);
      setBanner({
        type: 'success',
        text: `Loaded ${res.variations.length} live MTN variation codes from VTpass.`,
      });
    }
  };

  if (loading) {
    return (
      <div className="border hairline-border bg-brand-charcoal/50 p-8 text-sm text-brand-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-brand-gold" />
        Loading VATAR Data Hub &amp; VTpass Wallet...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 border px-4 py-3 text-sm',
            banner.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200',
          )}
        >
          <span className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            {banner.text}
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="cursor-pointer opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. VTPASS AUTO-DELIVERY WALLET BAR */}
      <section className="border border-brand-gold/35 bg-brand-charcoal/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="heading-eyebrow flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-brand-gold" />
              VTpass Automated MTN Data Wallet
            </p>
            {vtpassConfigured ? (
              <p className="mt-1 font-heading text-lg text-brand-white">
                ₦{(walletBalance ?? 0).toLocaleString()}{' '}
                <span className="ml-1.5 border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300 uppercase">
                  VTpass {vtpassEnv || 'live'} Connected
                </span>
              </p>
            ) : (
              <p className="mt-1 font-body text-xs text-brand-muted">
                <Wallet className="mr-1 inline h-3.5 w-3.5 text-brand-gold" />
                {vtpassNote || 'Add VTpass API secrets in Supabase Edge Functions to enable 1-click auto-delivery (manual delivery still works anytime).'}
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={() => void loadAll(false)}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Sync Wallet
          </Button>
        </div>
      </section>

      {/* 2. INCOMING DATA ORDERS QUEUE */}
      <section className="border hairline-border bg-brand-charcoal/55 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="heading-eyebrow flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-brand-gold" />
              MTN Data Hub Orders
            </p>
            <h3 className="heading-section mt-1 text-xl text-brand-white">
              {pendingOrders.length > 0
                ? `${pendingOrders.length} Data Order(s) Pending`
                : 'All Data Orders Delivered'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('pending')}
              className={cn(
                'cursor-pointer border px-3 py-1.5 font-heading text-[0.68rem] tracking-[0.16em] uppercase',
                filterMode === 'pending'
                  ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                  : 'hairline-border text-brand-muted',
              )}
            >
              Pending ({pendingOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={cn(
                'cursor-pointer border px-3 py-1.5 font-heading text-[0.68rem] tracking-[0.16em] uppercase',
                filterMode === 'all'
                  ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                  : 'hairline-border text-brand-muted',
              )}
            >
              All History ({orders.length})
            </button>
          </div>
        </div>

        {visibleOrders.length === 0 ? (
          <p className="mt-4 font-body text-sm text-brand-muted">
            No MTN data orders in this view yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleOrders.map((order) => {
              const isActionable = [
                'awaiting_transfer',
                'transfer_sent',
                'failed',
              ].includes(order.status);

              return (
                <article
                  key={order.id}
                  className={cn(
                    'border p-4',
                    order.status === 'transfer_sent'
                      ? 'border-brand-gold/60 bg-brand-black/90'
                      : 'hairline-border bg-brand-black/60',
                  )}
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-xs tracking-[0.16em] text-brand-gold">
                          {order.order_code}
                        </span>
                        <span
                          className={cn(
                            'border px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.14em] uppercase',
                            statusBadgeClass(order.status),
                          )}
                        >
                          {DATA_ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span className="font-body text-xs text-brand-muted">
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-heading text-base font-semibold text-brand-white">
                          {order.plan_label} &mdash; {order.in_game_label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm text-brand-gold">
                          {order.phone_number}
                          <button
                            type="button"
                            onClick={() => void handleCopyPhone(order.id, order.phone_number)}
                            className="cursor-pointer border hairline-border bg-brand-charcoal px-1.5 py-0.5 text-[10px] text-brand-cream hover:border-brand-gold"
                          >
                            {copiedPhoneId === order.id ? (
                              <Check className="inline h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="inline h-3 w-3" />
                            )}
                          </button>
                        </span>
                        <span className="font-body text-xs text-brand-muted">
                          From @{order.lagos_life_username} ({order.buyer_full_name})
                        </span>
                      </div>

                      {order.vtu_response_note && (
                        <p className="mt-1 font-mono text-[11px] text-brand-muted">
                          {order.vtu_response_note}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isActionable && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busyOrderId === order.id}
                            onClick={() => void handleAutoDeliver(order)}
                          >
                            {busyOrderId === order.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                            Auto-Deliver Data
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyOrderId === order.id}
                            onClick={() => void handleManualStatus(order, 'delivered')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark Done
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyOrderId === order.id}
                            onClick={() => void handleManualStatus(order, 'rejected')}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setActiveReceipt({
                            title: `Data Hub — ${order.plan_label}`,
                            reference: order.vtu_reference || order.order_code,
                            recipient: `${order.phone_number} (@${order.lagos_life_username})`,
                            senders: ['VATAR Data Hub'],
                            totalAmount: order.in_game_amount,
                            sentAmount:
                              order.status === 'delivered' ? order.in_game_amount : 0,
                            status: DATA_ORDER_STATUS_LABELS[order.status],
                            timestamp: order.delivered_at || order.created_at,
                            note: order.vtu_response_note,
                          })
                        }
                      >
                        <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                        Receipt
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. COLLAPSIBLE DATA HUB SETTINGS & VTPASS VARIATION MAPPER */}
      <section className="border hairline-border bg-brand-charcoal/45">
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
        >
          <span className="flex items-center gap-2 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase">
            <Settings className="h-4 w-4 text-brand-gold" />
            Data Hub Settings &amp; VTpass Plan Mapping
            {!settings?.whatsapp_number && (
              <span className="border border-brand-gold/50 bg-brand-gold/15 px-2 py-0.5 text-[0.6rem] text-brand-gold">
                Setup
              </span>
            )}
          </span>
          {showSettings ? (
            <ChevronUp className="h-4 w-4 text-brand-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-brand-muted" />
          )}
        </button>

        {showSettings && (
          <div className="space-y-6 border-t hairline-border p-5">
            <form onSubmit={(e) => void handleSaveSettings(e)} className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block font-heading text-[0.65rem] tracking-[0.16em] text-brand-cream uppercase">
                  Receiving LagosLife Handle
                </label>
                <input
                  type="text"
                  required
                  value={receivingHandle}
                  onChange={(e) => setReceivingHandle(e.target.value)}
                  placeholder="softCollins"
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-heading text-[0.65rem] tracking-[0.16em] text-brand-cream uppercase">
                  Owner WhatsApp Number
                </label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="2348087521558"
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex items-end justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-brand-cream">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="h-4 w-4 accent-brand-gold"
                  />
                  Hub Active
                </label>
                <Button type="submit" variant="primary" size="sm" disabled={savingSettings}>
                  {savingSettings ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>

            {/* VTpass Variation Code Mapper */}
            <div className="border-t hairline-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-heading text-xs tracking-[0.16em] text-brand-gold uppercase">
                  VTpass MTN Variation Codes
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={loadingVariations}
                  onClick={() => void handleLoadVariations()}
                >
                  {loadingVariations ? 'Fetching...' : 'Fetch Live VTpass Codes'}
                </Button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {plans.map((plan) => (
                  <div
                    key={plan.code}
                    className="flex items-center justify-between gap-2 border hairline-border bg-brand-black/60 px-3 py-2 text-xs"
                  >
                    <span className="text-brand-cream">
                      {plan.data_label} ({plan.validity_label}) &bull; {plan.in_game_label}
                    </span>
                    {vtpassVariations.length > 0 ? (
                      <select
                        value={plan.vtpass_variation_code}
                        onChange={async (e) => {
                          const code = e.target.value;
                          const res = await adminUpdateDataPlanVariation(plan.code, code);
                          if (res.plan) {
                            setPlans((prev) =>
                              prev.map((p) => (p.code === plan.code ? res.plan! : p)),
                            );
                          }
                        }}
                        className="max-w-[180px] border hairline-border bg-brand-charcoal px-2 py-1 font-mono text-[11px] text-brand-white"
                      >
                        <option value={plan.vtpass_variation_code}>
                          {plan.vtpass_variation_code}
                        </option>
                        {vtpassVariations.map((v) => (
                          <option key={v.variation_code} value={v.variation_code}>
                            {v.name} ({v.variation_code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono text-[11px] text-brand-muted">
                        {plan.vtpass_variation_code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <TransferReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
