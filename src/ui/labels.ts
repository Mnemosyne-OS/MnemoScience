/**
 * labels — small formatting rules shared by the screens. Kept out of the
 * .tsx files so each of those exports a component and nothing else (Fast
 * Refresh refuses a module that mixes the two).
 */
import type { SourceDef } from '../domains';
import type { MemorySummary } from '../memory/library';
import { OEIS_MAX_RESULTS } from '../sources/oeis';
import type { LibRead, T } from './types';

/** The size line of a source tile: measured on 2026-10-04, or read when the list opens. */
export function sizeLine(t: T, lang: string, s: SourceDef): string {
  if ('live' in s.size) return s.size.live === 'category' ? t('size.category') : t('size.search', { max: OEIS_MAX_RESULTS });
  return t(`size.${s.size.unit}` as const, { n: s.size.count.toLocaleString(lang) });
}


/**
 * What is in memory, in words. Nothing written yet is a sentence, never a
 * "0", and "nothing" is said only once the saved library was READ: before
 * that it is "reading", and a failed read is "unreadable".
 */
export function memoryLine(t: T, lang: string, sum: MemorySummary, libRead: LibRead): string {
  if (libRead.kind === 'reading') return t('home.reading');
  if (libRead.kind === 'unreadable') return t('home.unreadable');
  if (sum.entries === 0) return t('home.nothingYet');
  return t('home.inMemory', { n: sum.entries.toLocaleString(lang), date: sum.lastAt ? new Date(sum.lastAt).toLocaleDateString(lang) : '—' });
}

/** Folds case and accents, for the list filters. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
