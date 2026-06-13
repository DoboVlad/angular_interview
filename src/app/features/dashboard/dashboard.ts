import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Play,
  Flame,
  Target,
  TrendingUp,
  ClipboardList,
  ArrowRight,
} from 'lucide-angular';
import {
  CategoryFilter,
  CATEGORY_FILTER_LABELS,
  TestConfig,
  TestSize,
  TimerSetting,
} from '../../core/models/test-session.model';
import { QuizService } from '../../core/services/quiz.service';
import { StorageService } from '../../core/services/storage.service';
import { STORAGE_KEYS } from '../../core/tokens/injection-tokens';
import {
  Validators,
  signalControl,
  signalForm,
  withValidators,
} from '../../shared/forms/signal-forms';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar';

const SIZES: readonly TestSize[] = [10, 20, 40];
const FILTERS: readonly CategoryFilter[] = ['angular-focus', 'js-ts', 'mixed'];
const TIMERS: readonly TimerSetting[] = [null, 45, 90];

@Component({
  selector: 'be-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    RelativeTimePipe,
    ProgressBarComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly quiz = inject(QuizService);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly bank = this.quiz.bank;
  protected readonly sizes = SIZES;
  protected readonly filters = FILTERS;
  protected readonly timers = TIMERS;
  protected readonly filterLabels = CATEGORY_FILTER_LABELS;

  // Signal Form: test configuration.
  protected readonly form = signalForm({
    size: signalControl<TestSize>(20, withValidators(Validators.oneOf(SIZES))),
    filter: signalControl<CategoryFilter>(
      'angular-focus',
      withValidators(Validators.oneOf(FILTERS)),
    ),
    timer: signalControl<TimerSetting>(
      this.storage.read<TimerSetting>(STORAGE_KEYS.timerDefault, null),
      withValidators(Validators.oneOf(TIMERS)),
    ),
  });

  protected readonly stats = signal(this.quiz.aggregateStats());
  protected readonly recent = signal(this.quiz.history().slice(0, 5));

  protected readonly bankReady = computed(
    () => (this.bank.value()?.length ?? 0) > 0,
  );
  protected readonly canStart = computed(
    () => this.form.valid() && this.bankReady(),
  );

  protected readonly Play = Play;
  protected readonly Flame = Flame;
  protected readonly Target = Target;
  protected readonly TrendingUp = TrendingUp;
  protected readonly ClipboardList = ClipboardList;
  protected readonly ArrowRight = ArrowRight;

  protected timerLabel(timer: TimerSetting): string {
    return timer === null ? 'Off' : `${timer}s`;
  }

  protected start(): void {
    if (!this.canStart()) {
      this.form.markAllTouched();
      return;
    }
    const config: TestConfig = this.form.value() as TestConfig;
    this.quiz.startTest(config);
    void this.router.navigate(['/test']);
  }
}
