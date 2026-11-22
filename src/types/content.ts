export type CompetitionStatus = 'upcoming' | 'active' | 'completed';

export interface CompetitionItem {
  id: string;
  title: string;
  category: string;
  status: CompetitionStatus;
  scheduleLabel: string;
  format: string;
  summary: string;
}

export interface AnnouncementItem {
  id: string;
  tag: string;
  title: string;
  excerpt: string;
  publishedLabel: string;
}

export interface LeaderboardEntry {
  position: number;
  username: string;
  points: number;
  achievementsCount: number;
  division?: string;
}

export type RankingPeriod = 'all-time' | 'season' | 'monthly';

export type MarketplaceCategory =
  | 'All'
  | 'Lagos Life Game Funds'
  | 'Digital Goods'
  | 'Digital Services'
  | 'Community Products & Services';

export type ListingAvailability = 'available' | 'reserved' | 'sold';

export interface MarketplaceListing {
  id: string;
  title: string;
  category: Exclude<MarketplaceCategory, 'All'>;
  description: string;
  priceLabel: string;
  sellerName: string;
  sellerRole?: string;
  availability: ListingAvailability;
  contactHref?: string;
}
