import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/layout/PageContainer';
import { ROUTES } from '@/routes/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-brand-black text-brand-white">
      <PageContainer className="py-24">
        <div className="max-w-xl border hairline-border bg-brand-charcoal p-10 sm:p-14">
          <p className="heading-eyebrow">404 — Page Not Found</p>
          <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
            Uncharted Territory
          </h1>
          <p className="body-lead mt-5">
            The page you requested does not exist or has been moved. Return to the main
            house to continue exploring VATAR LIFESTYLE BY SOFT.
          </p>
          <div className="mt-8">
            <Button to={ROUTES.home} variant="primary" size="md">
              Return Home
            </Button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
