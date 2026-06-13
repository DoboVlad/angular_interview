import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, Lightbulb, Crown } from 'lucide-angular';
import { CodeBlockComponent } from '../../../../shared/components/code-block/code-block';
import { AiExplanationComponent } from '../ai-explanation/ai-explanation';
import { ExplainRequest } from '../../../../core/services/anthropic.service';

/** Post-answer reveal: explanation, the principal-level insight, and AI deep-dive. */
@Component({
  selector: 'be-explanation-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, CodeBlockComponent, AiExplanationComponent],
  template: `
    <div class="reveal be-animate-rise">
      <div class="reveal__section">
        <span class="reveal__label">
          <lucide-icon [img]="Lightbulb" [size]="15" />
          Why
        </span>
        <be-code-block [markdown]="explanation()" />
      </div>

      <div class="be-callout reveal__insight">
        <span class="reveal__label reveal__label--insight">
          <lucide-icon [img]="Crown" [size]="15" />
          Senior insight
        </span>
        <p>{{ seniorInsight() }}</p>
      </div>

      <be-ai-explanation [request]="request()" />
    </div>
  `,
  styleUrl: './explanation-panel.scss',
})
export class ExplanationPanelComponent {
  readonly explanation = input.required<string>();
  readonly seniorInsight = input.required<string>();
  readonly request = input.required<ExplainRequest>();

  protected readonly Lightbulb = Lightbulb;
  protected readonly Crown = Crown;
}
