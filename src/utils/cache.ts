// src/utils/cache.ts

export function getCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch (e) {
    console.error(`Error reading cache key "${key}":`, e);
    return null;
  }
}

export function setCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error setting cache key "${key}":`, e);
  }
}
