import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderMarkdown } from '../../markdown';

/**
 * Renders a markdown string (including fenced code blocks) to styled HTML.
 * Used for question stems, explanations, and streamed AI output. The rendered
 * value is a `computed`, so updating the `markdown` signal input re-renders
 * reactively — ideal for character-by-character streaming.
 */
@Component({
  selector: 'be-code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="be-prose" [innerHTML]="html()"></div>`,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class CodeBlockComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** The markdown source to render. */
  readonly markdown = input<string>('');

  protected readonly html = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(this.markdown())),
  );
}
