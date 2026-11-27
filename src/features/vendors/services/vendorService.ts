import { supabase } from '@/lib/supabase/client';
import type {
  OrderChatMessageRecord,
  OrderChatMessageRow,
  VendorStoreDirectoryRow,
  VendorStoreRecord,
  VendorStoreStatus,
} from '@/lib/supabase/database.types';

export async function fetchVendorStores(): Promise<{
  stores: VendorStoreDirectoryRow[];
  error: string | null;
}> {
  if (!supabase) return { stores: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('get_vendor_stores');
  if (error) return { stores: [], error: error.message };
  return { stores: Array.isArray(data) ? data : [], error: null };
}

export async function upsertMyVendorStore(params: {
  storeName: string;
  slug?: string;
  tagline: string;
  description: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}): Promise<{ store: VendorStoreRecord | null; error: string | null }> {
  if (!supabase) return { store: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('upsert_my_vendor_store', {
    p_store_name: params.storeName.trim(),
    p_slug: params.slug?.trim() || null,
    p_tagline: params.tagline.trim(),
    p_description: params.description.trim(),
    p_bank_name: params.bankName.trim(),
    p_account_number: params.accountNumber.trim(),
    p_account_name: params.accountName.trim(),
  });
  if (error) return { store: null, error: error.message };
  return { store: data, error: null };
}

export async function adminModerateVendorStore(params: {
  storeId: string;
  status: VendorStoreStatus;
  isVerified?: boolean;
}): Promise<{ store: VendorStoreRecord | null; error: string | null }> {
  if (!supabase) return { store: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('admin_moderate_vendor_store', {
    p_store_id: params.storeId,
    p_status: params.status,
    p_is_verified: typeof params.isVerified === 'boolean' ? params.isVerified : null,
  });
  if (error) return { store: null, error: error.message };
  return { store: data, error: null };
}

export async function fetchOrderChatMessages(orderId: string): Promise<{
  messages: OrderChatMessageRow[];
  error: string | null;
}> {
  if (!supabase) return { messages: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('get_order_chat_messages', {
    p_order_id: orderId,
  });
  if (error) return { messages: [], error: error.message };
  return { messages: Array.isArray(data) ? data : [], error: null };
}

export async function sendOrderChatMessage(
  orderId: string,
  body: string,
): Promise<{ message: OrderChatMessageRecord | null; error: string | null }> {
  if (!supabase) return { message: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('send_order_chat_message', {
    p_order_id: orderId,
    p_body: body.trim(),
  });
  if (error) return { message: null, error: error.message };
  return { message: data, error: null };
}

export function subscribeToOrderChat(
  orderId: string,
  onNewMessage: () => void,
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client
    .channel(`vatar:order-chat:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'marketplace_order_messages',
        filter: `order_id=eq.${orderId}`,
      },
      () => {
        onNewMessage();
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
