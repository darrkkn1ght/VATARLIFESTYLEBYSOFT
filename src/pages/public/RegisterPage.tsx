import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  validateRegistration,
  type RegisterField,
} from '@/lib/validation/auth';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

export function RegisterPage() {
  const { signUp, isConfigured, configError } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [lagosLifeUsername, setLagosLifeUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const validation = validateRegistration({
      fullName,
      email,
      username,
      lagosLifeUsername,
      password,
      confirmPassword,
    });

    setFieldErrors(validation.errors);
    if (!validation.isValid) return;

    setIsSubmitting(true);
    const result = await signUp({
      fullName,
      email,
      username,
      lagosLifeUsername,
      password,
    });
    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    if (result.requiresEmailVerification) {
      setVerificationPending(true);
      return;
    }

    navigate(ROUTES.dashboard, { replace: true });
  };

  return (
    <AuthShell
      eyebrow="Membership Application"
      title="Create Account"
      subtitle="Register your profile for VATAR LIFESTYLE BY SOFT. All new applications start in pending review before full member access is granted."
      asideHeading="Claim Your Place In The House."
      asideDescription="Complete your registration with your VATAR username and public Lagos Life username. Once submitted, our team reviews your application."
    >
      {!isConfigured && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 border border-brand-gold/40 bg-brand-black/80 p-4"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
            aria-hidden="true"
          />
          <div className="font-body text-xs leading-relaxed text-brand-cream/85">
            <p className="font-heading tracking-[0.16em] text-brand-gold uppercase">
              Backend Configuration Pending
            </p>
            <p className="mt-1 text-brand-muted">
              {configError ?? 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable registration.'}
            </p>
          </div>
        </div>
      )}

      {verificationPending ? (
        <div className="space-y-5 py-2">
          <div className="flex items-center gap-3 text-brand-gold">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <p className="font-heading text-sm tracking-[0.2em] uppercase">
              Application Received
            </p>
          </div>
          <p className="font-body text-sm leading-relaxed text-brand-cream/90">
            Your account has been created and your membership application is now{' '}
            <span className="text-brand-gold">pending review</span>. Please check{' '}
            <span className="text-brand-white">{email}</span> to confirm your email
            address, then sign in to monitor your approval status.
          </p>
          <Button to={ROUTES.login} variant="primary" size="md" className="w-full">
            Proceed to Sign In
          </Button>
        </div>
      ) : (
        <>
          {formError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-xs text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <p>{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="reg-full-name"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Full Name
              </label>
              <input
                id="reg-full-name"
                type="text"
                required
                autoComplete="name"
                disabled={isSubmitting || !isConfigured}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
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

            <div>
              <label
                htmlFor="reg-email"
                className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
              >
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                disabled={isSubmitting || !isConfigured}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-invalid={Boolean(fieldErrors.email)}
                className={cn(
                  'mt-2 w-full border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                  fieldErrors.email ? 'border-red-400/70' : 'hairline-border',
                )}
              />
              {fieldErrors.email && (
                <p role="alert" className="mt-1.5 font-body text-xs text-red-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="reg-username"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  VATAR Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  autoComplete="username"
                  disabled={isSubmitting || !isConfigured}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="your_handle"
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
                  htmlFor="reg-lagos-life"
                  className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                >
                  Lagos Life Username
                </label>
                <input
                  id="reg-lagos-life"
                  type="text"
                  required
                  disabled={isSubmitting || !isConfigured}
                  value={lagosLifeUsername}
                  onChange={(event) => setLagosLifeUsername(event.target.value)}
                  placeholder="In-game username"
                  aria-invalid={Boolean(fieldErrors.lagosLifeUsername)}
                  className={cn(
                    'mt-2 w-full border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                    fieldErrors.lagosLifeUsername ? 'border-red-400/70' : 'hairline-border',
                  )}
                />
                {fieldErrors.lagosLifeUsername && (
                  <p role="alert" className="mt-1.5 font-body text-xs text-red-400">
                    {fieldErrors.lagosLifeUsername}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <PasswordInput
                id="reg-password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                error={fieldErrors.password}
                disabled={isSubmitting || !isConfigured}
              />

              <PasswordInput
                id="reg-confirm-password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="Repeat password"
                error={fieldErrors.confirmPassword}
                disabled={isSubmitting || !isConfigured}
              />
            </div>

            <div className="flex items-start gap-2.5 border hairline-border bg-brand-black/60 p-3.5">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
                aria-hidden="true"
              />
              <p className="font-body text-[0.72rem] leading-relaxed text-brand-muted">
                Choose a unique password for VATAR. Never enter your Lagos Life game
                password, banking PIN, or OTP.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting || !isConfigured}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting Application...
                </>
              ) : (
                'Submit Membership Application'
              )}
            </Button>
          </form>

          <div className="mt-7 border-t hairline-border pt-6 text-center">
            <p className="font-body text-xs text-brand-muted">
              Already have an account?{' '}
              <Link
                to={ROUTES.login}
                className="font-medium text-brand-gold transition-colors hover:text-brand-cream"
              >
                Sign In
              </Link>
            </p>
          </div>
        </>
      )}
    </AuthShell>
  );
}
