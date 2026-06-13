import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Pure-SVG countdown ring. No animation library — the stroke dash offset is a
 * computed of `remaining / total`, so it redraws reactively each tick.
 */
@Component({
  selector: 'be-timer-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ring"
      role="timer"
      [attr.aria-label]="remaining() + ' seconds remaining'"
    >
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle
          class="ring__track"
          cx="22"
          cy="22"
          [attr.r]="radius"
          fill="none"
          stroke-width="4"
        />
        <circle
          class="ring__progress"
          [class.ring__progress--warn]="fraction() <= 0.33"
          cx="22"
          cy="22"
          [attr.r]="radius"
          fill="none"
          stroke-width="4"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="dashOffset()"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span class="ring__label" [class.ring__label--warn]="fraction() <= 0.33">
        {{ remaining() }}
      </span>
    </div>
  `,
  styleUrl: './timer-ring.scss',
})
export class TimerRingComponent {
  readonly total = input.required<number>();
  readonly remaining = input.required<number>();

  protected readonly radius = 18;
  protected readonly circumference = 2 * Math.PI * 18;

  protected readonly fraction = computed(() => {
    const t = this.total();
    return t <= 0 ? 0 : Math.max(0, Math.min(1, this.remaining() / t));
  });

  protected readonly dashOffset = computed(
    () => this.circumference * (1 - this.fraction()),
  );
}
