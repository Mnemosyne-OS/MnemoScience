import { describe, it, expect, vi } from 'vitest';
import { DIRECT_TIMEOUT_MS, fetchText, hostAnswerText, hostFetcher, withRetry, withTimeout } from './http';

describe('social.fetch answers', () => {
  it('refuses a truncated body: a prefix is never parsed as a whole text', async () => {
    expect(() => hostAnswerText({ status: 200, body: '<html>…', encoding: 'utf8', truncated: true })).toThrow('HOST_FETCH_TRUNCATED');
    const fetch = hostFetcher(async () => ({ status: 200, body: '[{"number":45}', encoding: 'utf8', truncated: true }));
    await expect(fetch('https://oeis.org/search?q=x&fmt=json')).rejects.toThrow('HOST_FETCH_TRUNCATED');
  });

  it('decodes a base64 body as UTF-8', () => {
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode('Nöther')));
    expect(hostAnswerText({ body: b64, encoding: 'base64', truncated: false })).toBe('Nöther');
  });

  it('refuses an answer without a body', () => {
    expect(() => hostAnswerText(undefined)).toThrow('HOST_FETCH_NO_BODY');
  });

  it('asks the host with the url and a deadline above its own 12 s', async () => {
    const invoke = vi.fn(async () => ({ body: 'ok', encoding: 'utf8', truncated: false }));
    await hostFetcher(invoke)('https://example.org/');
    expect(invoke).toHaveBeenCalledWith('social.fetch', { url: 'https://example.org/' }, 20_000);
  });
});

describe('a Stop that arrives while the host is answering', () => {
  it('is honoured: the answer is dropped', async () => {
    const ctrl = new AbortController();
    const invoke = vi.fn(async () => { ctrl.abort(); return { body: 'late', encoding: 'utf8', truncated: false }; });
    await expect(hostFetcher(invoke)('https://example.org/', ctrl.signal)).rejects.toThrow(/Abort/);
  });
});

describe('fetchText', () => {
  it('always sends a deadline, combined with the caller signal, and refuses a non-2xx', async () => {
    expect(DIRECT_TIMEOUT_MS).toBe(30_000);
    const seen: (AbortSignal | undefined)[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => {
      seen.push(init?.signal ?? undefined);
      return new Response('nope', { status: 503 });
    });
    try {
      await expect(fetchText('https://x/')).rejects.toThrow('HTTP_503');
      expect(seen[0]).toBeInstanceOf(AbortSignal);
      const ctrl = new AbortController();
      ctrl.abort();
      await expect(fetchText('https://x/', ctrl.signal)).rejects.toThrow('HTTP_503');
      expect(seen[1]!.aborted).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('withTimeout', () => {
  it('turns a call that never answers into a named timeout', async () => {
    vi.useFakeTimers();
    try {
      const p = withTimeout(new Promise(() => undefined), 15_000, 'SANDBOX');
      vi.advanceTimersByTime(15_000);
      await expect(p).rejects.toThrow('SANDBOX_TIMEOUT');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('withRetry', () => {
  it('gives up on a 5xx after 4 retries (5 tries in all)', async () => {
    const wait = vi.fn(async () => undefined);
    const down = vi.fn().mockRejectedValue(new Error('HTTP_502'));
    await expect(withRetry(down, wait)('u')).rejects.toThrow('HTTP_502');
    expect(down).toHaveBeenCalledTimes(5);
    expect(wait.mock.calls.map((c) => (c as unknown as [number])[0])).toEqual([2000, 4000, 8000, 16000]);
  });

  it('retries a server error, never a 404', async () => {
    const wait = vi.fn(async () => undefined);
    const flaky = vi.fn().mockRejectedValueOnce(new Error('HTTP_503')).mockResolvedValueOnce('ok');
    expect(await withRetry(flaky, wait)('u')).toBe('ok');
    const missing = vi.fn().mockRejectedValue(new Error('HTTP_404'));
    await expect(withRetry(missing, wait)('u')).rejects.toThrow('HTTP_404');
    expect(missing).toHaveBeenCalledTimes(1);
  });
});
