import { Injectable, inject } from '@angular/core';
import { STORAGE } from '../tokens/injection-tokens';
import { environment } from '../../../environments/environment';

/**
 * Typed `localStorage` wrapper. Generic read/write with JSON
 * (de)serialisation, so callers never touch raw strings. All access is
 * defensive — corrupted JSON or a disabled storage (private mode) degrades to
 * the provided fallback rather than throwing.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = inject(STORAGE);

  read<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.warn(`Failed to read "${key}"`, err);
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Quota exceeded or storage disabled — non-fatal for a quiz app.
      this.warn(`Failed to write "${key}"`, err);
    }
  }

  /** Raw string read for non-JSON values (e.g. the API key). */
  readString(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  writeString(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch (err) {
      this.warn(`Failed to write "${key}"`, err);
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  /** Clears only this app's namespaced keys (prefix `be:`). */
  clearAll(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const k = this.storage.key(i);
        if (k && k.startsWith('be:')) keys.push(k);
      }
      keys.forEach((k) => this.storage.removeItem(k));
    } catch (err) {
      this.warn('Failed to clear storage', err);
    }
  }

  private warn(message: string, err: unknown): void {
    if (!environment.production) {
      // Dev-only diagnostics; stripped of noise in production builds.
      console.warn(`[StorageService] ${message}`, err);
    }
  }
}
