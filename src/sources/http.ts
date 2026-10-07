/**
 * http — the two ways the cartridge reaches a source.
 *
 *  - Direct `fetch` for a source that answers with CORS `*` (OpenStax and
 *    PlanetMath on raw.githubusercontent.com, the MediaWiki API with
 *    `origin=*`, the GitHub API). Every call carries a deadline (rule 9).
 *  - The host's `social.fetch` action for a source WITHOUT CORS (MacTutor,
 *    OEIS, arXiv). It answers `{ status, body, encoding, truncated,
 *    contentType }`, HTTPS only, 4 MB cap, 12 s timeout, and NO response
 *    headers. `truncated: true` means the body is a PREFIX: it is refused,
 *    never parsed as if whole.
 */
import type { FetchText, HostInvoke } from './types';

/** Deadline of one direct request. A module or a page is small; 30 s covers a slow link. */
export const DIRECT_TIMEOUT_MS = 30_000;

/** Deadline of one host fetch: the host gives up at 12 s, the bridge answer needs a margin. */
export const HOST_TIMEOUT_MS = 20_000;

function withDeadline(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const deadline = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

/** Text from an HTTPS file with CORS. A non-2xx is an error, never an empty text. */
export async function fetchText(url: string, signal?: AbortSignal, headers?: Record<string, string>): Promise<string> {
  const res = await fetch(url, { signal: withDeadline(signal, DIRECT_TIMEOUT_MS), ...(headers ? { headers } : {}) });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.text();
}

/** JSON from an HTTPS endpoint with CORS. */
export async function fetchJson(url: string, signal?: AbortSignal, headers?: Record<string, string>): Promise<unknown> {
  return JSON.parse(await fetchText(url, signal, headers));
}

/** What `social.fetch` answers (host socialHandlers.ts). */
export interface HostFetchAnswer {
  status?: number;
  body?: string;
  encoding?: 'utf8' | 'base64';
  truncated?: boolean;
  contentType?: string;
}

/** Decodes a base64 body as UTF-8 text. */
function base64Text(body: string): string {
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Reads the host's answer. Refused: a truncated body (`HOST_FETCH_TRUNCATED`)
 * and an answer without a text body (`HOST_FETCH_NO_BODY`).
 */
export function hostAnswerText(answer: unknown): string {
  const a = (answer && typeof answer === 'object' ? answer : {}) as HostFetchAnswer;
  if (a.truncated === true) throw new Error('HOST_FETCH_TRUNCATED');
  if (typeof a.body !== 'string') throw new Error('HOST_FETCH_NO_BODY');
  return a.encoding === 'base64' ? base64Text(a.body) : a.body;
}

/**
 * A FetchText that goes through the host. The bridge call cannot be
 * cancelled, so a stop is honoured as soon as the answer arrives.
 */
export function hostFetcher(invoke: HostInvoke): FetchText {
  return async (url, signal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const answer = await invoke('social.fetch', { url }, HOST_TIMEOUT_MS);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return hostAnswerText(answer);
  };
}

/** Waits, or rejects at once when the signal fires. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * A serial gate that keeps at least `gapMs` between the START of two calls
 * (arXiv asks for one request every 3 seconds). Calls queue in order.
 */
export function createThrottle(gapMs: number, now: () => number = Date.now, wait: (ms: number) => Promise<void> = (ms) => sleep(ms)) {
  let last = -Infinity;
  let chain: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(async () => {
      const delay = last + gapMs - now();
      if (delay > 0) await wait(delay);
      last = now();
      return fn();
    });
    // The queue goes on after a failure; the failure still reaches the caller.
    chain = next.catch((err) => { console.warn('[mnemo-science] throttled call failed', err); });
    return next;
  };
}

const RETRY_STATUSES = /^(HTTP_(429|5\d\d)|FETCH_TIMEOUT|TimeoutError|TypeError|Failed to fetch|NetworkError|network)/i;
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000];

/**
 * A fetch that waits and tries again on a rate limit, a server error, a
 * timeout or a network blip (4 retries, 2 s to 16 s). Any other failure is
 * thrown at once: a 404 is an answer, not a blip.
 */
export function withRetry(fetchText: FetchText, wait: (ms: number, signal?: AbortSignal) => Promise<void> = sleep): FetchText {
  return async (url, signal) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchText(url, signal);
      } catch (err) {
        const msg = err instanceof Error ? `${err.name === 'TypeError' || err.name === 'TimeoutError' ? `${err.name} ` : ''}${err.message}` : String(err);
        if (signal?.aborted || attempt >= BACKOFF_MS.length || !RETRY_STATUSES.test(msg)) throw err;
        console.warn('[mnemo-science] fetch failed, retrying', url, msg);
        await wait(BACKOFF_MS[attempt]!, signal);
      }
    }
  };
}

/**
 * A promise with a deadline (rule 9), for the host calls that take no
 * timeout of their own. A late answer is dropped, a missing one is
 * `<code>_TIMEOUT` instead of a screen that waits forever.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${code}_TIMEOUT`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (err) => { clearTimeout(timer); reject(err); });
  });
}
