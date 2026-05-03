/**
 * Safe localStorage wrapper for Safari Private Mode and restricted browsers.
 * Falls back to in-memory storage when localStorage is unavailable.
 */

const memoryStore = new Map<string, string>();

let _storageAvailable: boolean | null = null;

function isLocalStorageAvailable(): boolean {
  if (_storageAvailable !== null) return _storageAvailable;
  try {
    const testKey = "__sb_storage_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    _storageAvailable = true;
  } catch {
    _storageAvailable = false;
  }
  return _storageAvailable;
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (isLocalStorageAvailable()) {
      try { return localStorage.getItem(key); } catch { /* fall through */ }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    if (isLocalStorageAvailable()) {
      try { localStorage.setItem(key, value); return; } catch { /* fall through */ }
    }
    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    if (isLocalStorageAvailable()) {
      try { localStorage.removeItem(key); } catch { /* fall through */ }
    }
    memoryStore.delete(key);
  },

  clear(): void {
    if (isLocalStorageAvailable()) {
      try { localStorage.clear(); } catch { /* fall through */ }
    }
    memoryStore.clear();
  },

  keys(): string[] {
    if (isLocalStorageAvailable()) {
      try { return Object.keys(localStorage); } catch { /* fall through */ }
    }
    return Array.from(memoryStore.keys());
  },
};

export function isStorageAvailable(): boolean {
  return isLocalStorageAvailable();
}
