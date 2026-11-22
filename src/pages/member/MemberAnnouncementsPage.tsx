import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  AnnouncementPriorityBadge,
  PinnedBadge,
} from '@/features/announcements/components/AnnouncementBadges';
import {
  fetchMemberAnnouncements,
  markAnnouncementAsRead,
} from '@/features/announcements/services/announcementService';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '@/features/announcements/types/announcement.types';
import type {
  AnnouncementCategory,
  MemberAnnouncementRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

const CATEGORY_FILTERS = [
  'All',
  'General',
  'Competitions',
  'Marketplace',
  'Important',
] as const;
type CategoryFilterLabel = (typeof CATEGORY_FILTERS)[number];

const LABEL_TO_CODE: Record<
  Exclude<CategoryFilterLabel, 'All'>,
  AnnouncementCategory
> = {
  General: 'general',
  Competitions: 'competitions',
  Marketplace: 'marketplace',
  Important: 'important',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MemberAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<MemberAnnouncementRow[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilterLabel>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<MemberAnnouncementRow | null>(null);

  const loadAnnouncements = useCallback(async (fullLoad: boolean) => {
    if (fullLoad) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const res = await fetchMemberAnnouncements(null);
    if (res.error) setError(res.error);
    else setAnnouncements(res.announcements);

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAnnouncements(true);
  }, [loadAnnouncements]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return announcements;
    const code = LABEL_TO_CODE[selectedCategory];
    return announcements.filter((a) => a.category === code);
  }, [announcements, selectedCategory]);

  const unreadCount = useMemo(
    () => announcements.filter((a) => !a.is_read).length,
    [announcements],
  );

  const handleOpenAnnouncement = async (item: MemberAnnouncementRow) => {
    setActiveAnnouncement(item);

    if (!item.is_read) {
      const res = await markAnnouncementAsRead(item.id);
      if (res.error) {
        setError(`Could not mark announcement as read: ${res.error}`);
        return;
      }

      const nowIso = new Date().toISOString();
      setAnnouncements((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, is_read: true, read_at: nowIso } : row,
        ),
      );
      setActiveAnnouncement((prev) =>
        prev && prev.id === item.id
          ? { ...prev, is_read: true, read_at: nowIso }
          : prev,
      );
      window.dispatchEvent(new CustomEvent('vatar:announcements-updated'));
    }
  };

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Official Bulletins</p>
                {unreadCount > 0 && (
                  <span className="border border-brand-gold bg-brand-gold/15 px-2.5 py-0.5 font-heading text-[0.66rem] tracking-[0.18em] text-brand-gold uppercase">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Announcements
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Official dispatches from VATAR LIFESTYLE BY SOFT leadership. Open any
                bulletin to read the full message and mark it as read.
              </p>
            </div>

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
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-8 py-10 sm:py-14">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <div className="border-b hairline-border pb-6">
          <CategoryFilter
            categories={CATEGORY_FILTERS}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            ariaLabel="Filter announcements by category"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="h-28 animate-pulse border hairline-border bg-brand-charcoal/45"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-4 w-4" aria-hidden="true" />}
            eyebrow="All Clear"
            title={
              selectedCategory === 'All'
                ? 'No Published Announcements Yet'
                : `No ${selectedCategory} Announcements Yet`
            }
            description="Official community announcements will appear here as soon as administrators publish them."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <article
                key={item.id}
                onClick={() => void handleOpenAnnouncement(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleOpenAnnouncement(item);
                  }
                }}
                className={cn(
                  'cursor-pointer border p-6 transition-colors hover:border-brand-gold/60',
                  item.is_pinned
                    ? 'border-brand-gold/50 bg-brand-charcoal/85'
                    : !item.is_read
                      ? 'border-brand-gold/30 bg-brand-charcoal/70'
                      : 'hairline-border bg-brand-charcoal/45',
                )}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!item.is_read && (
                        <span
                          aria-label="Unread"
                          className="h-2 w-2 rounded-full bg-brand-gold"
                        />
                      )}
                      {item.is_pinned && <PinnedBadge />}
                      <AnnouncementPriorityBadge priority={item.priority} />
                      <span className="font-body text-xs tracking-[0.18em] text-brand-gold uppercase">
                        {ANNOUNCEMENT_CATEGORY_LABELS[item.category]}
                      </span>
                    </div>

                    <h2 className="heading-section mt-3 text-2xl text-brand-white">
                      {item.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 max-w-3xl font-body text-sm text-brand-muted">
                      {item.content}
                    </p>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="inline-flex items-center gap-1.5 font-body text-xs text-brand-cream/85">
                      <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                      {formatDate(item.published_at ?? item.created_at)}
                    </p>
                    <p className="mt-1.5 font-body text-xs text-brand-muted">
                      {item.is_read ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300/80">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Read
                        </span>
                      ) : (
                        <span className="text-brand-gold">Unread — Click to read</span>
                      )}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </PageContainer>

      {/* Announcement Reader Modal */}
      {activeAnnouncement && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reader-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-brand-gold/45 bg-brand-charcoal p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setActiveAnnouncement(null)}
              aria-label="Close announcement"
              className="absolute top-5 right-5 cursor-pointer text-brand-muted hover:text-brand-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {activeAnnouncement.is_pinned && <PinnedBadge />}
              <AnnouncementPriorityBadge priority={activeAnnouncement.priority} />
              <span className="font-body text-xs tracking-[0.18em] text-brand-gold uppercase">
                {ANNOUNCEMENT_CATEGORY_LABELS[activeAnnouncement.category]}
              </span>
            </div>

            <h2
              id="reader-title"
              className="heading-display mt-4 text-3xl text-brand-white"
            >
              {activeAnnouncement.title}
            </h2>

            <p className="mt-2 font-body text-xs text-brand-muted">
              Published {formatDate(activeAnnouncement.published_at ?? activeAnnouncement.created_at)}{' '}
              by <span className="text-brand-cream">@{activeAnnouncement.author_username}</span>
            </p>

            <div className="mt-6 border-t hairline-border pt-6">
              <p className="whitespace-pre-line font-body text-sm leading-relaxed text-brand-cream/90">
                {activeAnnouncement.content}
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between border-t hairline-border pt-5">
              <span className="inline-flex items-center gap-1.5 font-body text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Marked as read
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveAnnouncement(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
