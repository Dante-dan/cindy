import http from 'node:http';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOllamaVersion, OllamaHttpError, streamOllamaPull } from '../ollamaClient.js';

describe('fetchOllamaVersion', () => {
  it('accepts a version JSON body', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ version: '0.32.13' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(fetchOllamaVersion(fetchImpl)).resolves.toEqual({ version: '0.32.13' });
  });

  it('treats a non-Ollama HTTP body as a port conflict', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>not ollama</html>', { status: 200 }));
    await expect(fetchOllamaVersion(fetchImpl)).rejects.toMatchObject({
      kind: 'conflict',
    } satisfies Partial<OllamaHttpError>);
  });
});

// #6311: exercise the production pull entry with in-memory HTTP events (unit tier).
// Existing version probes do not cover HTTP pull errors, NDJSON completion or local transport failures.
// Minimal failing inputs: a 500 {error} response, or ECONNREFUSED at the loopback request.
describe('streamOllamaPull diagnostics', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockPull(statusCode: number, chunks: string[], requestError?: Error) {
    const response = Object.assign(new EventEmitter(), {
      statusCode,
      setEncoding: vi.fn(),
      resume: vi.fn(),
    });
    const request = Object.assign(new EventEmitter(), {
      write: vi.fn(),
      destroy: vi.fn(),
      end: () =>
        queueMicrotask(() => {
          if (requestError) request.emit('error', requestError);
          else {
            callback(response as unknown as http.IncomingMessage);
            for (const chunk of chunks) response.emit('data', chunk);
            response.emit('end');
          }
        }),
    });
    let callback: (response: http.IncomingMessage) => void;
    vi.spyOn(http, 'request').mockImplementation(((
      _options: unknown,
      onResponse: typeof callback,
    ) => {
      callback = onResponse;
      return request;
    }) as typeof http.request);
    return request;
  }

  it('retains the Ollama error from a failed HTTP response and redacts credentials', async () => {
    mockPull(500, ['{"error":"pull model manifest: unauthorized token=', 'private-value"}']);
    await expect(streamOllamaPull('example:Q6_K', vi.fn())).rejects.toMatchObject({
      kind: 'http',
      message: 'ollama /api/pull failed (500): pull model manifest: unauthorized token=[REDACTED]',
    });
  });

  it('falls back to status for non-JSON error pages', async () => {
    mockPull(502, ['<html>private proxy page</html>']);
    await expect(streamOllamaPull('example:Q6_K', vi.fn())).rejects.toMatchObject({
      kind: 'http',
      message: 'ollama /api/pull failed (502)',
    });
  });

  it('identifies a refused local request without confusing a remote download failure', async () => {
    mockPull(
      0,
      [],
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' }),
    );
    await expect(streamOllamaPull('example:Q6_K', vi.fn())).rejects.toMatchObject({
      kind: 'refused',
      message: 'ollama is not reachable',
    });
  });

  it('keeps successful streamed pulls and custom quantization names intact', async () => {
    const request = mockPull(200, ['{"status":"pulling manifest"}\n', '{"status":"success"}']);
    const onEvent = vi.fn();
    await expect(streamOllamaPull('example:Q6_K', onEvent)).resolves.toBeUndefined();
    expect(request.write).toHaveBeenCalledWith(
      JSON.stringify({ name: 'example:Q6_K', stream: true }),
    );
    expect(onEvent).toHaveBeenLastCalledWith({ status: 'success' });
  });
});
