/**
 * #3 — Shared setup for jsdom component tests.
 *
 * Node ≥22 exposes an EXPERIMENTAL global `localStorage` that is inert unless
 * launched with `--localstorage-file`, and it shadows jsdom's own store — so
 * `setItem`/`clear` are undefined and the storage-backed components
 * (SettingsView, the wizard autosave) can't run. Replace it with a small
 * in-memory Storage so `window.localStorage` behaves like a browser.
 *
 * Guarded on `typeof window` so it is a no-op for the Node-environment tests
 * that must stay Node-only (AC-28): those never see a window here.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

function install(target: object, store: MemoryStorage): void {
  try {
    Object.defineProperty(target, 'localStorage', {
      value: store,
      configurable: true,
      writable: true,
    });
  } catch {
    // Non-configurable global — leave as-is rather than crash the suite.
  }
}

if (typeof window !== 'undefined') {
  // ONE shared instance on both globals: components read window.localStorage while
  // tests assert against the bare `localStorage` global — they must be the same store.
  const store = new MemoryStorage();
  install(globalThis, store);
  install(window, store);
}
