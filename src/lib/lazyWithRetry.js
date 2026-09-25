import { lazy } from 'react';

const RELOAD_KEY = 'bfar.chunkReloadAt';
const RELOAD_WINDOW_MS = 30000;

const isChunkLoadError = (error) =>
  error?.name === 'ChunkLoadError' || /Loading (CSS )?chunk [\w-]+ failed/i.test(String(error?.message || ''));

/**
 * React.lazy for a route page. Each deployment renames the page files, so a tab
 * opened before a deploy asks for files that no longer exist. That failure
 * reloads the page once to pick up the new version instead of crashing; if it
 * fails again right after a reload (e.g. offline) the error is shown normally.
 */
const lazyWithRetry = (importPage) =>
  lazy(() =>
    importPage().catch((error) => {
      let lastReload = 0;
      try {
        lastReload = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
      } catch (_) {
        // Storage unavailable: fall through and surface the error.
      }
      if (isChunkLoadError(error) && Date.now() - lastReload > RELOAD_WINDOW_MS) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch (_) {
          // ignore
        }
        window.location.reload();
        return new Promise(() => {}); // keep the loader up while reloading
      }
      throw error;
    })
  );

export default lazyWithRetry;
