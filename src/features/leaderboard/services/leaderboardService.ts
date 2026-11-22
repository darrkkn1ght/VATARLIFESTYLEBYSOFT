import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type {
  CompetitionRecord,
  LeaderboardRankRow,
  ProfileRecord,
} from '@/lib/supabase/database.types';
import type { AdminResultBreakdownRow } from '@/features/competitions/types/competition.types';

export async function fetchLeaderboardRankings(
  competitionId?: string | null,
): Promise<{
  rankings: LeaderboardRankRow[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      rankings: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_competition_id: competitionId ?? null,
  });

  if (error) {
    return { rankings: [], error: error.message };
  }

  const rankings: LeaderboardRankRow[] = (data ?? []).map((row) => ({
    rank_position: Number(row.rank_position),
    user_id: row.user_id,
    username: row.username,
    total_points: Number(row.total_points),
    competitions_played: Number(row.competitions_played),
    wins: Number(row.wins),
    podiums: Number(row.podiums),
    best_placement: Number(row.best_placement),
  }));

  return { rankings, error: null };
}

export async function fetchAdminLeaderboardBreakdown(
  competitionId?: string | null,
): Promise<{
  competitions: CompetitionRecord[];
  breakdown: AdminResultBreakdownRow[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      competitions: [],
      breakdown: [],
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  let resultsQuery = supabase
    .from('competition_results')
    .select('*')
    .order('created_at', { ascending: false });

  if (competitionId) {
    resultsQuery = resultsQuery.eq('competition_id', competitionId);
  }

  const [compsRes, profilesRes, resultsRes] = await Promise.all([
    supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*'),
    resultsQuery,
  ]);

  if (compsRes.error) {
    return { competitions: [], breakdown: [], error: compsRes.error.message };
  }
  if (profilesRes.error) {
    return { competitions: [], breakdown: [], error: profilesRes.error.message };
  }
  if (resultsRes.error) {
    return { competitions: [], breakdown: [], error: resultsRes.error.message };
  }

  const compMap = new Map<string, CompetitionRecord>();
  for (const c of compsRes.data ?? []) {
    compMap.set(c.id, c);
  }

  const profileMap = new Map<string, ProfileRecord>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, p);
  }

  const breakdown: AdminResultBreakdownRow[] = (resultsRes.data ?? []).map(
    (result) => {
      const profile = profileMap.get(result.user_id);
      const comp = compMap.get(result.competition_id);
      return {
        result,
        competitionTitle: comp?.title ?? 'Competition',
        username: profile?.username ?? result.user_id.slice(0, 8),
        fullName: profile?.full_name ?? 'Member',
      };
    },
  );

  return {
    competitions: compsRes.data ?? [],
    breakdown,
    error: null,
  };
}
