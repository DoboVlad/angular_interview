import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { StorageService } from './storage.service';
import { WINDOW } from '../tokens/injection-tokens';
import { STORAGE_KEYS } from '../tokens/injection-tokens';

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Dark/light theming. The active preference is a signal; an effect mirrors it
 * onto `<html data-theme="...">` and persists it. "system" defers to
 * `prefers-color-scheme`, which we observe via matchMedia.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);
  private readonly doc = inject(DOCUMENT);
  private readonly window = inject(WINDOW);

  private readonly mediaQuery = this.window.matchMedia?.(
    '(prefers-color-scheme: dark)',
  );

  /** The user's stored choice (light | dark | system). */
  readonly preference = signal<ThemePreference>(
    this.storage.read<ThemePreference>(STORAGE_KEYS.theme, 'system'),
  );

  /** Tracks the OS preference when in "system" mode. */
  private readonly systemPrefersDark = signal<boolean>(
    this.mediaQuery?.matches ?? false,
  );

  /** The effective theme actually applied to the DOM. */
  readonly activeTheme = computed<'light' | 'dark'>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  readonly isDark = computed(() => this.activeTheme() === 'dark');

  constructor() {
    // Keep the system-preference signal in sync with the OS.
    this.mediaQuery?.addEventListener('change', (e) =>
      this.systemPrefersDark.set(e.matches),
    );

    // Apply + persist whenever the effective theme changes.
    effect(() => {
      const theme = this.activeTheme();
      this.doc.documentElement.setAttribute('data-theme', theme);
    });

    effect(() => {
      this.storage.write(STORAGE_KEYS.theme, this.preference());
    });
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
  }

  /** Cycles light → dark (treating "system" as its resolved value). */
  toggle(): void {
    this.preference.set(this.activeTheme() === 'dark' ? 'light' : 'dark');
  }
}
