import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ExternalLink,
  Loader2,
  MessageCircle,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  TransferReceiptModal,
  type TransferReceiptData,
} from '@/components/shared/TransferReceiptModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import {
  buildVipWhatsAppUrl,
  buildWhatsAppReceiptUrl,
  calculateTrillionQuoteNgn,
  cancelMoneyPackOrder,
  createTrillionQuoteOrder,
  fetchMoneyPackSettings,
  fetchMyMoneyPackOrders,
  fetchMyVipMembership,
  formatTrillionLabel,
  HALF_TRILLION_RATE_NGN,
  LIVE_RATE_NGN_PER_TRILLION,
  markMoneyPackPaymentSubmitted,
  markVipPaymentSubmitted,
  MAX_ORDER_TRILLIONS,
  MIN_ORDER_TRILLIONS,
  MONEY_PACK_STATUS_LABELS,
  normalizeTrillions,
  requestVipUpgrade,
  TRILLION_PRESETS,
  VIP_TIERS,
  type VipTierConfig,
} from '@/features/marketplace/services/moneyPackService';
import type {
  MoneyPackOrderRecord,
  MoneyPackOrderStatus,
  MoneyPackSettingsRecord,
  VipMembershipRecord,
  VipUpgradeRequestRecord,
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
  const [searchParams] = useSearchParams();

  const [settings, setSettings] = useState<MoneyPackSettingsRecord | null>(null);
  const [orders, setOrders] = useState<MoneyPackOrderRecord[]>([]);
  const [vip, setVip] = useState<VipMembershipRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Quote state (Min 500B / 0.5T = ₦800 | ₦1,500 / 1T | Max 1000T)
  const [trillionsInput, setTrillionsInput] = useState<string>(() => {
    const raw = searchParams.get('t');
    return raw ? String(normalizeTrillions(raw)) : '0.5';
  });
  const [lagosUsername, setLagosUsername] = useState(profile?.lagos_life_username ?? '');
  const [confirmLagosUsername, setConfirmLagosUsername] = useState(
    profile?.lagos_life_username ?? '',
  );
  const [submitting, setSubmitting] = useState(false);

  // Active checkout order & VIP upgrade checkout
  const [activeOrder, setActiveOrder] = useState<MoneyPackOrderRecord | null>(null);
  const [activeVipRequest, setActiveVipRequest] = useState<VipUpgradeRequestRecord | null>(
    null,
  );
  const [vipBusyTier, setVipBusyTier] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<TransferReceiptData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.lagos_life_username && !lagosUsername) {
      setLagosUsername(profile.lagos_life_username);
      setConfirmLagosUsername(profile.lagos_life_username);
    }
  }, [profile?.lagos_life_username, lagosUsername]);

  const loadData = useCallback(async () => {
    setError(null);
    const [settingsRes, ordersRes, vipRes] = await Promise.all([
      fetchMoneyPackSettings(),
      fetchMyMoneyPackOrders(),
      fetchMyVipMembership(),
    ]);
    if (settingsRes.error) {
      setError(settingsRes.error);
    } else {
      setSettings(settingsRes.settings);
    }
    if (!ordersRes.error) {
      setOrders(ordersRes.orders);
      const openOrder = ordersRes.orders.find((o) => o.status === 'awaiting_payment');
      setActiveOrder((prev) => {
        if (prev) {
          const updated = ordersRes.orders.find((o) => o.id === prev.id);
          return updated ?? prev;
        }
        return openOrder ?? null;
      });
    }
    if (!vipRes.error) {
      setVip(vipRes.vip);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const parsedT = normalizeTrillions(trillionsInput);
  const displayLabel = formatTrillionLabel(parsedT);
  const activeDiscount = vip?.discount_percent ?? 0;
  const quote = calculateTrillionQuoteNgn(parsedT, activeDiscount);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const handlePlaceOrder = async () => {
    const clean1 = lagosUsername.trim().replace(/^@/, '');
    const clean2 = confirmLagosUsername.trim().replace(/^@/, '');

    if (clean1.length < 2) {
      setError('Enter your LagosLife username to receive your funds.');
      return;
    }
    if (clean1.toLowerCase() !== clean2.toLowerCase()) {
      setError(
        'Both LagosLife username fields must match exactly. Currency cannot be reversed.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await createTrillionQuoteOrder({
      trillions: parsedT,
      lagosLifeUsername: clean1,
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

  const handleRequestVip = async (tier: VipTierConfig) => {
    setVipBusyTier(tier.code);
    setError(null);
    const res = await requestVipUpgrade(tier.code);
    setVipBusyTier(null);
    if (res.error || !res.request) {
      setError(res.error || 'Could not start VIP upgrade.');
      return;
    }
    setActiveVipRequest(res.request);
  };

  const handleVipPaidWhatsApp = async (req: VipUpgradeRequestRecord) => {
    const waUrl = buildVipWhatsAppUrl(
      settings?.whatsapp_number ?? '',
      req,
      profile?.username,
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (req.status === 'awaiting_payment') {
      const res = await markVipPaymentSubmitted(req.id);
      if (res.request) setActiveVipRequest(res.request);
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
      <div className="mb-8 border hairline-border bg-brand-charcoal/50 p-6">
        <div className="flex items-center gap-3 text-sm text-brand-muted">
          <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
          Loading Official VATAR Currency Store...
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 space-y-6">
      {error && (
        <div className="flex items-center gap-2.5 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. PAID VIP MEMBERSHIP DISCOUNT TIERS */}
      <section className="border hairline-border bg-brand-charcoal/65 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="heading-eyebrow flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
              Membership
            </p>
            <h2 className="mt-1 font-body text-sm text-brand-cream sm:text-base">
              Save up to <strong className="text-brand-gold">20%</strong> on every purchase
              by unlocking a monthly VIP tier.
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {vip && (
              <span className="inline-flex items-center gap-1.5 border border-brand-gold bg-brand-gold/15 px-3 py-1 font-heading text-[0.68rem] tracking-[0.16em] text-brand-gold uppercase">
                <Crown className="h-3.5 w-3.5" />
                Active: {vip.tier} ({vip.discount_percent}% off)
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VIP_TIERS.map((tier) => {
            const isCurrent = vip?.tier === tier.code;
            return (
              <button
                key={tier.code}
                type="button"
                disabled={vipBusyTier === tier.code}
                onClick={() => void handleRequestVip(tier)}
                className={cn(
                  'flex cursor-pointer flex-col items-start border p-4 text-left transition-all hover:border-brand-gold',
                  tier.accentClass,
                  isCurrent && 'ring-1 ring-brand-gold',
                )}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="font-heading text-xs font-semibold tracking-[0.18em] uppercase">
                    {tier.name}
                  </span>
                  {isCurrent && (
                    <span className="font-mono text-[10px] text-emerald-300 uppercase">
                      Active
                    </span>
                  )}
                </div>
                <span className="mt-1 font-heading text-base font-semibold text-brand-white">
                  ₦{tier.monthlyPriceNgn.toLocaleString()}
                  <span className="text-xs font-normal text-brand-muted">/mo</span>
                </span>
                <span className="mt-0.5 font-mono text-xs opacity-90">
                  {vipBusyTier === tier.code
                    ? 'Creating...'
                    : `${tier.discountPercent}% off`}
                </span>
              </button>
            );
          })}
        </div>

        {/* VIP Upgrade Payment Box */}
        {activeVipRequest && (
          <div className="mt-4 border border-brand-gold bg-brand-black/90 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-xs tracking-[0.18em] text-brand-gold uppercase">
                  VIP Upgrade {activeVipRequest.request_code} &mdash;{' '}
                  {activeVipRequest.tier.toUpperCase()} ({activeVipRequest.discount_percent}% off)
                </p>
                <p className="mt-0.5 font-heading text-lg text-brand-white">
                  Pay ₦{activeVipRequest.price_ngn.toLocaleString()} / 30 days
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVipRequest(null)}
                className="cursor-pointer p-1 text-brand-muted hover:text-brand-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 border-t border-b hairline-border py-3 text-xs sm:grid-cols-3">
              <div>
                <span className="text-brand-muted uppercase">Bank</span>
                <p className="mt-0.5 font-medium text-brand-white">
                  {settings?.bank_name || 'Contact owner'}
                </p>
              </div>
              <div>
                <span className="text-brand-muted uppercase">Account Number</span>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-sm text-brand-gold">
                    {settings?.account_number || 'Pending'}
                  </span>
                  {settings?.account_number && (
                    <button
                      type="button"
                      onClick={() => void copyText('vip-acct', settings.account_number)}
                      className="cursor-pointer border hairline-border px-1.5 py-0.5 text-[10px] text-brand-cream"
                    >
                      {copiedField === 'vip-acct' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-brand-muted uppercase">Account Name</span>
                <p className="mt-0.5 font-medium text-brand-white">
                  {settings?.account_name || 'VATAR LIFESTYLE BY SOFT'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleVipPaidWhatsApp(activeVipRequest)}
              className="inline-flex cursor-pointer items-center gap-2 border border-brand-gold bg-brand-gold px-4 py-2 font-heading text-xs font-semibold tracking-[0.16em] text-brand-black uppercase hover:bg-brand-cream"
            >
              <MessageCircle className="h-4 w-4" />
              I&apos;ve Paid — Send VIP Receipt on WhatsApp
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* ACTIVE ORDER PAYMENT CARD */}
      {activeOrder &&
        (activeOrder.status === 'awaiting_payment' ||
          activeOrder.status === 'payment_submitted' ||
          activeOrder.status === 'sending') && (
          <section className="border border-brand-gold bg-brand-black/95 p-5 sm:p-6">
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
                  <strong className="text-brand-cream">
                    @{activeOrder.lagos_life_username}
                  </strong>
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

            <div className="mt-4 grid gap-3 border-t border-b hairline-border py-4 sm:grid-cols-3">
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
                  Receipt sent — waiting for admin dispatch.
                </span>
              )}
            </div>
          </section>
        )}

      {/* 2. STEP 1: CHOOSE YOUR AMOUNT (₦1,500 / 1T, Min 1T - Max 1000T) */}
      {settings && !settings.is_enabled ? (
        <div className="border hairline-border bg-brand-charcoal/50 p-5 text-sm text-brand-muted">
          Official currency orders are temporarily paused by the owner.
        </div>
      ) : (
        <section className="border border-brand-gold/40 bg-brand-charcoal/70 p-5 sm:p-7 space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-semibold tracking-[0.16em] text-brand-white uppercase">
                1. Choose your amount
              </h2>
              <span className="font-mono text-xs text-brand-gold">
                ₦{LIVE_RATE_NGN_PER_TRILLION.toLocaleString()} / 1T
              </span>
            </div>

            <div className="relative mt-3">
              <input
                type="number"
                min={MIN_ORDER_TRILLIONS}
                max={MAX_ORDER_TRILLIONS}
                step={0.5}
                value={trillionsInput}
                onChange={(e) => setTrillionsInput(e.target.value)}
                className="w-full border hairline-border bg-brand-black py-3 pr-12 pl-4 font-heading text-2xl font-semibold text-brand-white focus:border-brand-gold focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border hairline-border bg-brand-charcoal font-heading text-xs text-brand-gold">
                T
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {TRILLION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTrillionsInput(String(preset))}
                  className={cn(
                    'cursor-pointer border px-3.5 py-1.5 font-mono text-xs transition-colors',
                    parsedT === preset
                      ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                      : 'hairline-border bg-brand-black text-brand-cream hover:border-brand-gold',
                  )}
                >
                  {preset}T
                </button>
              ))}
            </div>

            {/* Total Payable Box */}
            <div className="mt-4 border hairline-border bg-brand-black/80 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-body text-xs text-brand-muted">Total payable</span>
                <div className="text-right">
                  {activeDiscount > 0 && (
                    <span className="mr-2 font-mono text-xs text-brand-muted line-through">
                      ₦{quote.basePrice.toLocaleString()}
                    </span>
                  )}
                  <span className="font-heading text-2xl font-semibold text-brand-white">
                    ₦{quote.finalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
              {activeDiscount > 0 && (
                <p className="mt-1 text-right font-mono text-[11px] text-emerald-300">
                  {vip?.tier.toUpperCase()} VIP {activeDiscount}% discount applied (Saved ₦
                  {quote.savings.toLocaleString()})
                </p>
              )}
            </div>

            <p className="mt-2 font-body text-xs text-brand-muted">
              Minimum 500B (0.5T = ₦{HALF_TRILLION_RATE_NGN.toLocaleString()}) &bull; Standard
              rate ₦{LIVE_RATE_NGN_PER_TRILLION.toLocaleString()} / 1T &bull; Max{' '}
              {MAX_ORDER_TRILLIONS}T per order
            </p>
          </div>

          {/* 3. STEP 2: CONFIRM YOUR LAGOSLIFE USERNAME (TYPED TWICE) */}
          <div className="border-t hairline-border pt-5">
            <h2 className="font-heading text-sm font-semibold tracking-[0.16em] text-brand-white uppercase">
              2. Confirm your LagosLife username
            </h2>
            <p className="mt-1 font-body text-xs text-brand-muted">
              Currency cannot be reversed. Type the username twice, exactly as it appears in-game.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={lagosUsername}
                onChange={(e) => setLagosUsername(e.target.value)}
                placeholder="LagosLife username (e.g. @player)"
                className="w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
              <input
                type="text"
                value={confirmLagosUsername}
                onChange={(e) => setConfirmLagosUsername(e.target.value)}
                placeholder="Confirm LagosLife username"
                className="w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
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
                    Continue &mdash; {displayLabel} for ₦{quote.finalPrice.toLocaleString()}
                  </>
                )}
              </Button>

              <div className="flex flex-wrap items-center gap-4 font-heading text-[0.65rem] tracking-[0.16em] text-brand-muted uppercase">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-gold" />
                  Verified Payments
                </span>
                {settings?.telegram_url && (
                  <a
                    href={settings.telegram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-gold hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    Telegram
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Member Orders + Receipts */}
      {orders.length > 0 && (
        <section className="border hairline-border bg-brand-charcoal/50 p-5">
          <p className="font-heading text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
            Your Recent Currency Orders
          </p>
          <div className="mt-3 space-y-2">
            {orders.slice(0, 6).map((order) => (
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
                  <span className="text-brand-muted">→ @{order.lagos_life_username}</span>
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
                      Pay
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveReceipt({
                        title: `Currency Order — ${order.pack_label}`,
                        reference: order.order_code,
                        recipient: order.lagos_life_username,
                        senders: ['VATAR Official Store'],
                        totalAmount: order.in_game_amount,
                        sentAmount:
                          order.status === 'completed' ? order.in_game_amount : 0,
                        status: MONEY_PACK_STATUS_LABELS[order.status],
                        timestamp:
                          order.completed_at ||
                          order.payment_submitted_at ||
                          order.created_at,
                        priceNgn: order.total_price_ngn,
                        note: order.admin_note,
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

      <ReviewsSection />

      <TransferReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
