import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type {
  CompetitionRecord,
  CompetitionRegistrationRecord,
  CompetitionRegistrationStatus,
  CompetitionResultRecord,
  CompetitionStatus,
  ProfileRecord,
  PublishedCompetitionResultRow,
} from '@/lib/supabase/database.types';
import type {
  CompetitionFormValues,
  CompetitionParticipantView,
  CompetitionWithMeta,
} from '@/features/competitions/types/competition.types';

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function toIsoOrNull(localDateTime: string): string | null {
  const trimmed = localDateTime.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseLimitOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function fetchParticipantCountMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!supabase) return map;

  const { data } = await supabase.rpc('get_competition_participant_counts');
  for (const row of data ?? []) {
    map.set(row.competition_id, Number(row.registered_count) || 0);
  }
  return map;
}

// =========================================================
// MEMBER SERVICES
// =========================================================

export async function fetchMemberCompetitions(userId: string): Promise<{
  items: CompetitionWithMeta[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      items: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [compsRes, regsRes, countMap] = await Promise.all([
    supabase
      .from('competitions')
      .select('*')
      .neq('status', 'draft')
      .order('competition_start', { ascending: true, nullsFirst: false }),
    supabase
      .from('competition_registrations')
      .select('*')
      .eq('user_id', userId),
    fetchParticipantCountMap(),
  ]);

  if (compsRes.error) {
    return { items: [], error: compsRes.error.message };
  }

  if (regsRes.error) {
    return { items: [], error: regsRes.error.message };
  }

  const myRegMap = new Map<string, CompetitionRegistrationRecord>();
  for (const reg of regsRes.data ?? []) {
    myRegMap.set(reg.competition_id, reg);
  }

  const items: CompetitionWithMeta[] = (compsRes.data ?? []).map(
    (competition) => ({
      competition,
      registeredCount: countMap.get(competition.id) ?? 0,
      myRegistration: myRegMap.get(competition.id) ?? null,
    }),
  );

  return { items, error: null };
}

export async function fetchMemberCompetitionDetail(
  competitionId: string,
  userId: string,
): Promise<{
  item: CompetitionWithMeta | null;
  publishedResults: PublishedCompetitionResultRow[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      item: null,
      publishedResults: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [compRes, regRes, countMap, resultsRes] = await Promise.all([
    supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle(),
    supabase
      .from('competition_registrations')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('user_id', userId)
      .maybeSingle(),
    fetchParticipantCountMap(),
    supabase.rpc('get_competition_published_results', {
      p_competition_id: competitionId,
    }),
  ]);

  if (compRes.error) {
    return { item: null, publishedResults: [], error: compRes.error.message };
  }

  if (!compRes.data) {
    return { item: null, publishedResults: [], error: null };
  }

  return {
    item: {
      competition: compRes.data,
      registeredCount: countMap.get(compRes.data.id) ?? 0,
      myRegistration: regRes.data ?? null,
    },
    publishedResults: resultsRes.error ? [] : (resultsRes.data ?? []),
    error: regRes.error?.message ?? resultsRes.error?.message ?? null,
  };
}

export async function registerMemberForCompetition(
  competitionId: string,
): Promise<{ registration: CompetitionRegistrationRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      registration: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('register_for_competition', {
    p_competition_id: competitionId,
  });

  if (error) {
    return { registration: null, error: error.message };
  }

  return { registration: data ?? null, error: null };
}

export async function fetchMemberPublishedResults(userId: string): Promise<{
  results: Array<{
    result: CompetitionResultRecord;
    competitionTitle: string;
  }>;
  error: string | null;
}> {
  if (!supabase) {
    return {
      results: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [resultsRes, compsRes] = await Promise.all([
    supabase
      .from('competition_results')
      .select('*')
      .eq('user_id', userId)
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase.from('competitions').select('id, title'),
  ]);

  if (resultsRes.error) {
    return { results: [], error: resultsRes.error.message };
  }

  const titleMap = new Map<string, string>();
  for (const c of compsRes.data ?? []) {
    titleMap.set(c.id, c.title);
  }

  return {
    results: (resultsRes.data ?? []).map((result) => ({
      result,
      competitionTitle: titleMap.get(result.competition_id) ?? 'Competition',
    })),
    error: null,
  };
}

// =========================================================
// ADMIN SERVICES
// =========================================================

export async function fetchAdminCompetitions(): Promise<{
  items: CompetitionWithMeta[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      items: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [compsRes, countMap] = await Promise.all([
    supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false }),
    fetchParticipantCountMap(),
  ]);

  if (compsRes.error) {
    return { items: [], error: compsRes.error.message };
  }

  return {
    items: (compsRes.data ?? []).map((competition) => ({
      competition,
      registeredCount: countMap.get(competition.id) ?? 0,
      myRegistration: null,
    })),
    error: null,
  };
}

export async function createCompetition(
  values: CompetitionFormValues,
  createdBy: string,
): Promise<{ competition: CompetitionRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      competition: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase
    .from('competitions')
    .insert({
      title: values.title.trim(),
      slug: values.slug.trim().toLowerCase() || slugifyTitle(values.title),
      description: values.description.trim(),
      competition_type: values.competitionType.trim() || 'tournament',
      banner_image_url: values.bannerImageUrl.trim() || null,
      registration_start: toIsoOrNull(values.registrationStart),
      registration_end: toIsoOrNull(values.registrationEnd),
      competition_start: toIsoOrNull(values.competitionStart),
      competition_end: toIsoOrNull(values.competitionEnd),
      participant_limit: parseLimitOrNull(values.participantLimit),
      status: values.status,
      rules: values.rules.trim() || null,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        competition: null,
        error: 'A competition with that slug already exists. Choose a unique slug.',
      };
    }
    return { competition: null, error: error.message };
  }

  return { competition: data ?? null, error: null };
}

export async function updateCompetition(
  competitionId: string,
  values: CompetitionFormValues,
): Promise<{ competition: CompetitionRecord | null; error: string | null }> {
  if (!supabase) {
    return {
      competition: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase
    .from('competitions')
    .update({
      title: values.title.trim(),
      slug: values.slug.trim().toLowerCase() || slugifyTitle(values.title),
      description: values.description.trim(),
      competition_type: values.competitionType.trim() || 'tournament',
      banner_image_url: values.bannerImageUrl.trim() || null,
      registration_start: toIsoOrNull(values.registrationStart),
      registration_end: toIsoOrNull(values.registrationEnd),
      competition_start: toIsoOrNull(values.competitionStart),
      competition_end: toIsoOrNull(values.competitionEnd),
      participant_limit: parseLimitOrNull(values.participantLimit),
      status: values.status,
      rules: values.rules.trim() || null,
    })
    .eq('id', competitionId)
    .select('*')
    .single();

  if (error) {
    return { competition: null, error: error.message };
  }

  return { competition: data ?? null, error: null };
}

export async function updateCompetitionStatus(
  competitionId: string,
  status: CompetitionStatus,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return {
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { error } = await supabase
    .from('competitions')
    .update({ status })
    .eq('id', competitionId);

  return { error: error?.message ?? null };
}

export async function fetchCompetitionParticipantsAndResults(
  competitionId: string,
): Promise<{
  participants: CompetitionParticipantView[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      participants: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const [regsRes, profilesRes, resultsRes] = await Promise.all([
    supabase
      .from('competition_registrations')
      .select('*')
      .eq('competition_id', competitionId)
      .order('registered_at', { ascending: true }),
    supabase.from('profiles').select('*'),
    supabase
      .from('competition_results')
      .select('*')
      .eq('competition_id', competitionId),
  ]);

  if (regsRes.error) return { participants: [], error: regsRes.error.message };
  if (profilesRes.error) return { participants: [], error: profilesRes.error.message };
  if (resultsRes.error) return { participants: [], error: resultsRes.error.message };

  const profileMap = new Map<string, ProfileRecord>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, p);
  }

  const resultMap = new Map<string, CompetitionResultRecord>();
  for (const r of resultsRes.data ?? []) {
    resultMap.set(r.user_id, r);
  }

  const participants: CompetitionParticipantView[] = (regsRes.data ?? []).map(
    (registration) => ({
      registration,
      profile: profileMap.get(registration.user_id) ?? null,
      result: resultMap.get(registration.user_id) ?? null,
    }),
  );

  return { participants, error: null };
}

export async function manageParticipantRegistration(
  registrationId: string,
  newStatus: CompetitionRegistrationStatus,
  reason: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return {
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { error } = await supabase.rpc('admin_manage_registration', {
    p_registration_id: registrationId,
    p_new_status: newStatus,
    p_reason: reason.trim() || null,
  });

  return { error: error?.message ?? null };
}

export async function upsertCompetitionResult(input: {
  competitionId: string;
  userId: string;
  placement: number;
  pointsAwarded: number;
  resultNote: string;
  isPublished: boolean;
}): Promise<{ error: string | null }> {
  if (!supabase) {
    return {
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { error } = await supabase.rpc('admin_upsert_competition_result', {
    p_competition_id: input.competitionId,
    p_user_id: input.userId,
    p_placement: input.placement,
    p_points_awarded: input.pointsAwarded,
    p_result_note: input.resultNote.trim() || null,
    p_is_published: input.isPublished,
  });

  return { error: error?.message ?? null };
}

export async function publishCompetitionResults(
  competitionId: string,
  publish: boolean,
): Promise<{ count: number; error: string | null }> {
  if (!supabase) {
    return {
      count: 0,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('admin_publish_competition_results', {
    p_competition_id: competitionId,
    p_publish: publish,
  });

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: Number(data) || 0, error: null };
}
