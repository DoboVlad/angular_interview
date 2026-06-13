import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Difficulty } from '../../../core/models/question.model';

const LABELS: Record<Difficulty, string> = {
  1: 'Warm-up',
  2: 'Solid',
  3: 'Senior',
  4: 'Expert',
  5: 'Principal',
};

/** Five dots, filled up to the given difficulty level. */
@Component({
  selector: 'be-difficulty-dots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="dots"
      role="img"
      [attr.aria-label]="'Difficulty ' + level() + ' of 5 — ' + label()"
    >
      @for (dot of dots; track dot) {
        <span class="dot" [class.dot--on]="dot <= level()"></span>
      }
      @if (showLabel()) {
        <span class="dots__label">{{ label() }}</span>
      }
    </span>
  `,
  styleUrl: './difficulty-dots.scss',
})
export class DifficultyDotsComponent {
  readonly level = input.required<Difficulty>();
  readonly showLabel = input<boolean>(false);

  protected readonly dots = [1, 2, 3, 4, 5];
  protected readonly label = computed(() => LABELS[this.level()]);
}
