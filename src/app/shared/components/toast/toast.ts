import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule, Sparkles, Check, Info, X } from 'lucide-angular';
import { ToastService } from './toast.service';

@Component({
  selector: 'be-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (toast of toasts(); track toast.id) {
        <div class="toast toast--{{ toast.kind }}" role="status">
          <span class="toast__icon">
            @switch (toast.kind) {
              @case ('level-up') { <lucide-icon [img]="Sparkles" [size]="18" /> }
              @case ('success') { <lucide-icon [img]="Check" [size]="18" /> }
              @default { <lucide-icon [img]="Info" [size]="18" /> }
            }
          </span>
          <div class="toast__body">
            <strong>{{ toast.title }}</strong>
            @if (toast.message) {
              <span class="toast__msg">{{ toast.message }}</span>
            }
          </div>
          <button
            type="button"
            class="toast__close"
            (click)="dismiss(toast.id)"
            aria-label="Dismiss notification"
          >
            <lucide-icon [img]="X" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast.scss',
})
export class ToastComponent {
  private readonly service = inject(ToastService);
  protected readonly toasts = this.service.toasts;

  protected readonly Sparkles = Sparkles;
  protected readonly Check = Check;
  protected readonly Info = Info;
  protected readonly X = X;

  protected dismiss(id: number): void {
    this.service.dismiss(id);
  }
}
