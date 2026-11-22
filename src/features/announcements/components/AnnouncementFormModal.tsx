import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { slugifyAnnouncementTitle } from '@/features/announcements/services/announcementService';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
  type AnnouncementFormValues,
} from '@/features/announcements/types/announcement.types';
import type {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementRecord,
  AnnouncementStatus,
} from '@/lib/supabase/database.types';

interface AnnouncementFormModalProps {
  isOpen: boolean;
  editing: AnnouncementRecord | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: AnnouncementFormValues) => Promise<void>;
}

const CATEGORIES: readonly AnnouncementCategory[] = [
  'general',
  'competitions',
  'marketplace',
  'important',
];

const PRIORITIES: readonly AnnouncementPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

function createInitial(editing: AnnouncementRecord | null): AnnouncementFormValues {
  if (!editing) {
    return {
      title: '',
      slug: '',
      content: '',
      category: 'general',
      priority: 'normal',
      isPinned: false,
      status: 'draft',
    };
  }
  return {
    title: editing.title,
    slug: editing.slug,
    content: editing.content,
    category: editing.category,
    priority: editing.priority,
    isPinned: editing.is_pinned,
    status: editing.status,
  };
}

export function AnnouncementFormModal({
  isOpen,
  editing,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AnnouncementFormModalProps) {
  const [values, setValues] = useState<AnnouncementFormValues>(() =>
    createInitial(editing),
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(editing));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(createInitial(editing));
    setSlugTouched(Boolean(editing));
    setLocalError(null);
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const handleTitleChange = (title: string) => {
    setValues((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugifyAnnouncementTitle(title),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (values.title.trim().length < 3) {
      setLocalError('Title must be at least 3 characters.');
      return;
    }

    const effectiveSlug =
      values.slug.trim().toLowerCase() || slugifyAnnouncementTitle(values.title);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug)) {
      setLocalError('Slug must use lowercase letters, numbers, and hyphens only.');
      return;
    }

    if (values.content.trim().length < 10) {
      setLocalError('Announcement content must be at least 10 characters.');
      return;
    }

    await onSubmit({ ...values, slug: effectiveSlug });
  };

  const displayError = localError ?? error;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ann-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close announcement modal"
          className="absolute top-5 right-5 cursor-pointer text-brand-muted hover:text-brand-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <p className="heading-eyebrow">
          {editing ? 'Edit Announcement' : 'New Announcement'}
        </p>
        <h2
          id="ann-modal-title"
          className="heading-section mt-2 text-2xl text-brand-white"
        >
          {editing ? editing.title : 'Compose Community Bulletin'}
        </h2>

        {displayError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 border border-red-400/40 bg-red-950/30 p-3.5 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{displayError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ann-title"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Title
              </label>
              <input
                id="ann-title"
                type="text"
                required
                disabled={isSubmitting}
                value={values.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Bulletin headline"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="ann-slug"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Slug
              </label>
              <input
                id="ann-slug"
                type="text"
                required
                disabled={isSubmitting}
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setValues((prev) => ({ ...prev, slug: e.target.value }));
                }}
                placeholder="bulletin-headline"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="ann-category"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Category
              </label>
              <select
                id="ann-category"
                disabled={isSubmitting}
                value={values.category}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    category: e.target.value as AnnouncementCategory,
                  }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ANNOUNCEMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ann-priority"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Priority
              </label>
              <select
                id="ann-priority"
                disabled={isSubmitting}
                value={values.priority}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    priority: e.target.value as AnnouncementPriority,
                  }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {ANNOUNCEMENT_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ann-status"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Status
              </label>
              <select
                id="ann-status"
                disabled={isSubmitting}
                value={values.status}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    status: e.target.value as AnnouncementStatus,
                  }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="ann-content"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Content
            </label>
            <textarea
              id="ann-content"
              rows={6}
              required
              disabled={isSubmitting}
              value={values.content}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="Write the official announcement message for members..."
              className="mt-2 w-full resize-y border hairline-border bg-brand-black p-3.5 text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2.5 font-body text-xs text-brand-cream">
            <input
              type="checkbox"
              disabled={isSubmitting}
              checked={values.isPinned}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, isPinned: e.target.checked }))
              }
              className="accent-brand-gold"
            />
            Pin this announcement to the top of the member feed
          </label>

          <div className="flex flex-col-reverse gap-3 border-t hairline-border pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : editing ? (
                'Save Changes'
              ) : (
                'Create Announcement'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
