import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Gift,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
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
  verifyLagosLife2FA,
  type TreasuryAccount,
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
  const [bonusPin, setBonusPin] = useState<string>(
    () => sessionStorage.getItem('vatar_admin_bonus_pin') || '',
  );
  const [expanded, setExpanded] = useState(false);

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
        } else if (res.status === 401) {
          localStorage.removeItem(BONUS_TOKEN_KEY);
          setToken(null);
          setAccount(null);
        }
      } catch {
        // Ignore transient errors
      }
    },
    [token],
  );

  useEffect(() => {
    setCfg(loadWelcomeBonusConfig());
    if (token) void syncAccount(token);
  }, [token, syncAccount, refreshSignal]);

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
      if (res.ok && res.data.twoFactor && res.data.challenge) {
        setTwoFactorState({
          challenge: res.data.challenge,
          method: res.data.method,
          to: res.data.to,
        });
        setTwoFactorCode('');
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
                <form onSubmit={handleVerify2FA} className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="6-digit 2FA code"
                    className="flex-1 min-w-[160px] border hairline-border bg-brand-charcoal px-3 py-2 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
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
                    Verify 2FA
                  </Button>
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
        </div>
      )}
    </div>
  );
}
