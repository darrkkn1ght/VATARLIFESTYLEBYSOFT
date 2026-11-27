import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

const RELOAD_GUARD_KEY = 'vatar_chunk_reload_ts';

function extractErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '';
}

function isChunkLoadError(error: unknown): boolean {
  const lower = extractErrorMessage(error).toLowerCase();
  return (
    lower.includes('importing a module script failed') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('failed to load module script') ||
    lower.includes('not a valid javascript mime type') ||
    lower.includes('mime type') ||
    lower.includes('unable to preload css') ||
    lower.includes('loading chunk') ||
    lower.includes('chunkloaderror') ||
    lower.includes('error loading dynamically imported module') ||
    lower === 'load failed' ||
    lower === 'failed to fetch'
  );
}

export function reloadBypassingCache(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function triggerSafeChunkReload(): boolean {
  try {
    const lastTs = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
    const now = Date.now();
    // Guard against reload loops: only auto-reload once every 15 seconds
    if (now - lastTs > 15_000) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
      reloadBypassingCache();
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
  const rawMessage = extractErrorMessage(error);

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
            ? 'The site was just updated. Tap below to load the latest version.'
            : 'Something interrupted loading this page. Tap Reload below to load a fresh copy.'}
        </p>
        {rawMessage && !chunkError && (
          <p className="mt-3 border hairline-border bg-brand-black/70 px-3 py-2 font-mono text-[11px] break-words text-brand-muted">
            {rawMessage}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reloadBypassingCache()}
            className="inline-flex cursor-pointer items-center gap-2 border border-brand-gold bg-brand-gold px-5 py-2.5 font-heading text-xs font-semibold tracking-[0.18em] text-brand-black uppercase transition-colors hover:border-brand-cream hover:bg-brand-cream"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reload Page
          </button>
          <a
            href={`/?_v=${Date.now()}`}
            className="inline-flex items-center border hairline-border bg-brand-black px-5 py-2.5 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:border-brand-gold hover:text-brand-gold"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
