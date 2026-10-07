/**
 * oeis — integer sequences from the On-Line Encyclopedia of Integer
 * Sequences, by search (doc 135 §3bis.3).
 *
 * Measured 2026-10-04:
 *  - `oeis.org/search?q=…&fmt=json` answers a JSON array of 10 sequences per
 *    page (`start=0, 10, …`), no CORS header: read through the host;
 *  - 🪤 `start=100` still answers 200 (results 101-110) and `start=110`
 *    answers HTTP 403 « Sign in to see search results past the first 100 »:
 *    110 results at most, the cartridge never asks for more, the screen says so;
 *  - some searches answer `null` with HTTP 200: no result;
 *  - each sequence carries `revision` and `time` (its last edit): that is the
 *    date of the memory. Code fields (maple, mathematica, program) are left
 *    out of the text, everything that describes the sequence is kept.
 *  - licence: « Creative Commons Attribution Share-Alike 4.0 license (CC-BY-SA-4.0) ».
 */
import { OEIS_LICENCE } from '../domains';
import type { Entry, FetchText, Unit } from './types';

export const OEIS_PAGE = 10;
/** The OEIS shows no more than this many results without an account (measured: 200 at start=100, 403 at 110). */
export const OEIS_MAX_RESULTS = 110;
/** The search the list starts on: the « core » sequences (183 on 2026-10-04, the first 110 reachable). */
export const OEIS_DEFAULT_QUERY = 'keyword:core';

export const searchUrl = (q: string, start: number) => `https://oeis.org/search?q=${encodeURIComponent(q)}&fmt=json&start=${start}`;

export interface OeisSequence {
  number: number;
  name: string;
  data?: string;
  offset?: string;
  comment?: string[];
  formula?: string[];
  example?: string[];
  reference?: string[];
  xref?: string[];
  keyword?: string;
  author?: string;
  revision?: number;
  time?: string;
}

/** `45` → `A000045`. */
export const aNumber = (n: number) => `A${String(n).padStart(6, '0')}`;

const strings = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** One page of results. `null` (what the OEIS answers for no match) is an empty page. */
export function parseResults(json: unknown): OeisSequence[] {
  if (json === null) return [];
  if (!Array.isArray(json)) throw new Error('OEIS_UNEXPECTED_ANSWER');
  const out: OeisSequence[] = [];
  for (const r of json as Record<string, unknown>[]) {
    const number = num(r?.number);
    const name = str(r?.name);
    if (number === undefined || !name) continue;
    const s: OeisSequence = { number, name };
    const data = str(r.data); if (data) s.data = data;
    const offset = str(r.offset); if (offset) s.offset = offset;
    for (const k of ['comment', 'formula', 'example', 'reference', 'xref'] as const) {
      const v = strings(r[k]); if (v?.length) s[k] = v;
    }
    const keyword = str(r.keyword); if (keyword) s.keyword = keyword;
    const author = str(r.author); if (author) s.author = author;
    const revision = num(r.revision); if (revision !== undefined) s.revision = revision;
    const time = str(r.time); if (time) s.time = time;
    out.push(s);
  }
  return out;
}

export function sequenceEntry(s: OeisSequence): Entry {
  return { key: aNumber(s.number), title: `${aNumber(s.number)} ${s.name}`, ...(s.keyword ? { detail: s.keyword } : {}) };
}

/** The text of one sequence: what describes it, in the OEIS's own words and order. */
export function sequenceText(s: OeisSequence): string {
  const block = (label: string, lines?: string[]) => (lines?.length ? `${label}:\n${lines.map((l) => `- ${l}`).join('\n')}` : '');
  return [
    s.name,
    s.data ? `Terms${s.offset ? ` (offset ${s.offset})` : ''}: ${s.data.replace(/,$/, '')}` : '',
    block('Comments', s.comment),
    block('Formulas', s.formula),
    block('Examples', s.example),
    block('References', s.reference),
    block('Cross-references', s.xref),
    s.keyword ? `Keywords: ${s.keyword}` : '',
    s.author ? `Author: ${s.author}` : '',
  ].filter(Boolean).join('\n\n');
}

export function sequenceDate(s: Pick<OeisSequence, 'revision' | 'time'>): string | undefined {
  if (s.time && s.revision !== undefined) return `Revision #${s.revision} of ${s.time}`;
  if (s.time) return `Last edited ${s.time}`;
  return undefined;
}

export function sequenceUnit(s: OeisSequence): Unit {
  const a = aNumber(s.number);
  const date = sequenceDate(s);
  return {
    key: a,
    title: `OEIS · ${a} · ${s.name}`,
    text: sequenceText(s),
    origin: `The On-Line Encyclopedia of Integer Sequences, ${a}`,
    ...(date ? { date } : {}),
    licence: OEIS_LICENCE,
    url: `https://oeis.org/${a}`,
    lang: 'en',
  };
}

/** One page of a search. A start at or past the cap is never requested. */
export async function searchPage(fetchText: FetchText, q: string, start: number, signal?: AbortSignal): Promise<OeisSequence[]> {
  if (start >= OEIS_MAX_RESULTS) return [];
  const body = await fetchText(searchUrl(q, start), signal);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (err) {
    console.error('[mnemo-science] OEIS answer is not JSON', err);
    throw new Error('OEIS_UNEXPECTED_ANSWER');
  }
  return parseResults(json);
}
