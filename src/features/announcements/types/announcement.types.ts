import type {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementRecord,
  AnnouncementStatus,
} from '@/lib/supabase/database.types';

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general: 'General',
  competitions: 'Competitions',
  marketplace: 'Marketplace',
  important: 'Important',
};

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export interface AnnouncementFormValues {
  title: string;
  slug: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  isPinned: boolean;
  status: AnnouncementStatus;
}

export interface AdminAnnouncementView {
  announcement: AnnouncementRecord;
  authorUsername: string;
}
