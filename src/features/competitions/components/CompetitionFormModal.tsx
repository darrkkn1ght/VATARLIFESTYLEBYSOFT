import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { slugifyTitle } from '@/features/competitions/services/competitionService';
import type { CompetitionFormValues } from '@/features/competitions/types/competition.types';
import type {
  CompetitionRecord,
  CompetitionStatus,
} from '@/lib/supabase/database.types';

interface CompetitionFormModalProps {
  isOpen: boolean;
  editingCompetition: CompetitionRecord | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: CompetitionFormValues) => Promise<void>;
}

const STATUS_OPTIONS: readonly { value: CompetitionStatus; label: string }[] = [
  { value: 'draft', label: 'Draft (Hidden from members)' },
  { value: 'published', label: 'Published (Visible, registration not open yet)' },
  { value: 'registration_open', label: 'Registration Open' },
  { value: 'registration_closed', label: 'Registration Closed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function createInitialValues(comp: CompetitionRecord | null): CompetitionFormValues {
  if (!comp) {
    return {
      title: '',
      slug: '',
      description: '',
      competitionType: 'tournament',
      bannerImageUrl: '',
      registrationStart: '',
      registrationEnd: '',
      competitionStart: '',
      competitionEnd: '',
      participantLimit: '',
      status: 'draft',
      rules: '',
    };
  }

  return {
    title: comp.title,
    slug: comp.slug,
    description: comp.description,
    competitionType: comp.competition_type,
    bannerImageUrl: comp.banner_image_url ?? '',
    registrationStart: toDateTimeLocal(comp.registration_start),
    registrationEnd: toDateTimeLocal(comp.registration_end),
    competitionStart: toDateTimeLocal(comp.competition_start),
    competitionEnd: toDateTimeLocal(comp.competition_end),
    participantLimit: comp.participant_limit ? String(comp.participant_limit) : '',
    status: comp.status,
    rules: comp.rules ?? '',
  };
}

export function CompetitionFormModal({
  isOpen,
  editingCompetition,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CompetitionFormModalProps) {
  const [values, setValues] = useState<CompetitionFormValues>(() =>
    createInitialValues(editingCompetition),
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(editingCompetition));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(createInitialValues(editingCompetition));
    setSlugTouched(Boolean(editingCompetition));
    setLocalError(null);
  }, [isOpen, editingCompetition]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleTitleChange = (title: string) => {
    setValues((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugifyTitle(title),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (values.title.trim().length < 3) {
      setLocalError('Title must be at least 3 characters.');
      return;
    }

    const effectiveSlug = values.slug.trim().toLowerCase() || slugifyTitle(values.title);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug)) {
      setLocalError('Slug must contain only lowercase letters, numbers, and hyphens.');
      return;
    }

    if (values.description.trim().length < 10) {
      setLocalError('Description must be at least 10 characters.');
      return;
    }

    if (
      values.registrationStart &&
      values.registrationEnd &&
      new Date(values.registrationEnd) < new Date(values.registrationStart)
    ) {
      setLocalError('Registration end date must be after registration start date.');
      return;
    }

    if (
      values.competitionStart &&
      values.competitionEnd &&
      new Date(values.competitionEnd) < new Date(values.competitionStart)
    ) {
      setLocalError('Competition end date must be after competition start date.');
      return;
    }

    await onSubmit({ ...values, slug: effectiveSlug });
  };

  const displayError = localError ?? error;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comp-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-brand-gold/40 bg-brand-charcoal p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close competition form"
          className="absolute top-5 right-5 cursor-pointer p-1 text-brand-muted hover:text-brand-white disabled:pointer-events-none"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <p className="heading-eyebrow">
          {editingCompetition ? 'Edit Competition' : 'New Competition'}
        </p>
        <h2
          id="comp-form-title"
          className="heading-section mt-2 text-2xl text-brand-white sm:text-3xl"
        >
          {editingCompetition ? editingCompetition.title : 'Create Competition'}
        </h2>

        {displayError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 border border-red-400/40 bg-red-950/30 p-3.5 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{displayError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="comp-title"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Title
              </label>
              <input
                id="comp-title"
                type="text"
                required
                disabled={isSubmitting}
                value={values.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g., Lagos Life Invitational"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="comp-slug"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                URL Slug
              </label>
              <input
                id="comp-slug"
                type="text"
                required
                disabled={isSubmitting}
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setValues((prev) => ({ ...prev, slug: e.target.value }));
                }}
                placeholder="lagos-life-invitational"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-mono text-xs text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="comp-type"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Type
              </label>
              <input
                id="comp-type"
                type="text"
                required
                disabled={isSubmitting}
                value={values.competitionType}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, competitionType: e.target.value }))
                }
                placeholder="tournament"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="comp-limit"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Participant Limit
              </label>
              <input
                id="comp-limit"
                type="number"
                min={1}
                disabled={isSubmitting}
                value={values.participantLimit}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, participantLimit: e.target.value }))
                }
                placeholder="Unlimited"
                className="mt-2 w-full border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="comp-status"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Status
              </label>
              <select
                id="comp-status"
                disabled={isSubmitting}
                value={values.status}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    status: e.target.value as CompetitionStatus,
                  }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="comp-description"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Description
            </label>
            <textarea
              id="comp-description"
              rows={3}
              required
              disabled={isSubmitting}
              value={values.description}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Overview of the competition format and objectives..."
              className="mt-2 w-full resize-y border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="comp-reg-start"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Registration Opens
              </label>
              <input
                id="comp-reg-start"
                type="datetime-local"
                disabled={isSubmitting}
                value={values.registrationStart}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, registrationStart: e.target.value }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="comp-reg-end"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Registration Closes
              </label>
              <input
                id="comp-reg-end"
                type="datetime-local"
                disabled={isSubmitting}
                value={values.registrationEnd}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, registrationEnd: e.target.value }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="comp-start"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Competition Starts
              </label>
              <input
                id="comp-start"
                type="datetime-local"
                disabled={isSubmitting}
                value={values.competitionStart}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, competitionStart: e.target.value }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="comp-end"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Competition Ends
              </label>
              <input
                id="comp-end"
                type="datetime-local"
                disabled={isSubmitting}
                value={values.competitionEnd}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, competitionEnd: e.target.value }))
                }
                className="mt-2 w-full border hairline-border bg-brand-black px-3 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="comp-rules"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Rules &amp; Scoring Notes (Optional)
            </label>
            <textarea
              id="comp-rules"
              rows={4}
              disabled={isSubmitting}
              value={values.rules}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, rules: e.target.value }))
              }
              placeholder="Document match rules, eligibility requirements, and how points will be awarded..."
              className="mt-2 w-full resize-y border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
            />
          </div>

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
              ) : editingCompetition ? (
                'Save Changes'
              ) : (
                'Create Competition'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
