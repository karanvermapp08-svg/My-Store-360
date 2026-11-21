/**
 * Safe local storage reader and writer with error recovery
 * Ensures that corrupt or malformed JSON never crashes application startup.
 */

export function safeGetStoredData<T>(key: string, fallback: T, validator?: (val: unknown) => boolean): T {
  try {
    if (typeof localStorage === 'undefined') {
      return fallback;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (validator && !validator(parsed)) {
      console.warn(`[SafeStorage] Validation failed for storage key "${key}". Resetting to fallback defaults.`);
      return fallback;
    }
    return parsed as T;
  } catch (error) {
    console.error(`[SafeStorage] Corrupted or invalid JSON detected for storage key "${key}". Recovering gracefully.`, error);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    return fallback;
  }
}

export function safeSetStoredData<T>(key: string, value: T): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[SafeStorage] Failed to write data for key "${key}":`, error);
    return false;
  }
}

/**
 * Collision-proof ID generator using crypto.randomUUID where supported with fallback
 */
export function generateUniqueId(prefix: string = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${randomSuffix}`;
}
