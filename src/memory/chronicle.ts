/**
 * chronicle — how a unit becomes memories.
 *
 * Every memory carries the unit's title (source AND entry), the text
 * verbatim, and a SOURCE LINE that closes it: where the text comes from, how
 * recent it is, its licence, and where to check it. A chunk retrieved alone,
 * months later, must still say all of that. A date the source did not give
 * is ABSENT from the line: never today's date, never "unknown date" dressed
 * as a fact.
 */
import type { Unit } from '../sources/types';

/**
 * Largest text in ONE memory. The host cuts a chronicle at 50 000 bytes
 * (`social:ingest`), and 18 000 is DocWatch's part size (doc 57), the same
 * value MnemoLaw uses: a long page reads like any document part.
 */
export const PART_CHARS = 18_000;

/**
 * Splits a text into parts of at most `max` characters, at a blank line in
 * the second half of the window when there is one, else a line break, else a
 * space, else hard. Joined back, the parts are the text.
 */
export function splitText(text: string, max = PART_CHARS): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const floor = Math.floor(max / 2);
    let cut = window.lastIndexOf('\n\n');
    if (cut < floor) cut = window.lastIndexOf('\n');
    if (cut < floor) cut = window.lastIndexOf(' ');
    if (cut < floor) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts;
}

/** The closing line of every memory of a unit. */
export function sourceLine(unit: Pick<Unit, 'origin' | 'date' | 'licence' | 'url'>): string {
  // A licence quoted whole may already end with its own full stop (MacTutor's does).
  const end = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
  const date = unit.date ? ` ${end(unit.date)}` : '';
  return `Source: ${end(unit.origin)}${date} Licence: ${end(unit.licence)} Check at ${unit.url}`;
}

/** The memories of one unit: one, or one per part, each titled and closed by the source line. */
export function unitChronicles(unit: Unit): string[] {
  const parts = splitText(unit.text.trim());
  return parts.map((part, i) => [
    `# ${unit.title}${parts.length > 1 ? ` (part ${i + 1}/${parts.length})` : ''}`,
    '',
    part.trim(),
    '',
    sourceLine(unit),
  ].join('\n'));
}

/** sourceRef of a memory: cartridge, source, entry, and the part when there are several. */
export function unitRef(sourceId: string, key: string, part?: number): string {
  return `mnemo-science:${sourceId}:${key}${part === undefined ? '' : `#${part}`}`;
}
