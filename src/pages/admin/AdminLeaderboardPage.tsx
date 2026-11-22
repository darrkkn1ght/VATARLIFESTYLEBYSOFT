import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Edit3,
  Loader2,
  RefreshCw,
  Trophy,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { upsertCompetitionResult } from '@/features/competitions/services/competitionService';
import type { AdminResultBreakdownRow } from '@/features/competitions/types/competition.types';
import {
  fetchAdminLeaderboardBreakdown,
  fetchLeaderboardRankings,
} from '@/features/leaderboard/services/leaderboardService';
import type {
  CompetitionRecord,
  LeaderboardRankRow,
} from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

export function AdminLeaderboardPage() {
  const [rankings, setRankings] = useState<LeaderboardRankRow[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [breakdown, setBreakdown] = useState<AdminResultBreakdownRow[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Result correction modal
  const [editingRow, setEditingRow] = useState<AdminResultBreakdownRow | null>(null);
  const [editPlacement, setEditPlacement] = useState('1');
  const [editPoints, setEditPoints] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editPublished, setEditPublished] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async (compId: string, fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const [rankRes, breakdownRes] = await Promise.all([
      fetchLeaderboardRankings(compId || null),
      fetchAdminLeaderboardBreakdown(compId || null),
    ]);

    if (rankRes.error) setError(rankRes.error);
    else setRankings(rankRes.rankings);

    if (breakdownRes.error) {
      setError(breakdownRes.error);
    } else {
      setCompetitions(breakdownRes.competitions);
      setBreakdown(breakdownRes.breakdown);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData(selectedCompetitionId, true);
  }, [selectedCompetitionId, loadData]);

  const openCorrectionModal = (row: AdminResultBreakdownRow) => {
    setModalError(null);
    setEditingRow(row);
    setEditPlacement(String(row.result.placement));
    setEditPoints(String(row.result.points_awarded));
    setEditNote(row.result.result_note ?? '');
    setEditPublished(row.result.is_published);
  };

  const handleSaveCorrection = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingRow) return;

    const placement = Number.parseInt(editPlacement, 10);
    const points = Number.parseInt(editPoints, 10);
    if (!Number.isFinite(placement) || placement < 1) {
      setModalError('Placement must be 1 or greater.');
      return;
    }
    if (!Number.isFinite(points) || points < 0) {
      setModalError('Points cannot be negative.');
      return;
    }

    setModalError(null);
    setIsSaving(true);

    const res = await upsertCompetitionResult({
      competitionId: editingRow.result.competition_id,
      userId: editingRow.result.user_id,
      placement,
      pointsAwarded: points,
      resultNote: editNote,
      isPublished: editPublished,
    });

    setIsSaving(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    setFeedback(
      `Corrected result for @${editingRow.username} and logged an audit entry.`,
    );
    setEditingRow(null);
    await loadData(selectedCompetitionId, false);
  };

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Admin Control Center</p>
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Leaderboard &amp; Results Audit
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Inspect aggregated rankings, verify the underlying competition results
                contributing to every member's score, and apply audited corrections.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter by competition"
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="border hairline-border bg-brand-charcoal px-3.5 py-2 font-body text-xs text-brand-cream focus:border-brand-gold focus:outline-none"
              >
                <option value="">All Competitions</option>
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.title}
                  </option>
                ))}
              </select>

              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadData(selectedCompetitionId, false)}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>

              <Button to={ROUTES.adminCompetitions} variant="primary" size="sm">
                Manage Competitions
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-14 py-10 sm:py-14">
        {feedback && (
          <div
            role="status"
            className="flex items-center justify-between gap-4 border border-brand-gold/45 bg-brand-charcoal p-4 text-xs text-brand-cream"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <p>{feedback}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="cursor-pointer font-heading text-[0.68rem] tracking-[0.18em] text-brand-muted uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* Aggregated Published Rankings */}
        <section>
          <SectionHeading
            index="01"
            eyebrow="Live Standings"
            title="Aggregated Published Leaderboard"
            description="Only published results from non-cancelled competitions contribute to official standings."
          />

          <div className="mt-6">
            {isLoading ? (
              <div className="h-44 animate-pulse border hairline-border bg-brand-charcoal/45" />
            ) : rankings.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                eyebrow="No Published Rankings"
                title="No Published Leaderboard Standings Yet"
                description="Record and publish competition results under Manage Competitions to populate standings."
                compact
              />
            ) : (
              <div className="overflow-x-auto border hairline-border bg-brand-charcoal/50">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b hairline-border bg-brand-obsidian font-heading text-xs tracking-[0.2em] text-brand-muted uppercase">
                      <th className="px-5 py-3.5">Rank</th>
                      <th className="px-5 py-3.5">Username</th>
                      <th className="px-5 py-3.5 text-right">Points</th>
                      <th className="px-5 py-3.5 text-right">Played</th>
                      <th className="px-5 py-3.5 text-right">Wins</th>
                      <th className="px-5 py-3.5 text-right">Podiums</th>
                      <th className="px-5 py-3.5 text-right">Best</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/10">
                    {rankings.map((row) => (
                      <tr key={row.user_id}>
                        <td className="px-5 py-3.5 font-heading text-sm text-brand-gold">
                          #{row.rank_position}
                        </td>
                        <td className="px-5 py-3.5 font-heading text-sm text-brand-white uppercase">
                          <span className="inline-flex items-center gap-1.5">
                            {row.rank_position === 1 && (
                              <Crown className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                            )}
                            @{row.username}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-heading text-sm text-brand-gold">
                          {row.total_points.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-brand-cream">
                          {row.competitions_played}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-brand-cream">
                          {row.wins}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-brand-cream">
                          {row.podiums}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-brand-muted">
                          #{row.best_placement}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Underlying Result Records */}
        <section>
          <SectionHeading
            index="02"
            eyebrow="Audit Breakdown"
            title="Underlying Competition Results"
            description="Inspect all recorded results (published and draft) and issue audited corrections."
          />

          <div className="mt-6">
            {isLoading ? (
              <div className="h-44 animate-pulse border hairline-border bg-brand-charcoal/45" />
            ) : breakdown.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                eyebrow="No Result Records"
                title="No Competition Results Recorded"
                description="Recorded results from all competitions will appear here for administrative verification."
                compact
              />
            ) : (
              <div className="overflow-x-auto border hairline-border bg-brand-charcoal/50">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b hairline-border bg-brand-obsidian font-heading text-xs tracking-[0.2em] text-brand-muted uppercase">
                      <th className="px-5 py-3.5">Competition</th>
                      <th className="px-5 py-3.5">Member</th>
                      <th className="px-5 py-3.5">Place</th>
                      <th className="px-5 py-3.5 text-right">Points</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Note</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/10 text-xs">
                    {breakdown.map((row) => (
                      <tr key={row.result.id}>
                        <td className="px-5 py-3.5 font-heading text-sm text-brand-cream uppercase">
                          {row.competitionTitle}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-brand-white">@{row.username}</p>
                          <p className="text-brand-muted">{row.fullName}</p>
                        </td>
                        <td className="px-5 py-3.5 font-heading text-sm text-brand-gold">
                          #{row.result.placement}
                        </td>
                        <td className="px-5 py-3.5 text-right font-heading text-sm text-brand-white">
                          {row.result.points_awarded.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={
                              row.result.is_published
                                ? 'text-emerald-300'
                                : 'text-brand-muted'
                            }
                          >
                            {row.result.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-brand-muted">
                          {row.result.result_note ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => openCorrectionModal(row)}
                            className="inline-flex cursor-pointer items-center gap-1 border hairline-border bg-brand-black px-2.5 py-1 font-heading text-[0.65rem] tracking-[0.16em] text-brand-cream uppercase hover:border-brand-gold hover:text-brand-gold"
                          >
                            <Edit3 className="h-3 w-3" aria-hidden="true" />
                            Correct
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </PageContainer>

      {/* Correct Result Modal */}
      {editingRow && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => setEditingRow(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="heading-eyebrow">Audited Correction</p>
            <h2 className="heading-section mt-2 text-2xl text-brand-white">
              @{editingRow.username} — {editingRow.competitionTitle}
            </h2>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleSaveCorrection} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="corr-place"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Placement
                  </label>
                  <input
                    id="corr-place"
                    type="number"
                    min={1}
                    required
                    value={editPlacement}
                    onChange={(e) => setEditPlacement(e.target.value)}
                    className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="corr-points"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Points
                  </label>
                  <input
                    id="corr-points"
                    type="number"
                    min={0}
                    required
                    value={editPoints}
                    onChange={(e) => setEditPoints(e.target.value)}
                    className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="corr-note"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Result Note
                </label>
                <textarea
                  id="corr-note"
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 font-body text-xs text-brand-cream">
                <input
                  type="checkbox"
                  checked={editPublished}
                  onChange={(e) => setEditPublished(e.target.checked)}
                  className="accent-brand-gold"
                />
                Published on leaderboard
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setEditingRow(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Save Correction'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
