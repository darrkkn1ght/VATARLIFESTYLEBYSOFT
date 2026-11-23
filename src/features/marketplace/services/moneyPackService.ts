import { supabase } from '@/lib/supabase/client';
import type {
  MoneyPackCode,
  MoneyPackOrderRecord,
  MoneyPackOrderStatus,
  MoneyPackSettingsRecord,
} from '@/lib/supabase/database.types';

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

export async function fetchMoneyPackSettings(): Promise<{
  settings: MoneyPackSettingsRecord | null;
  error: string | null;
}> {
  if (!supabase) return { settings: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('money_pack_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    return { settings: null, error: error.message };
  }
  return { settings: data, error: null };
}

export async function fetchMyMoneyPackOrders(): Promise<{
  orders: MoneyPackOrderRecord[];
  error: string | null;
}> {
  if (!supabase) return { orders: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('money_pack_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { orders: [], error: error.message };
  }
  return { orders: data ?? [], error: null };
}

export async function fetchAdminMoneyPackOrders(): Promise<{
  orders: AdminMoneyPackOrderView[];
  error: string | null;
}> {
  if (!supabase) return { orders: [], error: 'Supabase is not configured.' };
  const [ordersRes, profilesRes] = await Promise.all([
    supabase
      .from('money_pack_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('profiles').select('id, username, full_name'),
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
    return { settings: null, error: error.message };
  }
  return { settings: data, error: null };
}

export async function fetchPendingMoneyPackCount(): Promise<{
  count: number;
  error: string | null;
}> {
  if (!supabase) return { count: 0, error: null };
  const { data, error } = await supabase.rpc('get_pending_money_pack_count');
  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: typeof data === 'number' ? data : 0, error: null };
}
