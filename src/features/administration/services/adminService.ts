import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type {
  AppRole,
  AuditLogRecord,
  Json,
  MembershipRecord,
  ProfileRecord,
} from '@/lib/supabase/database.types';
import type {
  AdminAuditEntry,
  AdminMemberRecord,
  MembershipSummaryCounts,
  ReviewMembershipInput,
} from '@/features/administration/types/admin.types';

function readStringField(metadata: Json, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function formatUserLabel(
  userId: string | null,
  profileMap: Map<string, ProfileRecord>,
): string {
  if (!userId) return 'System / SQL Operator';
  const profile = profileMap.get(userId);
  if (profile) return `@${profile.username}`;
  return `${userId.slice(0, 8)}…`;
}

export function computeMembershipCounts(
  members: readonly AdminMemberRecord[],
): MembershipSummaryCounts {
  const counts: MembershipSummaryCounts = {
    total: members.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
  };

  for (const member of members) {
    counts[member.membership.status] += 1;
  }

  return counts;
}

export async function fetchAdminMembers(): Promise<{
  members: AdminMemberRecord[];
  counts: MembershipSummaryCounts;
  profileMap: Map<string, ProfileRecord>;
  error: string | null;
}> {
  if (!supabase) {
    return {
      members: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 },
      profileMap: new Map(),
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [membershipsRes, profilesRes, rolesRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*'),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  if (membershipsRes.error) {
    return {
      members: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 },
      profileMap: new Map(),
      error: `Failed to load memberships: ${membershipsRes.error.message}`,
    };
  }

  if (profilesRes.error) {
    return {
      members: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 },
      profileMap: new Map(),
      error: `Failed to load member profiles: ${profilesRes.error.message}`,
    };
  }

  if (rolesRes.error) {
    return {
      members: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 },
      profileMap: new Map(),
      error: `Failed to load user roles: ${rolesRes.error.message}`,
    };
  }

  const profileMap = new Map<string, ProfileRecord>();
  for (const profile of profilesRes.data ?? []) {
    profileMap.set(profile.id, profile);
  }

  const roleMap = new Map<string, AppRole[]>();
  for (const row of rolesRes.data ?? []) {
    const existing = roleMap.get(row.user_id) ?? [];
    existing.push(row.role);
    roleMap.set(row.user_id, existing);
  }

  const members: AdminMemberRecord[] = (membershipsRes.data ?? []).map(
    (membership) => {
      const reviewerProfile = membership.reviewed_by
        ? profileMap.get(membership.reviewed_by)
        : undefined;

      return {
        userId: membership.user_id,
        profile: profileMap.get(membership.user_id) ?? null,
        membership,
        roles: roleMap.get(membership.user_id) ?? [],
        reviewerUsername: reviewerProfile ? `@${reviewerProfile.username}` : null,
      };
    },
  );

  return {
    members,
    counts: computeMembershipCounts(members),
    profileMap,
    error: null,
  };
}

export async function fetchRecentAuditActivity(
  profileMap: Map<string, ProfileRecord>,
  limit = 10,
): Promise<{ entries: AdminAuditEntry[]; error: string | null }> {
  if (!supabase) {
    return {
      entries: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return {
      entries: [],
      error: `Failed to load recent activity: ${error.message}`,
    };
  }

  const entries: AdminAuditEntry[] = (data ?? []).map((log: AuditLogRecord) => ({
    log,
    actorLabel: formatUserLabel(log.actor_id, profileMap),
    targetLabel: formatUserLabel(log.target_user_id, profileMap),
    previousStatus: readStringField(log.metadata, 'previous_status'),
    newStatus: readStringField(log.metadata, 'new_status'),
    reviewNote: readStringField(log.metadata, 'review_note'),
    roleLabel:
      readStringField(log.metadata, 'role') ??
      readStringField(log.metadata, 'new_role'),
  }));

  return { entries, error: null };
}

export async function reviewMemberApplication(
  input: ReviewMembershipInput,
): Promise<{ membership: MembershipRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      membership: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const trimmedNote = input.reviewNote.trim();

  const { data, error } = await supabase.rpc('review_membership', {
    p_target_user_id: input.targetUserId,
    p_new_status: input.newStatus,
    p_review_note: trimmedNote.length > 0 ? trimmedNote : null,
  });

  if (error) {
    return {
      membership: null,
      error: error.message,
    };
  }

  return {
    membership: data ?? null,
    error: null,
  };
}
