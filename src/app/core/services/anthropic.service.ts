import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ANTHROPIC_CONFIG, STORAGE_KEYS } from '../tokens/injection-tokens';

export type AnthropicErrorKind =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'aborted'
  | 'server'
  | 'unknown';

export class AnthropicError extends Error {
  constructor(
    readonly kind: AnthropicErrorKind,
    message: string,
    /** For rate limits: seconds to wait before retrying, if provided. */
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

/** The shape of context we send to the model for a "go deeper" explanation. */
export interface ExplainRequest {
  readonly questionText: string;
  readonly correctAnswer: string;
  readonly userAnswer: string;
  readonly topic: string;
}

const SYSTEM_PROMPT =
  'You are a principal Angular engineer conducting a technical interview. ' +
  'Explain concepts with precision. Always include a realistic Angular 22 code ' +
  'example using Signals, Signal Forms, or resource() where relevant. ' +
  'Be concise but complete. Format with markdown.';

/**
 * Direct, streaming browser call to the Anthropic Messages API. Parses the SSE
 * stream and yields text deltas. Abortable via a caller-supplied AbortSignal.
 *
 * NOTE: calling Anthropic directly from the browser exposes the API key to the
 * user's machine. This is acceptable for a personal, client-side study tool —
 * the Settings screen states this plainly — but never ship a shared key.
 */
@Injectable({ providedIn: 'root' })
export class AnthropicService {
  private readonly storage = inject(StorageService);
  private readonly config = inject(ANTHROPIC_CONFIG);

  /** The stored key as a signal so the UI reacts to it being set/cleared. */
  private readonly apiKey = signal<string | null>(
    this.storage.readString(STORAGE_KEYS.apiKey),
  );
  readonly hasApiKey = computed(() => {
    const k = this.apiKey();
    return k !== null && k.trim().length > 0;
  });

  setApiKey(key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      this.storage.writeString(STORAGE_KEYS.apiKey, trimmed);
      this.apiKey.set(trimmed);
    } else {
      this.clearApiKey();
    }
  }

  clearApiKey(): void {
    this.storage.remove(STORAGE_KEYS.apiKey);
    this.apiKey.set(null);
  }

  /**
   * Streams an explanation, yielding incremental text deltas. Consumers append
   * each delta to a signal and render with marked.js.
   */
  async *stream(
    req: ExplainRequest,
    abortSignal: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    const key = this.apiKey();
    if (!key) {
      throw new AnthropicError('no-key', 'No API key configured.');
    }

    const userContent =
      `Question: ${req.questionText}\n` +
      `Correct answer: ${req.correctAnswer}\n` +
      `User chose: ${req.userAnswer}\n` +
      `Topic: ${req.topic}\n` +
      'Please give a thorough technical explanation with a code example.';

    let response: Response;
    try {
      response = await fetch(this.config.apiUrl, {
        method: 'POST',
        signal: abortSignal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': this.config.version,
          // Required for direct browser-to-API calls.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
    } catch (err) {
      if (this.isAbort(err)) throw new AnthropicError('aborted', 'Aborted.');
      throw new AnthropicError('network', 'Network request failed.');
    }

    if (!response.ok) {
      throw await this.toError(response);
    }
    if (!response.body) {
      throw new AnthropicError('server', 'Empty response stream.');
    }

    yield* this.readSse(response.body, abortSignal);
  }

  /** Reads and decodes the SSE body, yielding `content_block_delta` text. */
  private async *readSse(
    body: ReadableStream<Uint8Array>,
    abortSignal: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (abortSignal.aborted) throw new AnthropicError('aborted', 'Aborted.');
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line.
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const text = this.extractDelta(rawEvent);
          if (text) yield text;
        }
      }
    } catch (err) {
      if (err instanceof AnthropicError) throw err;
      if (this.isAbort(err)) throw new AnthropicError('aborted', 'Aborted.');
      throw new AnthropicError('network', 'Stream interrupted.');
    } finally {
      reader.releaseLock();
    }
  }

  /** Pulls the text out of a single SSE event block, if it is a text delta. */
  private extractDelta(rawEvent: string): string | null {
    for (const line of rawEvent.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]' || data === '') continue;
      try {
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (
          parsed.type === 'content_block_delta' &&
          parsed.delta?.type === 'text_delta' &&
          typeof parsed.delta.text === 'string'
        ) {
          return parsed.delta.text;
        }
      } catch {
        // Partial/non-JSON keep-alive line — ignore.
      }
    }
    return null;
  }

  private async toError(response: Response): Promise<AnthropicError> {
    if (response.status === 401 || response.status === 403) {
      return new AnthropicError('auth', 'Invalid or unauthorised API key.');
    }
    if (response.status === 429) {
      const header = response.headers.get('retry-after');
      const retryAfterSec = header ? Number(header) : undefined;
      return new AnthropicError(
        'rate-limit',
        'Rate limited. Please retry shortly.',
        Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
      );
    }
    if (response.status >= 500) {
      return new AnthropicError('server', `Server error (${response.status}).`);
    }
    return new AnthropicError('unknown', `Request failed (${response.status}).`);
  }

  private isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
  }
}
