import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { updateMemberProfile } from '@/features/membership/services/memberProfileService';
import { cn } from '@/lib/utilities/cn';
import {
  validateProfileUpdate,
  type ProfileFormField,
} from '@/lib/validation/profile';

export function MemberProfilePage() {
  const { user, profile, refreshAccountData } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [lagosLifeUsername, setLagosLifeUsername] = useState(
    profile?.lagos_life_username ?? '',
  );
  const [bio, setBio] = useState(profile?.bio ?? '');

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ProfileFormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setUsername(profile.username);
    setLagosLifeUsername(profile.lagos_life_username);
    setBio(profile.bio ?? '');
  }, [profile]);

  const hasChanges =
    fullName.trim() !== (profile?.full_name ?? '') ||
    username.trim() !== (profile?.username ?? '') ||
    lagosLifeUsername.trim() !== (profile?.lagos_life_username ?? '') ||
    bio.trim() !== (profile?.bio ?? '');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setFormError(null);
    setSuccessMessage(null);

    const validation = validateProfileUpdate({
      fullName,
      username,
      lagosLifeUsername,
      bio,
    });

    setFieldErrors(validation.errors);
    if (!validation.isValid) return;

    setIsSaving(true);
    const result = await updateMemberProfile(user.id, {
      fullName,
      username,
      lagosLifeUsername,
      bio,
    });
    setIsSaving(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    await refreshAccountData();
    setSuccessMessage('Your profile changes have been saved.');
  };

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
            <p className="heading-eyebrow">Member Identity</p>
          </div>
          <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
            My Profile
          </h1>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
            Keep your public VATAR identity and Lagos Life username accurate. Account
            security credentials and membership status are managed separately.
          </p>
        </PageContainer>
      </section>

      <PageContainer className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Editable Profile Form */}
          <div className="lg:col-span-8">
            <div className="border hairline-border bg-brand-charcoal/70 p-6 sm:p-8">
              <p className="heading-eyebrow">Editable Fields</p>
              <h2 className="heading-section mt-2 text-2xl text-brand-white">
                Profile Details
              </h2>

              {formError && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-xs text-red-200"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
                    aria-hidden="true"
                  />
                  <p>{formError}</p>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="mt-6 flex items-start gap-3 border border-brand-gold/50 bg-brand-black p-4 text-xs text-brand-cream"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
                    aria-hidden="true"
                  />
                  <p>{successMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
                <div>
                  <label
                    htmlFor="profile-full-name"
                    className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                  >
                    Full Name
                  </label>
                  <input
                    id="profile-full-name"
                    type="text"
                    required
                    disabled={isSaving}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    className={cn(
                      'mt-2 w-full border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                      fieldErrors.fullName ? 'border-red-400/70' : 'hairline-border',
                    )}
                  />
                  {fieldErrors.fullName && (
                    <p role="alert" className="mt-1.5 font-body text-xs text-red-400">
                      {fieldErrors.fullName}
                    </p>
                  )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-username"
                      className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                    >
                      VATAR Username
                    </label>
                    <input
                      id="profile-username"
                      type="text"
                      required
                      disabled={isSaving}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      aria-invalid={Boolean(fieldErrors.username)}
                      className={cn(
                        'mt-2 w-full border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                        fieldErrors.username ? 'border-red-400/70' : 'hairline-border',
                      )}
                    />
                    {fieldErrors.username && (
                      <p role="alert" className="mt-1.5 font-body text-xs text-red-400">
                        {fieldErrors.username}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="profile-lagos-life"
                      className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                    >
                      Lagos Life Username
                    </label>
                    <input
                      id="profile-lagos-life"
                      type="text"
                      required
                      disabled={isSaving}
                      value={lagosLifeUsername}
                      onChange={(event) => setLagosLifeUsername(event.target.value)}
                      aria-invalid={Boolean(fieldErrors.lagosLifeUsername)}
                      className={cn(
                        'mt-2 w-full border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                        fieldErrors.lagosLifeUsername
                          ? 'border-red-400/70'
                          : 'hairline-border',
                      )}
                    />
                    {fieldErrors.lagosLifeUsername && (
                      <p role="alert" className="mt-1.5 font-body text-xs text-red-400">
                        {fieldErrors.lagosLifeUsername}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="profile-bio"
                      className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                    >
                      Bio (Optional)
                    </label>
                    <span className="font-body text-xs text-brand-muted">
                      {bio.trim().length}/300
                    </span>
                  </div>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    maxLength={300}
                    disabled={isSaving}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Share a brief note about your play style or community interests..."
                    aria-invalid={Boolean(fieldErrors.bio)}
                    className={cn(
                      'mt-2 w-full resize-y border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                      fieldErrors.bio ? 'border-red-400/70' : 'hairline-border',
                    )}
                  />
                  {fieldErrors.bio && (
                    <p role="alert" className="mt-1.5 font-body text-xs text-red-400">
                      {fieldErrors.bio}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start justify-between gap-4 border-t hairline-border pt-6 sm:flex-row sm:items-center">
                  <p className="font-body text-xs text-brand-muted">
                    Changes save directly to your verified profile record.
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isSaving || !hasChanges}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Read-Only Account Metadata & Safety */}
          <aside className="space-y-6 lg:col-span-4">
            <div className="border hairline-border bg-brand-charcoal/55 p-6">
              <p className="heading-eyebrow">Account Record</p>
              <h2 className="heading-section mt-2 text-xl text-brand-white">
                Protected Identifiers
              </h2>

              <dl className="mt-5 space-y-4 border-t hairline-border pt-4 text-xs">
                <div>
                  <dt className="tracking-[0.18em] text-brand-muted uppercase">
                    Email Address
                  </dt>
                  <dd className="mt-1 font-body text-sm text-brand-cream">
                    {user?.email ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.18em] text-brand-muted uppercase">
                    Profile Image
                  </dt>
                  <dd className="mt-1 font-body text-xs text-brand-muted">
                    Avatar uploads will be enabled once media storage is provisioned.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex items-start gap-3 border border-brand-gold/30 bg-brand-charcoal/55 p-5">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
                aria-hidden="true"
              />
              <p className="font-body text-xs leading-relaxed text-brand-muted">
                Never enter your Lagos Life password, banking PIN, or OTP anywhere on
                your profile. VATAR only uses your public in-game username.
              </p>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
