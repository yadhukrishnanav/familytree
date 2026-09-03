'use client';

// Family Tree — Client error recovery
// Turns "Application error: a client-side exception" into a self-healing
// recovery flow for the most common cause: a deploy happened while a tab was
// open, and the old tab lazily requests a hashed chunk that no longer exists
// on the new deployment ("Failed to fetch dynamically imported module" /
// ChunkLoadError). Recovery = purge every service worker + cache, then reload
// once. The reload lands on the fresh deployment with a clean asset cache.

const RELOAD_FLAG = 'ft_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 30_000; // don't reload-loop: max once per 30s

export function isChunkLoadError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('dynamically imported module') ||
    m.includes('chunkloaderror') ||
    m.includes('loading chunk') ||
    m.includes('error loading dynamically imported') ||
    m.includes('importing a module script failed')
  );
}

function purgeServiceWorkersAndCaches(): Promise<void> {
  return (async () => {
    if (typeof navigator === 'undefined') return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined' && 'keys' in caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best effort — the reload below usually fixes it anyway
    }
  })();
}

/**
 * If this looks like a deploy-related chunk failure, purge SW + caches and
 * reload once. Returns true when a reload was triggered (the page is going
 * away — don't render anything else).
 */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : (error as { message?: string })?.message ?? '';
  if (!isChunkLoadError(message)) return false;

  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
  } catch {
    // sessionStorage unavailable — still allow a single reload
  }
  const now = Date.now();
  if (now - last < RELOAD_COOLDOWN_MS) return false; // already tried — show the UI

  try {
    sessionStorage.setItem(RELOAD_FLAG, String(now));
  } catch {
    // ignore
  }
  void purgeServiceWorkersAndCaches().then(() => window.location.reload());
  return true;
}

/** Nuclear option from the error screen: wipe local state and reload fresh. */
export function clearLocalDataAndReload(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // ignore
  }
  void purgeServiceWorkersAndCaches().then(() => window.location.reload());
}
