import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Browser `localStorage`, injected so it can be swapped in tests. */
export const STORAGE = new InjectionToken<Storage>('be.storage', {
  providedIn: 'root',
  factory: () => localStorage,
});

/** `window` reference for matchMedia / clipboard, injectable for testability. */
export const WINDOW = new InjectionToken<Window>('be.window', {
  providedIn: 'root',
  factory: () => window,
});

export interface AnthropicConfig {
  readonly apiUrl: string;
  readonly model: string;
  readonly version: string;
  readonly maxTokens: number;
}

export const ANTHROPIC_CONFIG = new InjectionToken<AnthropicConfig>(
  'be.anthropic.config',
  {
    providedIn: 'root',
    factory: () => ({
      apiUrl: environment.anthropicApiUrl,
      model: environment.anthropicModel,
      version: environment.anthropicVersion,
      maxTokens: 1500,
    }),
  },
);

/** localStorage key namespace. */
export const STORAGE_KEYS = {
  apiKey: 'be:anthropic-key',
  theme: 'be:theme',
  timerDefault: 'be:timer-default',
  history: 'be:history',
} as const;
