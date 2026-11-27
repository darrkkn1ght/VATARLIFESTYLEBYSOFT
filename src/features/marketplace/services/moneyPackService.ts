import { supabase } from '@/lib/supabase/client';
import type {
  MoneyPackCode,
  MoneyPackOrderRecord,
  MoneyPackOrderStatus,
  MoneyPackSettingsRecord,
  VipMembershipRecord,
  VipTierCode,
  VipUpgradeRequestRecord,
} from '@/lib/supabase/database.types';

export const LIVE_RATE_NGN_PER_TRILLION = 1500;
export const HALF_TRILLION_RATE_NGN = 800; // 500B (0.5T) minimum rate
export const MIN_ORDER_TRILLIONS = 0.5;
export const MAX_ORDER_TRILLIONS = 1000;
export const TRILLION_PRESETS = [0.5, 1, 5, 10, 50, 100] as const;

export function normalizeTrillions(raw: number | string): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < MIN_ORDER_TRILLIONS) return MIN_ORDER_TRILLIONS;
  const clamped = Math.min(MAX_ORDER_TRILLIONS, num);
  return Math.round(clamped * 2) / 2;
}

export function formatTrillionLabel(trillions: number): string {
  const normalized = normalizeTrillions(trillions);
  if (normalized === 0.5) return '500B';
  return `${normalized}T`;
}

export interface VipTierConfig {
  code: VipTierCode;
  name: string;
  monthlyPriceNgn: number;
  discountPercent: number;
  accentClass: string;
}

export const VIP_TIERS: readonly VipTierConfig[] = [
  {
    code: 'gold',
    name: 'GOLD',
    monthlyPriceNgn: 30_000,
    discountPercent: 5,
    accentClass: 'border-amber-500/45 bg-amber-950/20 text-amber-300',
  },
  {
    code: 'platinum',
    name: 'PLATINUM',
    monthlyPriceNgn: 50_000,
    discountPercent: 8,
    accentClass: 'border-zinc-400/45 bg-zinc-900/50 text-zinc-200',
  },
  {
    code: 'diamond',
    name: 'DIAMOND',
    monthlyPriceNgn: 100_000,
    discountPercent: 12,
    accentClass: 'border-sky-400/45 bg-sky-950/25 text-sky-300',
  },
  {
    code: 'elite',
    name: 'ELITE',
    monthlyPriceNgn: 200_000,
    discountPercent: 20,
    accentClass: 'border-brand-gold bg-brand-gold/15 text-brand-gold',
  },
] as const;

export function calculateTrillionQuoteNgn(
  trillions: number,
  discountPercent = 0,
): { basePrice: number; finalPrice: number; savings: number } {
  const safeT = normalizeTrillions(trillions);
  const wholeT = Math.floor(safeT);
  const hasHalf = safeT - wholeT >= 0.5;
  const basePrice = wholeT * LIVE_RATE_NGN_PER_TRILLION + (hasHalf ? HALF_TRILLION_RATE_NGN : 0);
  const finalPrice = Math.round((basePrice * (100 - discountPercent)) / 100);
  return { basePrice, finalPrice, savings: basePrice - finalPrice };
}

export interface AdminVipRequestView extends VipUpgradeRequestRecord {
  member_username: string;
  member_full_name: string;
  member_lagos_life: string;
}

export function buildVipWhatsAppUrl(
  whatsappNumber: string,
  req: VipUpgradeRequestRecord,
  memberUsername?: string | null,
): string {
  const digits = whatsappNumber.replace(/[^0-9]/g, '');
  const lines = [
    `Hello Soft, I just paid for VATAR ${req.tier.toUpperCase()} VIP Membership (${req.discount_percent}% off).`,
    `Request Ref: ${req.request_code}`,
    `Amount Paid: ₦${req.price_ngn.toLocaleString()}/mo`,
    memberUsername ? `VATAR Username: @${memberUsername}` : null,
    'Here is my payment receipt:',
  ].filter(Boolean);
  const text = encodeURIComponent(lines.join('\n'));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export interface MoneyPackTier {
  code: MoneyPackCode;
  label: string;
  inGameAmount: number;
  priceNgn: number;
  popular?: boolean;
}

export const OFFICIAL_MONEY_PACKS: readonly MoneyPackTier[] = [
  { code: '100B', label: '100B', inGameAmount: 100_000_000_000, priceNgn: 400 },
  { code: '200B', label: '200B', inGameAmount: 200_000_000_000, priceNgn: 700 },
  { code: '300B', label: '300B', inGameAmount: 300_000_000_000, priceNgn: 1000 },
  { code: '400B', label: '400B', inGameAmount: 400_000_000_000, priceNgn: 1300 },
  { code: '500B', label: '500B', inGameAmount: 500_000_000_000, priceNgn: 1500, popular: true },
  { code: '600B', label: '600B', inGameAmount: 600_000_000_000, priceNgn: 1800 },
  { code: '700B', label: '700B', inGameAmount: 700_000_000_000, priceNgn: 2000 },
  { code: '800B', label: '800B', inGameAmount: 800_000_000_000, priceNgn: 2400 },
  { code: '900B', label: '900B', inGameAmount: 900_000_000_000, priceNgn: 2600 },
  { code: '1T', label: '1T', inGameAmount: 1_000_000_000_000, priceNgn: 2900, popular: true },
] as const;

export const MONEY_PACK_STATUS_LABELS: Record<MoneyPackOrderStatus, string> = {
  awaiting_payment: 'Awaiting Payment',
  payment_submitted: 'Receipt Sent',
  sending: 'Sending Funds',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export interface AdminMoneyPackOrderView extends MoneyPackOrderRecord {
  buyer_username: string;
  buyer_full_name: string;
}

export function buildWhatsAppReceiptUrl(
  whatsappNumber: string,
  order: MoneyPackOrderRecord,
  memberUsername?: string | null,
): string {
  const digits = whatsappNumber.replace(/[^0-9]/g, '');
  const lines = [
    'Hello Soft, I just paid for an Official VATAR Money Pack.',
    `Order Ref: ${order.order_code}`,
    `Pack: ${order.pack_label}`,
    `Amount Paid: ₦${order.total_price_ngn.toLocaleString()}`,
    `LagosLife Username: ${order.lagos_life_username}`,
    memberUsername ? `VATAR Username: @${memberUsername}` : null,
    'Here is my payment receipt:',
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join('\n'));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function notifyMoneyPacksUpdated(): void {
  window.dispatchEvent(new Event('vatar:money-packs-updated'));
}

function isTransientNetworkError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  );
}

function formatServiceError(message: string): string {
  if (isTransientNetworkError(message)) {
    return 'Network connection was interrupted. Please tap Sync or try again.';
  }
  return message;
}

async function retryReadOnce<T extends { error: string | null }>(
  operation: () => Promise<T>,
): Promise<T> {
  const first = await operation();
  if (!first.error || !isTransientNetworkError(first.error)) {
    return first;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  const second = await operation();
  if (second.error) {
    return { ...second, error: formatServiceError(second.error) };
  }
  return second;
}

export async function fetchMoneyPackSettings(): Promise<{
  settings: MoneyPackSettingsRecord | null;
  error: string | null;
}> {
  if (!supabase) return { settings: null, error: 'Supabase is not configured.' };
  const client = supabase;
  return retryReadOnce(async () => {
    const { data, error } = await client
      .from('money_pack_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      return { settings: null, error: error.message };
    }
    return { settings: data, error: null };
  });
}

export async function fetchMyMoneyPackOrders(): Promise<{
  orders: MoneyPackOrderRecord[];
  error: string | null;
}> {
  if (!supabase) return { orders: [], error: 'Supabase is not configured.' };
  const client = supabase;
  return retryReadOnce(async () => {
    const { data, error } = await client
      .from('money_pack_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { orders: [], error: error.message };
    }
    return { orders: data ?? [], error: null };
  });
}

export async function fetchAdminMoneyPackOrders(): Promise<{
  orders: AdminMoneyPackOrderView[];
  error: string | null;
}> {
  if (!supabase) return { orders: [], error: 'Supabase is not configured.' };
  const client = supabase;
  return retryReadOnce(async () => {
    const [ordersRes, profilesRes] = await Promise.all([
      client
        .from('money_pack_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      client.from('profiles').select('id, username, full_name'),
    ]);

    if (ordersRes.error) {
      return { orders: [], error: ordersRes.error.message };
    }

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p]),
    );

    const enriched: AdminMoneyPackOrderView[] = (ordersRes.data ?? []).map((order) => {
      const profile = profileMap.get(order.buyer_id);
      return {
        ...order,
        buyer_username: profile?.username ?? 'member',
        buyer_full_name: profile?.full_name ?? 'VATAR Member',
      };
    });

    return { orders: enriched, error: null };
  });
}

export async function createMoneyPackOrder(params: {
  packCode: MoneyPackCode;
  quantity: number;
  lagosLifeUsername: string;
  buyerNote?: string;
}): Promise<{ order: MoneyPackOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('create_money_pack_order', {
    p_pack_code: params.packCode,
    p_quantity: params.quantity,
    p_lagos_life_username: params.lagosLifeUsername.trim(),
    p_buyer_note: params.buyerNote?.trim() || null,
  });

  if (error) {
    return { order: null, error: error.message };
  }
  notifyMoneyPacksUpdated();
  return { order: data, error: null };
}

export async function markMoneyPackPaymentSubmitted(
  orderId: string,
): Promise<{ order: MoneyPackOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('mark_money_pack_payment_submitted', {
    p_order_id: orderId,
  });

  if (error) {
    return { order: null, error: error.message };
  }
  notifyMoneyPacksUpdated();
  return { order: data, error: null };
}

export async function cancelMoneyPackOrder(
  orderId: string,
): Promise<{ order: MoneyPackOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('cancel_money_pack_order', {
    p_order_id: orderId,
  });

  if (error) {
    return { order: null, error: error.message };
  }
  notifyMoneyPacksUpdated();
  return { order: data, error: null };
}

export async function adminUpdateMoneyPackOrder(params: {
  orderId: string;
  nextStatus: 'sending' | 'completed' | 'rejected';
  adminNote?: string;
}): Promise<{ order: MoneyPackOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_update_money_pack_order', {
    p_order_id: params.orderId,
    p_new_status: params.nextStatus,
    p_admin_note: params.adminNote?.trim() || null,
  });

  if (error) {
    return { order: null, error: error.message };
  }
  notifyMoneyPacksUpdated();
  return { order: data, error: null };
}

export async function adminUpdateMoneyPackSettings(params: {
  bankName: string;
  accountNumber: string;
  accountName: string;
  whatsappNumber: string;
  telegramUrl: string;
  isEnabled: boolean;
}): Promise<{ settings: MoneyPackSettingsRecord | null; error: string | null }> {
  if (!supabase) return { settings: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_update_money_pack_settings', {
    p_bank_name: params.bankName.trim(),
    p_account_number: params.accountNumber.trim(),
    p_account_name: params.accountName.trim(),
    p_whatsapp_number: params.whatsappNumber.trim(),
    p_telegram_url: params.telegramUrl.trim() || 'https://t.me/VatarLifeStyleBySoft',
    p_is_enabled: params.isEnabled,
  });

  if (error) {
    return { settings: null, error: formatServiceError(error.message) };
  }
  return { settings: data, error: null };
}

export async function fetchPendingMoneyPackCount(): Promise<{
  count: number;
  error: string | null;
}> {
  if (!supabase) return { count: 0, error: null };
  const client = supabase;
  return retryReadOnce(async () => {
    const { data, error } = await client.rpc('get_pending_money_pack_count');
    if (error) {
      return { count: 0, error: error.message };
    }
    return { count: typeof data === 'number' ? data : 0, error: null };
  });
}

export async function createTrillionQuoteOrder(params: {
  trillions: number;
  lagosLifeUsername: string;
  buyerNote?: string;
}): Promise<{ order: MoneyPackOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('create_trillion_quote_order', {
    p_trillions: normalizeTrillions(params.trillions),
    p_lagos_life_username: params.lagosLifeUsername.trim(),
    p_buyer_note: params.buyerNote?.trim() || null,
  });
  if (error) {
    return { order: null, error: formatServiceError(error.message) };
  }
  notifyMoneyPacksUpdated();
  return { order: data, error: null };
}

export async function fetchMyVipMembership(): Promise<{
  vip: VipMembershipRecord | null;
  error: string | null;
}> {
  if (!supabase) return { vip: null, error: null };
  const client = supabase;
  return retryReadOnce(async () => {
    const { data, error } = await client
      .from('vip_memberships')
      .select('*')
      .maybeSingle();
    if (error) return { vip: null, error: error.message };
    if (data && new Date(data.expires_at).getTime() <= Date.now()) {
      return { vip: null, error: null };
    }
    return { vip: data, error: null };
  });
}

export async function requestVipUpgrade(
  tier: VipTierCode,
): Promise<{ request: VipUpgradeRequestRecord | null; error: string | null }> {
  if (!supabase) return { request: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('request_vip_upgrade', {
    p_tier: tier,
  });
  if (error) return { request: null, error: formatServiceError(error.message) };
  return { request: data, error: null };
}

export async function markVipPaymentSubmitted(
  requestId: string,
): Promise<{ request: VipUpgradeRequestRecord | null; error: string | null }> {
  if (!supabase) return { request: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('mark_vip_payment_submitted', {
    p_request_id: requestId,
  });
  if (error) return { request: null, error: formatServiceError(error.message) };
  return { request: data, error: null };
}

export async function fetchAdminVipRequests(): Promise<{
  requests: AdminVipRequestView[];
  error: string | null;
}> {
  if (!supabase) return { requests: [], error: 'Supabase is not configured.' };
  const [reqRes, profRes] = await Promise.all([
    supabase
      .from('vip_upgrade_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('id, username, full_name, lagos_life_username'),
  ]);
  if (reqRes.error) return { requests: [], error: reqRes.error.message };
  const map = new Map((profRes.data ?? []).map((p) => [p.id, p]));
  const enriched: AdminVipRequestView[] = (reqRes.data ?? []).map((r) => {
    const p = map.get(r.user_id);
    return {
      ...r,
      member_username: p?.username ?? 'member',
      member_full_name: p?.full_name ?? 'VATAR Member',
      member_lagos_life: p?.lagos_life_username ?? '',
    };
  });
  return { requests: enriched, error: null };
}

export async function adminReviewVipUpgrade(params: {
  requestId: string;
  decision: 'approved' | 'rejected';
  adminNote?: string;
}): Promise<{ request: VipUpgradeRequestRecord | null; error: string | null }> {
  if (!supabase) return { request: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_review_vip_upgrade', {
    p_request_id: params.requestId,
    p_decision: params.decision,
    p_admin_note: params.adminNote?.trim() || null,
  });
  if (error) return { request: null, error: formatServiceError(error.message) };
  return { request: data, error: null };
}
