import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  Eye,
  EyeOff,
  Trash2,
  Check,
} from 'lucide-angular';
import { AnthropicService } from '../../core/services/anthropic.service';
import { ThemeService, ThemePreference } from '../../core/services/theme.service';
import { StorageService } from '../../core/services/storage.service';
import { STORAGE_KEYS } from '../../core/tokens/injection-tokens';
import { ToastService } from '../../shared/components/toast/toast.service';
import { TimerSetting } from '../../core/models/test-session.model';
import { signalControl } from '../../shared/forms/signal-forms';

const THEME_OPTIONS: readonly ThemePreference[] = ['light', 'dark', 'system'];
const TIMER_OPTIONS: readonly TimerSetting[] = [null, 45, 90];

@Component({
  selector: 'be-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly anthropic = inject(AnthropicService);
  protected readonly theme = inject(ThemeService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly timerOptions = TIMER_OPTIONS;

  protected readonly hasKey = this.anthropic.hasApiKey;
  protected readonly showKey = signal(false);
  protected readonly showResetConfirm = signal(false);

  // Signal Form controls.
  protected readonly apiKey = signalControl<string>('');
  protected readonly timerDefault = signalControl<TimerSetting>(
    this.storage.read<TimerSetting>(STORAGE_KEYS.timerDefault, null),
  );

  protected readonly Eye = Eye;
  protected readonly EyeOff = EyeOff;
  protected readonly Trash2 = Trash2;
  protected readonly Check = Check;

  protected timerLabel(timer: TimerSetting): string {
    return timer === null ? 'Off' : `${timer}s`;
  }

  protected saveKey(): void {
    const value = this.apiKey.value().trim();
    if (!value) return;
    this.anthropic.setApiKey(value);
    this.apiKey.set('');
    this.toast.show('success', 'API key saved', 'Stored on this device only.');
  }

  protected clearKey(): void {
    this.anthropic.clearApiKey();
    this.toast.show('info', 'API key removed');
  }

  protected setTheme(pref: ThemePreference): void {
    this.theme.setPreference(pref);
  }

  protected setTimerDefault(timer: TimerSetting): void {
    this.timerDefault.set(timer);
    this.storage.write(STORAGE_KEYS.timerDefault, timer);
    this.toast.show('success', 'Default timer updated');
  }

  protected resetAll(): void {
    this.storage.clearAll();
    this.anthropic.clearApiKey();
    this.theme.setPreference('system');
    this.timerDefault.set(null);
    this.showResetConfirm.set(false);
    this.toast.show('info', 'All data cleared', 'History, key, and preferences reset.');
  }
}
