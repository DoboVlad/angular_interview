import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SubcategoryBreakdown } from '../../../../core/models/test-result.model';
import { DifficultyDotsComponent } from '../../../../shared/components/difficulty-dots/difficulty-dots';
import { Difficulty } from '../../../../core/models/question.model';

/** Per-subcategory results table with a coaching suggestion column. */
@Component({
  selector: 'be-breakdown-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DifficultyDotsComponent],
  template: `
    <div class="table-wrap">
      <table class="breakdown">
        <thead>
          <tr>
            <th scope="col">Topic</th>
            <th scope="col">Score</th>
            <th scope="col">Avg difficulty</th>
            <th scope="col">Suggestion</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.subcategory) {
            <tr>
              <th scope="row" class="breakdown__topic">{{ row.subcategory }}</th>
              <td>
                <span
                  class="breakdown__score"
                  [class.breakdown__score--low]="row.correct / row.total < 0.5"
                >
                  {{ row.correct }}/{{ row.total }}
                </span>
              </td>
              <td>
                <be-difficulty-dots [level]="roundLevel(row.avgDifficulty)" />
                <span class="breakdown__avg">{{ row.avgDifficulty }}</span>
              </td>
              <td class="breakdown__suggestion">{{ row.suggestion }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './breakdown-table.scss',
})
export class BreakdownTableComponent {
  readonly rows = input.required<readonly SubcategoryBreakdown[]>();

  protected roundLevel(avg: number): Difficulty {
    return Math.max(1, Math.min(5, Math.round(avg))) as Difficulty;
  }
}
