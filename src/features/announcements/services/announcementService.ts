import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type {
  AnnouncementCategory,
  AnnouncementRecord,
  AnnouncementStatus,
  MemberAnnouncementRow,
  ProfileRecord,
} from '@/lib/supabase/database.types';
import type {
  AdminAnnouncementView,
  AnnouncementFormValues,
} from '@/features/announcements/types/announcement.types';

export function slugifyAnnouncementTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

// =========================================================
// MEMBER SERVICES
// =========================================================

export async function fetchMemberAnnouncements(
  category?: AnnouncementCategory | null,
): Promise<{
  announcements: MemberAnnouncementRow[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      announcements: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('get_member_announcements', {
    p_category: category ?? null,
  });

  if (error) {
    return { announcements: [], error: error.message };
  }

  return { announcements: data ?? [], error: null };
}

export async function markAnnouncementAsRead(
  announcementId: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return {
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { error } = await supabase.rpc('mark_announcement_read', {
    p_announcement_id: announcementId,
  });

  return { error: error?.message ?? null };
}

export async function fetchUnreadAnnouncementsCount(): Promise<{
  count: number;
  error: string | null;
}> {
  if (!supabase) {
    return {
      count: 0,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('get_unread_announcements_count');
  if (error) return { count: 0, error: error.message };
  return { count: Number(data) || 0, error: null };
}

// =========================================================
// ADMIN SERVICES
// =========================================================

export async function fetchAdminAnnouncements(): Promise<{
  items: AdminAnnouncementView[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      items: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [annRes, profilesRes] = await Promise.all([
    supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, username'),
  ]);

  if (annRes.error) return { items: [], error: annRes.error.message };
  if (profilesRes.error) return { items: [], error: profilesRes.error.message };

  const usernameMap = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as Pick<ProfileRecord, 'id' | 'username'>[]) {
    usernameMap.set(p.id, p.username);
  }

  const items: AdminAnnouncementView[] = (annRes.data ?? []).map((announcement) => ({
    announcement,
    authorUsername: announcement.author_id
      ? (usernameMap.get(announcement.author_id) ?? 'admin')
      : 'admin',
  }));

  return { items, error: null };
}

export async function createAnnouncement(
  values: AnnouncementFormValues,
  authorId: string,
): Promise<{ announcement: AnnouncementRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      announcement: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: values.title.trim(),
      slug: values.slug.trim().toLowerCase() || slugifyAnnouncementTitle(values.title),
      content: values.content.trim(),
      category: values.category,
      priority: values.priority,
      is_pinned: values.isPinned,
      status: values.status,
      published_at: values.status === 'published' ? new Date().toISOString() : null,
      author_id: authorId,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        announcement: null,
        error: 'An announcement with that slug already exists. Choose a unique slug.',
      };
    }
    return { announcement: null, error: error.message };
  }

  return { announcement: data ?? null, error: null };
}

export async function updateAnnouncement(
  announcementId: string,
  values: AnnouncementFormValues,
): Promise<{ announcement: AnnouncementRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      announcement: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase
    .from('announcements')
    .update({
      title: values.title.trim(),
      slug: values.slug.trim().toLowerCase() || slugifyAnnouncementTitle(values.title),
      content: values.content.trim(),
      category: values.category,
      priority: values.priority,
      is_pinned: values.isPinned,
      status: values.status,
    })
    .eq('id', announcementId)
    .select('*')
    .single();

  if (error) return { announcement: null, error: error.message };
  return { announcement: data ?? null, error: null };
}

export async function updateAnnouncementStatus(
  announcementId: string,
  status: AnnouncementStatus,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return {
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { error } = await supabase
    .from('announcements')
    .update({
      status,
      ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
    })
    .eq('id', announcementId);

  return { error: error?.message ?? null };
}
