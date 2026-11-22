import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/routes/paths';

function AuthLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center bg-brand-black px-6 text-brand-white"
    >
      <div className="flex flex-col items-center">
        <span className="flex h-12 w-12 items-center justify-center border border-brand-gold/60 bg-brand-charcoal font-heading text-lg font-semibold text-brand-gold">
          V
        </span>
        <p className="mt-5 font-heading text-xs tracking-[0.28em] text-brand-gold uppercase">
          Verifying Access
        </p>
        <div className="mt-4 h-px w-32 overflow-hidden bg-brand-charcoal">
          <div className="h-full w-1/2 animate-pulse bg-brand-gold" />
        </div>
      </div>
    </div>
  );
}

interface GuardProps {
  children?: ReactNode;
}

export function RequireAuth({ children }: GuardProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export function RequireApprovedMember({ children }: GuardProps) {
  const { isLoading, isAuthenticated, isApprovedMember } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!isApprovedMember) {
    return <Navigate to={ROUTES.membershipStatus} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function RequireAdmin({ children }: GuardProps) {
  const { isLoading, isAuthenticated, isAdmin, isApprovedMember, membershipStatus } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (membershipStatus === 'suspended' || membershipStatus === 'rejected') {
    return <Navigate to={ROUTES.membershipStatus} replace />;
  }

  if (!isAdmin) {
    return (
      <Navigate
        to={isApprovedMember ? ROUTES.dashboard : ROUTES.membershipStatus}
        replace
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export function RedirectIfAuthenticated({ children }: GuardProps) {
  const {
    isLoading,
    isAuthenticated,
    isApprovedMember,
    isAdmin,
    isPasswordRecovery,
    membershipStatus,
  } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    if (isPasswordRecovery) {
      return <Navigate to={ROUTES.updatePassword} replace />;
    }
    if (membershipStatus === 'suspended' || membershipStatus === 'rejected') {
      return <Navigate to={ROUTES.membershipStatus} replace />;
    }
    if (isAdmin) {
      return <Navigate to={ROUTES.admin} replace />;
    }
    return (
      <Navigate
        to={isApprovedMember ? ROUTES.dashboard : ROUTES.membershipStatus}
        replace
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
