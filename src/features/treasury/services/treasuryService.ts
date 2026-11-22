export const MONEYSENDER_API_BASE = (
  import.meta.env.VITE_MONEYSENDER_API_URL || 'https://moneysender.onrender.com'
).replace(/\/+$/, '');

export const TREASURY_TOKEN_STORAGE_KEY = 'vatar_treasury_client_token';

export interface TreasuryAccount {
  uid?: string;
  user: string;
  name: string;
  money: number;
}

export interface TreasuryJob {
  id: string;
  type: 'single' | 'batch' | 'BATCH' | 'spray' | 'SPRAY';
  sender?: string;
  target?: string;
  targetLabel?: string;
  total: number;
  remaining: number;
  chunkSize?: number;
  totalTxs?: number;
  txCount?: number;
  status: 'RUNNING' | 'SCHEDULED' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | string;
  scheduledTimestamp?: number | null;
  needsTwoStep?: boolean;
  twoStepType?: 'pin' | '2fa' | string;
  logs?: string[];
}

export interface TreasuryLoginResult {
  token?: string;
  account?: TreasuryAccount;
  twoFactor?: boolean;
  challenge?: string;
  method?: string;
  to?: string;
  error?: string;
}

export function parseNairaAmount(raw: string | number): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.floor(raw) : 0;
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[₦,\s]/g, '');
  if (!cleaned) return 0;
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([kmbtq]?)$/);
  if (!match) return 0;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const mult: Record<string, number> = {
    '': 1,
    k: 1e3,
    m: 1e6,
    b: 1e9,
    t: 1e12,
    q: 1e15,
  };
  return Math.floor(num * (mult[match[2]] ?? 1));
}

export function formatNaira(val: number | string | null | undefined): string {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return '₦0';
  if (n >= 1e15) return `₦${(n / 1e15).toFixed(2).replace(/\.00$/, '')}Q`;
  if (n >= 1e12) return `₦${(n / 1e12).toFixed(2).replace(/\.00$/, '')}T`;
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2).replace(/\.00$/, '')}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2).replace(/\.00$/, '')}M`;
  return `₦${Math.floor(n).toLocaleString()}`;
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['x-client-token'] = token;
  }
  const res = await fetch(`${MONEYSENDER_API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export function loginLagosLife(username: string, password: string) {
  return requestJson<TreasuryLoginResult>('/api/client/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function verifyLagosLife2FA(challenge: string, code: string) {
  return requestJson<TreasuryLoginResult>('/api/client/2fa', {
    method: 'POST',
    body: JSON.stringify({ challenge, code }),
  });
}

export function resendLagosLife2FA(challenge: string) {
  return requestJson<{ ok?: boolean }>('/api/client/2fa/resend', {
    method: 'POST',
    body: JSON.stringify({ challenge }),
  });
}

export function importLagosLifeCookie(cookie: string) {
  return requestJson<TreasuryLoginResult>('/api/client/import-cookie', {
    method: 'POST',
    body: JSON.stringify({ cookie }),
  });
}

export function fetchTreasuryStatus(token: string) {
  return requestJson<{ account: TreasuryAccount; jobs: TreasuryJob[] }>(
    '/api/client/status',
    { method: 'GET' },
    token,
  );
}

export function logoutTreasury(token: string) {
  return requestJson<{ ok?: boolean }>('/api/client/logout', { method: 'POST' }, token);
}

export function sendSingleTransfer(
  token: string,
  payload: { to: string; amount: number; scheduledAt?: string; pin?: string },
) {
  return requestJson<{ success?: boolean; job?: TreasuryJob }>(
    '/api/client/send',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function sendBatchTransfer(
  token: string,
  payload: {
    recipients: string[];
    amountPerUser: number;
    scheduledAt?: string;
    pin?: string;
  },
) {
  return requestJson<{ success?: boolean; job?: TreasuryJob }>(
    '/api/client/batch',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function startScheduledTransferNow(token: string, jobId: string) {
  return requestJson<{ success?: boolean }>(
    '/api/client/start-now',
    {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    },
    token,
  );
}

export function submitTransferTwoStep(token: string, jobId: string, code: string) {
  return requestJson<{ success?: boolean }>(
    '/api/client/twostep',
    {
      method: 'POST',
      body: JSON.stringify({ jobId, pin: code, twoStepCode: code }),
    },
    token,
  );
}

export function stopTransferJob(token: string, jobId: string) {
  return requestJson<{ success?: boolean }>(
    '/api/client/stop',
    {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    },
    token,
  );
}
