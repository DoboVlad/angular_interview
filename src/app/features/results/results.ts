import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  RotateCcw,
  Plus,
  Share2,
  Home,
} from 'lucide-angular';
import { QuizService } from '../../core/services/quiz.service';
import { WINDOW } from '../../core/tokens/injection-tokens';
import { ToastService } from '../../shared/components/toast/toast.service';
import { TestConfig } from '../../core/models/test-session.model';
import { ScoreDonutComponent } from './components/score-donut/score-donut';
import { BreakdownTableComponent } from './components/breakdown-table/breakdown-table';
import {
  MissedAccordionComponent,
  MissedEntry,
} from './components/missed-accordion/missed-accordion';

@Component({
  selector: 'be-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    ScoreDonutComponent,
    BreakdownTableComponent,
    MissedAccordionComponent,
  ],
  templateUrl: './results.html',
  styleUrl: './results.scss',
})
export class Results {
  private readonly quiz = inject(QuizService);
  private readonly router = inject(Router);
  private readonly window = inject(WINDOW);
  private readonly toast = inject(ToastService);

  /** Bound from the `:testId` route param via component input binding. */
  readonly testId = input.required<string>();

  protected readonly result = computed(() => this.quiz.resultById(this.testId()));

  protected readonly missed = computed<MissedEntry[]>(() => {
    const r = this.result();
    const bank = this.quiz.bank.value() ?? [];
    if (!r || bank.length === 0) return [];
    return r.items
      .filter((i) => !i.correct)
      .map((i) => {
        const question = bank.find((q) => q.id === i.questionId);
        return question
          ? { question, given: i.given, skipped: i.skipped }
          : null;
      })
      .filter((e): e is MissedEntry => e !== null);
  });

  protected readonly hasMissed = computed(() => this.missed().length > 0);

  protected readonly RotateCcw = RotateCcw;
  protected readonly Plus = Plus;
  protected readonly Share2 = Share2;
  protected readonly Home = Home;

  protected retryMissed(): void {
    const r = this.result();
    if (!r) return;
    const questions = this.missed().map((m) => m.question);
    if (questions.length === 0) return;
    const config: TestConfig = { ...r.config, size: r.config.size };
    this.quiz.startWithQuestions(questions, config);
    void this.router.navigate(['/test']);
  }

  protected async share(): Promise<void> {
    const r = this.result();
    if (!r) return;
    const summary =
      `Blue Eclipse — Angular interview quiz\n` +
      `Score: ${r.scorePct}% (${r.grade}) · ${r.correct}/${r.total} correct\n` +
      `Filter: ${r.config.filter} · ${r.config.size} questions` +
      (r.config.timer ? ` · ${r.config.timer}s timer` : '') +
      `\nWeakest: ${r.breakdown[0]?.subcategory ?? '—'}`;
    try {
      await this.window.navigator.clipboard.writeText(summary);
      this.toast.show('success', 'Copied', 'Result summary is on your clipboard.');
    } catch {
      this.toast.show('info', 'Copy failed', 'Clipboard access was blocked.');
    }
  }
}
