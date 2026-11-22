import type {
  AppRole,
  AuditLogRecord,
  MembershipRecord,
  MembershipStatus,
  ProfileRecord,
} from '@/lib/supabase/database.types';

export type ReviewActionStatus = Extract<
  MembershipStatus,
  'approved' | 'rejected' | 'suspended'
>;

export interface AdminMemberRecord {
  userId: string;
  profile: ProfileRecord | null;
  membership: MembershipRecord;
  roles: readonly AppRole[];
  reviewerUsername: string | null;
}

export interface MembershipSummaryCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
}

export interface AdminAuditEntry {
  log: AuditLogRecord;
  actorLabel: string;
  targetLabel: string;
  previousStatus: string | null;
  newStatus: string | null;
  reviewNote: string | null;
  roleLabel: string | null;
}

export interface ReviewMembershipInput {
  targetUserId: string;
  newStatus: ReviewActionStatus;
  reviewNote: string;
}
