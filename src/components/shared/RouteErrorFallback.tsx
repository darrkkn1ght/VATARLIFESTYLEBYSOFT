import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouteError } from 'react-router-dom';

const RELOAD_GUARD_KEY = 'vatar_chunk_reload_ts';

function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lower = message.toLowerCase();
  return (
    lower.includes('importing a module script failed') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('loading chunk') ||
    lower.includes('chunkloaderror') ||
    lower.includes('error loading dynamically imported module')
  );
}

export function triggerSafeChunkReload(): boolean {
  try {
    const lastTs = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
    const now = Date.now();
    // Guard against reload loops: only auto-reload once every 15 seconds
    if (now - lastTs > 15_000) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    // sessionStorage unavailable (private mode edge case)
  }
  return false;
}

export function RouteErrorFallback() {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      triggerSafeChunkReload();
    }
  }, [chunkError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-black px-6 py-16 text-brand-white">
      <div className="w-full max-w-md border border-brand-gold/40 bg-brand-charcoal/80 p-8 text-center">
        <p className="font-heading text-xs tracking-[0.24em] text-brand-gold uppercase">
          VATAR LIFESTYLE BY SOFT
        </p>
        <h1 className="heading-section mt-3 text-2xl text-brand-white">
          {chunkError ? 'New Version Available' : 'Page Interrupted'}
        </h1>
        <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
          {chunkError
            ? 'The site was just updated. Tap below to refresh and load the latest version.'
            : 'Something interrupted loading this page. Refreshing usually fixes it immediately.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex cursor-pointer items-center gap-2 border border-brand-gold bg-brand-gold px-5 py-2.5 font-heading text-xs font-semibold tracking-[0.18em] text-brand-black uppercase transition-colors hover:border-brand-cream hover:bg-brand-cream"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reload Page
          </button>
          <a
            href="/"
            className="inline-flex items-center border hairline-border bg-brand-black px-5 py-2.5 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:border-brand-gold hover:text-brand-gold"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
