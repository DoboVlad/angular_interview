import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import {
  AnswerValue,
  OPTION_KEYS,
  Question,
} from '../../../../core/models/question.model';
import { CodeBlockComponent } from '../../../../shared/components/code-block/code-block';
import { DifficultyDotsComponent } from '../../../../shared/components/difficulty-dots/difficulty-dots';

export interface MissedEntry {
  readonly question: Question;
  readonly given: AnswerValue | null;
  readonly skipped: boolean;
}

/** Expandable list of missed questions with the correct answer + explanation. */
@Component({
  selector: 'be-missed-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, CodeBlockComponent, DifficultyDotsComponent],
  templateUrl: './missed-accordion.html',
  styleUrl: './missed-accordion.scss',
})
export class MissedAccordionComponent {
  readonly entries = input.required<readonly MissedEntry[]>();

  protected readonly ChevronDown = ChevronDown;

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isOpen(id: string): boolean {
    return this.expanded().has(id);
  }

  protected toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected describe(q: Question, value: AnswerValue | null): string {
    if (value === null) return 'Skipped';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    const index = OPTION_KEYS.indexOf(value);
    const text = q.options?.[index];
    return text ? `${value}. ${text}` : value;
  }
}
