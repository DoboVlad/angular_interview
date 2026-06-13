import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

interface Segment {
  readonly key: string;
  readonly color: string;
  readonly length: number;
  readonly offset: number;
}

/** Pure-SVG donut showing correct / wrong / skipped proportions. No library. */
@Component({
  selector: 'be-score-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut">
      <svg viewBox="0 0 120 120" width="160" height="160" role="img"
           [attr.aria-label]="ariaLabel()">
        <circle class="donut__track" cx="60" cy="60" [attr.r]="radius"
                fill="none" stroke-width="14" />
        @for (seg of segments(); track seg.key) {
          <circle
            [attr.stroke]="seg.color"
            cx="60" cy="60" [attr.r]="radius"
            fill="none" stroke-width="14"
            [attr.stroke-dasharray]="seg.length + ' ' + (circumference - seg.length)"
            [attr.stroke-dashoffset]="seg.offset"
            transform="rotate(-90 60 60)"
          />
        }
      </svg>
      <div class="donut__center">
        <span class="donut__pct">{{ scorePct() }}%</span>
        <span class="donut__sub">correct</span>
      </div>
    </div>
  `,
  styleUrl: './score-donut.scss',
})
export class ScoreDonutComponent {
  readonly correct = input.required<number>();
  readonly wrong = input.required<number>();
  readonly skipped = input.required<number>();

  protected readonly radius = 50;
  protected readonly circumference = 2 * Math.PI * 50;

  private readonly total = computed(
    () => this.correct() + this.wrong() + this.skipped(),
  );

  protected readonly scorePct = computed(() => {
    const t = this.total();
    return t === 0 ? 0 : Math.round((this.correct() / t) * 100);
  });

  protected readonly segments = computed<Segment[]>(() => {
    const t = this.total();
    if (t === 0) return [];
    const data: [string, string, number][] = [
      ['correct', 'var(--be-success)', this.correct()],
      ['wrong', 'var(--be-error)', this.wrong()],
      ['skipped', 'var(--be-lavender)', this.skipped()],
    ];
    let cumulative = 0;
    const out: Segment[] = [];
    for (const [key, color, count] of data) {
      if (count === 0) continue;
      const length = (count / t) * this.circumference;
      // Negative offset rotates the segment start to the end of the prior arc.
      out.push({ key, color, length, offset: -cumulative });
      cumulative += length;
    }
    return out;
  });

  protected readonly ariaLabel = computed(
    () =>
      `Score ${this.scorePct()} percent. ${this.correct()} correct, ` +
      `${this.wrong()} wrong, ${this.skipped()} skipped.`,
  );
}
