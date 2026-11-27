import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { triggerSafeChunkReload } from '@/components/shared/RouteErrorFallback';
import '@/styles/index.css';

// Automatically recover when a new deployment invalidates older lazy-loaded chunks
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  triggerSafeChunkReload();
});

// Clean up cache-busting query param after a fresh reload
try {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has('_v')) {
    currentUrl.searchParams.delete('_v');
    window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
  }
} catch {
  // Ignore URL parsing edge cases
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found in the document.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
