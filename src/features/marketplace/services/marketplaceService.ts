import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type {
  MarketplaceCategoryCode,
  MarketplaceDisputeReason,
  MarketplaceListingCommentRecord,
  MarketplaceListingCommentRow,
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

const CART_STORAGE_KEY = 'vatar_marketplace_cart_v1';

export interface MarketplaceCartItem {
  listingId: string;
  title: string;
  priceAmount: number;
  priceCurrency: string;
  category: MarketplaceCategoryCode;
  sellerUsername: string;
  sellerId: string;
  imageUrl: string | null;
  location: string;
  gameCurrencyAmount: number | null;
}

export function loadMarketplaceCart(): MarketplaceCartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MarketplaceCartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveMarketplaceCart(items: MarketplaceCartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('vatar:cart-updated'));
  } catch {
    // ignore storage errors
  }
}

export function toggleMarketplaceCartItem(
  listing: MarketplaceListingWithSellerRow,
): { inCart: boolean; items: MarketplaceCartItem[] } {
  const current = loadMarketplaceCart();
  const exists = current.some((i) => i.listingId === listing.id);
  if (exists) {
    const next = current.filter((i) => i.listingId !== listing.id);
    saveMarketplaceCart(next);
    return { inCart: false, items: next };
  }
  const nextItem: MarketplaceCartItem = {
    listingId: listing.id,
    title: listing.title,
    priceAmount: Number(listing.price_amount),
    priceCurrency: listing.price_currency || 'NGN',
    category: listing.category,
    sellerUsername: listing.seller_username,
    sellerId: listing.seller_id,
    imageUrl: listing.image_urls?.[0] || null,
    location: listing.location || '',
    gameCurrencyAmount: listing.game_currency_amount ?? null,
  };
  const next = [nextItem, ...current];
  saveMarketplaceCart(next);
  return { inCart: true, items: next };
}

export function removeFromMarketplaceCart(listingId: string): MarketplaceCartItem[] {
  const next = loadMarketplaceCart().filter((i) => i.listingId !== listingId);
  saveMarketplaceCart(next);
  return next;
}

export async function compressAndUploadListingPhoto(
  file: File,
  userId: string,
): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) {
    return { url: null, error: 'Supabase is not configured.' };
  }
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Please select a valid image file (JPG, PNG, or WebP).' };
  }
  if (file.size > 12 * 1024 * 1024) {
    return { url: null, error: 'Image is too large (max 12 MB).' };
  }

  try {
    // Client-side resize + WebP compression for fast mobile loading
    const bitmap = await createImageBitmap(file);
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { url: null, error: 'Could not process image on this device.' };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.82),
    );
    const uploadPayload = blob || file;
    const ext = blob ? 'webp' : file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('marketplace-media')
      .upload(path, uploadPayload, {
        contentType: blob ? 'image/webp' : file.type,
        upsert: false,
      });

    if (uploadErr) {
      return { url: null, error: uploadErr.message };
    }

    const { data: pub } = supabase.storage.from('marketplace-media').getPublicUrl(path);
    return { url: pub.publicUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : 'Could not upload image.',
    };
  }
}

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
      location: row.location ?? '',
      image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
      likes_count: Number(row.likes_count ?? 0),
      comments_count: Number(row.comments_count ?? 0),
      viewer_has_liked: Boolean(row.viewer_has_liked),
      viewer_has_favorited: Boolean(row.viewer_has_favorited),
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
    p_location: values.location.trim(),
    p_image_urls: values.imageUrls.filter(Boolean).slice(0, 4),
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
    p_location: values.location.trim(),
    p_image_urls: values.imageUrls.filter(Boolean).slice(0, 4),
  });

  return { error: error?.message ?? null };
}

export async function toggleListingLike(
  listingId: string,
): Promise<{ liked: boolean; likesCount: number; error: string | null }> {
  if (!supabase) {
    return { liked: false, likesCount: 0, error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('toggle_marketplace_listing_like', {
    p_listing_id: listingId,
  });
  if (error) return { liked: false, likesCount: 0, error: error.message };
  return {
    liked: Boolean(data?.liked),
    likesCount: Number(data?.likes_count ?? 0),
    error: null,
  };
}

export async function toggleListingFavorite(
  listingId: string,
): Promise<{ favorited: boolean; error: string | null }> {
  if (!supabase) {
    return { favorited: false, error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('toggle_marketplace_listing_favorite', {
    p_listing_id: listingId,
  });
  if (error) return { favorited: false, error: error.message };
  return { favorited: Boolean(data?.favorited), error: null };
}

export async function fetchListingComments(
  listingId: string,
): Promise<{ comments: MarketplaceListingCommentRow[]; error: string | null }> {
  if (!supabase) return { comments: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('get_marketplace_listing_comments', {
    p_listing_id: listingId,
  });
  if (error) return { comments: [], error: error.message };
  return { comments: Array.isArray(data) ? data : [], error: null };
}

export async function addListingComment(
  listingId: string,
  body: string,
): Promise<{ comment: MarketplaceListingCommentRecord | null; error: string | null }> {
  if (!supabase) return { comment: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('add_marketplace_listing_comment', {
    p_listing_id: listingId,
    p_body: body.trim(),
  });
  if (error) return { comment: null, error: error.message };
  return { comment: data, error: null };
}

export async function deleteListingComment(
  commentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('delete_marketplace_listing_comment', {
    p_comment_id: commentId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: Boolean(data), error: null };
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
