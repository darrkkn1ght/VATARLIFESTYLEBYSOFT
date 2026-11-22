import type { CompetitionResultRecord } from '@/lib/supabase/database.types';

export interface DerivedAchievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progressLabel: string;
}

export function deriveAchievementsFromResults(
  publishedResults: readonly CompetitionResultRecord[],
): DerivedAchievement[] {
  const completedCount = publishedResults.length;
  const winsCount = publishedResults.filter((r) => r.placement === 1).length;
  const podiumsCount = publishedResults.filter((r) => r.placement <= 3).length;

  return [
    {
      id: 'first-competition',
      title: 'First Competition Completed',
      description:
        'Earned upon recording your first published result in an official VATAR competition.',
      earned: completedCount >= 1,
      progressLabel: `${Math.min(completedCount, 1)} / 1 completed`,
    },
    {
      id: 'podium-finisher',
      title: 'Podium Standard',
      description:
        'Awarded for achieving a verified top-three placement in a published competition.',
      earned: podiumsCount >= 1,
      progressLabel: `${podiumsCount} podium finish${podiumsCount === 1 ? '' : 'es'}`,
    },
    {
      id: 'champion',
      title: 'First-Place Finish',
      description:
        'Reserved for members who secure an official 1st-place finish in a VATAR competition.',
      earned: winsCount >= 1,
      progressLabel: `${winsCount} win${winsCount === 1 ? '' : 's'}`,
    },
    {
      id: 'veteran-competitor',
      title: 'Multiple Competitions Completed',
      description:
        'Recognizes sustained participation across three or more published VATAR competitions.',
      earned: completedCount >= 3,
      progressLabel: `${Math.min(completedCount, 3)} / 3 completed`,
    },
  ];
}
