import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  validateLogin,
  validateResetEmail,
  type LoginField,
} from '@/lib/validation/auth';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { signIn, requestPasswordReset, isConfigured, configError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = (location.state as LocationState | null)?.from;

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const validation = validateLogin(email, password);
    setFieldErrors(validation.errors);
    if (!validation.isValid) return;

    setIsSubmitting(true);
    const result = await signIn({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    if (redirectTarget && redirectTarget !== ROUTES.login && redirectTarget !== ROUTES.register) {
      navigate(redirectTarget, { replace: true });
    }
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setResetMessage(null);

    const emailError = validateResetEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setResetMessage(
      'If an account exists for that email address, a password reset link has been sent.',
    );
  };

  return (
    <AuthShell
      eyebrow={mode === 'login' ? 'Member Access' : 'Account Recovery'}
      title={mode === 'login' ? 'Sign In' : 'Reset Password'}
      subtitle={
        mode === 'login'
          ? 'Enter your credentials to access your VATAR LIFESTYLE BY SOFT account and membership status.'
          : 'Enter your registered email address and we will send a password recovery link.'
      }
      asideHeading="A Lifestyle. A Community. A Legacy."
      asideDescription="Sign in to track your membership approval, access approved member features, and carry your verified VATAR record forward."
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
              {configError ?? 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable sign-in.'}
            </p>
          </div>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-xs text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <p>{formError}</p>
        </div>
      )}

      {resetMessage && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 border border-brand-gold/45 bg-brand-black p-4 text-xs text-brand-cream"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
          <p>{resetMessage}</p>
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              disabled={isSubmitting || !isConfigured}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              className={cn(
                'mt-2 w-full border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 transition-colors focus:border-brand-gold focus:outline-none disabled:opacity-50',
                fieldErrors.email ? 'border-red-400/70' : 'hairline-border',
              )}
            />
            {fieldErrors.email && (
              <p id="login-email-error" role="alert" className="mt-1.5 font-body text-xs text-red-400">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <PasswordInput
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={fieldErrors.password}
            disabled={isSubmitting || !isConfigured}
          />

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setFormError(null);
                setFieldErrors({});
                setResetMessage(null);
              }}
              className="cursor-pointer font-body text-xs text-brand-muted transition-colors hover:text-brand-gold"
            >
              Forgot your password?
            </button>
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
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResetSubmit} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="reset-email"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Registered Email Address
            </label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              disabled={isSubmitting || !isConfigured}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
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
                Sending Reset Link...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFormError(null);
              setFieldErrors({});
              setResetMessage(null);
            }}
            className="w-full cursor-pointer py-1 text-center font-body text-xs text-brand-muted transition-colors hover:text-brand-gold"
          >
            Back to Sign In
          </button>
        </form>
      )}

      <div className="mt-7 border-t hairline-border pt-6 text-center">
        <p className="font-body text-xs text-brand-muted">
          New to VATAR LIFESTYLE BY SOFT?{' '}
          <Link
            to={ROUTES.register}
            className="font-medium text-brand-gold transition-colors hover:text-brand-cream"
          >
            Apply for Membership
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
