import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Crown,
  KeyRound,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Settings,
  Square,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  TransferReceiptModal,
  type TransferReceiptData,
} from '@/components/shared/TransferReceiptModal';
import { Button } from '@/components/ui/Button';
import {
  adminReviewVipUpgrade,
  adminUpdateMoneyPackOrder,
  adminUpdateMoneyPackSettings,
  fetchAdminMoneyPackOrders,
  fetchAdminVipRequests,
  fetchMoneyPackSettings,
  MONEY_PACK_STATUS_LABELS,
  type AdminMoneyPackOrderView,
  type AdminVipRequestView,
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
  getJobDescription,
  importLagosLifeCookie,
  loginLagosLife,
  parseNairaAmount,
  resendLagosLife2FA,
  stopTransferJob,
  submitTransferTwoStep,
  verifyLagosLife2FA,
  type TreasuryJob,
} from '@/features/treasury/services/treasuryService';

const ADMIN_DESC_PRESETS = [
  'Official Currency Order',
  'Competition Winner Prize',
  'VIP Monthly Bonus',
  'Giveaway',
  'Refund',
] as const;

const ADMIN_AMOUNT_CHIPS = ['50B', '100B', '500B', '1T', '5T', '10T'] as const;
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
  const [vipRequests, setVipRequests] = useState<AdminVipRequestView[]>([]);
  const [busyVipId, setBusyVipId] = useState<string | null>(null);
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
  const [confirmOrder, setConfirmOrder] = useState<AdminMoneyPackOrderView | null>(null);
  const [orderDescription, setOrderDescription] = useState('');
  const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);
  const [showPipelineJobs, setShowPipelineJobs] = useState(false);

  // Direct Admin Money Sender (with Description)
  const [directTarget, setDirectTarget] = useState('');
  const [directAmount, setDirectAmount] = useState('');
  const [directDescription, setDirectDescription] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<TransferReceiptData | null>(null);
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

    const [ordersRes, settingsRes, liveSenders, vipRes] = await Promise.all([
      fetchAdminMoneyPackOrders(),
      fetchMoneyPackSettings(),
      refreshAllLiveSenders(),
      fetchAdminVipRequests(),
    ]);

    if (ordersRes.error) {
      setBanner({ type: 'error', text: ordersRes.error });
    } else {
      setOrders(ordersRes.orders);
    }

    if (!vipRes.error) {
      setVipRequests(vipRes.requests);
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

  // Flatten live pipeline jobs across all connected sender accounts
  const allPipelineJobs = useMemo(
    () =>
      senders.flatMap((sender) =>
        (sender.jobs || []).map((job) => ({
          sender,
          job,
        })),
      ),
    [senders],
  );

  const hasActivePipelineJob = useMemo(
    () =>
      allPipelineJobs.some(({ job }) =>
        ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(String(job.status || '').toUpperCase()),
      ),
    [allPipelineJobs],
  );

  // Auto-expand Live Pipeline Monitor whenever an active transfer starts
  useEffect(() => {
    if (hasActivePipelineJob) {
      setShowPipelineJobs(true);
    }
  }, [hasActivePipelineJob]);

  // Silently poll sender jobs every 3s ONLY while a transfer is actively running
  useEffect(() => {
    if (!hasActivePipelineJob) return;
    let active = true;
    const timer = window.setInterval(() => {
      void refreshAllLiveSenders().then((live) => {
        if (active) setSenders(live);
      });
    }, 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasActivePipelineJob]);

  const handleStopJob = async (sender: LiveSenderAccount, job: TreasuryJob) => {
    setStoppingJobId(job.id);
    const res = await stopTransferJob(sender.token, job.id);
    setStoppingJobId(null);
    if (res.ok) {
      setBanner({
        type: 'success',
        text: `Stopped transfer on @${sender.user} to @${job.target || job.targetLabel || 'recipient'}.`,
      });
      const refreshed = await refreshAllLiveSenders();
      setSenders(refreshed);
    } else {
      setBanner({
        type: 'error',
        text: res.data.error || 'Could not stop transfer job.',
      });
    }
  };

  const handleResumeLiveJobCode = async (sender: LiveSenderAccount, job: TreasuryJob) => {
    const key = `live:${sender.user}:${job.id}`;
    const code = (twoStepCodes[key] || '').trim();
    if (!code) return;
    const res = await submitTransferTwoStep(sender.token, job.id, code);
    if (res.ok) {
      setTwoStepCodes((prev) => ({ ...prev, [key]: '' }));
      setBanner({ type: 'success', text: `Submitted PIN/2FA code for @${sender.user}.` });
      const refreshed = await refreshAllLiveSenders();
      setSenders(refreshed);
    } else {
      setBanner({ type: 'error', text: res.data.error || 'Invalid PIN/2FA code.' });
    }
  };

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

  const handleReviewVip = async (
    req: AdminVipRequestView,
    decision: 'approved' | 'rejected',
  ) => {
    setBusyVipId(req.id);
    const res = await adminReviewVipUpgrade({
      requestId: req.id,
      decision,
      adminNote:
        decision === 'approved'
          ? `Approved ${req.tier.toUpperCase()} VIP (${req.discount_percent}% off) for 30 days.`
          : 'Rejected by admin.',
    });
    setBusyVipId(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error });
    } else if (res.request) {
      setVipRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, ...res.request! } : r)),
      );
      setBanner({
        type: 'success',
        text:
          decision === 'approved'
            ? `Activated ${req.tier.toUpperCase()} VIP (${req.discount_percent}% off) for @${req.member_username} for 30 days!`
            : `Rejected VIP request ${req.request_code}.`,
      });
    }
  };

  const pendingVipRequests = useMemo(
    () =>
      vipRequests.filter(
        (r) => r.status === 'awaiting_payment' || r.status === 'payment_submitted',
      ),
    [vipRequests],
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

  // Direct Admin Money Sender (send any amount + description across Multi-Pipeline Senders)
  const handleDirectAdminSend = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTarget = directTarget.trim().replace(/^@/, '');
    const amt = parseNairaAmount(directAmount);
    const cleanDesc = directDescription.trim();

    if (!cleanTarget || amt <= 0) {
      setBanner({
        type: 'error',
        text: 'Enter a recipient @username and a valid transfer amount (e.g. 100B, 1T).',
      });
      return;
    }
    if (!cleanDesc) {
      setBanner({
        type: 'error',
        text: 'Enter a transfer description so the recipient knows what the money is for.',
      });
      return;
    }

    const { allocations, shortfall } = planPipelineSplit(senders, amt);
    if (allocations.length === 0 || shortfall > 0) {
      setBanner({
        type: 'error',
        text:
          activeSenders.length === 0
            ? 'Connect at least 1 LagosLife sender account above first.'
            : `Connected sender accounts need ${formatNaira(shortfall)} more to send ${formatNaira(amt)}.`,
      });
      return;
    }

    setSendingDirect(true);
    setBanner(null);
    const { results } = await dispatchOrderAcrossSenders(
      senders,
      cleanTarget,
      amt,
      undefined,
      cleanDesc,
    );
    setSendingDirect(false);

    const allOk = results.length > 0 && results.every((r) => r.ok);
    if (allOk) {
      setDirectTarget('');
      setDirectAmount('');
      setDirectDescription('');
      setShowPipelineJobs(true);
      setBanner({
        type: 'success',
        text: `Sending ${formatNaira(amt)} to @${cleanTarget} — "${cleanDesc}"!`,
      });
    } else {
      const failedMsg = results
        .filter((r) => !r.ok)
        .map((r) => `@${r.senderUser}: ${r.error}`)
        .join('; ');
      setBanner({ type: 'error', text: `Transfer failed: ${failedMsg}` });
    }

    const refreshed = await refreshAllLiveSenders();
    setSenders(refreshed);
  };

  // ONE-CLICK: Approve + Dispatch across connected sender pipeline(s)
  const handleApproveAndSend = async (order: AdminMoneyPackOrderView) => {
    setBusyOrderId(order.id);
    setBanner(null);
    const cleanOrderDesc =
      orderDescription.trim() ||
      `VATAR Official Currency — ${order.order_code} (${order.pack_label})`;

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
      undefined,
      cleanOrderDesc,
    );

    setDispatchesByOrder((prev) => ({ ...prev, [order.id]: results }));

    const allOk = results.length > 0 && results.every((r) => r.ok);
    const anyNeedsTwoStep = results.some((r) => r.job?.needsTwoStep);
    const allAlreadyCompleted =
      allOk &&
      results.every((r) => String(r.job?.status || '').toUpperCase() === 'COMPLETED');

    const pipelineSummary = results
      .map((r) => `@${r.senderUser} (${formatNaira(r.amount)})`)
      .join(' + ');

    if (allAlreadyCompleted && !anyNeedsTwoStep) {
      const doneRes = await adminUpdateMoneyPackOrder({
        orderId: order.id,
        nextStatus: 'completed',
        adminNote: `${cleanOrderDesc} • Sent via ${pipelineSummary}`,
      });
      if (doneRes.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...doneRes.order! } : o)),
        );
      }
      setBanner({
        type: 'success',
        text: `Order ${order.order_code} (${order.pack_label}) completed via ${results.length} pipeline(s)!`,
      });
    } else if (allOk) {
      await adminUpdateMoneyPackOrder({
        orderId: order.id,
        nextStatus: 'sending',
        adminNote: `${cleanOrderDesc} • Sending via ${pipelineSummary}`,
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                status: 'sending',
                admin_note: `${cleanOrderDesc} • Sending via ${pipelineSummary}`,
              }
            : o,
        ),
      );
      setBanner({
        type: 'success',
        text: anyNeedsTwoStep
          ? `Transfer started for ${order.order_code} — enter PIN / 2FA in the Live Pipeline Monitor above.`
          : `Sending ${order.pack_label} to @${order.lagos_life_username} — watch live % progress or STOP anytime in Live Pipeline Monitor above.`,
      });
    } else {
      const failedMsg = results
        .filter((r) => !r.ok)
        .map((r) => `@${r.senderUser}: ${r.error}`)
        .join('; ');
      setBanner({ type: 'error', text: `Some sends failed: ${failedMsg}` });
    }

    setConfirmOrder(null);
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
        {/* Direct Admin Money Sender with Description */}
        {activeSenders.length > 0 && (
          <form
            onSubmit={(e) => void handleDirectAdminSend(e)}
            className="mt-5 space-y-3 border-t hairline-border pt-5"
          >
            <p className="font-heading text-xs font-semibold tracking-[0.16em] text-brand-gold uppercase">
              Direct Admin Money Sender (With Description)
            </p>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <label className="block font-heading text-[10px] tracking-[0.14em] text-brand-muted uppercase">
                  Recipient @Username
                </label>
                <input
                  type="text"
                  value={directTarget}
                  onChange={(e) => setDirectTarget(e.target.value)}
                  placeholder="@recipient"
                  className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-heading text-[10px] tracking-[0.14em] text-brand-muted uppercase">
                  Amount (₦)
                </label>
                <input
                  type="text"
                  value={directAmount}
                  onChange={(e) => setDirectAmount(e.target.value)}
                  placeholder="e.g. 100B, 1T"
                  className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block font-heading text-[10px] tracking-[0.14em] text-brand-cream uppercase">
                  Description (What Is This Money For?)
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={directDescription}
                  onChange={(e) => setDirectDescription(e.target.value)}
                  placeholder="e.g. Competition Winner Prize, VIP Bonus..."
                  className="mt-1 w-full border hairline-border bg-brand-black px-3 py-2 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sendingDirect}
                  className="w-full"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendingDirect ? 'Sending...' : 'Send Now'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-heading text-[10px] tracking-[0.14em] text-brand-muted uppercase">
                  Amounts:
                </span>
                {ADMIN_AMOUNT_CHIPS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDirectAmount(amt)}
                    className={cn(
                      'cursor-pointer border px-2 py-0.5 font-mono text-[11px]',
                      directAmount.toUpperCase() === amt
                        ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                        : 'hairline-border bg-brand-black text-brand-cream hover:border-brand-gold',
                    )}
                  >
                    {amt}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-heading text-[10px] tracking-[0.14em] text-brand-muted uppercase">
                  Quick Description:
                </span>
                {ADMIN_DESC_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDirectDescription(preset)}
                    className={cn(
                      'cursor-pointer border px-2 py-0.5 font-body text-[11px]',
                      directDescription === preset
                        ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                        : 'hairline-border bg-brand-black text-brand-cream hover:border-brand-gold',
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}
      </section>
      {allPipelineJobs.length > 0 && (
        <section className="border border-brand-gold/45 bg-brand-charcoal/70">
          <button
            type="button"
            onClick={() => setShowPipelineJobs((prev) => !prev)}
            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <div>
              <p className="heading-eyebrow flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-brand-gold" />
                Live Pipeline Monitor &amp; Transfer History ({allPipelineJobs.length})
              </p>
              <p className="mt-0.5 font-body text-xs text-brand-muted">
                Track live % sent, stop active transfers, inspect errors, or view receipts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasActivePipelineJob && (
                <span className="inline-flex items-center gap-1.5 border border-brand-gold/50 bg-brand-gold/15 px-2.5 py-1 font-heading text-[0.65rem] tracking-[0.16em] text-brand-gold uppercase">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Live Updating
                </span>
              )}
              <span className="inline-flex items-center gap-1 border hairline-border bg-brand-black px-2.5 py-1 font-heading text-[0.65rem] tracking-[0.14em] text-brand-cream uppercase">
                {showPipelineJobs ? (
                  <>
                    Minimize
                    <ChevronUp className="h-3.5 w-3.5 text-brand-gold" />
                  </>
                ) : (
                  <>
                    Expand
                    <ChevronDown className="h-3.5 w-3.5 text-brand-gold" />
                  </>
                )}
              </span>
            </div>
          </button>

          {showPipelineJobs && (
            <div className="max-h-72 space-y-3 overflow-y-auto border-t hairline-border p-4 sm:p-5">
              {allPipelineJobs.slice(0, 20).map(({ sender, job }) => {
              const total = Number(job.total || 0);
              const remaining = Math.max(0, Number(job.remaining || 0));
              const sent = Math.max(0, total - remaining);
              const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
              const statusUpper = String(job.status || 'UNKNOWN').toUpperCase();
              const isStoppable = ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(statusUpper);
              const recipientLabel = (job.target || job.targetLabel || 'recipient').replace(/^@/, '');
              const recentLogs = (job.logs || []).slice(-2);
              const jobDesc = getJobDescription(job);
              const codeKey = `live:${sender.user}:${job.id}`;

              return (
                <div
                  key={`${sender.user}:${job.id}`}
                  className={cn(
                    'border p-4',
                    isStoppable
                      ? 'border-brand-gold/60 bg-brand-black/90'
                      : 'hairline-border bg-brand-black/60',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-xs tracking-[0.14em] text-brand-cream">
                          @{sender.user} &rarr;{' '}
                          <span className="text-brand-gold">@{recipientLabel}</span>
                        </span>
                        <span
                          className={cn(
                            'border px-2 py-0.5 font-heading text-[0.6rem] tracking-[0.14em] uppercase',
                            statusUpper === 'COMPLETED'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : isStoppable
                                ? 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold'
                                : 'border-rose-500/40 bg-rose-500/15 text-rose-300',
                          )}
                        >
                          {statusUpper}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-xs text-brand-muted">
                        Sent <strong className="text-brand-white">{formatNaira(sent)}</strong> of{' '}
                        <strong className="text-brand-white">{formatNaira(total)}</strong> ({pct}%)
                        {job.txCount ? ` • ${job.txCount}${job.totalTxs ? `/${job.totalTxs}` : ''} txs` : ''}
                      </p>
                      {jobDesc && (
                        <p className="mt-1 font-body text-xs text-brand-gold">
                          Description: <span className="text-brand-cream">{jobDesc}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isStoppable && (
                        <button
                          type="button"
                          disabled={stoppingJobId === job.id}
                          onClick={() => void handleStopJob(sender, job)}
                          className="inline-flex cursor-pointer items-center gap-1.5 border border-rose-500 bg-rose-600 px-3 py-1.5 font-heading text-[0.68rem] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-rose-500 disabled:opacity-60"
                        >
                          <Square className="h-3 w-3 fill-current" />
                          {stoppingJobId === job.id ? 'Stopping...' : 'Stop Transfer'}
                        </button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setActiveReceipt({
                            title: 'LagosLife Transfer Proof',
                            reference: `JOB-${job.id.slice(0, 8).toUpperCase()}`,
                            recipient: recipientLabel,
                            senders: [sender.user],
                            totalAmount: total,
                            sentAmount: sent,
                            status: statusUpper,
                            timestamp: new Date().toISOString(),
                            txCount: job.txCount ?? null,
                            note:
                              jobDesc ||
                              (recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null),
                          })
                        }
                      >
                        <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                        Receipt
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden bg-brand-charcoal">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        statusUpper === 'COMPLETED'
                          ? 'bg-emerald-400'
                          : statusUpper === 'CANCELLED' || statusUpper === 'FAILED'
                            ? 'bg-rose-400'
                            : 'bg-brand-gold',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Live Logs / Errors */}
                  {recentLogs.length > 0 && (
                    <div className="mt-2.5 space-y-1 font-mono text-[11px]">
                      {recentLogs.map((line, idx) => {
                        const isErr = /err|fail|insufficient|wrong|stop|cancel/i.test(line);
                        return (
                          <p
                            key={idx}
                            className={isErr ? 'text-rose-300' : 'text-brand-muted'}
                          >
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline PIN / 2FA Resume */}
                  {job.needsTwoStep && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t hairline-border pt-3 text-xs">
                      <KeyRound className="h-3.5 w-3.5 text-brand-gold" />
                      <span className="text-brand-cream">
                        Needs {job.twoStepType || 'PIN/2FA'}:
                      </span>
                      <input
                        type="text"
                        value={twoStepCodes[codeKey] || ''}
                        onChange={(e) =>
                          setTwoStepCodes((prev) => ({ ...prev, [codeKey]: e.target.value }))
                        }
                        placeholder="Enter PIN / 2FA"
                        className="border hairline-border bg-brand-charcoal px-2.5 py-1 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleResumeLiveJobCode(sender, job)}
                      >
                        Resume
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </section>
      )}

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

                    <div className="flex flex-wrap items-center gap-2">
                      {isActionable && (
                        <>
                          {confirmOrder?.id === order.id ? (
                            <div className="w-full space-y-2 border border-brand-gold bg-brand-gold/10 p-3 sm:w-auto">
                              <p className="font-body text-xs text-brand-cream">
                                Send <strong>{order.pack_label}</strong> to{' '}
                                <strong className="text-brand-gold">
                                  @{order.lagos_life_username}
                                </strong>
                                :
                              </p>
                              <input
                                type="text"
                                maxLength={140}
                                value={orderDescription}
                                onChange={(e) => setOrderDescription(e.target.value)}
                                placeholder="Transfer description (what this money is for)"
                                className="w-full min-w-[240px] border hairline-border bg-brand-black px-2.5 py-1.5 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                              />
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
                                  Confirm Send
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmOrder(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busyOrderId === order.id}
                              onClick={() => {
                                setConfirmOrder(order);
                                setOrderDescription(
                                  `VATAR Currency Order ${order.order_code} (${order.pack_label})`,
                                );
                              }}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Approve &amp; Send Now
                            </Button>
                          )}

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
                        </>
                      )}

                      {(order.status === 'completed' || order.status === 'sending') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setActiveReceipt({
                              title: `Money Pack — ${order.pack_label}`,
                              reference: order.order_code,
                              recipient: order.lagos_life_username,
                              senders: activeSenders.map((s) => s.user),
                              totalAmount: order.in_game_amount,
                              sentAmount: order.in_game_amount,
                              status: MONEY_PACK_STATUS_LABELS[order.status],
                              timestamp: order.completed_at || order.approved_at || order.created_at,
                              priceNgn: order.total_price_ngn,
                              note: order.admin_note,
                            })
                          }
                        >
                          <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                          Receipt
                        </Button>
                      )}
                    </div>
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

      {/* 2B. VIP MEMBERSHIP UPGRADE REQUESTS */}
      {pendingVipRequests.length > 0 && (
        <section className="border border-brand-gold/55 bg-brand-charcoal/70 p-5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-brand-gold" />
            <h3 className="font-heading text-sm font-semibold tracking-[0.16em] text-brand-gold uppercase">
              VIP Discount Tier Requests ({pendingVipRequests.length})
            </h3>
          </div>
          <div className="mt-3 space-y-2.5">
            {pendingVipRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 border hairline-border bg-brand-black/80 px-4 py-3 text-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading tracking-[0.14em] text-brand-gold">
                      {req.request_code}
                    </span>
                    <span className="border border-brand-gold/40 bg-brand-gold/15 px-2 py-0.5 font-heading text-[10px] text-brand-gold uppercase">
                      {req.tier} ({req.discount_percent}% off)
                    </span>
                    <span className="font-semibold text-brand-white">
                      ₦{req.price_ngn.toLocaleString()}/mo
                    </span>
                  </div>
                  <p className="mt-1 text-brand-muted">
                    @{req.member_username} ({req.member_full_name}) &bull;{' '}
                    {req.status === 'payment_submitted' ? 'Receipt Sent' : 'Awaiting Payment'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busyVipId === req.id}
                    onClick={() => void handleReviewVip(req, 'approved')}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    Approve 30-Day VIP
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyVipId === req.id}
                    onClick={() => void handleReviewVip(req, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
      <TransferReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
