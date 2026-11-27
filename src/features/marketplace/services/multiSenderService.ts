import {
  fetchTreasuryStatus,
  logoutTreasury,
  saveJobDescription,
  sendSingleTransfer,
  type TreasuryAccount,
  type TreasuryJob,
} from '@/features/treasury/services/treasuryService';

export const ADMIN_SENDERS_STORAGE_KEY = 'vatar_admin_sender_accounts_v1';

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

export function loadStoredSenders(): StoredSenderAccount[] {
  try {
    const raw = localStorage.getItem(ADMIN_SENDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredSenderAccount =>
        Boolean(item && typeof item.token === 'string' && typeof item.user === 'string'),
    );
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
  const key = account.user.toLowerCase();
  const nextItem: StoredSenderAccount = {
    id: account.uid || key,
    token,
    user: account.user,
    name: account.name || account.user,
    enabled: true,
    defaultPin: defaultPin?.trim() || undefined,
  };

  const filtered = existing.filter((s) => s.user.toLowerCase() !== key);
  const updated = [...filtered, nextItem];
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
            user: res.data.account.user || sender.user,
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

  return results;
}

/**
 * Splits `totalAmount` across all enabled online sender accounts that have available
 * balance, prioritizing even parallel distribution so large transfers finish faster.
 */
export function planPipelineSplit(
  senders: LiveSenderAccount[],
  totalAmount: number,
): { allocations: { sender: LiveSenderAccount; amount: number }[]; shortfall: number } {
  const ready = senders
    .filter((s) => s.enabled && s.online && s.money > 0)
    .sort((a, b) => b.money - a.money);

  if (ready.length === 0) {
    return { allocations: [], shortfall: totalAmount };
  }

  // Round-robin balanced allocation in 10B increments where possible, then exact remainder
  const remainingBySender = new Map<string, number>(ready.map((s) => [s.user, s.money]));
  const assignedBySender = new Map<string, number>(ready.map((s) => [s.user, 0]));
  let remainingToAssign = totalAmount;

  // First pass: equal target share per sender, capped by their balance
  while (remainingToAssign > 0) {
    const eligible = ready.filter((s) => (remainingBySender.get(s.user) ?? 0) > 0);
    if (eligible.length === 0) break;

    const equalShare = Math.floor(remainingToAssign / eligible.length);
    if (equalShare <= 0) {
      // Assign leftover exact amount to the sender with highest remaining balance
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

  return { allocations, shortfall: remainingToAssign };
}

export async function dispatchOrderAcrossSenders(
  senders: LiveSenderAccount[],
  recipientUsername: string,
  totalAmount: number,
  overridePin?: string,
  transferNote?: string,
): Promise<{
  results: PipelineDispatchItem[];
  shortfall: number;
}> {
  const { allocations, shortfall } = planPipelineSplit(senders, totalAmount);
  if (allocations.length === 0 || shortfall > 0) {
    return { results: [], shortfall };
  }

  const cleanNote = transferNote?.trim() || undefined;

  const results = await Promise.all(
    allocations.map(async ({ sender, amount }): Promise<PipelineDispatchItem> => {
      try {
        const pin = overridePin?.trim() || sender.defaultPin?.trim() || undefined;
        const res = await sendSingleTransfer(sender.token, {
          to: recipientUsername.trim(),
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
