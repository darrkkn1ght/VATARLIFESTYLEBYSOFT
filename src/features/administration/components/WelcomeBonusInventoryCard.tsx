import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Gift,
  History,
  KeyRound,
  LogOut,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
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
  sendSingleTransfer,
  submitTransferTwoStep,
  verifyLagosLife2FA,
  type TreasuryAccount,
  type TreasuryJob,
} from '@/features/treasury/services/treasuryService';

const BONUS_TOKEN_KEY = 'vatar_admin_bonus_treasury_token';
const BONUS_CFG_KEY = 'vatar_admin_welcome_bonus_cfg';

export interface WelcomeBonusConfig {
  enabled: boolean;
  amountRaw: string;
  sentHandles: Record<string, { at: string; amount: number; memberLabel: string }>;
}

const DEFAULT_CFG: WelcomeBonusConfig = {
  enabled: false,
  amountRaw: '20B',
  sentHandles: {},
};

export function loadWelcomeBonusConfig(): WelcomeBonusConfig {
  try {
    const raw = localStorage.getItem(BONUS_CFG_KEY);
    if (!raw) return DEFAULT_CFG;
    const parsed = JSON.parse(raw) as Partial<WelcomeBonusConfig>;
    return {
      enabled: Boolean(parsed.enabled),
      amountRaw: typeof parsed.amountRaw === 'string' && parsed.amountRaw.trim() ? parsed.amountRaw : '20B',
      sentHandles: parsed.sentHandles && typeof parsed.sentHandles === 'object' ? parsed.sentHandles : {},
    };
  } catch {
    return DEFAULT_CFG;
  }
}

export function saveWelcomeBonusConfig(cfg: WelcomeBonusConfig) {
  localStorage.setItem(BONUS_CFG_KEY, JSON.stringify(cfg));
}

export async function dispatchWelcomeBonusOnApproval(input: {
  lagosLifeUsername: string | null | undefined;
  memberLabel: string;
}): Promise<{ dispatched: boolean; message: string }> {
  const cfg = loadWelcomeBonusConfig();
  if (!cfg.enabled) {
    return { dispatched: false, message: '' };
  }

  const token = localStorage.getItem(BONUS_TOKEN_KEY);
  if (!token) {
    return {
      dispatched: false,
      message: 'Welcome Bonus is ON, but no Bonus Inventory account is connected.',
    };
  }

  const handle = String(input.lagosLifeUsername || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!handle) {
    return {
      dispatched: false,
      message: `Skipped welcome bonus: ${input.memberLabel} has no LagosLife username on file.`,
    };
  }

  if (cfg.sentHandles[handle]) {
    return {
      dispatched: false,
      message: `Skipped welcome bonus: @${handle} already received a welcome bonus previously.`,
    };
  }

  const amount = parseNairaAmount(cfg.amountRaw);
  if (amount <= 0) {
    return {
      dispatched: false,
      message: `Skipped welcome bonus: invalid configured bonus amount ("${cfg.amountRaw}").`,
    };
  }

  const pin = sessionStorage.getItem('vatar_admin_bonus_pin') || undefined;
  const res = await sendSingleTransfer(token, {
    to: handle,
    amount,
    pin,
  });

  if (!res.ok) {
    return {
      dispatched: false,
      message: `Welcome bonus to @${handle} could not start: ${res.data.error || 'Unknown error'}`,
    };
  }

  cfg.sentHandles[handle] = {
    at: new Date().toISOString(),
    amount,
    memberLabel: input.memberLabel,
  };
  saveWelcomeBonusConfig(cfg);

  return {
    dispatched: true,
    message: `Auto-dispatched ${formatNaira(amount)} welcome bonus to @${handle}!`,
  };
}

const PRESET_BONUSES = ['5B', '10B', '20B', '50B', '100B'];

interface WelcomeBonusInventoryCardProps {
  refreshSignal?: number;
}

export function WelcomeBonusInventoryCard({
  refreshSignal = 0,
}: WelcomeBonusInventoryCardProps) {
  const [cfg, setCfg] = useState<WelcomeBonusConfig>(() => loadWelcomeBonusConfig());
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(BONUS_TOKEN_KEY),
  );
  const [account, setAccount] = useState<TreasuryAccount | null>(null);
  const [jobs, setJobs] = useState<TreasuryJob[]>([]);
  const [jobCodes, setJobCodes] = useState<Record<string, string>>({});
  const [bonusPin, setBonusPin] = useState<string>(
    () => sessionStorage.getItem('vatar_admin_bonus_pin') || '',
  );
  const [expanded, setExpanded] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<TransferReceiptData | null>(null);

  // Connect form
  const [authTab, setAuthTab] = useState<'login' | 'cookie'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 2FA state
  const [twoFactorState, setTwoFactorState] = useState<{
    challenge: string;
    method?: string;
    to?: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const syncAccount = useCallback(
    async (activeToken?: string | null) => {
      const t = activeToken ?? token;
      if (!t) return;
      try {
        const res = await fetchTreasuryStatus(t);
        if (res.ok && res.data.account) {
          setAccount(res.data.account);
          setJobs(res.data.jobs || []);
        } else if (res.status === 401) {
          localStorage.removeItem(BONUS_TOKEN_KEY);
          setToken(null);
          setAccount(null);
          setJobs([]);
        }
      } catch {
        // Ignore transient errors
      }
    },
    [token],
  );

  const hasRunningBonusJob = jobs.some((j) =>
    ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(String(j.status || '').toUpperCase()),
  );

  useEffect(() => {
    setCfg(loadWelcomeBonusConfig());
    if (!token) return;
    void syncAccount(token);
  }, [token, syncAccount, refreshSignal]);

  // Only poll every 3s while a bonus transfer is actively running
  useEffect(() => {
    if (!token || !hasRunningBonusJob) return;
    const id = window.setInterval(() => {
      void syncAccount(token);
    }, 3000);
    return () => window.clearInterval(id);
  }, [token, hasRunningBonusJob, syncAccount]);

  const bonusHistoryEntries = Object.entries(cfg.sentHandles)
    .map(([handle, meta]) => ({
      handle,
      at: meta.at,
      amount: meta.amount,
      memberLabel: meta.memberLabel,
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const filteredBonusHistory = bonusHistoryEntries.filter((entry) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.handle.toLowerCase().includes(q) ||
      entry.memberLabel.toLowerCase().includes(q)
    );
  });

  const updateCfg = (patch: Partial<WelcomeBonusConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      saveWelcomeBonusConfig(next);
      return next;
    });
  };

  const bonusNum = parseNairaAmount(cfg.amountRaw);
  const bonusesRemaining =
    account && bonusNum > 0 ? Math.floor((account.money || 0) / bonusNum) : 0;
  const totalSentCount = Object.keys(cfg.sentHandles).length;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().replace(/^@/, '');
    if (!clean || !password) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await loginLagosLife(clean, password);
      if (res.ok && (res.data.twoFactorRequired || res.data.twoFactor) && res.data.challenge) {
        setTwoFactorState({
          challenge: res.data.challenge,
          method: res.data.method,
          to: res.data.to,
        });
        setTwoFactorCode('');
        setNotice(
          res.data.method === 'email'
            ? `Enter the 6-digit verification code sent to ${res.data.to || 'your email'} below.`
            : 'Enter the 6-digit code from your authenticator app below.',
        );
      } else if (res.ok && res.data.token && res.data.account) {
        localStorage.setItem(BONUS_TOKEN_KEY, res.data.token);
        setToken(res.data.token);
        setAccount(res.data.account);
        setPassword('');
        setNotice(`Connected bonus inventory @${res.data.account.user}.`);
      } else {
        setError(res.data.error || 'Authentication failed.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorState || !twoFactorCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verifyLagosLife2FA(twoFactorState.challenge, twoFactorCode.trim());
      if (res.ok && res.data.token && res.data.account) {
        localStorage.setItem(BONUS_TOKEN_KEY, res.data.token);
        setToken(res.data.token);
        setAccount(res.data.account);
        setTwoFactorState(null);
        setTwoFactorCode('');
        setPassword('');
        setNotice(`Connected bonus inventory @${res.data.account.user}.`);
      } else {
        setError(res.data.error || 'Invalid 2FA code.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await importLagosLifeCookie(cookieInput.trim());
      if (res.ok && res.data.token && res.data.account) {
        localStorage.setItem(BONUS_TOKEN_KEY, res.data.token);
        setToken(res.data.token);
        setAccount(res.data.account);
        setCookieInput('');
        setNotice(`Connected bonus inventory @${res.data.account.user}.`);
      } else {
        setError(res.data.error || 'Invalid cookie.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (token) await logoutTreasury(token).catch(() => {});
    localStorage.removeItem(BONUS_TOKEN_KEY);
    sessionStorage.removeItem('vatar_admin_bonus_pin');
    setToken(null);
    setAccount(null);
    setBonusPin('');
    setNotice('Bonus inventory account disconnected.');
  };

  const pausedJobsNeedingCode = jobs.filter(
    (j) => j.needsTwoStep && j.status === 'PAUSED',
  );

  return (
    <div className="mb-8 border hairline-border bg-brand-charcoal/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-brand-gold/35 bg-brand-black text-brand-gold">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-base font-semibold tracking-[0.08em] text-brand-white uppercase">
                Welcome Bonus Inventory
              </h2>
              <span
                className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                  cfg.enabled
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                    : 'border-brand-muted/30 bg-brand-black text-brand-muted'
                }`}
              >
                {cfg.enabled ? `Auto-Send ON (${cfg.amountRaw})` : 'Auto-Send OFF'}
              </span>
            </div>
            <p className="mt-0.5 font-body text-xs text-brand-muted">
              {account
                ? `Inventory @${account.user}: ${formatNaira(account.money)} (~${bonusesRemaining.toLocaleString()} approvals funded) • ${totalSentCount} paid`
                : `Automatically send a configurable LagosLife bonus (default ₦20B) when you approve new members • ${totalSentCount} paid`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 border hairline-border bg-brand-black px-3 py-1.5 font-body text-xs text-brand-cream">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => updateCfg({ enabled: e.target.checked })}
              className="accent-brand-gold"
            />
            Auto-send on Approve
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide Settings' : 'Configure Inventory'}
          </Button>
        </div>
      </div>

      {pausedJobsNeedingCode.length > 0 && token && (
        <div className="mt-4 space-y-3 border border-brand-gold/55 bg-brand-black/90 p-4">
          {pausedJobsNeedingCode.map((job) => (
            <div key={job.id} className="space-y-2">
              <div className="flex items-center gap-2 font-body text-xs font-semibold text-brand-gold">
                <KeyRound className="h-4 w-4 shrink-0" />
                <span>
                  {job.twoStepType === 'pin'
                    ? `Bonus to ${job.targetLabel || job.target} needs your 4-digit Transaction PIN:`
                    : `Bonus to ${job.targetLabel || job.target} needs your 6-digit 2FA code:`}
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
                      ? '4-digit Transaction PIN'
                      : '6-digit 2FA code (Authenticator / Email)'
                  }
                  className="flex-1 min-w-[180px] border hairline-border bg-brand-charcoal px-3 py-1.5 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    const code = (jobCodes[job.id] || '').trim();
                    if (!code) return;
                    setError(null);
                    const res = await submitTransferTwoStep(token, job.id, code);
                    if (res.ok) {
                      setJobCodes((prev) => ({ ...prev, [job.id]: '' }));
                      setNotice('Verification submitted — resuming welcome bonus transfer.');
                      await syncAccount(token);
                    } else {
                      setError(res.data.error || 'Invalid verification code.');
                    }
                  }}
                >
                  Submit &amp; Send
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-5 space-y-5 border-t hairline-border pt-5">
          {error && (
            <div className="border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 font-body text-xs text-red-200">
              {error}
            </div>
          )}
          {notice && (
            <div className="flex items-center gap-2 border border-emerald-500/40 bg-emerald-950/35 px-3.5 py-2.5 font-body text-xs text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {notice}
            </div>
          )}

          {/* Configurable Bonus Amount */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                Bonus Amount Per Approved Member (₦)
              </label>
              <input
                type="text"
                value={cfg.amountRaw}
                onChange={(e) => updateCfg({ amountRaw: e.target.value })}
                placeholder="e.g. 20B"
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_BONUSES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateCfg({ amountRaw: p })}
                    className={`cursor-pointer border px-2.5 py-0.5 font-mono text-xs ${
                      cfg.amountRaw.toUpperCase() === p
                        ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                        : 'hairline-border bg-brand-black text-brand-cream hover:border-brand-gold'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-body text-xs tracking-[0.14em] text-brand-muted uppercase">
                Bonus Account Transaction PIN (Optional, session-only)
              </label>
              <input
                type="password"
                value={bonusPin}
                onChange={(e) => {
                  setBonusPin(e.target.value);
                  sessionStorage.setItem('vatar_admin_bonus_pin', e.target.value);
                }}
                placeholder="4-digit PIN if required"
                maxLength={8}
                className="mt-1.5 w-full border hairline-border bg-brand-black px-3.5 py-2 font-mono text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
              <p className="mt-1.5 font-body text-[11px] text-brand-muted">
                1-time per LagosLife handle dedup is enforced automatically.
              </p>
            </div>
          </div>

          {/* Connected Bonus Inventory Account */}
          {account ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border hairline-border bg-brand-black p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-brand-gold" />
                <div>
                  <p className="font-body text-xs text-brand-muted">
                    Connected Bonus Pool: <strong className="text-brand-white">@{account.user}</strong>
                  </p>
                  <p className="font-heading text-lg text-brand-gold">
                    {formatNaira(account.money)}{' '}
                    <span className="font-body text-xs text-brand-muted">
                      ({bonusesRemaining.toLocaleString()} × {cfg.amountRaw} remaining)
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void syncAccount()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleDisconnect()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="border hairline-border bg-brand-black p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-body text-xs font-semibold tracking-[0.12em] text-brand-cream uppercase">
                  <ShieldCheck className="h-4 w-4 text-brand-gold" />
                  Connect Bonus-Funding LagosLife Account
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAuthTab('login')}
                    className={`cursor-pointer px-2.5 py-1 font-body text-[11px] uppercase ${
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
                    className={`cursor-pointer px-2.5 py-1 font-body text-[11px] uppercase ${
                      authTab === 'cookie'
                        ? 'bg-brand-gold text-brand-black font-semibold'
                        : 'text-brand-muted hover:text-brand-white'
                    }`}
                  >
                    Session Cookie
                  </button>
                </div>
              </div>

              {twoFactorState ? (
                <form onSubmit={handleVerify2FA} className="mt-4 space-y-2.5">
                  <p className="font-body text-xs text-brand-cream">
                    {twoFactorState.method === 'email'
                      ? `Type the 6-digit code sent to ${twoFactorState.to || 'your email'}:`
                      : 'Type the 6-digit code from your authenticator app:'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={8}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="6-digit 2FA code"
                      className="flex-1 min-w-[160px] border border-brand-gold/60 bg-brand-charcoal px-3 py-2 font-mono text-sm tracking-[0.2em] text-brand-white focus:border-brand-gold focus:outline-none"
                    />
                    {twoFactorState.method === 'email' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void resendLagosLife2FA(twoFactorState.challenge)}
                      >
                        Resend
                      </Button>
                    )}
                    <Button type="submit" size="sm" disabled={loading}>
                      {loading ? 'Verifying...' : 'Verify 2FA'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setTwoFactorState(null);
                        setTwoFactorCode('');
                        setNotice(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : authTab === 'login' ? (
                <form onSubmit={handleLogin} className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Bonus account @username"
                    className="border hairline-border bg-brand-charcoal px-3 py-2 font-body text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="border hairline-border bg-brand-charcoal px-3 py-2 font-body text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? 'Connecting...' : 'Connect Pool'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleImportCookie} className="mt-4 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    placeholder="ll_session=...; ll_pass=..."
                    className="flex-1 min-w-[220px] border hairline-border bg-brand-charcoal px-3 py-2 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? 'Importing...' : 'Import Cookie'}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Welcome Bonus History & Proof Receipts */}
          <div className="border hairline-border bg-brand-black/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                <span className="font-heading text-xs font-semibold tracking-[0.16em] text-brand-cream uppercase">
                  Welcome Bonus History ({bonusHistoryEntries.length})
                </span>
              </div>
              {bonusHistoryEntries.length > 0 && (
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search @handle or member..."
                    className="w-full border hairline-border bg-brand-charcoal py-1.5 pr-3 pl-8 font-body text-xs text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                  />
                </div>
              )}
            </div>

            {filteredBonusHistory.length === 0 ? (
              <p className="mt-3 font-body text-xs text-brand-muted">
                {bonusHistoryEntries.length === 0
                  ? 'No welcome bonuses dispatched yet. Dispatched bonuses will appear here with downloadable proof receipts.'
                  : 'No matching welcome bonus records found.'}
              </p>
            ) : (
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredBonusHistory.map((entry) => (
                  <div
                    key={`${entry.handle}:${entry.at}`}
                    className="flex flex-wrap items-center justify-between gap-2 border hairline-border bg-brand-charcoal/60 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading tracking-[0.12em] text-brand-gold">
                          @{entry.handle}
                        </span>
                        <span className="text-brand-white font-medium">
                          {formatNaira(entry.amount)}
                        </span>
                        <span className="text-brand-muted">({entry.memberLabel})</span>
                      </div>
                      <p className="mt-0.5 font-body text-[11px] text-brand-muted">
                        Sent {new Date(entry.at).toLocaleString()}
                      </p>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setActiveReceipt({
                          title: 'Welcome Bonus Delivery Receipt',
                          reference: `WB-${entry.handle.slice(0, 6).toUpperCase()}`,
                          recipient: entry.handle,
                          senders: account?.user ? [account.user] : ['VATAR Bonus Pool'],
                          totalAmount: entry.amount,
                          sentAmount: entry.amount,
                          status: 'COMPLETED',
                          timestamp: entry.at,
                          note: `Welcome bonus dispatched on approval for ${entry.memberLabel}.`,
                        })
                      }
                    >
                      <Receipt className="h-3.5 w-3.5 text-brand-gold" />
                      Receipt
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <TransferReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
