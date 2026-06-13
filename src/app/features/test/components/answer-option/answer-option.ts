import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule, Check, X } from 'lucide-angular';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong';

/**
 * A single keyboard-navigable answer card. The parent owns selection/keyboard
 * handling; this component is presentational and emits `pick`.
 */
@Component({
  selector: 'be-answer-option',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      class="option option--{{ state() }}"
      role="radio"
      [attr.aria-checked]="state() === 'selected' || state() === 'correct'"
      [disabled]="locked()"
      (click)="pick.emit()"
    >
      <kbd class="option__key" aria-hidden="true">{{ shortcut() }}</kbd>
      <span class="option__text">{{ text() }}</span>
      @if (state() === 'correct') {
        <span class="option__mark option__mark--ok">
          <lucide-icon [img]="Check" [size]="18" />
        </span>
      } @else if (state() === 'wrong') {
        <span class="option__mark option__mark--bad">
          <lucide-icon [img]="X" [size]="18" />
        </span>
      }
    </button>
  `,
  styleUrl: './answer-option.scss',
})
export class AnswerOptionComponent {
  readonly text = input.required<string>();
  /** 1-based keyboard shortcut number. */
  readonly shortcut = input.required<number>();
  readonly state = input<OptionState>('idle');
  readonly locked = input<boolean>(false);

  readonly pick = output<void>();

  protected readonly Check = Check;
  protected readonly X = X;

  // Exposed for potential future template use; keeps the API explicit.
  protected readonly isResolved = computed(
    () => this.state() === 'correct' || this.state() === 'wrong',
  );
}
