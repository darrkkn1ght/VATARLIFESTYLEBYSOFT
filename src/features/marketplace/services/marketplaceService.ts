import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type {
  MarketplaceCategoryCode,
  MarketplaceDisputeReason,
  MarketplaceListingWithSellerRow,
  MarketplaceModerationStatus,
  MarketplaceOrderEventRecord,
  MarketplaceOrderRecord,
  MarketplaceOrderStatus,
  MyMarketplaceOrderRow,
  ProfileRecord,
} from '@/lib/supabase/database.types';
import type {
  AdminDisputeView,
  AdminOrderView,
  ListingFormValues,
} from '@/features/marketplace/types/marketplace.types';

export async function fetchMarketplaceListings(
  category?: MarketplaceCategoryCode | null,
): Promise<{
  listings: MarketplaceListingWithSellerRow[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      listings: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('get_marketplace_listings', {
    p_category: category ?? null,
  });

  if (error) return { listings: [], error: error.message };

  return {
    listings: (data ?? []).map((row) => ({
      ...row,
      price_amount: Number(row.price_amount),
      game_currency_amount:
        row.game_currency_amount !== null ? Number(row.game_currency_amount) : null,
    })),
    error: null,
  };
}

export function parseGameFundsInput(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^[₦nN]+/, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();

  if (!cleaned) return null;

  const match = /^(\d+(?:\.\d+)?)([KMBT])?$/.exec(cleaned);
  if (!match) return null;

  const base = Number.parseFloat(match[1]);
  if (!Number.isFinite(base) || base <= 0) return null;

  const suffix = match[2] ?? '';
  const multiplier =
    suffix === 'T'
      ? 1_000_000_000_000
      : suffix === 'B'
        ? 1_000_000_000
        : suffix === 'M'
          ? 1_000_000
          : suffix === 'K'
            ? 1_000
            : 1;

  const result = Math.round(base * multiplier);
  if (!Number.isFinite(result) || result <= 0 || result > 9_000_000_000_000_000) {
    return null;
  }
  return result;
}

export function formatGameFundsShort(amount: number | null | undefined): string {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return '';
  if (amount >= 1_000_000_000_000) {
    const t = amount / 1_000_000_000_000;
    return `${Number.isInteger(t) ? t : Number(t.toFixed(2))}T`;
  }
  if (amount >= 1_000_000_000) {
    const b = amount / 1_000_000_000;
    return `${Number.isInteger(b) ? b : Number(b.toFixed(2))}B`;
  }
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `${Number.isInteger(m) ? m : Number(m.toFixed(2))}M`;
  }
  if (amount >= 1_000) {
    const k = amount / 1_000;
    return `${Number.isInteger(k) ? k : Number(k.toFixed(2))}K`;
  }
  return String(Math.round(amount));
}

export function parseRealPriceInput(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^(NGN|USD|[₦$])\s*/i, '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

export async function createListing(
  values: ListingFormValues,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.' };
  }

  const price = parseRealPriceInput(values.priceAmount);
  if (!price) {
    return { error: 'Enter the real-money price in Naira (e.g. 1500).' };
  }
  const gameAmount = values.gameCurrencyAmount.trim()
    ? parseGameFundsInput(values.gameCurrencyAmount)
    : null;

  if (values.gameCurrencyAmount.trim() && gameAmount === null) {
    return {
      error: 'Enter a valid Game Funds quantity such as 100B, 500B, 1T, or 5T.',
    };
  }

  const { error } = await supabase.rpc('create_marketplace_listing', {
    p_category: values.category,
    p_title: values.title.trim(),
    p_description: values.description.trim(),
    p_price_amount: price,
    p_price_currency: values.priceCurrency.trim().toUpperCase() || 'NGN',
    p_game_currency_amount: gameAmount,
    p_seller_contact_note: values.sellerContactNote.trim() || null,
  });

  return { error: error?.message ?? null };
}

export async function updateOwnListing(
  listingId: string,
  values: ListingFormValues,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.' };
  }

  const price = parseRealPriceInput(values.priceAmount);
  if (!price) {
    return { error: 'Enter the real-money price in Naira (e.g. 1500).' };
  }
  const gameAmount = values.gameCurrencyAmount.trim()
    ? parseGameFundsInput(values.gameCurrencyAmount)
    : null;

  if (values.gameCurrencyAmount.trim() && gameAmount === null) {
    return {
      error: 'Enter a valid Game Funds quantity such as 100B, 500B, 1T, or 5T.',
    };
  }

  const { error } = await supabase.rpc('update_own_marketplace_listing', {
    p_listing_id: listingId,
    p_title: values.title.trim(),
    p_description: values.description.trim(),
    p_price_amount: price,
    p_price_currency: values.priceCurrency.trim().toUpperCase() || 'NGN',
    p_game_currency_amount: gameAmount,
    p_seller_contact_note: values.sellerContactNote.trim() || null,
    p_status: values.status,
  });

  return { error: error?.message ?? null };
}

export async function createPurchaseRequest(input: {
  listingId: string;
  requestedGameCurrencyAmount: number | null;
  recipientLagosLifeUsername: string;
  buyerNote: string;
}): Promise<{ order: MarketplaceOrderRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      order: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('create_marketplace_order', {
    p_listing_id: input.listingId,
    p_requested_game_currency_amount: input.requestedGameCurrencyAmount,
    p_recipient_lagos_life_username: input.recipientLagosLifeUsername.trim() || null,
    p_buyer_note: input.buyerNote.trim() || null,
  });

  return { order: data ?? null, error: error?.message ?? null };
}

export async function fetchMyOrders(): Promise<{
  orders: MyMarketplaceOrderRow[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      orders: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('get_my_marketplace_orders');
  if (error) return { orders: [], error: error.message };

  return {
    orders: (data ?? []).map((row) => ({
      ...row,
      agreed_price_amount: Number(row.agreed_price_amount),
      requested_game_currency_amount:
        row.requested_game_currency_amount !== null
          ? Number(row.requested_game_currency_amount)
          : null,
    })),
    error: null,
  };
}

export async function fetchOrderEvents(orderId: string): Promise<{
  events: MarketplaceOrderEventRecord[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      events: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase
    .from('marketplace_order_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) return { events: [], error: error.message };
  return { events: data ?? [], error: null };
}

export async function transitionOrderStatus(
  orderId: string,
  nextStatus: MarketplaceOrderStatus,
  note = '',
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.' };
  }

  const { error } = await supabase.rpc('transition_marketplace_order', {
    p_order_id: orderId,
    p_next_status: nextStatus,
    p_note: note.trim() || null,
  });

  return { error: error?.message ?? null };
}

export async function openOrderDispute(input: {
  orderId: string;
  reason: MarketplaceDisputeReason;
  description: string;
}): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.' };
  }

  const { error } = await supabase.rpc('open_marketplace_dispute', {
    p_order_id: input.orderId,
    p_reason: input.reason,
    p_description: input.description.trim(),
  });

  return { error: error?.message ?? null };
}

// =========================================================
// ADMIN MARKETPLACE SERVICES
// =========================================================

export async function moderateListing(
  listingId: string,
  moderationStatus: MarketplaceModerationStatus,
  moderationNote: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.' };
  }

  const { error } = await supabase.rpc('admin_moderate_listing', {
    p_listing_id: listingId,
    p_moderation_status: moderationStatus,
    p_moderation_note: moderationNote.trim() || null,
  });

  return { error: error?.message ?? null };
}

export async function fetchAdminMarketplaceOversight(): Promise<{
  listings: MarketplaceListingWithSellerRow[];
  orders: AdminOrderView[];
  disputes: AdminDisputeView[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      listings: [],
      orders: [],
      disputes: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [listingsRes, ordersRes, disputesRes, profilesRes] = await Promise.all([
    fetchMarketplaceListings(null),
    supabase
      .from('marketplace_orders')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('marketplace_disputes')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*'),
  ]);

  if (listingsRes.error) {
    return { listings: [], orders: [], disputes: [], error: listingsRes.error };
  }
  if (ordersRes.error) {
    return { listings: [], orders: [], disputes: [], error: ordersRes.error.message };
  }
  if (disputesRes.error) {
    return { listings: [], orders: [], disputes: [], error: disputesRes.error.message };
  }
  if (profilesRes.error) {
    return { listings: [], orders: [], disputes: [], error: profilesRes.error.message };
  }

  const profileMap = new Map<string, ProfileRecord>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, p);
  }

  const listingTitleMap = new Map<string, string>();
  for (const l of listingsRes.listings) {
    listingTitleMap.set(l.id, l.title);
  }

  const orderMap = new Map<string, MarketplaceOrderRecord>();
  const orders: AdminOrderView[] = (ordersRes.data ?? []).map((o) => {
    const normalized: MarketplaceOrderRecord = {
      ...o,
      agreed_price_amount: Number(o.agreed_price_amount),
      requested_game_currency_amount:
        o.requested_game_currency_amount !== null
          ? Number(o.requested_game_currency_amount)
          : null,
    };
    orderMap.set(o.id, normalized);
    return {
      order: normalized,
      listingTitle: listingTitleMap.get(o.listing_id) ?? 'Listing',
      buyerUsername: profileMap.get(o.buyer_id)?.username ?? o.buyer_id.slice(0, 8),
      sellerUsername: profileMap.get(o.seller_id)?.username ?? o.seller_id.slice(0, 8),
    };
  });

  const disputes: AdminDisputeView[] = (disputesRes.data ?? []).map((d) => {
    const order = orderMap.get(d.order_id) ?? null;
    return {
      dispute: d,
      order,
      listingTitle: order ? (listingTitleMap.get(order.listing_id) ?? 'Listing') : 'Order',
      buyerProfile: order ? (profileMap.get(order.buyer_id) ?? null) : null,
      sellerProfile: order ? (profileMap.get(order.seller_id) ?? null) : null,
      openedByUsername: profileMap.get(d.opened_by)?.username ?? d.opened_by.slice(0, 8),
    };
  });

  return {
    listings: listingsRes.listings,
    orders,
    disputes,
    error: null,
  };
}

export async function resolveAdminDispute(input: {
  disputeId: string;
  disputeStatus: 'resolved' | 'dismissed';
  resolutionNote: string;
  targetOrderStatus: 'buyer_confirmed' | 'cancelled' | 'rejected' | 'in_progress';
}): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.' };
  }

  const { error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: input.disputeId,
    p_dispute_status: input.disputeStatus,
    p_resolution_note: input.resolutionNote.trim(),
    p_target_order_status: input.targetOrderStatus,
  });

  return { error: error?.message ?? null };
}
