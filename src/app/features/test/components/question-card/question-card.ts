import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import {
  AnswerValue,
  OPTION_KEYS,
  Question,
  indexToOptionKey,
} from '../../../../core/models/question.model';
import { AnsweredQuestion } from '../../../../core/models/test-session.model';
import { ExplainRequest } from '../../../../core/services/anthropic.service';
import {
  AnswerOptionComponent,
  OptionState,
} from '../answer-option/answer-option';
import { ExplanationPanelComponent } from '../explanation-panel/explanation-panel';
import { CodeBlockComponent } from '../../../../shared/components/code-block/code-block';
import { DifficultyDotsComponent } from '../../../../shared/components/difficulty-dots/difficulty-dots';

interface RenderableOption {
  readonly label: string;
  readonly value: AnswerValue;
  readonly shortcut: number;
}

@Component({
  selector: 'be-question-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnswerOptionComponent,
    ExplanationPanelComponent,
    CodeBlockComponent,
    DifficultyDotsComponent,
  ],
  templateUrl: './question-card.html',
  styleUrl: './question-card.scss',
})
export class QuestionCardComponent {
  readonly question = input.required<Question>();
  readonly selected = input<AnswerValue | null>(null);
  readonly answered = input<AnsweredQuestion | undefined>(undefined);

  readonly pick = output<AnswerValue>();

  protected readonly isAnswered = computed(() => this.answered() !== undefined);

  /** Normalises MC / true-false into a uniform option list. */
  protected readonly options = computed<RenderableOption[]>(() => {
    const q = this.question();
    if (q.type === 'true-false') {
      return [
        { label: 'True', value: true, shortcut: 1 },
        { label: 'False', value: false, shortcut: 2 },
      ];
    }
    return (q.options ?? []).map((label, i) => ({
      label,
      value: indexToOptionKey(i),
      shortcut: i + 1,
    }));
  });

  protected stateFor(option: RenderableOption): OptionState {
    const q = this.question();
    const ans = this.answered();
    if (!ans) {
      return this.selected() === option.value ? 'selected' : 'idle';
    }
    if (option.value === q.correctAnswer) return 'correct';
    if (option.value === ans.given) return 'wrong';
    return 'idle';
  }

  protected readonly explainRequest = computed<ExplainRequest>(() => {
    const q = this.question();
    const ans = this.answered();
    return {
      questionText: q.question,
      correctAnswer: this.describe(q.correctAnswer),
      userAnswer: ans ? this.describe(ans.given) : '—',
      topic: q.subcategory,
    };
  });

  /** Human-readable rendering of an answer value for the AI prompt. */
  private describe(value: AnswerValue | null): string {
    const q = this.question();
    if (value === null) return 'No answer (skipped)';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    const index = OPTION_KEYS.indexOf(value);
    const text = q.options?.[index];
    return text ? `${value}. ${text}` : value;
  }
}
