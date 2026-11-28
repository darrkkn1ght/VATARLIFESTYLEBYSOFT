import type {
  MarketplaceCategoryCode,
  MarketplaceDisputeReason,
  MarketplaceDisputeRecord,
  MarketplaceListingStatus,
  MarketplaceOrderRecord,
  ProfileRecord,
} from '@/lib/supabase/database.types';

export const MARKETPLACE_CATEGORY_LABELS: Record<MarketplaceCategoryCode, string> = {
  lagos_life_funds: 'Lagos Life Game Funds',
  digital_goods: 'Digital Products & Guides',
  digital_services: 'Digital Services',
  cars_vehicles: 'Cars & Automobiles',
  fashion_clothing: 'Clothes, Shoes & Fashion',
  gadgets_electronics: 'Phones, Laptops & Gadgets',
  real_estate: 'Real Estate & Shortlets',
  community_products: 'Other Real-Life Store Items',
};

export const DISPUTE_REASON_LABELS: Record<MarketplaceDisputeReason, string> = {
  currency_not_received: 'Currency not received',
  incorrect_amount: 'Incorrect amount received',
  incorrect_recipient: 'Incorrect recipient',
  seller_unresponsive: 'Seller unresponsive',
  other: 'Other transaction problem',
};

export interface ListingFormValues {
  category: MarketplaceCategoryCode;
  title: string;
  description: string;
  priceAmount: string;
  priceCurrency: string;
  gameCurrencyAmount: string;
  sellerContactNote: string;
  location: string;
  imageUrls: string[];
  status: MarketplaceListingStatus;
}

export interface AdminDisputeView {
  dispute: MarketplaceDisputeRecord;
  order: MarketplaceOrderRecord | null;
  listingTitle: string;
  buyerProfile: ProfileRecord | null;
  sellerProfile: ProfileRecord | null;
  openedByUsername: string;
}

export interface AdminOrderView {
  order: MarketplaceOrderRecord;
  listingTitle: string;
  buyerUsername: string;
  sellerUsername: string;
}
