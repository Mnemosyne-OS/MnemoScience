/**
 * types — what every source reader hands to the rest of the cartridge.
 *
 * A source lists ENTRIES (cheap: a title and a key) and reads UNITS (the text
 * of one entry, with everything its source line needs). The memory layer only
 * ever sees units, so a new source is a new reader and nothing else.
 */

/** The sub-domains shown on the home screen, in order. */
export type DomainId = 'physics' | 'chemistry' | 'biology' | 'mathematics' | 'astronomy' | 'history';

export const DOMAINS: readonly DomainId[] = ['physics', 'chemistry', 'biology', 'mathematics', 'astronomy', 'history'];

/** The kinds of source wired in this cartridge (doc 135 §3bis). */
export type SourceKind = 'openstax' | 'wikipedia' | 'planetmath' | 'mactutor' | 'oeis' | 'arxiv';

/** One line of a source's list. `key` is unique inside its source. */
export interface Entry {
  key: string;
  title: string;
  /** A second line: the chapter, the dates of a life, the authors… */
  detail?: string;
}

/** One entry read in full, ready to become memories. */
export interface Unit {
  key: string;
  /** Names the source AND the entry: a chunk retrieved alone must say what it is. */
  title: string;
  text: string;
  /** Where the text comes from, as a phrase: `OpenStax, Astronomy 2e`. */
  origin: string;
  /**
   * How recent the text is, as a phrase read from the source (`revision
   * 1376020512 of 2026-09-21T14:49:27Z`). ABSENT when the source gives none:
   * never today's date, never a guess.
   */
  date?: string;
  /** The licence exactly as the source states it. */
  licence: string;
  /** Where a reader can check the text. */
  url: string;
  /** Language of the text (`en`, `fr`, `es`). */
  lang: string;
}

/** A text fetch with the caller's stop signal. */
export type FetchText = (url: string, signal?: AbortSignal) => Promise<string>;

/** The host bridge's `invoke`, injected so readers are testable without it. */
export type HostInvoke = (action: string, payload?: unknown, timeoutMs?: number) => Promise<unknown>;
