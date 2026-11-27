import { supabase } from '@/lib/supabase/client';
import type {
  DataHubSettingsRecord,
  DataOrderRecord,
  DataOrderStatus,
  DataPlanRecord,
} from '@/lib/supabase/database.types';

export const DATA_ORDER_STATUS_LABELS: Record<DataOrderStatus, string> = {
  awaiting_transfer: 'Awaiting Transfer',
  transfer_sent: 'Transfer Sent',
  delivering: 'Delivering Data',
  delivered: 'Delivered',
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export interface AdminDataOrderView extends DataOrderRecord {
  buyer_username: string;
  buyer_full_name: string;
}

export interface VtpassVariationItem {
  variation_code: string;
  name: string;
  variation_amount: string;
}

export function buildDataWhatsAppUrl(
  whatsappNumber: string,
  order: DataOrderRecord,
  receivingHandle: string,
): string {
  const digits = whatsappNumber.replace(/[^0-9]/g, '');
  const lines = [
    'Hello Soft, I just sent LagosLife funds for a VATAR Data Hub order.',
    `Order Ref: ${order.order_code}`,
    `Plan: ${order.plan_label}`,
    `MTN Number: ${order.phone_number}`,
    `Amount Sent: ${order.in_game_label} to @${receivingHandle.replace(/^@/, '')}`,
    `My LagosLife Handle: @${order.lagos_life_username.replace(/^@/, '')}`,
  ];
  const text = encodeURIComponent(lines.join('\n'));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function notifyDataHubUpdated(): void {
  window.dispatchEvent(new Event('vatar:data-hub-updated'));
}

export async function fetchDataHubCatalog(): Promise<{
  settings: DataHubSettingsRecord | null;
  plans: DataPlanRecord[];
  error: string | null;
}> {
  if (!supabase) return { settings: null, plans: [], error: 'Supabase is not configured.' };
  const [settingsRes, plansRes] = await Promise.all([
    supabase.from('data_hub_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('data_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (settingsRes.error) {
    return { settings: null, plans: [], error: settingsRes.error.message };
  }
  if (plansRes.error) {
    return { settings: settingsRes.data, plans: [], error: plansRes.error.message };
  }
  return {
    settings: settingsRes.data,
    plans: plansRes.data ?? [],
    error: null,
  };
}

export async function fetchMyDataOrders(): Promise<{
  orders: DataOrderRecord[];
  error: string | null;
}> {
  if (!supabase) return { orders: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('data_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { orders: [], error: error.message };
  return { orders: data ?? [], error: null };
}

export async function fetchAdminDataOrders(): Promise<{
  orders: AdminDataOrderView[];
  error: string | null;
}> {
  if (!supabase) return { orders: [], error: 'Supabase is not configured.' };
  const [ordersRes, profilesRes] = await Promise.all([
    supabase
      .from('data_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('profiles').select('id, username, full_name'),
  ]);

  if (ordersRes.error) return { orders: [], error: ordersRes.error.message };

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const enriched: AdminDataOrderView[] = (ordersRes.data ?? []).map((o) => {
    const p = profileMap.get(o.buyer_id);
    return {
      ...o,
      buyer_username: p?.username ?? 'member',
      buyer_full_name: p?.full_name ?? 'VATAR Member',
    };
  });

  return { orders: enriched, error: null };
}

export async function createDataOrder(params: {
  planCode: string;
  phoneNumber: string;
  lagosLifeUsername: string;
}): Promise<{ order: DataOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('create_data_order', {
    p_plan_code: params.planCode,
    p_phone_number: params.phoneNumber.trim(),
    p_lagos_life_username: params.lagosLifeUsername.trim(),
  });
  if (error) return { order: null, error: error.message };
  notifyDataHubUpdated();
  return { order: data, error: null };
}

export async function markDataTransferSent(
  orderId: string,
): Promise<{ order: DataOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('mark_data_transfer_sent', {
    p_order_id: orderId,
  });
  if (error) return { order: null, error: error.message };
  notifyDataHubUpdated();
  return { order: data, error: null };
}

export async function cancelDataOrder(
  orderId: string,
): Promise<{ order: DataOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('cancel_data_order', {
    p_order_id: orderId,
  });
  if (error) return { order: null, error: error.message };
  notifyDataHubUpdated();
  return { order: data, error: null };
}

export async function adminUpdateDataOrder(params: {
  orderId: string;
  nextStatus: 'delivering' | 'delivered' | 'failed' | 'rejected';
  vtuReference?: string;
  vtuResponseNote?: string;
}): Promise<{ order: DataOrderRecord | null; error: string | null }> {
  if (!supabase) return { order: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_update_data_order', {
    p_order_id: params.orderId,
    p_new_status: params.nextStatus,
    p_vtu_reference: params.vtuReference?.trim() || null,
    p_vtu_response_note: params.vtuResponseNote?.trim() || null,
  });
  if (error) return { order: null, error: error.message };
  notifyDataHubUpdated();
  return { order: data, error: null };
}

export async function adminUpdateDataHubSettings(params: {
  receivingHandle: string;
  whatsappNumber: string;
  isEnabled: boolean;
}): Promise<{ settings: DataHubSettingsRecord | null; error: string | null }> {
  if (!supabase) return { settings: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_update_data_hub_settings', {
    p_receiving_handle: params.receivingHandle.trim(),
    p_whatsapp_number: params.whatsappNumber.trim(),
    p_is_enabled: params.isEnabled,
  });
  if (error) return { settings: null, error: error.message };
  return { settings: data, error: null };
}

export async function adminUpdateDataPlanVariation(
  planCode: string,
  variationCode: string,
): Promise<{ plan: DataPlanRecord | null; error: string | null }> {
  if (!supabase) return { plan: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_update_data_plan_variation', {
    p_plan_code: planCode,
    p_vtpass_variation_code: variationCode.trim(),
  });
  if (error) return { plan: null, error: error.message };
  return { plan: data, error: null };
}

export async function fetchVtpassWalletBalance(): Promise<{
  balance: number | null;
  env: string | null;
  configured: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return { balance: null, env: null, configured: false, error: 'Supabase not configured.' };
  }
  const { data, error } = await supabase.functions.invoke('deliver-data-order', {
    body: { action: 'balance' },
  });
  if (error) {
    return {
      balance: null,
      env: null,
      configured: false,
      error: error.message || 'VTpass Edge Function not deployed yet.',
    };
  }
  if (data?.configured === false || data?.error) {
    return {
      balance: null,
      env: data?.env ?? null,
      configured: false,
      error: data?.error || 'VTpass keys not configured.',
    };
  }
  return {
    balance: typeof data?.balance === 'number' ? data.balance : 0,
    env: data?.env ?? 'sandbox',
    configured: true,
    error: null,
  };
}

export async function triggerAutoDataDelivery(orderId: string): Promise<{
  ok: boolean;
  order: DataOrderRecord | null;
  message: string | null;
  error: string | null;
}> {
  if (!supabase) {
    return { ok: false, order: null, message: null, error: 'Supabase not configured.' };
  }
  const { data, error } = await supabase.functions.invoke('deliver-data-order', {
    body: { action: 'deliver', orderId },
  });
  if (error) {
    return {
      ok: false,
      order: null,
      message: null,
      error: error.message || 'Could not reach auto-delivery function.',
    };
  }
  if (!data?.ok) {
    return {
      ok: false,
      order: data?.order ?? null,
      message: null,
      error: data?.error || 'VTpass delivery failed.',
    };
  }
  notifyDataHubUpdated();
  return {
    ok: true,
    order: data?.order ?? null,
    message: data?.message ?? 'Data delivered successfully!',
    error: null,
  };
}

export async function fetchVtpassVariations(): Promise<{
  variations: VtpassVariationItem[];
  error: string | null;
}> {
  if (!supabase) return { variations: [], error: 'Supabase not configured.' };
  const { data, error } = await supabase.functions.invoke('deliver-data-order', {
    body: { action: 'variations' },
  });
  if (error) return { variations: [], error: error.message };
  if (data?.error) return { variations: [], error: data.error };
  return { variations: Array.isArray(data?.variations) ? data.variations : [], error: null };
}
