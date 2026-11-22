import type {
  CompetitionRecord,
  CompetitionRegistrationRecord,
  CompetitionResultRecord,
  CompetitionStatus,
  ProfileRecord,
} from '@/lib/supabase/database.types';

export interface CompetitionWithMeta {
  competition: CompetitionRecord;
  registeredCount: number;
  myRegistration: CompetitionRegistrationRecord | null;
}

export interface CompetitionParticipantView {
  registration: CompetitionRegistrationRecord;
  profile: ProfileRecord | null;
  result: CompetitionResultRecord | null;
}

export interface CompetitionFormValues {
  title: string;
  slug: string;
  description: string;
  competitionType: string;
  bannerImageUrl: string;
  registrationStart: string;
  registrationEnd: string;
  competitionStart: string;
  competitionEnd: string;
  participantLimit: string;
  status: CompetitionStatus;
  rules: string;
}

export interface AdminResultBreakdownRow {
  result: CompetitionResultRecord;
  competitionTitle: string;
  username: string;
  fullName: string;
}
