import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// jsdom does not expose the web-streams globals; pull them from Node.
import { ReadableStream } from 'node:stream/web';
import { TestBed } from '@angular/core/testing';
import { AnthropicError, AnthropicService } from './anthropic.service';
import { STORAGE } from '../tokens/injection-tokens';

// --- Fakes -----------------------------------------------------------------

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(enc.encode(e));
      controller.close();
    },
  });
}

function delta(text: string): string {
  return (
    'event: content_block_delta\n' +
    `data: ${JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    })}\n\n`
  );
}

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const d of gen) out += d;
  return out;
}

// --- Suite -----------------------------------------------------------------

describe('AnthropicService', () => {
  let service: AnthropicService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: STORAGE, useFactory: fakeStorage }],
    });
    service = TestBed.inject(AnthropicService);
  });

  afterEach(() => vi.restoreAllMocks());

  const req = {
    questionText: 'What is a signal?',
    correctAnswer: 'A',
    userAnswer: 'B',
    topic: 'signals',
  };

  it('reports no key initially and reacts to setApiKey', () => {
    expect(service.hasApiKey()).toBe(false);
    service.setApiKey('sk-ant-test');
    expect(service.hasApiKey()).toBe(true);
    service.clearApiKey();
    expect(service.hasApiKey()).toBe(false);
  });

  it('throws a no-key error when streaming without a key', async () => {
    const gen = service.stream(req, new AbortController().signal);
    await expect(collect(gen)).rejects.toMatchObject({ kind: 'no-key' });
  });

  it('streams and concatenates text deltas from the SSE response', async () => {
    service.setApiKey('sk-ant-test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(sseStream([delta('Hello'), delta(', '), delta('world')]), {
          status: 200,
        }),
      ),
    );

    const text = await collect(service.stream(req, new AbortController().signal));
    expect(text).toBe('Hello, world');
  });

  it('ignores non-text events and keep-alive lines', async () => {
    service.setApiKey('sk-ant-test');
    const ping = 'event: ping\ndata: {"type":"ping"}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(sseStream([ping, delta('ok'), 'data: [DONE]\n\n']), {
          status: 200,
        }),
      ),
    );

    const text = await collect(service.stream(req, new AbortController().signal));
    expect(text).toBe('ok');
  });

  it('maps a 401 to an auth error', async () => {
    service.setApiKey('bad');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('no', { status: 401 })),
    );
    await expect(
      collect(service.stream(req, new AbortController().signal)),
    ).rejects.toMatchObject({ kind: 'auth' });
  });

  it('maps a 429 to a rate-limit error with retry-after seconds', async () => {
    service.setApiKey('ok');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('slow down', {
          status: 429,
          headers: { 'retry-after': '12' },
        }),
      ),
    );
    try {
      await collect(service.stream(req, new AbortController().signal));
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(AnthropicError);
      expect((err as AnthropicError).kind).toBe('rate-limit');
      expect((err as AnthropicError).retryAfterSec).toBe(12);
    }
  });

  it('surfaces an aborted error when the signal is already aborted', async () => {
    service.setApiKey('ok');
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new DOMException('Aborted', 'AbortError'),
      ),
    );
    await expect(
      collect(service.stream(req, controller.signal)),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });
});
