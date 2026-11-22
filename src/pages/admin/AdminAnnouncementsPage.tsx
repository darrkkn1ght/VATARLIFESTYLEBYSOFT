import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Bell,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import {
  AnnouncementPriorityBadge,
  AnnouncementStatusBadge,
  PinnedBadge,
} from '@/features/announcements/components/AnnouncementBadges';
import { AnnouncementFormModal } from '@/features/announcements/components/AnnouncementFormModal';
import {
  createAnnouncement,
  fetchAdminAnnouncements,
  updateAnnouncement,
  updateAnnouncementStatus,
} from '@/features/announcements/services/announcementService';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  type AdminAnnouncementView,
  type AnnouncementFormValues,
} from '@/features/announcements/types/announcement.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type {
  AnnouncementRecord,
  AnnouncementStatus,
} from '@/lib/supabase/database.types';

const STATUS_FILTERS = ['All', 'Draft', 'Published', 'Archived'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const FILTER_MAP: Record<Exclude<StatusFilter, 'All'>, AnnouncementStatus> = {
  Draft: 'draft',
  Published: 'published',
  Archived: 'archived',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AdminAnnouncementView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // Create / Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm status transition
  const [statusConfirm, setStatusConfirm] = useState<{
    announcement: AnnouncementRecord;
    nextStatus: AnnouncementStatus;
    label: string;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadAnnouncements = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const res = await fetchAdminAnnouncements();
    if (res.error) setError(res.error);
    else setItems(res.items);

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAnnouncements(true);
  }, [loadAnnouncements]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(({ announcement }) => {
      if (statusFilter !== 'All' && announcement.status !== FILTER_MAP[statusFilter]) {
        return false;
      }
      if (!q) return true;
      return (
        announcement.title.toLowerCase().includes(q) ||
        announcement.content.toLowerCase().includes(q) ||
        announcement.category.toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, searchQuery]);

  const handleSaveForm = async (values: AnnouncementFormValues) => {
    if (!user) return;
    setIsSaving(true);
    setFormError(null);

    const res = editing
      ? await updateAnnouncement(editing.id, values)
      : await createAnnouncement(values, user.id);

    setIsSaving(false);

    if (res.error) {
      setFormError(res.error);
      return;
    }

    setFormOpen(false);
    setEditing(null);
    setFeedback(
      editing
        ? `Updated announcement "${values.title}" and logged audit entry.`
        : `Created announcement "${values.title}" and logged audit entry.`,
    );
    await loadAnnouncements(false);
  };

  const handleConfirmStatus = async () => {
    if (!statusConfirm) return;
    setIsUpdatingStatus(true);
    const res = await updateAnnouncementStatus(
      statusConfirm.announcement.id,
      statusConfirm.nextStatus,
    );
    setIsUpdatingStatus(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setFeedback(
      `"${statusConfirm.announcement.title}" is now ${statusConfirm.nextStatus.toUpperCase()}.`,
    );
    setStatusConfirm(null);
    await loadAnnouncements(false);
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
                Announcements Management
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Compose, pin, publish, unpublish, and archive official VATAR LIFESTYLE
                BY SOFT bulletins. All administrative changes are logged to audit_logs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadAnnouncements(false)}
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
                  setEditing(null);
                  setFormError(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Announcement
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-8 py-10 sm:py-14">
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

        <div className="flex flex-col gap-4 border-b hairline-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search announcements..."
              ariaLabel="Search announcements"
            />
          </div>
          <CategoryFilter
            categories={STATUS_FILTERS}
            selected={statusFilter}
            onSelect={setStatusFilter}
            ariaLabel="Filter announcements by status"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className="h-28 animate-pulse border hairline-border bg-brand-charcoal/45"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-4 w-4" aria-hidden="true" />}
            eyebrow="No Announcements"
            title="No Announcements Created Yet"
            description="Create a draft or published announcement to broadcast official updates to approved members."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormError(null);
                  setFormOpen(true);
                }}
              >
                Create Announcement
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredItems.map(({ announcement, authorUsername }) => (
              <article
                key={announcement.id}
                className="flex flex-col justify-between gap-4 border hairline-border bg-brand-charcoal/65 p-6 lg:flex-row lg:items-start"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AnnouncementStatusBadge status={announcement.status} />
                    <AnnouncementPriorityBadge priority={announcement.priority} />
                    {announcement.is_pinned && <PinnedBadge />}
                    <span className="font-body text-xs text-brand-gold">
                      {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]}
                    </span>
                  </div>

                  <h2 className="heading-section mt-3 text-2xl text-brand-white">
                    {announcement.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-2xl font-body text-sm text-brand-muted">
                    {announcement.content}
                  </p>
                  <p className="mt-3 font-body text-xs text-brand-muted">
                    Author: <span className="text-brand-cream">@{authorUsername}</span>
                    {' • '}Published: {formatDateTime(announcement.published_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing(announcement);
                      setFormError(null);
                      setFormOpen(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </Button>

                  {announcement.status !== 'published' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        setStatusConfirm({
                          announcement,
                          nextStatus: 'published',
                          label: 'Publish Announcement',
                        })
                      }
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      Publish
                    </Button>
                  )}

                  {announcement.status === 'published' && (
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() =>
                        setStatusConfirm({
                          announcement,
                          nextStatus: 'draft',
                          label: 'Unpublish to Draft',
                        })
                      }
                    >
                      Unpublish
                    </Button>
                  )}

                  {announcement.status !== 'archived' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setStatusConfirm({
                          announcement,
                          nextStatus: 'archived',
                          label: 'Archive Announcement',
                        })
                      }
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      Archive
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </PageContainer>

      <AnnouncementFormModal
        isOpen={formOpen}
        editing={editing}
        isSubmitting={isSaving}
        error={formError}
        onClose={() => {
          if (!isSaving) {
            setFormOpen(false);
            setEditing(null);
          }
        }}
        onSubmit={handleSaveForm}
      />

      {statusConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-7">
            <div className="flex items-center gap-2 text-brand-gold">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <p className="heading-eyebrow">Confirm Status Change</p>
            </div>
            <h2 className="heading-section mt-3 text-2xl text-brand-white">
              {statusConfirm.label}
            </h2>
            <p className="mt-3 font-body text-sm text-brand-muted">
              Change <span className="text-brand-cream">{statusConfirm.announcement.title}</span>{' '}
              to <span className="text-brand-gold uppercase">{statusConfirm.nextStatus}</span>?
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
                onClick={handleConfirmStatus}
              >
                {isUpdatingStatus ? 'Updating...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
