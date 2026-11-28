import {
  fetchTreasuryStatus,
  logoutTreasury,
  saveJobDescription,
  sendSingleTransfer,
  type TreasuryAccount,
  type TreasuryJob,
} from '@/features/treasury/services/treasuryService';

export const ADMIN_SENDERS_STORAGE_KEY = 'vatar_admin_sender_accounts_v1';
export const ADMIN_DISPATCH_MODE_KEY = 'vatar_admin_sender_dispatch_mode_v1';

export type SenderDispatchMode = 'sequential' | 'parallel';

export interface StoredSenderAccount {
  id: string;
  token: string;
  user: string;
  name: string;
  enabled: boolean;
  defaultPin?: string;
}

export interface LiveSenderAccount extends StoredSenderAccount {
  money: number;
  jobs: TreasuryJob[];
  online: boolean;
}

export interface PipelineDispatchItem {
  senderId: string;
  senderUser: string;
  token: string;
  amount: number;
  ok: boolean;
  job?: TreasuryJob;
  error?: string;
}

export function loadDispatchMode(): SenderDispatchMode {
  try {
    const raw = localStorage.getItem(ADMIN_DISPATCH_MODE_KEY);
    return raw === 'parallel' ? 'parallel' : 'sequential';
  } catch {
    return 'sequential';
  }
}

export function saveDispatchMode(mode: SenderDispatchMode): void {
  try {
    localStorage.setItem(ADMIN_DISPATCH_MODE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function loadStoredSenders(): StoredSenderAccount[] {
  try {
    const raw = localStorage.getItem(ADMIN_SENDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (item): item is StoredSenderAccount =>
        Boolean(item && typeof item.token === 'string' && typeof item.user === 'string'),
    );
    // Deduplicate strictly by lowercase username & id so one account is never listed twice
    const seenUsers = new Set<string>();
    const seenIds = new Set<string>();
    const deduped: StoredSenderAccount[] = [];
    for (const item of valid) {
      const uKey = item.user.trim().replace(/^@/, '').toLowerCase();
      const idKey = (item.id || uKey).toLowerCase();
      if (seenUsers.has(uKey) || seenIds.has(idKey)) continue;
      seenUsers.add(uKey);
      seenIds.add(idKey);
      deduped.push({
        ...item,
        user: item.user.trim().replace(/^@/, ''),
      });
    }
    return deduped;
  } catch {
    return [];
  }
}

export function saveStoredSenders(senders: StoredSenderAccount[]): void {
  localStorage.setItem(ADMIN_SENDERS_STORAGE_KEY, JSON.stringify(senders));
}

export function upsertStoredSender(
  token: string,
  account: TreasuryAccount,
  defaultPin?: string,
): StoredSenderAccount[] {
  const existing = loadStoredSenders();
  const cleanUser = account.user.trim().replace(/^@/, '');
  const key = cleanUser.toLowerCase();
  const prevMatch = existing.find(
    (s) => s.user.toLowerCase() === key || (account.uid && s.id === account.uid),
  );
  const nextItem: StoredSenderAccount = {
    id: account.uid || key,
    token,
    user: cleanUser,
    name: account.name || cleanUser,
    enabled: prevMatch ? prevMatch.enabled : true,
    defaultPin: defaultPin?.trim() || prevMatch?.defaultPin || undefined,
  };

  const filtered = existing.filter(
    (s) => s.user.toLowerCase() !== key && (!account.uid || s.id !== account.uid),
  );
  const updated = [...filtered, nextItem];
  saveStoredSenders(updated);
  return updated;
}

export function updateStoredSenderPin(
  senderUser: string,
  pin: string,
): StoredSenderAccount[] {
  const cleanPin = pin.trim();
  const updated = loadStoredSenders().map((s) =>
    s.user.toLowerCase() === senderUser.toLowerCase()
      ? { ...s, defaultPin: cleanPin || undefined }
      : s,
  );
  saveStoredSenders(updated);
  return updated;
}

export async function removeStoredSender(senderUser: string): Promise<StoredSenderAccount[]> {
  const existing = loadStoredSenders();
  const target = existing.find((s) => s.user.toLowerCase() === senderUser.toLowerCase());
  if (target) {
    await logoutTreasury(target.token).catch(() => {});
  }
  const updated = existing.filter((s) => s.user.toLowerCase() !== senderUser.toLowerCase());
  saveStoredSenders(updated);
  return updated;
}

export async function refreshAllLiveSenders(): Promise<LiveSenderAccount[]> {
  const stored = loadStoredSenders();
  if (stored.length === 0) return [];

  const results = await Promise.all(
    stored.map(async (sender): Promise<LiveSenderAccount> => {
      try {
        const res = await fetchTreasuryStatus(sender.token);
        if (res.ok && res.data.account) {
          return {
            ...sender,
            id: res.data.account.uid || sender.id,
            user: (res.data.account.user || sender.user).replace(/^@/, ''),
            name: res.data.account.name || sender.name,
            money: Number(res.data.account.money || 0),
            jobs: res.data.jobs || [],
            online: true,
          };
        }
      } catch {
        // Network error or expired session
      }
      return {
        ...sender,
        money: 0,
        jobs: [],
        online: false,
      };
    }),
  );

  // Deduplicate live accounts by uid/user in case two cookies belonged to the same player
  const seen = new Set<string>();
  return results.filter((s) => {
    const k = (s.id || s.user).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface PipelineSplitOptions {
  mode?: SenderDispatchMode;
  preferredSenderUser?: string;
}

/**
 * Plans how `totalAmount` will be sent:
 * - `'sequential'` (DEFAULT — safest): Uses 100% from ONE primary/preferred account first,
 *   and only spills remaining overflow to a second account if 1 account lacks enough balance.
 *   Prevents 50/50 split issues where a 2nd account pauses for PIN/2FA/Friends-only!
 * - `'parallel'`: Evenly distributes across all enabled online accounts for faster multi-T sends.
 */
export function planPipelineSplit(
  senders: LiveSenderAccount[],
  totalAmount: number,
  options?: PipelineSplitOptions,
): { allocations: { sender: LiveSenderAccount; amount: number }[]; shortfall: number } {
  const mode = options?.mode ?? loadDispatchMode();
  const preferredKey = options?.preferredSenderUser?.trim().replace(/^@/, '').toLowerCase();

  // If a specific single sender was chosen (not 'auto' / 'split'), prioritize or restrict
  const ready = senders
    .filter((s) => s.enabled && s.online && s.money > 0)
    .sort((a, b) => {
      if (preferredKey) {
        if (a.user.toLowerCase() === preferredKey) return -1;
        if (b.user.toLowerCase() === preferredKey) return 1;
      }
      // Prefer accounts that already have a saved PIN first, then highest balance
      const aHasPin = a.defaultPin ? 1 : 0;
      const bHasPin = b.defaultPin ? 1 : 0;
      if (aHasPin !== bHasPin) return bHasPin - aHasPin;
      return b.money - a.money;
    });

  if (ready.length === 0) {
    return { allocations: [], shortfall: totalAmount };
  }

  // SEQUENTIAL MODE (Default): Send 100% from 1 account whenever possible!
  if (mode === 'sequential' || preferredKey) {
    let remainingToAssign = totalAmount;
    const allocations: { sender: LiveSenderAccount; amount: number }[] = [];
    for (const sender of ready) {
      if (remainingToAssign <= 0) break;
      const take = Math.min(sender.money, remainingToAssign);
      if (take > 0) {
        allocations.push({ sender, amount: take });
        remainingToAssign -= take;
      }
    }
    return {
      allocations: remainingToAssign > 0 ? [] : allocations,
      shortfall: remainingToAssign,
    };
  }

  // PARALLEL MODE: Even split across all active accounts
  const remainingBySender = new Map<string, number>(ready.map((s) => [s.user, s.money]));
  const assignedBySender = new Map<string, number>(ready.map((s) => [s.user, 0]));
  let remainingToAssign = totalAmount;

  while (remainingToAssign > 0) {
    const eligible = ready.filter((s) => (remainingBySender.get(s.user) ?? 0) > 0);
    if (eligible.length === 0) break;

    const equalShare = Math.floor(remainingToAssign / eligible.length);
    if (equalShare <= 0) {
      const top = eligible[0];
      const avail = remainingBySender.get(top.user) ?? 0;
      const take = Math.min(avail, remainingToAssign);
      assignedBySender.set(top.user, (assignedBySender.get(top.user) ?? 0) + take);
      remainingBySender.set(top.user, avail - take);
      remainingToAssign -= take;
      break;
    }

    let progressed = 0;
    for (const s of eligible) {
      const avail = remainingBySender.get(s.user) ?? 0;
      const take = Math.min(avail, equalShare, remainingToAssign);
      if (take > 0) {
        assignedBySender.set(s.user, (assignedBySender.get(s.user) ?? 0) + take);
        remainingBySender.set(s.user, avail - take);
        remainingToAssign -= take;
        progressed += take;
      }
    }
    if (progressed === 0) break;
  }

  const allocations = ready
    .map((sender) => ({
      sender,
      amount: assignedBySender.get(sender.user) ?? 0,
    }))
    .filter((a) => a.amount > 0);

  return {
    allocations: remainingToAssign > 0 ? [] : allocations,
    shortfall: remainingToAssign,
  };
}

export async function dispatchOrderAcrossSenders(
  senders: LiveSenderAccount[],
  recipientUsername: string,
  totalAmount: number,
  overridePin?: string,
  transferNote?: string,
  splitOptions?: PipelineSplitOptions,
): Promise<{
  results: PipelineDispatchItem[];
  shortfall: number;
}> {
  const { allocations, shortfall } = planPipelineSplit(
    senders,
    totalAmount,
    splitOptions,
  );
  if (allocations.length === 0 || shortfall > 0) {
    return { results: [], shortfall };
  }

  const cleanNote = transferNote?.trim() || undefined;

  const results = await Promise.all(
    allocations.map(async ({ sender, amount }): Promise<PipelineDispatchItem> => {
      try {
        const pin = overridePin?.trim() || sender.defaultPin?.trim() || undefined;
        const res = await sendSingleTransfer(sender.token, {
          to: recipientUsername.trim().replace(/^@/, ''),
          amount,
          ...(cleanNote ? { note: cleanNote } : {}),
          ...(pin ? { pin } : {}),
        });
        if (res.ok && res.data.success !== false) {
          if (cleanNote && res.data.job?.id) {
            saveJobDescription(res.data.job.id, cleanNote);
          }
          return {
            senderId: sender.id,
            senderUser: sender.user,
            token: sender.token,
            amount,
            ok: true,
            job: res.data.job,
          };
        }
        return {
          senderId: sender.id,
          senderUser: sender.user,
          token: sender.token,
          amount,
          ok: false,
          error: res.data.error || `Transfer failed (HTTP ${res.status})`,
        };
      } catch {
        return {
          senderId: sender.id,
          senderUser: sender.user,
          token: sender.token,
          amount,
          ok: false,
          error: 'Could not reach LagosLife transfer server.',
        };
      }
    }),
  );

  return { results, shortfall: 0 };
}
