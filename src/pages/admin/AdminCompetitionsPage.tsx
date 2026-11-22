import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import { CompetitionFormModal } from '@/features/competitions/components/CompetitionFormModal';
import {
  CompetitionStatusBadge,
  RegistrationStatusBadge,
} from '@/features/competitions/components/CompetitionStatusBadge';
import {
  createCompetition,
  fetchAdminCompetitions,
  fetchCompetitionParticipantsAndResults,
  manageParticipantRegistration,
  publishCompetitionResults,
  updateCompetition,
  updateCompetitionStatus,
  upsertCompetitionResult,
} from '@/features/competitions/services/competitionService';
import type {
  CompetitionFormValues,
  CompetitionParticipantView,
  CompetitionWithMeta,
} from '@/features/competitions/types/competition.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type {
  CompetitionRecord,
  CompetitionRegistrationStatus,
  CompetitionStatus,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

const ADMIN_FILTERS = [
  'All',
  'Draft',
  'Published',
  'Open',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;
type AdminFilter = (typeof ADMIN_FILTERS)[number];

const FILTER_MAP: Record<Exclude<AdminFilter, 'All'>, CompetitionStatus> = {
  Draft: 'draft',
  Published: 'published',
  Open: 'registration_open',
  'In Progress': 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminCompetitionsPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<CompetitionWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<AdminFilter>('All');

  // Create / Edit competition modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] =
    useState<CompetitionRecord | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selected competition for Participants & Results management
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'participants' | 'results'>('participants');
  const [participants, setParticipants] = useState<CompetitionParticipantView[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Consequential status change confirmation
  const [statusConfirm, setStatusConfirm] = useState<{
    competition: CompetitionRecord;
    nextStatus: CompetitionStatus;
    label: string;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Participant moderation modal
  const [moderatingParticipant, setModeratingParticipant] = useState<{
    view: CompetitionParticipantView;
    nextStatus: CompetitionRegistrationStatus;
  } | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [isModerating, setIsModerating] = useState(false);

  // Result entry modal
  const [editingResultFor, setEditingResultFor] =
    useState<CompetitionParticipantView | null>(null);
  const [resultPlacement, setResultPlacement] = useState('1');
  const [resultPoints, setResultPoints] = useState('0');
  const [resultNote, setResultNote] = useState('');
  const [resultPublished, setResultPublished] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Bulk publish confirmation
  const [publishConfirm, setPublishConfirm] = useState<{
    competition: CompetitionRecord;
    publish: boolean;
  } | null>(null);
  const [isPublishingResults, setIsPublishingResults] = useState(false);

  const loadCompetitions = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const res = await fetchAdminCompetitions();
    if (res.error) setError(res.error);
    else setItems(res.items);

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  const loadParticipants = useCallback(async (compId: string) => {
    setIsLoadingParticipants(true);
    const res = await fetchCompetitionParticipantsAndResults(compId);
    if (res.error) setError(res.error);
    else setParticipants(res.participants);
    setIsLoadingParticipants(false);
  }, []);

  useEffect(() => {
    void loadCompetitions(true);
  }, [loadCompetitions]);

  useEffect(() => {
    if (selectedCompId) {
      void loadParticipants(selectedCompId);
    } else {
      setParticipants([]);
    }
  }, [selectedCompId, loadParticipants]);

  const selectedComp = useMemo(
    () => items.find((i) => i.competition.id === selectedCompId)?.competition ?? null,
    [items, selectedCompId],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(({ competition }) => {
      if (selectedFilter !== 'All') {
        if (competition.status !== FILTER_MAP[selectedFilter]) return false;
      }
      if (!q) return true;
      return (
        competition.title.toLowerCase().includes(q) ||
        competition.slug.toLowerCase().includes(q) ||
        competition.competition_type.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, selectedFilter]);

  const handleSaveCompetition = async (values: CompetitionFormValues) => {
    if (!user) return;
    setIsSavingForm(true);
    setFormError(null);

    const res = editingCompetition
      ? await updateCompetition(editingCompetition.id, values)
      : await createCompetition(values, user.id);

    setIsSavingForm(false);

    if (res.error) {
      setFormError(res.error);
      return;
    }

    setFormOpen(false);
    setEditingCompetition(null);
    setFeedback(
      editingCompetition
        ? `Updated competition "${values.title}".`
        : `Created competition "${values.title}".`,
    );
    await loadCompetitions(false);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirm) return;
    setIsUpdatingStatus(true);
    const res = await updateCompetitionStatus(
      statusConfirm.competition.id,
      statusConfirm.nextStatus,
    );
    setIsUpdatingStatus(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setFeedback(
      `"${statusConfirm.competition.title}" moved to ${statusConfirm.nextStatus.replace('_', ' ').toUpperCase()}.`,
    );
    setStatusConfirm(null);
    await loadCompetitions(false);
  };

  const handleConfirmModeration = async (event: FormEvent) => {
    event.preventDefault();
    if (!moderatingParticipant || !selectedCompId) return;
    setModalError(null);
    setIsModerating(true);

    const res = await manageParticipantRegistration(
      moderatingParticipant.view.registration.id,
      moderatingParticipant.nextStatus,
      moderationReason,
    );

    setIsModerating(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    setModeratingParticipant(null);
    setModerationReason('');
    setFeedback('Participant registration status updated and audited.');
    await Promise.all([loadParticipants(selectedCompId), loadCompetitions(false)]);
  };

  const openResultModal = (view: CompetitionParticipantView) => {
    setModalError(null);
    setEditingResultFor(view);
    setResultPlacement(view.result ? String(view.result.placement) : '1');
    setResultPoints(view.result ? String(view.result.points_awarded) : '0');
    setResultNote(view.result?.result_note ?? '');
    setResultPublished(view.result?.is_published ?? false);
  };

  const handleSaveResult = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingResultFor || !selectedCompId) return;

    const placement = Number.parseInt(resultPlacement, 10);
    const points = Number.parseInt(resultPoints, 10);

    if (!Number.isFinite(placement) || placement < 1) {
      setModalError('Placement must be a whole number of 1 or higher.');
      return;
    }
    if (!Number.isFinite(points) || points < 0) {
      setModalError('Points must be 0 or higher.');
      return;
    }

    setModalError(null);
    setIsSavingResult(true);

    const res = await upsertCompetitionResult({
      competitionId: selectedCompId,
      userId: editingResultFor.registration.user_id,
      placement,
      pointsAwarded: points,
      resultNote,
      isPublished: resultPublished,
    });

    setIsSavingResult(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    setEditingResultFor(null);
    setFeedback('Competition result saved and recorded in the audit log.');
    await loadParticipants(selectedCompId);
  };

  const handleConfirmPublishAll = async () => {
    if (!publishConfirm) return;
    setIsPublishingResults(true);
    const res = await publishCompetitionResults(
      publishConfirm.competition.id,
      publishConfirm.publish,
    );
    setIsPublishingResults(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setFeedback(
      `${publishConfirm.publish ? 'Published' : 'Unpublished'} ${res.count} result record(s) for "${publishConfirm.competition.title}".`,
    );
    setPublishConfirm(null);
    if (selectedCompId) {
      await loadParticipants(selectedCompId);
    }
  };

  return (
    <div className="bg-brand-black">
      {/* Masthead */}
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
                Competition Management
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Create tournaments, control registration windows, moderate participants,
                and record audited competition results.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadCompetitions(false)}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingCompetition(null);
                  setFormError(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Competition
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-10 sm:py-14">
        {feedback && (
          <div
            role="status"
            className="mb-6 flex items-center justify-between gap-4 border border-brand-gold/45 bg-brand-charcoal p-4 text-xs text-brand-cream"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <p>{feedback}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="cursor-pointer font-heading text-[0.68rem] tracking-[0.18em] text-brand-muted uppercase hover:text-brand-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col gap-4 border-b hairline-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search title, slug, or type..."
              ariaLabel="Search competitions"
            />
          </div>
          <CategoryFilter
            categories={ADMIN_FILTERS}
            selected={selectedFilter}
            onSelect={setSelectedFilter}
            ariaLabel="Filter competitions by status"
          />
        </div>

        {/* Competitions List */}
        <div className="mt-8">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  className="h-24 animate-pulse border hairline-border bg-brand-charcoal/45"
                />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
              eyebrow="No Competitions"
              title="No Competitions Created Yet"
              description="Create your first draft or published competition to begin managing registrations and leaderboard points."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingCompetition(null);
                    setFormError(null);
                    setFormOpen(true);
                  }}
                >
                  Create Competition
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredItems.map(({ competition, registeredCount }) => {
                const isSelected = selectedCompId === competition.id;
                return (
                  <article
                    key={competition.id}
                    className={cn(
                      'border bg-brand-charcoal/60 p-6 transition-colors',
                      isSelected ? 'border-brand-gold/60' : 'hairline-border',
                    )}
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <CompetitionStatusBadge status={competition.status} />
                          <span className="font-body text-xs tracking-[0.18em] text-brand-muted uppercase">
                            {competition.competition_type}
                          </span>
                          <span className="font-mono text-xs text-brand-muted/80">
                            /{competition.slug}
                          </span>
                        </div>

                        <h2 className="heading-section mt-3 text-2xl text-brand-white">
                          {competition.title}
                        </h2>
                        <p className="mt-2 max-w-2xl font-body text-sm text-brand-muted">
                          {competition.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-brand-cream/85">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                            {registeredCount}
                            {competition.participant_limit
                              ? ` / ${competition.participant_limit} limit`
                              : ' registered'}
                          </span>
                          <span>Reg closes: {formatDate(competition.registration_end)}</span>
                          <span>Starts: {formatDate(competition.competition_start)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={isSelected ? 'primary' : 'subtle'}
                          size="sm"
                          onClick={() =>
                            setSelectedCompId(isSelected ? null : competition.id)
                          }
                        >
                          {isSelected ? 'Close Panel' : 'Participants & Results'}
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingCompetition(competition);
                            setFormError(null);
                            setFormOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>

                        {competition.status === 'draft' && (
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() =>
                              setStatusConfirm({
                                competition,
                                nextStatus: 'published',
                                label: 'Publish Competition',
                              })
                            }
                          >
                            Publish
                          </Button>
                        )}

                        {(competition.status === 'published' ||
                          competition.status === 'registration_closed') && (
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() =>
                              setStatusConfirm({
                                competition,
                                nextStatus: 'registration_open',
                                label: 'Open Registration',
                              })
                            }
                          >
                            Open Reg
                          </Button>
                        )}

                        {competition.status === 'registration_open' && (
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() =>
                              setStatusConfirm({
                                competition,
                                nextStatus: 'registration_closed',
                                label: 'Close Registration',
                              })
                            }
                          >
                            Close Reg
                          </Button>
                        )}

                        {(competition.status === 'registration_closed' ||
                          competition.status === 'in_progress') && (
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() =>
                              setStatusConfirm({
                                competition,
                                nextStatus: 'completed',
                                label: 'Mark Completed',
                              })
                            }
                          >
                            Complete
                          </Button>
                        )}

                        {competition.status !== 'cancelled' &&
                          competition.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setStatusConfirm({
                                  competition,
                                  nextStatus: 'cancelled',
                                  label: 'Cancel Competition',
                                })
                              }
                            >
                              Cancel
                            </Button>
                          )}
                      </div>
                    </div>

                    {/* Expanded Participants & Results Operations Panel */}
                    {isSelected && selectedComp && (
                      <div className="mt-6 border-t hairline-border pt-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveTab('participants')}
                              className={cn(
                                'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.18em] uppercase',
                                activeTab === 'participants'
                                  ? 'border-brand-gold bg-brand-gold text-brand-black'
                                  : 'hairline-border bg-brand-black text-brand-muted hover:text-brand-white',
                              )}
                            >
                              Participants ({participants.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('results')}
                              className={cn(
                                'cursor-pointer border px-4 py-2 font-heading text-xs tracking-[0.18em] uppercase',
                                activeTab === 'results'
                                  ? 'border-brand-gold bg-brand-gold text-brand-black'
                                  : 'hairline-border bg-brand-black text-brand-muted hover:text-brand-white',
                              )}
                            >
                              Results Management
                            </button>
                          </div>

                          {activeTab === 'results' && participants.length > 0 && (
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                  setPublishConfirm({
                                    competition: selectedComp,
                                    publish: true,
                                  })
                                }
                              >
                                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                Publish All Results
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setPublishConfirm({
                                    competition: selectedComp,
                                    publish: false,
                                  })
                                }
                              >
                                Unpublish
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="mt-5">
                          {isLoadingParticipants ? (
                            <div className="h-24 animate-pulse border hairline-border bg-brand-black/50" />
                          ) : participants.length === 0 ? (
                            <p className="border hairline-border bg-brand-black/50 p-5 font-body text-xs text-brand-muted">
                              No members have registered for this competition yet.
                            </p>
                          ) : activeTab === 'participants' ? (
                            <div className="overflow-x-auto border hairline-border bg-brand-black/60">
                              <table className="w-full border-collapse text-left">
                                <thead>
                                  <tr className="border-b hairline-border bg-brand-obsidian font-heading text-[0.7rem] tracking-[0.18em] text-brand-muted uppercase">
                                    <th className="px-4 py-3">Member</th>
                                    <th className="px-4 py-3">Lagos Life</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Reason</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-cream/10 text-xs">
                                  {participants.map((view) => (
                                    <tr key={view.registration.id}>
                                      <td className="px-4 py-3">
                                        <p className="font-heading text-sm text-brand-white uppercase">
                                          {view.profile?.full_name ?? 'Member'}
                                        </p>
                                        <p className="text-brand-gold">
                                          @{view.profile?.username ?? view.registration.user_id.slice(0, 8)}
                                        </p>
                                      </td>
                                      <td className="px-4 py-3 text-brand-cream/85">
                                        {view.profile?.lagos_life_username ?? '—'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <RegistrationStatusBadge
                                          status={view.registration.status}
                                        />
                                      </td>
                                      <td className="px-4 py-3 text-brand-muted">
                                        {view.registration.status_reason ?? '—'}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                          {view.registration.status === 'registered' ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setModalError(null);
                                                  setModerationReason('');
                                                  setModeratingParticipant({
                                                    view,
                                                    nextStatus: 'disqualified',
                                                  });
                                                }}
                                                className="cursor-pointer border border-red-400/40 px-2.5 py-1 font-heading text-[0.65rem] tracking-[0.14em] text-red-300 uppercase hover:border-red-400"
                                              >
                                                Disqualify
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setModalError(null);
                                                  setModerationReason('');
                                                  setModeratingParticipant({
                                                    view,
                                                    nextStatus: 'removed',
                                                  });
                                                }}
                                                className="cursor-pointer border hairline-border px-2.5 py-1 font-heading text-[0.65rem] tracking-[0.14em] text-brand-muted uppercase hover:border-amber-400 hover:text-amber-300"
                                              >
                                                Remove
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setModalError(null);
                                                setModerationReason('');
                                                setModeratingParticipant({
                                                  view,
                                                  nextStatus: 'registered',
                                                });
                                              }}
                                              className="cursor-pointer border border-brand-gold/40 px-2.5 py-1 font-heading text-[0.65rem] tracking-[0.14em] text-brand-gold uppercase"
                                            >
                                              Restore
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="overflow-x-auto border hairline-border bg-brand-black/60">
                              <table className="w-full border-collapse text-left">
                                <thead>
                                  <tr className="border-b hairline-border bg-brand-obsidian font-heading text-[0.7rem] tracking-[0.18em] text-brand-muted uppercase">
                                    <th className="px-4 py-3">Competitor</th>
                                    <th className="px-4 py-3">Placement</th>
                                    <th className="px-4 py-3">Points</th>
                                    <th className="px-4 py-3">Visibility</th>
                                    <th className="px-4 py-3">Note</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-cream/10 text-xs">
                                  {participants
                                    .filter((v) => v.registration.status === 'registered')
                                    .map((view) => (
                                      <tr key={view.registration.id}>
                                        <td className="px-4 py-3 font-heading text-sm text-brand-white uppercase">
                                          @{view.profile?.username ?? view.registration.user_id.slice(0, 8)}
                                        </td>
                                        <td className="px-4 py-3 font-heading text-sm text-brand-gold">
                                          {view.result ? `#${view.result.placement}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-brand-cream">
                                          {view.result
                                            ? view.result.points_awarded.toLocaleString()
                                            : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                          {view.result ? (
                                            <span
                                              className={
                                                view.result.is_published
                                                  ? 'text-emerald-300'
                                                  : 'text-brand-muted'
                                              }
                                            >
                                              {view.result.is_published
                                                ? 'Published'
                                                : 'Draft'}
                                            </span>
                                          ) : (
                                            <span className="text-brand-muted">
                                              Unrecorded
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-brand-muted">
                                          {view.result?.result_note ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() => openResultModal(view)}
                                            className="cursor-pointer border border-brand-gold/50 bg-brand-gold/10 px-3 py-1 font-heading text-[0.65rem] tracking-[0.16em] text-brand-gold uppercase hover:bg-brand-gold hover:text-brand-black"
                                          >
                                            {view.result ? 'Edit Result' : 'Record Result'}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </PageContainer>

      {/* Create / Edit Competition Modal */}
      <CompetitionFormModal
        isOpen={formOpen}
        editingCompetition={editingCompetition}
        isSubmitting={isSavingForm}
        error={formError}
        onClose={() => {
          if (!isSavingForm) {
            setFormOpen(false);
            setEditingCompetition(null);
          }
        }}
        onSubmit={handleSaveCompetition}
      />

      {/* Status Transition Confirmation Modal */}
      {statusConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <div className="flex items-center gap-2 text-brand-gold">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <p className="heading-eyebrow">Confirm Action</p>
            </div>
            <h2 className="heading-section mt-3 text-2xl text-brand-white">
              {statusConfirm.label}
            </h2>
            <p className="mt-3 font-body text-sm text-brand-muted">
              Update <span className="text-brand-cream">{statusConfirm.competition.title}</span>{' '}
              from <span className="uppercase">{statusConfirm.competition.status}</span> to{' '}
              <span className="text-brand-gold uppercase">{statusConfirm.nextStatus}</span>?
              This change will be recorded in the audit log.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={isUpdatingStatus}
                onClick={() => setStatusConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isUpdatingStatus}
                onClick={handleConfirmStatusChange}
              >
                {isUpdatingStatus ? 'Updating...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Participant Moderation Modal */}
      {moderatingParticipant && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => setModeratingParticipant(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-brand-gold">
              <Ban className="h-4 w-4" aria-hidden="true" />
              <p className="heading-eyebrow">Participant Action</p>
            </div>
            <h2 className="heading-section mt-3 text-2xl text-brand-white">
              Set Status: {moderatingParticipant.nextStatus}
            </h2>
            <p className="mt-2 font-body text-xs text-brand-muted">
              Member: @{moderatingParticipant.view.profile?.username ?? 'member'}
            </p>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleConfirmModeration} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="mod-reason"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Reason{' '}
                  {moderatingParticipant.nextStatus === 'disqualified' ||
                  moderatingParticipant.nextStatus === 'removed'
                    ? '(Required)'
                    : '(Optional)'}
                </label>
                <textarea
                  id="mod-reason"
                  rows={3}
                  required={
                    moderatingParticipant.nextStatus === 'disqualified' ||
                    moderatingParticipant.nextStatus === 'removed'
                  }
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  placeholder="Provide an auditable reason..."
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isModerating}
                  onClick={() => setModeratingParticipant(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isModerating}>
                  {isModerating ? 'Saving...' : 'Confirm'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record / Edit Result Modal */}
      {editingResultFor && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <button
              type="button"
              onClick={() => setEditingResultFor(null)}
              className="absolute top-4 right-4 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="heading-eyebrow">Official Result</p>
            <h2 className="heading-section mt-2 text-2xl text-brand-white">
              @{editingResultFor.profile?.username ?? 'Competitor'}
            </h2>

            {modalError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {modalError}
              </p>
            )}

            <form onSubmit={handleSaveResult} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="res-placement"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Placement
                  </label>
                  <input
                    id="res-placement"
                    type="number"
                    min={1}
                    required
                    value={resultPlacement}
                    onChange={(e) => setResultPlacement(e.target.value)}
                    className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="res-points"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Points Awarded
                  </label>
                  <input
                    id="res-points"
                    type="number"
                    min={0}
                    required
                    value={resultPoints}
                    onChange={(e) => setResultPoints(e.target.value)}
                    className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="res-note"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Result Note (Optional)
                </label>
                <textarea
                  id="res-note"
                  rows={2}
                  value={resultNote}
                  onChange={(e) => setResultNote(e.target.value)}
                  className="mt-2 w-full border hairline-border bg-brand-black p-3 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 font-body text-xs text-brand-cream">
                <input
                  type="checkbox"
                  checked={resultPublished}
                  onChange={(e) => setResultPublished(e.target.checked)}
                  className="accent-brand-gold"
                />
                Publish immediately to member leaderboard
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSavingResult}
                  onClick={() => setEditingResultFor(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingResult}>
                  {isSavingResult ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Save Result'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Publish Confirmation Modal */}
      {publishConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <p className="heading-eyebrow">Confirm Publication</p>
            <h2 className="heading-section mt-3 text-2xl text-brand-white">
              {publishConfirm.publish ? 'Publish All Results?' : 'Unpublish Results?'}
            </h2>
            <p className="mt-3 font-body text-sm text-brand-muted">
              {publishConfirm.publish
                ? 'Published results immediately update the member leaderboard and derived achievements.'
                : 'Unpublished results will be hidden from the member leaderboard until re-published.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={isPublishingResults}
                onClick={() => setPublishConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isPublishingResults}
                onClick={handleConfirmPublishAll}
              >
                {isPublishingResults ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
