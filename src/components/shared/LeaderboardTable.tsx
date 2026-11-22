import { Award, Trophy } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';
import type { LeaderboardEntry } from '@/types/content';

interface LeaderboardTableProps {
  entries: readonly LeaderboardEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  showCta?: boolean;
}

function getRankAccent(position: number): string {
  if (position === 1) return 'border-brand-gold bg-brand-gold/15 text-brand-gold';
  if (position === 2) return 'border-brand-cream/45 bg-brand-cream/10 text-brand-cream';
  if (position === 3) return 'border-brand-gold-deep bg-brand-gold-deep/20 text-brand-gold-hover';
  return 'border-brand-cream/15 bg-brand-black text-brand-muted';
}

export function LeaderboardTable({
  entries,
  emptyTitle = 'Official Standings Have Not Yet Opened',
  emptyDescription = 'Verified rankings, competitive points, and member achievements will appear here once seasonal competitions are live and connected.',
  showCta = true,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="border hairline-border bg-brand-charcoal/40">
        <div
          aria-hidden="true"
          className="hidden grid-cols-12 border-b hairline-border bg-brand-obsidian px-6 py-4 font-heading text-xs tracking-[0.2em] text-brand-muted uppercase md:grid"
        >
          <span className="col-span-2">Position</span>
          <span className="col-span-5">Username</span>
          <span className="col-span-2 text-right">Points</span>
          <span className="col-span-3 text-right">Achievements</span>
        </div>

        <EmptyState
          icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
          eyebrow="Standings Pending"
          title={emptyTitle}
          description={emptyDescription}
          className="border-0 bg-transparent"
          action={
            showCta ? (
              <Button to={ROUTES.register} variant="secondary" size="sm">
                Register to Compete
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="border hairline-border bg-brand-charcoal/50">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b hairline-border bg-brand-obsidian font-heading text-xs tracking-[0.2em] text-brand-muted uppercase">
              <th scope="col" className="px-6 py-4 font-medium">
                Position
              </th>
              <th scope="col" className="px-6 py-4 font-medium">
                Username
              </th>
              <th scope="col" className="px-6 py-4 text-right font-medium">
                Points
              </th>
              <th scope="col" className="px-6 py-4 text-right font-medium">
                Achievements
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={`${entry.position}-${entry.username}`}
                className={cn(
                  'border-b hairline-border transition-colors last:border-b-0 hover:bg-brand-charcoal',
                  entry.position <= 3 && 'bg-brand-obsidian/60',
                )}
              >
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center border font-heading text-xs font-semibold',
                      getRankAccent(entry.position),
                    )}
                  >
                    #{entry.position}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="font-heading text-base tracking-[0.06em] text-brand-white uppercase">
                    {entry.username}
                  </p>
                  {entry.division && (
                    <p className="mt-0.5 font-body text-xs text-brand-muted">
                      {entry.division}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-heading text-base tracking-[0.06em] text-brand-gold">
                  {entry.points.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 font-body text-sm text-brand-cream">
                    <Award className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                    {entry.achievementsCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-brand-cream/10 md:hidden">
        {entries.map((entry) => (
          <div
            key={`${entry.position}-${entry.username}`}
            className="flex items-center justify-between gap-4 p-5"
          >
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center border font-heading text-xs font-semibold',
                  getRankAccent(entry.position),
                )}
              >
                #{entry.position}
              </span>
              <div>
                <p className="font-heading text-base tracking-[0.06em] text-brand-white uppercase">
                  {entry.username}
                </p>
                <p className="mt-0.5 font-body text-xs text-brand-muted">
                  {entry.achievementsCount} achievements
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-heading text-base tracking-[0.06em] text-brand-gold">
                {entry.points.toLocaleString()}
              </p>
              <p className="font-body text-[0.65rem] tracking-[0.18em] text-brand-muted uppercase">
                Points
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
