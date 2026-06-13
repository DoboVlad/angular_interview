import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Thin 4px progress bar with a lavender→purple fill. */
@Component({
  selector: 'be-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="track"
      role="progressbar"
      [attr.aria-valuenow]="clamped()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="label()"
    >
      <div class="fill" [style.width.%]="clamped()"></div>
    </div>
  `,
  styleUrl: './progress-bar.scss',
})
export class ProgressBarComponent {
  /** 0–100. */
  readonly value = input<number>(0);
  readonly label = input<string>('Progress');

  protected readonly clamped = computed(() =>
    Math.max(0, Math.min(100, Math.round(this.value()))),
  );
}
