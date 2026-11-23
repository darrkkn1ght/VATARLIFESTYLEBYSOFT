import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  adminUpdateMoneyPackOrder,
  adminUpdateMoneyPackSettings,
  fetchAdminMoneyPackOrders,
  fetchMoneyPackSettings,
  MONEY_PACK_STATUS_LABELS,
  type AdminMoneyPackOrderView,
} from '@/features/marketplace/services/moneyPackService';
import {
  dispatchOrderAcrossSenders,
  loadStoredSenders,
  planPipelineSplit,
  refreshAllLiveSenders,
  removeStoredSender,
  saveStoredSenders,
  upsertStoredSender,
  type LiveSenderAccount,
  type PipelineDispatchItem,
} from '@/features/marketplace/services/multiSenderService';
import {
  formatNaira,
  importLagosLifeCookie,
  loginLagosLife,
  resendLagosLife2FA,
  submitTransferTwoStep,
  verifyLagosLife2FA,
} from '@/features/treasury/services/treasuryService';
import type {
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminMoneyPacksPanel() {
  const [orders, setOrders] = useState<AdminMoneyPackOrderView[]>([]);
  const [settings, setSettings] = useState<MoneyPackSettingsRecord | null>(null);
  const [senders, setSenders] = useState<LiveSenderAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Add Sender modal/drawer state
  const [showAddSender, setShowAddSender] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'cookie'>('login');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [defaultPin, setDefaultPin] = useState('');
  const [addingSender, setAddingSender] = useState(false);
  const [twoFactor, setTwoFactor] = useState<{
    challenge: string;
    method?: string;
    to?: string;
    hint?: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Order dispatch tracking
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [dispatchesByOrder, setDispatchesByOrder] = useState<
    Record<string, PipelineDispatchItem[]>
  >({});
  const [twoStepCodes, setTwoStepCodes] = useState<Record<string, string>>({});

  // Filter: active queue vs all history
  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');

  // Collapsible Payout Settings
  const [showSettings, setShowSettings] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/VatarLifeStyleBySoft');
  const [isEnabled, setIsEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadAll = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setLoading(true);
    else setRefreshing(true);

    const [ordersRes, settingsRes, liveSenders] = await Promise.all([
      fetchAdminMoneyPackOrders(),
      fetchMoneyPackSettings(),
      refreshAllLiveSenders(),
    ]);

    if (ordersRes.error) {
      setBanner({ type: 'error', text: ordersRes.error });
    } else {
      setOrders(ordersRes.orders);
    }

    if (settingsRes.settings) {
      const s = settingsRes.settings;
      setSettings(s);
      setBankName(s.bank_name);
      setAccountNumber(s.account_number);
      setAccountName(s.account_name);
      setWhatsappNumber(s.whatsapp_number);
      setTelegramUrl(s.telegram_url || 'https://t.me/VatarLifeStyleBySoft');
      setIsEnabled(s.is_enabled);
      // Auto-open settings once if bank details haven't been configured yet
      if (!s.account_number) {
        setShowSettings(true);
      }
    }

    setSenders(liveSenders);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const activeSenders = useMemo(
    () => senders.filter((s) => s.enabled && s.online),
    [senders],
  );
  const totalAvailableBalance = useMemo(
    () => activeSenders.reduce((sum, s) => sum + s.money, 0),
    [activeSenders],
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'payment_submitted' ||
          o.status === 'awaiting_payment' ||
          o.status === 'sending',
      ),
    [orders],
  );

  const visibleOrders = filterMode === 'pending' ? pendingOrders : orders;

  const handleToggleSender = (senderUser: string) => {
    const stored = loadStoredSenders().map((s) =>
      s.user.toLowerCase() === senderUser.toLowerCase()
        ? { ...s, enabled: !s.enabled }
        : s,
    );
    saveStoredSenders(stored);
    setSenders((prev) =>
      prev.map((s) =>
        s.user.toLowerCase() === senderUser.toLowerCase()
          ? { ...s, enabled: !s.enabled }
          : s,
      ),
    );
  };

  const handleRemoveSender = async (senderUser: string) => {
    await removeStoredSender(senderUser);
    setSenders((prev) =>
      prev.filter((s) => s.user.toLowerCase() !== senderUser.toLowerCase()),
    );
    setBanner({ type: 'success', text: `Disconnected sender @${senderUser}.` });
  };

  const handleConnectSender = async (e: FormEvent) => {
    e.preventDefault();
    setAddingSender(true);
    setBanner(null);

    try {
      const cleanUser = loginUser.trim().replace(/^@/, '');
      const res =
        authTab === 'login'
          ? await loginLagosLife(cleanUser, loginPass)
          : await importLagosLifeCookie(cookieInput.trim());

      if ((res.data.twoFactorRequired || res.data.twoFactor) && res.data.challenge) {
        setTwoFactor({
          challenge: res.data.challenge,
          method: res.data.method,
          to: res.data.to,
          hint: res.data.error,
        });
        setTwoFactorCode('');
        setAddingSender(false);
        return;
      }

      if (!res.ok || !res.data.token || !res.data.account) {
        setBanner({
          type: 'error',
          text: res.data.error || 'Could not connect LagosLife sender account.',
        });
        setAddingSender(false);
        return;
      }

      upsertStoredSender(res.data.token, res.data.account, defaultPin);
      setLoginUser('');
      setLoginPass('');
      setCookieInput('');
      setDefaultPin('');
      setShowAddSender(false);
      setBanner({
        type: 'success',
        text: `Connected sender @${res.data.account.user} (${formatNaira(res.data.account.money)}).`,
      });
      const live = await refreshAllLiveSenders();
      setSenders(live);
    } catch {
      setBanner({ type: 'error', text: 'Could not reach LagosLife transfer hub.' });
    }
    setAddingSender(false);
  };

  const handleVerify2FA = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFactor) return;
    setAddingSender(true);
    const res = await verifyLagosLife2FA(twoFactor.challenge, twoFactorCode.trim());
    setAddingSender(false);

    if (!res.ok || !res.data.token || !res.data.account) {
      setBanner({ type: 'error', text: res.data.error || 'Invalid 2FA code.' });
      return;
    }

    upsertStoredSender(res.data.token, res.data.account, defaultPin);
    setTwoFactor(null);
    setTwoFactorCode('');
    setLoginUser('');
    setLoginPass('');
    setDefaultPin('');
    setShowAddSender(false);
    setBanner({
      type: 'success',
      text: `Connected sender @${res.data.account.user} (${formatNaira(res.data.account.money)}).`,
    });
    const live = await refreshAllLiveSenders();
    setSenders(live);
  };

  // ONE-CLICK: Approve + Dispatch across connected sender pipeline(s)
  const handleApproveAndSend = async (order: AdminMoneyPackOrderView) => {
    setBusyOrderId(order.id);
    setBanner(null);

    const { allocations, shortfall } = planPipelineSplit(senders, order.in_game_amount);
    if (allocations.length === 0 || shortfall > 0) {
      setBusyOrderId(null);
      setBanner({
        type: 'error',
        text:
          activeSenders.length === 0
            ? 'Connect at least 1 LagosLife sender account above (or click Approve Only if sent manually).'
            : `Connected sender accounts need ${formatNaira(shortfall)} more to cover ${order.pack_label}.`,
      });
      return;
    }

    // 1. Mark order as sending in Supabase
    const sendingRes = await adminUpdateMoneyPackOrder({
      orderId: order.id,
      nextStatus: 'sending',
      adminNote: `Dispatched across ${allocations.length} sender account(s).`,
    });

    if (sendingRes.error) {
      setBusyOrderId(null);
      setBanner({ type: 'error', text: sendingRes.error });
      return;
    }

    // 2. Fire transfers in parallel across the multi-pipeline accounts
    const { results } = await dispatchOrderAcrossSenders(
      senders,
      order.lagos_life_username,
      order.in_game_amount,
    );

    setDispatchesByOrder((prev) => ({ ...prev, [order.id]: results }));

    const allOk = results.length > 0 && results.every((r) => r.ok);
    const anyNeedsTwoStep = results.some((r) => r.job?.needsTwoStep);

    if (allOk && !anyNeedsTwoStep) {
      const doneRes = await adminUpdateMoneyPackOrder({
        orderId: order.id,
        nextStatus: 'completed',
        adminNote: `Sent via ${results.map((r) => `@${r.senderUser} (${formatNaira(r.amount)})`).join(' + ')}`,
      });
      if (doneRes.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...doneRes.order! } : o)),
        );
      }
      setBanner({
        type: 'success',
        text: `Order ${order.order_code} (${order.pack_label}) dispatched to ${order.lagos_life_username} via ${results.length} pipeline(s)!`,
      });
    } else if (anyNeedsTwoStep) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'sending' } : o)),
      );
      setBanner({
        type: 'success',
        text: `Transfer started for ${order.order_code} — enter the PIN / 2FA code inside the order card to finish.`,
      });
    } else {
      const failedMsg = results
        .filter((r) => !r.ok)
        .map((r) => `@${r.senderUser}: ${r.error}`)
        .join('; ');
      setBanner({ type: 'error', text: `Some sends failed: ${failedMsg}` });
    }

    const refreshed = await refreshAllLiveSenders();
    setSenders(refreshed);
    setBusyOrderId(null);
  };

  const handleResumeJobCode = async (
    orderId: string,
    dispatch: PipelineDispatchItem,
  ) => {
    const key = `${orderId}:${dispatch.senderUser}`;
    const code = (twoStepCodes[key] || '').trim();
    if (!code || !dispatch.job?.id) return;

    const res = await submitTransferTwoStep(dispatch.token, dispatch.job.id, code);
    if (res.ok) {
      setTwoStepCodes((prev) => ({ ...prev, [key]: '' }));
      setBanner({
        type: 'success',
        text: `Submitted code for @${dispatch.senderUser}.`,
      });
      const refreshed = await refreshAllLiveSenders();
      setSenders(refreshed);
    } else {
      setBanner({
        type: 'error',
        text: res.data.error || 'Could not submit PIN/2FA code.',
      });
    }
  };

  const handleManualStatus = async (
    order: AdminMoneyPackOrderView,
    nextStatus: 'completed' | 'rejected',
  ) => {
    setBusyOrderId(order.id);
    const res = await adminUpdateMoneyPackOrder({
      orderId: order.id,
      nextStatus,
      adminNote:
        nextStatus === 'completed'
          ? 'Approved and confirmed by admin.'
          : 'Rejected by admin.',
    });
    setBusyOrderId(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error });
    } else if (res.order) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, ...res.order! } : o)),
      );
      setBanner({
        type: 'success',
        text: `Order ${order.order_code} marked ${nextStatus}.`,
      });
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setBanner(null);

    const res = await adminUpdateMoneyPackSettings({
      bankName,
      accountNumber,
      accountName,
      whatsappNumber,
      telegramUrl,
      isEnabled,
    });

    setSavingSettings(false);
    if (res.error) {
      setBanner({ type: 'error', text: res.error });
    } else if (res.settings) {
      setSettings(res.settings);
      setShowSettings(false);
      setBanner({ type: 'success', text: 'Payout bank & WhatsApp settings saved.' });
    }
  };

  if (loading) {
    return (
      <div className="border hairline-border bg-brand-charcoal/50 p-8 text-sm text-brand-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-brand-gold" />
        Loading Money Pack Orders &amp; Sender Pipeline...
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

      {/* 1. MULTI-PIPELINE SENDER ACCOUNTS BAR */}
      <section className="border border-brand-gold/35 bg-brand-charcoal/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="heading-eyebrow flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-brand-gold" />
              Multi-Pipeline Senders
            </p>
            <p className="mt-1 font-body text-xs text-brand-muted">
              Connect 1 or more LagosLife accounts. Orders auto-split across all enabled accounts for faster sends.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="border hairline-border bg-brand-black px-3 py-1.5 font-heading text-xs tracking-[0.14em] text-brand-gold">
              {activeSenders.length} Active &bull; {formatNaira(totalAvailableBalance)} Ready
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={() => void loadAll(false)}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Sync
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddSender((prev) => !prev)}
            >
              <Plus className="h-3.5 w-3.5" />
              Connect Account
            </Button>
          </div>
        </div>

        {/* Connected Accounts Pills */}
        {senders.length > 0 ? (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {senders.map((sender) => (
              <div
                key={sender.user}
                className={cn(
                  'flex items-center justify-between gap-3 border px-3.5 py-2.5',
                  sender.enabled && sender.online
                    ? 'border-brand-gold/50 bg-brand-black/80'
                    : 'hairline-border bg-brand-black/40 opacity-70',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        sender.online ? 'bg-emerald-400' : 'bg-rose-400',
                      )}
                    />
                    <span className="truncate font-heading text-xs tracking-[0.12em] text-brand-white">
                      @{sender.user}
                    </span>
                  </div>
                  <p className="mt-0.5 font-body text-xs text-brand-gold">
                    {sender.online ? formatNaira(sender.money) : 'Session expired'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSender(sender.user)}
                    className={cn(
                      'cursor-pointer border px-2 py-1 font-heading text-[0.6rem] tracking-[0.14em] uppercase',
                      sender.enabled
                        ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                        : 'hairline-border text-brand-muted',
                    )}
                  >
                    {sender.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveSender(sender.user)}
                    className="cursor-pointer p-1 text-brand-muted hover:text-rose-400"
                    aria-label={`Remove ${sender.user}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 border hairline-border bg-brand-black/40 px-4 py-3 font-body text-xs text-brand-muted">
            <Wallet className="mr-1.5 inline h-3.5 w-3.5 text-brand-gold" />
            No sender accounts connected yet. Click <strong>Connect Account</strong> to enable 1-click approve &amp; send.
          </div>
        )}

        {/* Inline Add Sender Form */}
        {showAddSender && (
          <div className="mt-4 border-t hairline-border pt-4">
            {twoFactor ? (
              <form onSubmit={(e) => void handleVerify2FA(e)} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label className="block font-heading text-[0.65rem] tracking-[0.18em] text-brand-gold uppercase">
                    {twoFactor.hint || '2FA Verification Code'}{' '}
                    {twoFactor.to ? `(${twoFactor.to})` : ''}
                  </label>
                  <input
                    type="text"
                    required
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="Enter 2FA code"
                    className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <Button type="submit" variant="primary" size="sm" disabled={addingSender}>
                  {addingSender ? 'Verifying...' : 'Verify & Connect'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void resendLagosLife2FA(twoFactor.challenge)}
                >
                  Resend
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTwoFactor(null)}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleConnectSender(e)} className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthTab('login')}
                    className={cn(
                      'cursor-pointer border px-3 py-1 font-heading text-[0.65rem] tracking-[0.16em] uppercase',
                      authTab === 'login'
                        ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                        : 'hairline-border text-brand-muted',
                    )}
                  >
                    LagosLife Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('cookie')}
                    className={cn(
                      'cursor-pointer border px-3 py-1 font-heading text-[0.65rem] tracking-[0.16em] uppercase',
                      authTab === 'cookie'
                        ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                        : 'hairline-border text-brand-muted',
                    )}
                  >
                    Import Cookie
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  {authTab === 'login' ? (
                    <>
                      <input
                        type="text"
                        required
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        placeholder="LagosLife Username"
                        className="border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                      />
                      <input
                        type="password"
                        required
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        placeholder="LagosLife Password"
                        className="border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      required
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      placeholder="Paste LagosLife session cookie"
                      className="border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none sm:col-span-2"
                    />
                  )}
                  <input
                    type="password"
                    value={defaultPin}
                    onChange={(e) => setDefaultPin(e.target.value)}
                    placeholder="Transfer PIN (optional)"
                    className="border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={addingSender}>
                    {addingSender ? 'Connecting...' : 'Save Sender'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* 2. INCOMING MONEY PACK ORDERS (1-CLICK APPROVE & SEND) */}
      <section className="border hairline-border bg-brand-charcoal/55 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="heading-eyebrow flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-brand-gold" />
              Money Pack Orders
            </p>
            <h3 className="heading-section mt-1 text-xl text-brand-white">
              {pendingOrders.length > 0
                ? `${pendingOrders.length} Order(s) Ready for Action`
                : 'All Caught Up'}
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
          <p className="mt-5 font-body text-sm text-brand-muted">
            No money pack orders in this view.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {visibleOrders.map((order) => {
              const isActionable =
                order.status === 'awaiting_payment' ||
                order.status === 'payment_submitted' ||
                order.status === 'sending';
              const dispatches = dispatchesByOrder[order.id] ?? [];
              const splitPreview = isActionable
                ? planPipelineSplit(senders, order.in_game_amount)
                : null;

              return (
                <article
                  key={order.id}
                  className={cn(
                    'border p-4 transition-colors',
                    order.status === 'payment_submitted'
                      ? 'border-brand-gold/60 bg-brand-black/90'
                      : 'hairline-border bg-brand-black/60',
                  )}
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-xs tracking-[0.18em] text-brand-gold">
                          {order.order_code}
                        </span>
                        <span
                          className={cn(
                            'border px-2 py-0.5 font-heading text-[0.62rem] tracking-[0.14em] uppercase',
                            statusBadgeClass(order.status),
                          )}
                        >
                          {MONEY_PACK_STATUS_LABELS[order.status]}
                        </span>
                        <span className="font-body text-xs text-brand-muted">
                          {formatTime(order.created_at)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="font-heading text-lg font-semibold text-brand-white">
                          {order.pack_label} &mdash; ₦{order.total_price_ngn.toLocaleString()}
                        </span>
                        <span className="font-body text-sm text-brand-cream">
                          Send to:{' '}
                          <strong className="text-brand-gold">
                            {order.lagos_life_username}
                          </strong>
                        </span>
                        <span className="font-body text-xs text-brand-muted">
                          ({order.buyer_full_name} / @{order.buyer_username})
                        </span>
                      </div>

                      {splitPreview && splitPreview.allocations.length > 0 && splitPreview.shortfall === 0 && (
                        <p className="mt-1 font-body text-[0.72rem] text-brand-muted">
                          Pipeline plan:{' '}
                          {splitPreview.allocations
                            .map((a) => `@${a.sender.user} (${formatNaira(a.amount)})`)
                            .join(' + ')}
                        </p>
                      )}
                    </div>

                    {isActionable && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busyOrderId === order.id}
                          onClick={() => void handleApproveAndSend(order)}
                        >
                          {busyOrderId === order.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Approve &amp; Send Now
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyOrderId === order.id}
                          onClick={() => void handleManualStatus(order, 'completed')}
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
                      </div>
                    )}
                  </div>

                  {/* Inline PIN / 2FA prompts if any pipeline job paused for code */}
                  {dispatches.some((d) => d.job?.needsTwoStep) && (
                    <div className="mt-3 space-y-2 border-t hairline-border pt-3">
                      {dispatches
                        .filter((d) => d.job?.needsTwoStep)
                        .map((d) => {
                          const key = `${order.id}:${d.senderUser}`;
                          return (
                            <div
                              key={key}
                              className="flex flex-wrap items-center gap-2 text-xs"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-brand-gold" />
                              <span className="text-brand-cream">
                                @{d.senderUser} needs {d.job?.twoStepType || 'PIN/2FA'}:
                              </span>
                              <input
                                type="text"
                                value={twoStepCodes[key] || ''}
                                onChange={(e) =>
                                  setTwoStepCodes((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="Enter PIN / 2FA"
                                className="border hairline-border bg-brand-charcoal px-2.5 py-1 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void handleResumeJobCode(order.id, d)}
                              >
                                Submit
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. COLLAPSIBLE PAYOUT BANK & WHATSAPP SETTINGS */}
      <section className="border hairline-border bg-brand-charcoal/45">
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
        >
          <span className="flex items-center gap-2 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase">
            <Settings className="h-4 w-4 text-brand-gold" />
            Payout Bank Account &amp; WhatsApp Settings
            {!settings?.account_number && (
              <span className="border border-brand-gold/50 bg-brand-gold/15 px-2 py-0.5 text-[0.6rem] text-brand-gold">
                Setup Needed
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
          <form
            onSubmit={(e) => void handleSaveSettings(e)}
            className="grid gap-4 border-t hairline-border p-5 sm:grid-cols-2"
          >
            <div>
              <label className="block font-heading text-[0.65rem] tracking-[0.18em] text-brand-cream uppercase">
                Bank Name
              </label>
              <input
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. OPay / PalmPay / GTBank"
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-heading text-[0.65rem] tracking-[0.18em] text-brand-cream uppercase">
                Account Number
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="10-digit account number"
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-heading text-[0.65rem] tracking-[0.18em] text-brand-cream uppercase">
                Account Name
              </label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Account holder name"
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-heading text-[0.65rem] tracking-[0.18em] text-brand-cream uppercase">
                Owner WhatsApp Number (with country code)
              </label>
              <input
                type="text"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 2348087521558"
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-heading text-[0.65rem] tracking-[0.18em] text-brand-cream uppercase">
                Telegram Channel Link
              </label>
              <input
                type="url"
                value={telegramUrl}
                onChange={(e) => setTelegramUrl(e.target.value)}
                placeholder="https://t.me/VatarLifeStyleBySoft"
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div className="flex items-end justify-between gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 font-body text-sm text-brand-cream">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="h-4 w-4 accent-brand-gold"
                />
                Accepting Money Pack Orders
              </label>

              <Button type="submit" variant="primary" size="sm" disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
