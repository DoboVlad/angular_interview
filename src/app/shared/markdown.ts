import { marked } from 'marked';

// Configure marked once for the whole app. GFM, line breaks, no deprecated
// mangling. `marked.parse` is synchronous given our synchronous config.
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Renders trusted markdown (our own question bank + streamed model output) to
 * an HTML string. Note: content originates from our JSON or the Anthropic API,
 * both of which we treat as trusted; we still rely on Angular's sanitizer at
 * the binding site as defence-in-depth.
 */
export function renderMarkdown(src: string): string {
  if (!src) return '';
  return marked.parse(src, { async: false }) as string;
}
