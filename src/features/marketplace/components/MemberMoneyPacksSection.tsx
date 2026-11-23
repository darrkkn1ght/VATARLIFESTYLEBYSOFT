import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  buildWhatsAppReceiptUrl,
  cancelMoneyPackOrder,
  createMoneyPackOrder,
  fetchMoneyPackSettings,
  fetchMyMoneyPackOrders,
  markMoneyPackPaymentSubmitted,
  MONEY_PACK_STATUS_LABELS,
  OFFICIAL_MONEY_PACKS,
  type MoneyPackTier,
} from '@/features/marketplace/services/moneyPackService';
import type {
  MoneyPackOrderRecord,
  MoneyPackOrderStatus,
  MoneyPackSettingsRecord,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

function statusBadgeClass(status: MoneyPackOrderStatus): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
    case 'sending':
    case 'payment_submitted':
      return 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold';
    case 'rejected':
    case 'cancelled':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
    default:
      return 'border-brand-cream/25 bg-brand-black text-brand-cream';
  }
}

export function MemberMoneyPacksSection() {
  const { profile } = useAuth();

  const [settings, setSettings] = useState<MoneyPackSettingsRecord | null>(null);
  const [orders, setOrders] = useState<MoneyPackOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPack, setSelectedPack] = useState<MoneyPackTier>(OFFICIAL_MONEY_PACKS[4]); // 500B default
  const [quantity, setQuantity] = useState(1);
  const [lagosUsername, setLagosUsername] = useState(profile?.lagos_life_username ?? '');
  const [submitting, setSubmitting] = useState(false);

  const [activeOrder, setActiveOrder] = useState<MoneyPackOrderRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.lagos_life_username && !lagosUsername) {
      setLagosUsername(profile.lagos_life_username);
    }
  }, [profile?.lagos_life_username, lagosUsername]);

  const loadData = useCallback(async () => {
    setError(null);
    const [settingsRes, ordersRes] = await Promise.all([
      fetchMoneyPackSettings(),
      fetchMyMoneyPackOrders(),
    ]);
    if (settingsRes.error) {
      setError(settingsRes.error);
    } else {
      setSettings(settingsRes.settings);
    }
    if (!ordersRes.error) {
      setOrders(ordersRes.orders);
      // Auto-surface any awaiting_payment order so member doesn't lose payment details
      const openOrder = ordersRes.orders.find((o) => o.status === 'awaiting_payment');
      setActiveOrder((prev) => {
        if (prev) {
          const updated = ordersRes.orders.find((o) => o.id === prev.id);
          return updated ?? prev;
        }
        return openOrder ?? null;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalPriceNgn = selectedPack.priceNgn * quantity;

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handlePlaceOrder = async () => {
    if (!lagosUsername.trim()) {
      setError('Enter your LagosLife username to receive your funds.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await createMoneyPackOrder({
      packCode: selectedPack.code,
      quantity,
      lagosLifeUsername: lagosUsername.trim(),
    });

    setSubmitting(false);
    if (res.error || !res.order) {
      setError(res.error || 'Could not create order. Please try again.');
      return;
    }

    setActiveOrder(res.order);
    setOrders((prev) => [res.order!, ...prev]);
  };

  const handlePaidAndWhatsApp = async (order: MoneyPackOrderRecord) => {
    const waUrl = buildWhatsAppReceiptUrl(
      settings?.whatsapp_number ?? '',
      order,
      profile?.username,
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    if (order.status === 'awaiting_payment') {
      setActionBusyId(order.id);
      const res = await markMoneyPackPaymentSubmitted(order.id);
      setActionBusyId(null);
      if (res.order) {
        setActiveOrder(res.order);
        setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      }
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setActionBusyId(orderId);
    const res = await cancelMoneyPackOrder(orderId);
    setActionBusyId(null);
    if (res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      if (activeOrder?.id === orderId) {
        setActiveOrder(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="mb-10 border hairline-border bg-brand-charcoal/50 p-6">
        <div className="flex items-center gap-3 text-sm text-brand-muted">
          <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
          Loading Official VATAR Money Packs...
        </div>
      </div>
    );
  }

  return (
    <section className="mb-10 border border-brand-gold/40 bg-brand-charcoal/70 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="heading-eyebrow flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
            Official Store — By Soft
          </p>
          <h2 className="heading-section mt-1 text-2xl text-brand-white sm:text-3xl">
            LagosLife Money Packs
          </h2>
          <p className="mt-1 font-body text-sm text-brand-muted">
            Tap a pack, pay to the official account, and tap once to send your receipt on WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {settings?.telegram_url && (
            <a
              href={settings.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border hairline-border bg-brand-black/60 px-3 py-2 font-heading text-[0.68rem] tracking-[0.16em] text-brand-cream uppercase transition-colors hover:border-brand-gold hover:text-brand-gold"
            >
              <Send className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
              Telegram Channel
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          <Button variant="secondary" size="sm" onClick={() => void loadData()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-center gap-2.5 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {settings && !settings.is_enabled ? (
        <div className="mt-6 border hairline-border bg-brand-black/60 p-5 text-sm text-brand-muted">
          Official money pack orders are temporarily paused by the owner. Check back shortly or join our Telegram channel for updates.
        </div>
      ) : (
        <>
          {/* Active Payment Checkout Card */}
          {activeOrder &&
            (activeOrder.status === 'awaiting_payment' ||
              activeOrder.status === 'payment_submitted' ||
              activeOrder.status === 'sending') && (
              <div className="mt-6 border border-brand-gold bg-brand-black/90 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-xs tracking-[0.2em] text-brand-gold uppercase">
                        Order {activeOrder.order_code}
                      </span>
                      <span
                        className={cn(
                          'border px-2 py-0.5 font-heading text-[0.65rem] tracking-[0.14em] uppercase',
                          statusBadgeClass(activeOrder.status),
                        )}
                      >
                        {MONEY_PACK_STATUS_LABELS[activeOrder.status]}
                      </span>
                    </div>
                    <h3 className="mt-1 font-heading text-xl text-brand-white">
                      {activeOrder.pack_label} &mdash; ₦{activeOrder.total_price_ngn.toLocaleString()}
                    </h3>
                    <p className="mt-0.5 font-body text-xs text-brand-muted">
                      Recipient LagosLife Username:{' '}
                      <span className="font-medium text-brand-cream">
                        {activeOrder.lagos_life_username}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveOrder(null)}
                    className="cursor-pointer p-1 text-brand-muted hover:text-brand-white"
                    aria-label="Hide payment card"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Bank Details */}
                <div className="mt-5 grid gap-3 border-t border-b hairline-border py-4 sm:grid-cols-3">
                  <div>
                    <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-muted uppercase">
                      Bank Name
                    </p>
                    <p className="mt-1 font-body text-sm font-medium text-brand-white">
                      {settings?.bank_name || 'Contact owner on WhatsApp'}
                    </p>
                  </div>

                  <div>
                    <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-muted uppercase">
                      Account Number
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-heading text-base tracking-[0.12em] text-brand-gold">
                        {settings?.account_number || 'Pending setup'}
                      </span>
                      {settings?.account_number && (
                        <button
                          type="button"
                          onClick={() => void copyText('acct', settings.account_number)}
                          className="inline-flex cursor-pointer items-center gap-1 border border-brand-gold/40 bg-brand-charcoal px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.14em] text-brand-cream uppercase hover:border-brand-gold hover:text-brand-gold"
                        >
                          {copiedField === 'acct' ? (
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
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-muted uppercase">
                      Account Name
                    </p>
                    <p className="mt-1 font-body text-sm font-medium text-brand-white">
                      {settings?.account_name || 'VATAR LIFESTYLE BY SOFT'}
                    </p>
                  </div>
                </div>

                {/* Primary 1-Click WhatsApp Receipt CTA */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={actionBusyId === activeOrder.id}
                      onClick={() => void handlePaidAndWhatsApp(activeOrder)}
                      className="inline-flex cursor-pointer items-center gap-2 border border-brand-gold bg-brand-gold px-5 py-3 font-heading text-xs font-semibold tracking-[0.18em] text-brand-black uppercase transition-colors hover:border-brand-cream hover:bg-brand-cream disabled:opacity-60"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      {activeOrder.status === 'awaiting_payment'
                        ? "I've Paid — Send Receipt on WhatsApp"
                        : 'Open WhatsApp Receipt Chat'}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    {(activeOrder.status === 'awaiting_payment' ||
                      activeOrder.status === 'payment_submitted') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionBusyId === activeOrder.id}
                        onClick={() => void handleCancelOrder(activeOrder.id)}
                      >
                        Cancel Order
                      </Button>
                    )}
                  </div>

                  {activeOrder.status === 'payment_submitted' && (
                    <span className="inline-flex items-center gap-1.5 font-body text-xs text-brand-gold">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Receipt sent — waiting for admin approval &amp; dispatch.
                    </span>
                  )}
                </div>
              </div>
            )}

          {/* Step 1: Tap a Pack */}
          <div className="mt-6">
            <p className="font-heading text-[0.7rem] tracking-[0.2em] text-brand-cream uppercase">
              1. Choose Your Pack
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {OFFICIAL_MONEY_PACKS.map((pack) => {
                const isSelected = selectedPack.code === pack.code;
                return (
                  <button
                    key={pack.code}
                    type="button"
                    onClick={() => setSelectedPack(pack)}
                    className={cn(
                      'relative flex cursor-pointer flex-col items-start border px-4 py-3 text-left transition-all',
                      isSelected
                        ? 'border-brand-gold bg-brand-gold/15 ring-1 ring-brand-gold'
                        : 'hairline-border bg-brand-black/60 hover:border-brand-gold/50',
                    )}
                  >
                    {pack.popular && (
                      <span className="absolute top-1.5 right-2 font-heading text-[0.55rem] tracking-[0.16em] text-brand-gold uppercase">
                        Popular
                      </span>
                    )}
                    <span className="font-heading text-lg font-semibold text-brand-white">
                      {pack.label}
                    </span>
                    <span className="mt-0.5 font-body text-xs font-medium text-brand-gold">
                      ₦{pack.priceNgn.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Confirm Username & 1-Tap Order */}
          <div className="mt-5 grid gap-4 border-t hairline-border pt-5 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-5">
              <label
                htmlFor="mp-lagos-username"
                className="block font-heading text-[0.68rem] tracking-[0.18em] text-brand-cream uppercase"
              >
                2. LagosLife Username
              </label>
              <input
                id="mp-lagos-username"
                type="text"
                value={lagosUsername}
                onChange={(e) => setLagosUsername(e.target.value)}
                placeholder="Your LagosLife username"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-heading text-[0.68rem] tracking-[0.18em] text-brand-cream uppercase">
                Quantity
              </label>
              <div className="mt-2 flex items-center border hairline-border bg-brand-black">
                {[1, 2, 3, 5].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className={cn(
                      'flex-1 cursor-pointer py-2.5 font-heading text-xs transition-colors',
                      quantity === q
                        ? 'bg-brand-gold font-semibold text-brand-black'
                        : 'text-brand-muted hover:text-brand-white',
                    )}
                  >
                    {q}×
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-4">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                disabled={submitting}
                onClick={() => void handlePlaceOrder()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    Order {quantity > 1 ? `${quantity}× ` : ''}
                    {selectedPack.label} &mdash; ₦{totalPriceNgn.toLocaleString()}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Recent Member Money Pack Orders */}
      {orders.length > 0 && (
        <div className="mt-6 border-t hairline-border pt-5">
          <p className="font-heading text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
            Your Recent Money Pack Orders
          </p>
          <div className="mt-3 space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 border hairline-border bg-brand-black/50 px-4 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-heading tracking-[0.14em] text-brand-gold">
                    {order.order_code}
                  </span>
                  <span className="font-medium text-brand-white">
                    {order.pack_label} (₦{order.total_price_ngn.toLocaleString()})
                  </span>
                  <span className="text-brand-muted">→ {order.lagos_life_username}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'border px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.14em] uppercase',
                      statusBadgeClass(order.status),
                    )}
                  >
                    {MONEY_PACK_STATUS_LABELS[order.status]}
                  </span>
                  {(order.status === 'awaiting_payment' ||
                    order.status === 'payment_submitted') && (
                    <button
                      type="button"
                      onClick={() => setActiveOrder(order)}
                      className="cursor-pointer font-heading text-[0.65rem] tracking-[0.14em] text-brand-gold uppercase hover:underline"
                    >
                      Pay / Receipt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
