import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Sparkles,
  Square,
  RotateCw,
  TriangleAlert,
  KeyRound,
} from 'lucide-angular';
import {
  AnthropicError,
  AnthropicService,
  ExplainRequest,
} from '../../../../core/services/anthropic.service';
import { CodeBlockComponent } from '../../../../shared/components/code-block/code-block';

type Phase = 'idle' | 'streaming' | 'done' | 'error';

@Component({
  selector: 'be-ai-explanation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, CodeBlockComponent],
  templateUrl: './ai-explanation.html',
  styleUrl: './ai-explanation.scss',
})
export class AiExplanationComponent {
  private readonly anthropic = inject(AnthropicService);
  private readonly destroyRef = inject(DestroyRef);

  readonly request = input.required<ExplainRequest>();

  protected readonly hasKey = this.anthropic.hasApiKey;
  protected readonly phase = signal<Phase>('idle');
  protected readonly text = signal<string>('');
  protected readonly error = signal<AnthropicError | null>(null);

  protected readonly isStreaming = computed(() => this.phase() === 'streaming');
  protected readonly hasText = computed(() => this.text().length > 0);

  private controller: AbortController | null = null;

  protected readonly Sparkles = Sparkles;
  protected readonly Square = Square;
  protected readonly RotateCw = RotateCw;
  protected readonly TriangleAlert = TriangleAlert;
  protected readonly KeyRound = KeyRound;

  constructor() {
    // Abort any in-flight stream if the component is torn down (e.g. next Q).
    this.destroyRef.onDestroy(() => this.controller?.abort());
  }

  protected async run(): Promise<void> {
    if (this.isStreaming()) return;
    this.controller?.abort();
    this.controller = new AbortController();
    this.text.set('');
    this.error.set(null);
    this.phase.set('streaming');

    try {
      for await (const delta of this.anthropic.stream(
        this.request(),
        this.controller.signal,
      )) {
        this.text.update((t) => t + delta);
      }
      this.phase.set('done');
    } catch (err) {
      if (err instanceof AnthropicError && err.kind === 'aborted') {
        // User-initiated stop: keep whatever streamed so far.
        this.phase.set(this.hasText() ? 'done' : 'idle');
        return;
      }
      this.error.set(
        err instanceof AnthropicError
          ? err
          : new AnthropicError('unknown', 'Something went wrong.'),
      );
      this.phase.set('error');
    } finally {
      this.controller = null;
    }
  }

  protected stop(): void {
    this.controller?.abort();
  }

  protected errorMessage(): string {
    const e = this.error();
    if (!e) return '';
    switch (e.kind) {
      case 'rate-limit':
        return e.retryAfterSec
          ? `Rate limited — retry in ${e.retryAfterSec}s.`
          : 'Rate limited — please retry shortly.';
      case 'network':
        return 'Network error. Check your connection and retry.';
      case 'server':
        return 'The API had a server error. Try again.';
      default:
        return e.message;
    }
  }
}
