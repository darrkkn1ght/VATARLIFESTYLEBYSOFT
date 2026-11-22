import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/routes/paths';

export function UpdatePasswordPage() {
  const {
    isAuthenticated,
    isLoading,
    isApprovedMember,
    isAdmin,
    updatePassword,
  } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(newPassword);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCompleted(true);
    setNewPassword('');
    setConfirmPassword('');
  };

  const nextDestination = isAdmin
    ? ROUTES.admin
    : isApprovedMember
      ? ROUTES.dashboard
      : ROUTES.membershipStatus;

  return (
    <AuthShell
      eyebrow="Account Security"
      title="Update Password"
      subtitle="Choose a strong, unique password for your VATAR LIFESTYLE BY SOFT account."
      asideHeading="Protect Your Identity."
      asideDescription="Use a unique password that you do not reuse on Lagos Life or any banking service."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand-gold" aria-hidden="true" />
        </div>
      ) : completed ? (
        <div className="space-y-5 py-2">
          <div className="flex items-center gap-3 text-brand-gold">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <p className="font-heading text-sm tracking-[0.2em] uppercase">
              Password Updated
            </p>
          </div>
          <p className="font-body text-sm leading-relaxed text-brand-cream/90">
            Your VATAR account password has been updated securely.
          </p>
          <Button to={nextDestination} variant="primary" size="md" className="w-full">
            Continue to Your Account
          </Button>
        </div>
      ) : !isAuthenticated ? (
        <div className="space-y-5 py-2">
          <div className="flex items-start gap-3 border border-brand-gold/40 bg-brand-black/80 p-4 text-xs text-brand-cream/90">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
            <p>
              This password recovery link is invalid or has expired. Request a new
              password reset email from the Sign In page.
            </p>
          </div>
          <Button to={ROUTES.login} variant="primary" size="md" className="w-full">
            Return to Sign In
          </Button>
        </div>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 border border-red-400/40 bg-red-950/30 p-3.5 text-xs text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <PasswordInput
              id="update-new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              disabled={isSubmitting}
            />

            <PasswordInput
              id="update-confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Repeat new password"
              disabled={isSubmitting}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Updating Password...
                </>
              ) : (
                'Save New Password'
              )}
            </Button>
          </form>

          <div className="mt-6 border-t hairline-border pt-5 text-center">
            <Link
              to={nextDestination}
              className="font-body text-xs text-brand-muted hover:text-brand-gold"
            >
              Cancel and return to account
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
