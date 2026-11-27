export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type AppRole = 'admin' | 'super_admin' | 'moderator';

export type CompetitionStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type CompetitionRegistrationStatus =
  | 'registered'
  | 'withdrawn'
  | 'disqualified'
  | 'removed';

export type MarketplaceCategoryCode =
  | 'lagos_life_funds'
  | 'digital_goods'
  | 'digital_services'
  | 'community_products';

export type MarketplaceListingStatus = 'available' | 'unavailable' | 'sold';

export type MarketplaceModerationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'removed';

export type MarketplaceOrderStatus =
  | 'requested'
  | 'accepted'
  | 'in_progress'
  | 'seller_marked_sent'
  | 'buyer_confirmed'
  | 'cancelled'
  | 'disputed'
  | 'rejected';

export type MarketplaceFulfillmentMode = 'manual' | 'official_api';

export type MarketplaceDisputeReason =
  | 'currency_not_received'
  | 'incorrect_amount'
  | 'incorrect_recipient'
  | 'seller_unresponsive'
  | 'other';

export type MarketplaceDisputeStatus =
  | 'open'
  | 'under_review'
  | 'resolved'
  | 'dismissed';

export type AnnouncementCategory =
  | 'general'
  | 'competitions'
  | 'marketplace'
  | 'important';

export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRecord = {
  id: string;
  username: string;
  full_name: string;
  lagos_life_username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type MembershipRecord = {
  id: string;
  user_id: string;
  status: MembershipStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRoleRecord = {
  id: string;
  user_id: string;
  role: AppRole;
  granted_by: string | null;
  created_at: string;
};

export type AuditLogRecord = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_user_id: string | null;
  metadata: Json;
  created_at: string;
};

export type CompetitionRecord = {
  id: string;
  title: string;
  slug: string;
  description: string;
  competition_type: string;
  banner_image_url: string | null;
  registration_start: string | null;
  registration_end: string | null;
  competition_start: string | null;
  competition_end: string | null;
  participant_limit: number | null;
  status: CompetitionStatus;
  rules: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitionRegistrationRecord = {
  id: string;
  competition_id: string;
  user_id: string;
  status: CompetitionRegistrationStatus;
  status_reason: string | null;
  reviewed_by: string | null;
  registered_at: string;
  updated_at: string;
};

export type CompetitionResultRecord = {
  id: string;
  competition_id: string;
  user_id: string;
  placement: number;
  points_awarded: number;
  result_note: string | null;
  is_published: boolean;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitionParticipantCountRow = {
  competition_id: string;
  registered_count: number;
};

export type PublishedCompetitionResultRow = {
  result_id: string;
  user_id: string;
  username: string;
  placement: number;
  points_awarded: number;
  result_note: string | null;
};

export type LeaderboardRankRow = {
  rank_position: number;
  user_id: string;
  username: string;
  total_points: number;
  competitions_played: number;
  wins: number;
  podiums: number;
  best_placement: number;
};

export type MarketplaceListingRecord = {
  id: string;
  seller_id: string;
  category: MarketplaceCategoryCode;
  title: string;
  description: string;
  price_amount: number;
  price_currency: string;
  game_currency_amount: number | null;
  seller_contact_note: string | null;
  status: MarketplaceListingStatus;
  moderation_status: MarketplaceModerationStatus;
  moderation_note: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceListingWithSellerRow = {
  id: string;
  seller_id: string;
  seller_username: string;
  category: MarketplaceCategoryCode;
  title: string;
  description: string;
  price_amount: number;
  price_currency: string;
  game_currency_amount: number | null;
  seller_contact_note: string | null;
  status: MarketplaceListingStatus;
  moderation_status: MarketplaceModerationStatus;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceOrderRecord = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  requested_game_currency_amount: number | null;
  agreed_price_amount: number;
  agreed_price_currency: string;
  recipient_lagos_life_username: string | null;
  fulfillment_mode: MarketplaceFulfillmentMode;
  status: MarketplaceOrderStatus;
  buyer_note: string | null;
  seller_note: string | null;
  seller_marked_sent_at: string | null;
  buyer_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MyMarketplaceOrderRow = {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_category: MarketplaceCategoryCode;
  buyer_id: string;
  buyer_username: string;
  seller_id: string;
  seller_username: string;
  requested_game_currency_amount: number | null;
  agreed_price_amount: number;
  agreed_price_currency: string;
  recipient_lagos_life_username: string | null;
  fulfillment_mode: MarketplaceFulfillmentMode;
  status: MarketplaceOrderStatus;
  buyer_note: string | null;
  seller_note: string | null;
  seller_marked_sent_at: string | null;
  buyer_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceDisputeRecord = {
  id: string;
  order_id: string;
  opened_by: string;
  reason: MarketplaceDisputeReason;
  description: string;
  status: MarketplaceDisputeStatus;
  admin_resolution_note: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type MarketplaceOrderEventRecord = {
  id: string;
  order_id: string;
  actor_id: string | null;
  event_type: string;
  event_description: string;
  created_at: string;
};

export type AnnouncementRecord = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  status: AnnouncementStatus;
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementReadRecord = {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
};

export type MemberAnnouncementRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  published_at: string | null;
  author_username: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type MoneyPackCode =
  | '100B'
  | '200B'
  | '300B'
  | '400B'
  | '500B'
  | '600B'
  | '700B'
  | '800B'
  | '900B'
  | '1T';

export type MoneyPackOrderStatus =
  | 'awaiting_payment'
  | 'payment_submitted'
  | 'sending'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type MoneyPackSettingsRecord = {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  whatsapp_number: string;
  telegram_url: string;
  is_enabled: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VipTierCode = 'gold' | 'platinum' | 'diamond' | 'elite';

export type VipUpgradeStatus =
  | 'awaiting_payment'
  | 'payment_submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type VipMembershipRecord = {
  user_id: string;
  tier: VipTierCode;
  discount_percent: number;
  monthly_price_ngn: number;
  started_at: string;
  expires_at: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VipUpgradeRequestRecord = {
  id: string;
  request_code: string;
  user_id: string;
  tier: VipTierCode;
  discount_percent: number;
  price_ngn: number;
  status: VipUpgradeStatus;
  payment_submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type MoneyPackOrderRecord = {
  id: string;
  order_code: string;
  buyer_id: string;
  lagos_life_username: string;
  pack_code: MoneyPackCode;
  pack_label: string;
  quantity: number;
  in_game_amount: number;
  unit_price_ngn: number;
  total_price_ngn: number;
  discount_percent?: number;
  vip_tier?: string | null;
  status: MoneyPackOrderStatus;
  buyer_note: string | null;
  admin_note: string | null;
  payment_submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicReviewRow = {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  vip_tier: string | null;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type SiteReviewRecord = {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRecord;
        Insert: {
          id: string;
          username: string;
          full_name: string;
          lagos_life_username: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          full_name?: string;
          lagos_life_username?: string;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: MembershipRecord;
        Insert: {
          id?: string;
          user_id: string;
          status?: MembershipStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: MembershipStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: UserRoleRecord;
        Insert: {
          id?: string;
          user_id: string;
          role: AppRole;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: {
          role?: AppRole;
          granted_by?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRecord;
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          target_user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          action?: never;
        };
        Relationships: [];
      };
      competitions: {
        Row: CompetitionRecord;
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description: string;
          competition_type?: string;
          banner_image_url?: string | null;
          registration_start?: string | null;
          registration_end?: string | null;
          competition_start?: string | null;
          competition_end?: string | null;
          participant_limit?: number | null;
          status?: CompetitionStatus;
          rules?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          description?: string;
          competition_type?: string;
          banner_image_url?: string | null;
          registration_start?: string | null;
          registration_end?: string | null;
          competition_start?: string | null;
          competition_end?: string | null;
          participant_limit?: number | null;
          status?: CompetitionStatus;
          rules?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      competition_registrations: {
        Row: CompetitionRegistrationRecord;
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          status?: CompetitionRegistrationStatus;
          status_reason?: string | null;
          reviewed_by?: string | null;
          registered_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: CompetitionRegistrationStatus;
          status_reason?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      competition_results: {
        Row: CompetitionResultRecord;
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          placement: number;
          points_awarded?: number;
          result_note?: string | null;
          is_published?: boolean;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          placement?: number;
          points_awarded?: number;
          result_note?: string | null;
          is_published?: boolean;
          recorded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_listings: {
        Row: MarketplaceListingRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      marketplace_orders: {
        Row: MarketplaceOrderRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      marketplace_disputes: {
        Row: MarketplaceDisputeRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      marketplace_order_events: {
        Row: MarketplaceOrderEventRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      announcements: {
        Row: AnnouncementRecord;
        Insert: {
          id?: string;
          title: string;
          slug: string;
          content: string;
          category?: AnnouncementCategory;
          priority?: AnnouncementPriority;
          is_pinned?: boolean;
          status?: AnnouncementStatus;
          published_at?: string | null;
          author_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          content?: string;
          category?: AnnouncementCategory;
          priority?: AnnouncementPriority;
          is_pinned?: boolean;
          status?: AnnouncementStatus;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcement_reads: {
        Row: AnnouncementReadRecord;
        Insert: {
          id?: string;
          announcement_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      money_pack_settings: {
        Row: MoneyPackSettingsRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      money_pack_orders: {
        Row: MoneyPackOrderRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vip_memberships: {
        Row: VipMembershipRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vip_upgrade_requests: {
        Row: VipUpgradeRequestRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { p_user_id: string; p_requested_role: string };
        Returns: boolean;
      };
      is_admin: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_super_admin: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_approved_member: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_active_admin: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      review_membership: {
        Args: {
          p_target_user_id: string;
          p_new_status: MembershipStatus;
          p_review_note?: string | null;
          p_actor_id?: string | null;
        };
        Returns: MembershipRecord;
      };
      register_for_competition: {
        Args: { p_competition_id: string };
        Returns: CompetitionRegistrationRecord;
      };
      admin_manage_registration: {
        Args: {
          p_registration_id: string;
          p_new_status: CompetitionRegistrationStatus;
          p_reason?: string | null;
        };
        Returns: CompetitionRegistrationRecord;
      };
      admin_upsert_competition_result: {
        Args: {
          p_competition_id: string;
          p_user_id: string;
          p_placement: number;
          p_points_awarded: number;
          p_result_note?: string | null;
          p_is_published?: boolean;
        };
        Returns: CompetitionResultRecord;
      };
      admin_publish_competition_results: {
        Args: {
          p_competition_id: string;
          p_publish?: boolean;
        };
        Returns: number;
      };
      get_competition_participant_counts: {
        Args: Record<string, never>;
        Returns: CompetitionParticipantCountRow[];
      };
      get_competition_published_results: {
        Args: { p_competition_id: string };
        Returns: PublishedCompetitionResultRow[];
      };
      get_leaderboard: {
        Args: { p_competition_id?: string | null };
        Returns: LeaderboardRankRow[];
      };
      get_marketplace_listings: {
        Args: { p_category?: string | null };
        Returns: MarketplaceListingWithSellerRow[];
      };
      create_marketplace_listing: {
        Args: {
          p_category: MarketplaceCategoryCode;
          p_title: string;
          p_description: string;
          p_price_amount: number;
          p_price_currency?: string;
          p_game_currency_amount?: number | null;
          p_seller_contact_note?: string | null;
        };
        Returns: MarketplaceListingRecord;
      };
      update_own_marketplace_listing: {
        Args: {
          p_listing_id: string;
          p_title: string;
          p_description: string;
          p_price_amount: number;
          p_price_currency?: string;
          p_game_currency_amount?: number | null;
          p_seller_contact_note?: string | null;
          p_status?: MarketplaceListingStatus;
        };
        Returns: MarketplaceListingRecord;
      };
      admin_moderate_listing: {
        Args: {
          p_listing_id: string;
          p_moderation_status: MarketplaceModerationStatus;
          p_moderation_note?: string | null;
        };
        Returns: MarketplaceListingRecord;
      };
      create_marketplace_order: {
        Args: {
          p_listing_id: string;
          p_requested_game_currency_amount?: number | null;
          p_recipient_lagos_life_username?: string | null;
          p_buyer_note?: string | null;
        };
        Returns: MarketplaceOrderRecord;
      };
      transition_marketplace_order: {
        Args: {
          p_order_id: string;
          p_next_status: MarketplaceOrderStatus;
          p_note?: string | null;
        };
        Returns: MarketplaceOrderRecord;
      };
      open_marketplace_dispute: {
        Args: {
          p_order_id: string;
          p_reason: MarketplaceDisputeReason;
          p_description: string;
        };
        Returns: MarketplaceDisputeRecord;
      };
      admin_resolve_dispute: {
        Args: {
          p_dispute_id: string;
          p_dispute_status: 'resolved' | 'dismissed';
          p_resolution_note: string;
          p_target_order_status: 'buyer_confirmed' | 'cancelled' | 'rejected' | 'in_progress';
        };
        Returns: MarketplaceDisputeRecord;
      };
      get_my_marketplace_orders: {
        Args: Record<string, never>;
        Returns: MyMarketplaceOrderRow[];
      };
      get_member_announcements: {
        Args: { p_category?: string | null };
        Returns: MemberAnnouncementRow[];
      };
      mark_announcement_read: {
        Args: { p_announcement_id: string };
        Returns: boolean;
      };
      get_unread_announcements_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      create_money_pack_order: {
        Args: {
          p_pack_code: MoneyPackCode;
          p_quantity?: number;
          p_lagos_life_username?: string | null;
          p_buyer_note?: string | null;
        };
        Returns: MoneyPackOrderRecord;
      };
      mark_money_pack_payment_submitted: {
        Args: { p_order_id: string };
        Returns: MoneyPackOrderRecord;
      };
      cancel_money_pack_order: {
        Args: { p_order_id: string };
        Returns: MoneyPackOrderRecord;
      };
      admin_update_money_pack_order: {
        Args: {
          p_order_id: string;
          p_new_status: 'sending' | 'completed' | 'rejected';
          p_admin_note?: string | null;
        };
        Returns: MoneyPackOrderRecord;
      };
      admin_update_money_pack_settings: {
        Args: {
          p_bank_name: string;
          p_account_number: string;
          p_account_name: string;
          p_whatsapp_number: string;
          p_telegram_url?: string;
          p_is_enabled?: boolean;
        };
        Returns: MoneyPackSettingsRecord;
      };
      get_pending_money_pack_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      create_trillion_quote_order: {
        Args: {
          p_trillions: number;
          p_lagos_life_username: string;
          p_buyer_note?: string | null;
        };
        Returns: MoneyPackOrderRecord;
      };
      request_vip_upgrade: {
        Args: { p_tier: VipTierCode };
        Returns: VipUpgradeRequestRecord;
      };
      mark_vip_payment_submitted: {
        Args: { p_request_id: string };
        Returns: VipUpgradeRequestRecord;
      };
      admin_review_vip_upgrade: {
        Args: {
          p_request_id: string;
          p_decision: 'approved' | 'rejected';
          p_admin_note?: string | null;
        };
        Returns: VipUpgradeRequestRecord;
      };
      get_public_reviews: {
        Args: { p_limit?: number };
        Returns: PublicReviewRow[];
      };
      submit_site_review: {
        Args: { p_rating: number; p_comment: string };
        Returns: SiteReviewRecord;
      };
      log_treasury_activity: {
        Args: {
          p_mode: string;
          p_target: string;
          p_amount_label: string;
          p_detail?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
