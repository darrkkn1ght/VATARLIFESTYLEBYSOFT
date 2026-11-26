import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock,
  Copy,
  Heart,
  KeyRound,
  LogOut,
  Play,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { SectionHeading } from '@/components/shared/SectionHeading';
import {
  TransferReceiptModal,
  type TransferReceiptData,
} from '@/components/shared/TransferReceiptModal';
import { Button } from '@/components/ui/Button';
import {
  fetchTreasuryStatus,
  formatNaira,
  importLagosLifeCookie,
  loginLagosLife,
  logoutTreasury,
  parseNairaAmount,
  resendLagosLife2FA,
  sendBatchTransfer,
  sendSingleTransfer,
  startScheduledTransferNow,
  stopTransferJob,
  submitTransferTwoStep,
  TREASURY_TOKEN_STORAGE_KEY,
  verifyLagosLife2FA,
  type TreasuryAccount,
  type TreasuryJob,
} from '@/features/treasury/services/treasuryService';

const SINGLE_CHIPS = [
  { label: '50B', value: '50B' },
  { label: '100B', value: '100B' },
  { label: '500B', value: '500B' },
  { label: '1T', value: '1T' },
  { label: '5T', value: '5T' },
];

const BULK_CHIPS = [
  { label: '10B', value: '10B' },
  { label: '50B', value: '50B' },
  { label: '100B', value: '100B' },
  { label: '500B', value: '500B' },
];

const DONATE_CHIPS = ['10B', '50B', '100B', '500B'];
const SPRAY_TOTAL_CHIPS = ['100B', '200B', '500B', '1T'];
const SPRAY_DROP_CHIPS = ['10B', '25B', '50B', '100B'];
const MAX_SPRAY_PER_MINUTE = 100_000_000_000; // 100B/min VATAR Treasury speed cap
const TRANSFER_COOLDOWN_MS = 60_000; // 1-minute cooldown between transfers
const COOLDOWN_STORAGE_KEY = 'vatar_treasury_cooldown_until';

interface AutoSpraySession {
  recipients: string[];
  totalBudget: number;
  dropPerMin: number;
  sentSoFar: number;
  dropsCompleted: number;
  nextDropAt: number | null;
  status: 'RUNNING' | 'COMPLETED' | 'STOPPED';
  startedAt: string;
  pin?: string;
}

export function MemberTreasuryPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TREASURY_TOKEN_STORAGE_KEY),
  );
  const [account, setAccount] = useState<TreasuryAccount | null>(null);
  const [jobs, setJobs] = useState<TreasuryJob[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Auth form state
  const [authTab, setAuthTab] = useState<'login' | 'cookie'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 2FA login modal state
  const [twoFactorState, setTwoFactorState] = useState<{
    challenge: string;
    method?: string;
    to?: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Transfer mode state
  const [mode, setMode] = useState<'single' | 'batch' | 'spray'>('single');
  const [recipient, setRecipient] = useState(() => searchParams.get('to') || '');
  const [singleAmount, setSingleAmount] = useState(() => searchParams.get('amount') || '');
  const [singleSchedule, setSingleSchedule] = useState('');
  const [singlePin, setSinglePin] = useState('');
  const [bulkRecipients, setBulkRecipients] = useState('');
  const [bulkAmountPer, setBulkAmountPer] = useState('100B');
  const [bulkSchedule, setBulkSchedule] = useState('');
  const [bulkPin, setBulkPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-Spray state (100B/min cap)
  const [sprayRecipients, setSprayRecipients] = useState('');
  const [sprayTotal, setSprayTotal] = useState('500B');
  const [sprayPerMin, setSprayPerMin] = useState('100B');
  const [sprayPin, setSprayPin] = useState('');
  const [spraySession, setSpraySession] = useState<AutoSpraySession | null>(null);
  const sprayTimerRef = useRef<number | null>(null);

  // 1-minute cooldown between transfers
  const [cooldownUntil, setCooldownUntil] = useState<number>(() => {
    const raw = Number(localStorage.getItem(COOLDOWN_STORAGE_KEY) || '0');
    return Number.isFinite(raw) ? raw : 0;
  });
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Receipt modal state
  const [activeReceipt, setActiveReceipt] = useState<TransferReceiptData | null>(null);

  // Per-job inline PIN/2FA inputs
  const [jobCodes, setJobCodes] = useState<Record<string, string>>({});

  // Donate modal state (VLC-style voluntary tip to @milespete)
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState('');
  const [donateSending, setDonateSending] = useState(false);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ text, type });
  };

  const refreshSession = useCallback(
    async (activeToken?: string | null) => {
      const t = activeToken ?? token;
      if (!t) return;
      try {
        const res = await fetchTreasuryStatus(t);
        if (res.ok && res.data.account) {
          setAccount(res.data.account);
          setJobs(res.data.jobs || []);
        } else if (res.status === 401) {
          localStorage.removeItem(TREASURY_TOKEN_STORAGE_KEY);
          setToken(null);
          setAccount(null);
          setJobs([]);
        }
      } catch {
        // Keep current view on transient poll error
      }
    },
    [token],
  );

  const startCooldown = useCallback(() => {
    const until = Date.now() + TRANSFER_COOLDOWN_MS;
    localStorage.setItem(COOLDOWN_STORAGE_KEY, String(until));
    setCooldownUntil(until);
    setNowTick(Date.now());
  }, []);

  const cooldownSecondsLeft = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  const sprayCountdownSeconds =
    spraySession?.status === 'RUNNING' && spraySession.nextDropAt
      ? Math.max(0, Math.ceil((spraySession.nextDropAt - nowTick) / 1000))
      : 0;

  useEffect(() => {
    if (cooldownSecondsLeft === 0 && spraySession?.status !== 'RUNNING') return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownSecondsLeft, spraySession?.status]);

  useEffect(() => {
    return () => {
      if (sprayTimerRef.current !== null) {
        window.clearTimeout(sprayTimerRef.current);
      }
    };
  }, []);

  const hasActiveJob = jobs.some((j) =>
    ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(String(j.status || '').toUpperCase()),
  );

  useEffect(() => {
    if (!token) return;
    void refreshSession(token);
  }, [token, refreshSession]);

  useEffect(() => {
    if (!token) return;
    const intervalMs = hasActiveJob || spraySession?.status === 'RUNNING' ? 3000 : 15000;
    const id = window.setInterval(() => {
      void refreshSession(token);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [token, hasActiveJob, spraySession?.status, refreshSession]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@/, '');
    if (!cleanUser || !password) {
      notify('Enter your LagosLife username and password.', 'error');
      return;
    }
    setAuthLoading(true);
    setStatusMessage(null);
    try {
      const res = await loginLagosLife(cleanUser, password);
      if (res.ok && (res.data.twoFactorRequired || res.data.twoFactor) && res.data.challenge) {
        setTwoFactorState({
          challenge: res.data.challenge,
          method: res.data.method,
          to: res.data.to,
        });
        setTwoFactorCode('');
      } else if (res.ok && res.data.token && res.data.account) {
        localStorage.setItem(TREASURY_TOKEN_STORAGE_KEY, res.data.token);
        setToken(res.data.token);
        setAccount(res.data.account);
        setPassword('');
        notify(`Connected @${res.data.account.user}.`, 'success');
      } else {
        notify(res.data.error || 'Authentication failed.', 'error');
      }
    } catch (err) {
      notify((err as Error).message || 'Unable to reach MoneySender backend.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorState || !twoFactorCode.trim()) return;
    setTwoFactorLoading(true);
    try {
      const res = await verifyLagosLife2FA(twoFactorState.challenge, twoFactorCode.trim());
      if (res.ok && res.data.token && res.data.account) {
        localStorage.setItem(TREASURY_TOKEN_STORAGE_KEY, res.data.token);
        setToken(res.data.token);
        setAccount(res.data.account);
        setTwoFactorState(null);
        setTwoFactorCode('');
        setPassword('');
        notify(`Connected @${res.data.account.user}.`, 'success');
      } else {
        notify(res.data.error || 'Invalid 2FA code.', 'error');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleImportCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) {
      notify('Paste a valid LagosLife session cookie first.', 'error');
      return;
    }
    setAuthLoading(true);
    setStatusMessage(null);
    try {
      const res = await importLagosLifeCookie(cookieInput.trim());
      if (res.ok && res.data.token && res.data.account) {
        localStorage.setItem(TREASURY_TOKEN_STORAGE_KEY, res.data.token);
        setToken(res.data.token);
        setAccount(res.data.account);
        setCookieInput('');
        notify(`Connected @${res.data.account.user}.`, 'success');
      } else {
        notify(res.data.error || 'Invalid session cookie.', 'error');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (token) {
      await logoutTreasury(token).catch(() => {});
    }
    localStorage.removeItem(TREASURY_TOKEN_STORAGE_KEY);
    setToken(null);
    setAccount(null);
    setJobs([]);
    notify('Disconnected and purged session from memory.', 'info');
  };

  const handleSingleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (cooldownSecondsLeft > 0) {
      notify(`Cooldown active — please wait ${cooldownSecondsLeft}s before starting another transfer.`, 'error');
      return;
    }
    const amt = parseNairaAmount(singleAmount);
    if (!recipient.trim() || amt <= 0) {
      notify('Enter a valid recipient username and transfer amount.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await sendSingleTransfer(token, {
        to: recipient.trim(),
        amount: amt,
        scheduledAt: singleSchedule || undefined,
        pin: singlePin.trim() || undefined,
      });
      if (res.ok) {
        startCooldown();
        setSingleAmount('');
        setSingleSchedule('');
        notify(
          singleSchedule
            ? `Scheduled ${formatNaira(amt)} to ${recipient.trim()}.`
            : `Started sending ${formatNaira(amt)} to ${recipient.trim()}.`,
          'success',
        );
        await refreshSession();
      } else {
        notify(res.data.error || 'Failed to initiate transfer.', 'error');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (cooldownSecondsLeft > 0) {
      notify(`Cooldown active — please wait ${cooldownSecondsLeft}s before starting another transfer.`, 'error');
      return;
    }
    const recipients = bulkRecipients
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const amtPer = parseNairaAmount(bulkAmountPer);
    if (recipients.length === 0 || amtPer <= 0) {
      notify('Enter at least one recipient and a valid amount per recipient.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await sendBatchTransfer(token, {
        recipients,
        amountPerUser: amtPer,
        scheduledAt: bulkSchedule || undefined,
        pin: bulkPin.trim() || undefined,
      });
      if (res.ok) {
        startCooldown();
        setBulkRecipients('');
        setBulkSchedule('');
        notify(
          bulkSchedule
            ? `Scheduled bulk distribution to ${recipients.length} recipients.`
            : `Started bulk distribution to ${recipients.length} recipients.`,
          'success',
        );
        await refreshSession();
      } else {
        notify(res.data.error || 'Failed to start bulk distribution.', 'error');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const executeSprayDrop = useCallback(
    async (sessionState: AutoSpraySession, activeToken: string) => {
      const remaining = Math.max(0, sessionState.totalBudget - sessionState.sentSoFar);
      if (remaining <= 0) {
        setSpraySession({ ...sessionState, status: 'COMPLETED', nextDropAt: null });
        notify(`Auto-Spray completed (${formatNaira(sessionState.totalBudget)} sent)!`, 'success');
        return;
      }

      const dropTotal = Math.min(remaining, sessionState.dropPerMin, MAX_SPRAY_PER_MINUTE);
      const recipients = sessionState.recipients;
      const perUser = Math.max(1, Math.floor(dropTotal / recipients.length));

      const res =
        recipients.length === 1
          ? await sendSingleTransfer(activeToken, {
              to: recipients[0],
              amount: dropTotal,
              pin: sessionState.pin || undefined,
            })
          : await sendBatchTransfer(activeToken, {
              recipients,
              amountPerUser: perUser,
              pin: sessionState.pin || undefined,
            });

      if (!res.ok) {
        setSpraySession({ ...sessionState, status: 'STOPPED', nextDropAt: null });
        notify(res.data.error || 'Auto-Spray paused due to transfer error.', 'error');
        return;
      }

      const deliveredThisDrop =
        recipients.length === 1 ? dropTotal : perUser * recipients.length;
      const nextSent = Math.min(
        sessionState.totalBudget,
        sessionState.sentSoFar + deliveredThisDrop,
      );
      const nextDrops = sessionState.dropsCompleted + 1;
      await refreshSession(activeToken);

      if (nextSent >= sessionState.totalBudget) {
        setSpraySession({
          ...sessionState,
          sentSoFar: nextSent,
          dropsCompleted: nextDrops,
          status: 'COMPLETED',
          nextDropAt: null,
        });
        notify(`Auto-Spray completed — ${formatNaira(nextSent)} delivered!`, 'success');
        return;
      }

      const nextDropAt = Date.now() + TRANSFER_COOLDOWN_MS;
      const updatedSession: AutoSpraySession = {
        ...sessionState,
        sentSoFar: nextSent,
        dropsCompleted: nextDrops,
        nextDropAt,
        status: 'RUNNING',
      };
      setSpraySession(updatedSession);
      setNowTick(Date.now());

      sprayTimerRef.current = window.setTimeout(() => {
        void executeSprayDrop(updatedSession, activeToken);
      }, TRANSFER_COOLDOWN_MS);
    },
    [refreshSession],
  );

  const handleStartAutoSpray = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (spraySession?.status === 'RUNNING') {
      notify('An Auto-Spray session is already running. Stop it first to start a new one.', 'error');
      return;
    }
    if (cooldownSecondsLeft > 0) {
      notify(`Cooldown active — please wait ${cooldownSecondsLeft}s before starting Auto-Spray.`, 'error');
      return;
    }

    const recipients = sprayRecipients
      .split(/\r?\n|,/)
      .map((s) => s.trim().replace(/^@/, ''))
      .filter(Boolean);
    const totalBudget = parseNairaAmount(sprayTotal);
    const requestedDrop = parseNairaAmount(sprayPerMin);
    const cappedDrop = Math.min(requestedDrop, MAX_SPRAY_PER_MINUTE);

    if (recipients.length === 0 || totalBudget <= 0 || cappedDrop <= 0) {
      notify('Enter recipient(s), total spray budget, and a valid drop amount (max 100B/min).', 'error');
      return;
    }

    const initialSession: AutoSpraySession = {
      recipients,
      totalBudget,
      dropPerMin: cappedDrop,
      sentSoFar: 0,
      dropsCompleted: 0,
      nextDropAt: null,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      pin: sprayPin.trim() || undefined,
    };

    setSubmitting(true);
    setSpraySession(initialSession);
    startCooldown();
    notify(
      `Auto-Spray started: ${formatNaira(totalBudget)} at ${formatNaira(cappedDrop)}/min.`,
      'info',
    );
    await executeSprayDrop(initialSession, token);
    setSubmitting(false);
  };

  const handleStopAutoSpray = () => {
    if (sprayTimerRef.current !== null) {
      window.clearTimeout(sprayTimerRef.current);
      sprayTimerRef.current = null;
    }
    setSpraySession((prev) =>
      prev ? { ...prev, status: 'STOPPED', nextDropAt: null } : null,
    );
    notify('Auto-Spray stopped.', 'info');
  };

  const handleDonateTip = async () => {
    if (!token) return;
    const amt = parseNairaAmount(donateAmount);
    if (amt <= 0) {
      notify('Enter a valid voluntary tip amount (e.g. 50B).', 'error');
      return;
    }
    setDonateSending(true);
    try {
      const res = await sendSingleTransfer(token, {
        to: 'milespete',
        amount: amt,
        pin: singlePin.trim() || bulkPin.trim() || undefined,
      });
      if (res.ok) {
        setDonateAmount('');
        setDonateOpen(false);
        notify(`Thank you for tipping ${formatNaira(amt)} to @milespete!`, 'success');
        await refreshSession();
      } else {
        notify(res.data.error || 'Unable to send voluntary tip.', 'error');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setDonateSending(false);
    }
  };

  const isMilespete =
    (account?.user || '').toLowerCase().replace(/^@/, '') === 'milespete';

  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Member Utility"
          title="VATAR Treasury"
          description="Automated 24/7 LagosLife transfers, bulk distribution, and scheduled settlement — 100% free with zero fees."
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDonateOpen(true)}
          className="inline-flex items-center gap-2"
        >
          <Heart className="h-3.5 w-3.5 text-brand-gold" />
          Donate
        </Button>
      </div>

      {statusMessage && (
        <div
          className={`mt-6 rounded-sm border px-4 py-3 font-body text-sm ${
            statusMessage.type === 'error'
              ? 'border-red-500/40 bg-red-950/40 text-red-200'
              : statusMessage.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
                : 'border-brand-gold/30 bg-brand-charcoal text-brand-cream'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {!account ? (
        <div className="mt-8 mx-auto max-w-xl border hairline-border bg-brand-charcoal p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-brand-gold/30 bg-brand-black text-brand-gold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-[0.06em] text-brand-white uppercase">
                Connect LagosLife Account
              </h2>
              <p className="font-body text-xs text-brand-muted">
                Sessions live strictly in ephemeral memory. Sign out anytime to wipe.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 border hairline-border bg-brand-black p-1">
            <button
              type="button"
              onClick={() => setAuthTab('login')}
              className={`cursor-pointer py-2 font-body text-xs tracking-[0.16em] uppercase transition-colors ${
                authTab === 'login'
                  ? 'bg-brand-gold text-brand-black font-semibold'
                  : 'text-brand-muted hover:text-brand-white'
              }`}
            >
              Credentials
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('cookie')}
              className={`cursor-pointer py-2 font-body text-xs tracking-[0.16em] uppercase transition-colors ${
                authTab === 'cookie'
                  ? 'bg-brand-gold text-brand-black font-semibold'
                  : 'text-brand-muted hover:text-brand-white'
              }`}
            >
              Session Token
            </button>
          </div>

          {authTab === 'login' ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                  LagosLife Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username"
                  autoComplete="off"
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={authLoading} className="w-full">
                {authLoading ? 'Connecting...' : 'Connect & Authenticate'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleImportCookie} className="mt-6 space-y-4">
              <div>
                <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                  LagosLife Session Cookie
                </label>
                <textarea
                  rows={3}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="ll_session=...; ll_pass=..."
                  className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-xs text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={authLoading} className="w-full">
                {authLoading ? 'Importing...' : 'Import Session Token'}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Account Balance Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 border hairline-border bg-brand-charcoal px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center border border-brand-gold/30 bg-brand-black text-brand-gold">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="font-body text-xs tracking-[0.16em] text-brand-muted uppercase">
                  {account.name} (@{account.user})
                </p>
                <p className="font-heading text-2xl font-semibold text-brand-gold">
                  {formatNaira(account.money)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refreshSession()}
                className="inline-flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleDisconnect()}
                className="inline-flex items-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </div>

          {/* Transfer Form Card */}
          <div className="border hairline-border bg-brand-charcoal p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-3 border hairline-border bg-brand-black p-1 w-full max-w-lg">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`inline-flex cursor-pointer items-center justify-center gap-1.5 py-2 font-body text-xs tracking-[0.12em] uppercase transition-colors ${
                    mode === 'single'
                      ? 'bg-brand-gold text-brand-black font-semibold'
                      : 'text-brand-muted hover:text-brand-white'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setMode('batch')}
                  className={`inline-flex cursor-pointer items-center justify-center gap-1.5 py-2 font-body text-xs tracking-[0.12em] uppercase transition-colors ${
                    mode === 'batch'
                      ? 'bg-brand-gold text-brand-black font-semibold'
                      : 'text-brand-muted hover:text-brand-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Bulk
                </button>
                <button
                  type="button"
                  onClick={() => setMode('spray')}
                  className={`inline-flex cursor-pointer items-center justify-center gap-1.5 py-2 font-body text-xs tracking-[0.12em] uppercase transition-colors ${
                    mode === 'spray'
                      ? 'bg-brand-gold text-brand-black font-semibold'
                      : 'text-brand-muted hover:text-brand-white'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto Spray
                </button>
              </div>

              <span className="border hairline-border bg-brand-black px-3 py-1.5 font-mono text-[11px] text-brand-gold">
                Standard Pace &bull; Max 100B/min &bull; 60s Cooldown
              </span>
            </div>

            {mode === 'single' ? (
              <form onSubmit={handleSingleSend} className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                    Recipient Username
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="@recipient"
                    className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                    Transfer Amount (₦)
                  </label>
                  <input
                    type="text"
                    value={singleAmount}
                    onChange={(e) => setSingleAmount(e.target.value)}
                    placeholder="e.g. 100B, 500B, 1T, 5T"
                    className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SINGLE_CHIPS.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setSingleAmount(c.value)}
                        className="cursor-pointer border hairline-border bg-brand-black px-2.5 py-1 font-mono text-xs text-brand-cream hover:border-brand-gold hover:text-brand-gold"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                    Schedule For Later (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={singleSchedule}
                    onChange={(e) => setSingleSchedule(e.target.value)}
                    className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                    Transaction PIN (Optional)
                  </label>
                  <input
                    type="password"
                    value={singlePin}
                    onChange={(e) => setSinglePin(e.target.value)}
                    placeholder="4-digit LagosLife PIN"
                    maxLength={8}
                    className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    disabled={submitting || cooldownSecondsLeft > 0}
                    className="w-full sm:w-auto"
                  >
                    {submitting
                      ? 'Submitting...'
                      : cooldownSecondsLeft > 0
                        ? `Cooldown (${cooldownSecondsLeft}s)`
                        : singleSchedule
                          ? 'Queue Scheduled Transfer'
                          : 'Initiate Automated Transfer'}
                  </Button>
                </div>
              </form>
            ) : mode === 'batch' ? (
              <form onSubmit={handleBatchSend} className="mt-6 space-y-5">
                <div>
                  <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                    Recipients (One per line or comma-separated; optional custom amount per line like `@user 50B`)
                  </label>
                  <textarea
                    rows={4}
                    value={bulkRecipients}
                    onChange={(e) => setBulkRecipients(e.target.value)}
                    placeholder={'@player1\n@player2 50B\n@player3'}
                    className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <div>
                    <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                      Default Amount Per Recipient
                    </label>
                    <input
                      type="text"
                      value={bulkAmountPer}
                      onChange={(e) => setBulkAmountPer(e.target.value)}
                      placeholder="100B"
                      className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {BULK_CHIPS.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setBulkAmountPer(c.value)}
                          className="cursor-pointer border hairline-border bg-brand-black px-2 py-0.5 font-mono text-xs text-brand-cream hover:border-brand-gold hover:text-brand-gold"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                      Schedule For Later (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={bulkSchedule}
                      onChange={(e) => setBulkSchedule(e.target.value)}
                      className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                      Transaction PIN (Optional)
                    </label>
                    <input
                      type="password"
                      value={bulkPin}
                      onChange={(e) => setBulkPin(e.target.value)}
                      placeholder="4-digit PIN"
                      maxLength={8}
                      className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={submitting || cooldownSecondsLeft > 0}
                  className="w-full sm:w-auto"
                >
                  {submitting
                    ? 'Submitting...'
                    : cooldownSecondsLeft > 0
                      ? `Cooldown (${cooldownSecondsLeft}s)`
                      : bulkSchedule
                        ? 'Queue Scheduled Bulk Send'
                        : 'Distribute to All Recipients'}
                </Button>
              </form>
            ) : (
              <div className="mt-6 space-y-5">
                {spraySession && (
                  <div className="border border-brand-gold/50 bg-brand-black p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-heading text-xs tracking-[0.16em] text-brand-gold uppercase">
                          Auto-Spray {spraySession.status} &bull; {formatNaira(spraySession.dropPerMin)}/min
                        </p>
                        <p className="mt-1 font-mono text-xs text-brand-cream">
                          Sent {formatNaira(spraySession.sentSoFar)} / {formatNaira(spraySession.totalBudget)} (
                          {Math.min(
                            100,
                            Math.round((spraySession.sentSoFar / Math.max(1, spraySession.totalBudget)) * 100),
                          )}
                          %) &bull; {spraySession.dropsCompleted} drop(s)
                          {spraySession.status === 'RUNNING' && sprayCountdownSeconds > 0
                            ? ` • Next drop in ${sprayCountdownSeconds}s`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {spraySession.status === 'RUNNING' && (
                          <button
                            type="button"
                            onClick={handleStopAutoSpray}
                            className="inline-flex cursor-pointer items-center gap-1.5 border border-rose-500 bg-rose-600 px-3 py-1.5 font-heading text-[0.68rem] font-semibold tracking-[0.14em] text-white uppercase hover:bg-rose-500"
                          >
                            <Square className="h-3 w-3 fill-current" />
                            Stop Spray
                          </button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setActiveReceipt({
                              title: 'Auto-Spray Delivery Receipt',
                              reference: `SPR-${Date.now().toString(36).slice(-6).toUpperCase()}`,
                              recipient: spraySession.recipients.join(', '),
                              senders: account?.user ? [account.user] : [],
                              totalAmount: spraySession.totalBudget,
                              sentAmount: spraySession.sentSoFar,
                              status: spraySession.status,
                              timestamp: spraySession.startedAt,
                              txCount: spraySession.dropsCompleted,
                              note: `Paced at ${formatNaira(spraySession.dropPerMin)}/min across ${spraySession.recipients.length} recipient(s).`,
                            })
                          }
                        >
                          <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                          Spray Receipt
                        </Button>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden bg-brand-charcoal">
                      <div
                        className="h-full bg-brand-gold transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((spraySession.sentSoFar / Math.max(1, spraySession.totalBudget)) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <form onSubmit={handleStartAutoSpray} className="space-y-5">
                  <div>
                    <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                      Spray Recipient(s) (1 or multiple handles, comma or newline separated)
                    </label>
                    <textarea
                      rows={3}
                      value={sprayRecipients}
                      onChange={(e) => setSprayRecipients(e.target.value)}
                      placeholder={'@winner1\n@winner2'}
                      className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                        Total Spray Budget (₦)
                      </label>
                      <input
                        type="text"
                        value={sprayTotal}
                        onChange={(e) => setSprayTotal(e.target.value)}
                        placeholder="e.g. 500B, 1T"
                        className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {SPRAY_TOTAL_CHIPS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSprayTotal(c)}
                            className="cursor-pointer border hairline-border bg-brand-black px-2 py-0.5 font-mono text-xs text-brand-cream hover:border-brand-gold hover:text-brand-gold"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                        Drop Per Minute (Max 100B)
                      </label>
                      <input
                        type="text"
                        value={sprayPerMin}
                        onChange={(e) => setSprayPerMin(e.target.value)}
                        placeholder="Max 100B"
                        className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {SPRAY_DROP_CHIPS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSprayPerMin(c)}
                            className="cursor-pointer border hairline-border bg-brand-black px-2 py-0.5 font-mono text-xs text-brand-cream hover:border-brand-gold hover:text-brand-gold"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                        Transaction PIN (Optional)
                      </label>
                      <input
                        type="password"
                        value={sprayPin}
                        onChange={(e) => setSprayPin(e.target.value)}
                        placeholder="4-digit PIN"
                        maxLength={8}
                        className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting || cooldownSecondsLeft > 0 || spraySession?.status === 'RUNNING'}
                    className="w-full sm:w-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {spraySession?.status === 'RUNNING'
                      ? 'Auto-Spray Running...'
                      : cooldownSecondsLeft > 0
                        ? `Cooldown (${cooldownSecondsLeft}s)`
                        : 'Start Auto-Spray (Max 100B/min)'}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Live Transfer Queue */}
          <div className="border hairline-border bg-brand-charcoal p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-heading text-base font-semibold tracking-[0.12em] text-brand-white uppercase">
                Live Settlement Queue ({jobs.length})
              </h3>
              <span className="font-body text-xs text-brand-muted">Auto-syncs every 3s</span>
            </div>

            {jobs.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center border hairline-border bg-brand-black/60 px-6 py-10 text-center">
                <Clock className="h-6 w-6 text-brand-muted" />
                <p className="mt-2 font-body text-sm text-brand-muted">
                  No active or recent transfers in this session yet.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {jobs.map((job) => {
                  const delivered = Math.max(0, (job.total || 0) - (job.remaining || 0));
                  const pct = job.total > 0 ? Math.min(100, Math.round((delivered / job.total) * 100)) : 0;
                  const recentLogs = (job.logs || []).slice(-4);
                  return (
                    <div
                      key={job.id}
                      className="border hairline-border bg-brand-black p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-body text-sm font-semibold text-brand-white">
                            {job.targetLabel || job.target}
                          </p>
                          <p className="font-mono text-xs text-brand-muted">
                            {formatNaira(delivered)} / {formatNaira(job.total)} ({pct}%)
                            {job.totalTxs ? ` • ${job.txCount || 0}/${job.totalTxs} chunks` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-brand-gold/40 px-2.5 py-0.5 font-mono text-[11px] text-brand-gold uppercase">
                            {job.status}
                          </span>
                          {job.status === 'SCHEDULED' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                if (!token) return;
                                await startScheduledTransferNow(token, job.id);
                                await refreshSession();
                              }}
                              className="inline-flex items-center gap-1"
                            >
                              <Play className="h-3 w-3" />
                              Start Now
                            </Button>
                          )}
                          {(job.status === 'RUNNING' ||
                            job.status === 'PAUSED' ||
                            job.status === 'SCHEDULED') && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                if (!token) return;
                                await stopTransferJob(token, job.id);
                                await refreshSession();
                              }}
                              className="inline-flex items-center gap-1"
                            >
                              <Square className="h-3 w-3" />
                              Stop
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setActiveReceipt({
                                title: 'VATAR Treasury Transfer Receipt',
                                reference: `TRS-${job.id.slice(0, 8).toUpperCase()}`,
                                recipient: (job.targetLabel || job.target || 'recipient').replace(/^@/, ''),
                                senders: account?.user ? [account.user] : [],
                                totalAmount: Number(job.total || 0),
                                sentAmount: delivered,
                                status: String(job.status || 'COMPLETED').toUpperCase(),
                                timestamp: new Date().toISOString(),
                                txCount: job.txCount ?? null,
                                note: recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null,
                              })
                            }
                            className="inline-flex items-center gap-1"
                          >
                            <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                            Receipt
                          </Button>
                        </div>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden bg-brand-charcoal">
                        <div
                          className="h-full bg-brand-gold transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {job.needsTwoStep && job.status === 'PAUSED' && (
                        <div className="space-y-2 border border-brand-gold/50 bg-brand-charcoal/80 p-3">
                          <div className="flex items-center gap-2 font-body text-xs font-semibold text-brand-gold">
                            <KeyRound className="h-4 w-4 shrink-0" />
                            <span>
                              {job.twoStepType === 'pin'
                                ? 'Transaction PIN Required to Continue'
                                : 'Two-Step 2FA Verification Required (6-Digit Code)'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={10}
                              value={jobCodes[job.id] || ''}
                              onChange={(e) =>
                                setJobCodes((prev) => ({ ...prev, [job.id]: e.target.value }))
                              }
                              placeholder={
                                job.twoStepType === 'pin'
                                  ? 'Enter 4-digit Transaction PIN'
                                  : 'Enter 6-digit 2FA code (Authenticator / Email)'
                              }
                              className="flex-1 min-w-[180px] border hairline-border bg-brand-black px-3 py-1.5 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                            />
                            <Button
                              size="sm"
                              onClick={async () => {
                                const code = (jobCodes[job.id] || '').trim();
                                if (!token || !code) return;
                                const res = await submitTransferTwoStep(token, job.id, code);
                                if (res.ok) {
                                  setJobCodes((prev) => ({ ...prev, [job.id]: '' }));
                                  notify('Verification submitted — resuming transfer.', 'success');
                                  await refreshSession();
                                } else {
                                  notify(res.data.error || 'Failed to resume transfer.', 'error');
                                }
                              }}
                            >
                              Submit &amp; Resume
                            </Button>
                          </div>
                        </div>
                      )}

                      {recentLogs.length > 0 && (
                        <div className="space-y-1 border-t hairline-border pt-2 font-mono text-[11px] text-brand-muted">
                          {recentLogs.map((line, i) => (
                            <p key={i} className="truncate">
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2FA Login Modal */}
      {twoFactorState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border hairline-border bg-brand-charcoal p-6">
            <h3 className="font-heading text-lg font-semibold text-brand-white uppercase">
              Two-Step Verification
            </h3>
            <p className="mt-1 font-body text-xs text-brand-muted">
              {twoFactorState.method === 'email'
                ? `Enter the 6-digit code sent to ${twoFactorState.to || 'your email'}.`
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>
            <form onSubmit={handleVerify2FA} className="mt-4 space-y-4">
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="000000"
                maxLength={11}
                className="w-full border hairline-border bg-brand-black px-4 py-3 text-center font-mono text-lg tracking-[0.25em] text-brand-white focus:border-brand-gold focus:outline-none"
              />
              {twoFactorState.method === 'email' && (
                <button
                  type="button"
                  onClick={async () => {
                    await resendLagosLife2FA(twoFactorState.challenge);
                    notify('Verification code resent.', 'info');
                  }}
                  className="cursor-pointer font-body text-xs text-brand-gold hover:underline"
                >
                  Resend Email Code
                </button>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setTwoFactorState(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={twoFactorLoading} className="flex-1">
                  {twoFactorLoading ? 'Verifying...' : 'Verify & Connect'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voluntary Donate Modal (VLC-style) */}
      {donateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border hairline-border bg-brand-charcoal p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold text-brand-gold uppercase">
                  Support VATAR Treasury
                </h3>
                <p className="mt-1 font-body text-xs text-brand-muted">
                  100% free — zero fees, zero cuts, zero paywalls. If this saves you time, you can
                  voluntarily tip <strong className="text-brand-white">@milespete</strong> in-game.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDonateOpen(false)}
                className="cursor-pointer text-brand-muted hover:text-brand-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between border hairline-border bg-brand-black px-3.5 py-2.5">
              <code className="font-mono text-sm text-brand-gold">@milespete</code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText('milespete');
                    notify('Copied @milespete to clipboard.', 'success');
                  } catch {
                    notify('Handle: @milespete', 'info');
                  }
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 font-body text-xs text-brand-cream hover:text-brand-gold"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Handle
              </button>
            </div>

            {account && !isMilespete && (
              <div className="mt-5 space-y-3 border-t hairline-border pt-4">
                <p className="font-body text-xs tracking-[0.12em] text-brand-muted uppercase">
                  Or Send a Voluntary Tip Now
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DONATE_CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDonateAmount(c)}
                      className="cursor-pointer border hairline-border bg-brand-black px-3 py-1 font-mono text-xs text-brand-cream hover:border-brand-gold hover:text-brand-gold"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                  placeholder="Custom tip (e.g. 50B, 100B)"
                  className="w-full border hairline-border bg-brand-black px-3.5 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
                <Button
                  type="button"
                  disabled={donateSending}
                  onClick={() => void handleDonateTip()}
                  className="w-full"
                >
                  {donateSending ? 'Sending Tip...' : 'Send Voluntary Tip to @milespete'}
                </Button>
              </div>
            )}

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setDonateOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <TransferReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </PageContainer>
  );
}
