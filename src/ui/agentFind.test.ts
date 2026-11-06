import { describe, expect, it } from 'vitest';
import { findNamed, nameWords, type Named } from './agentFind';

const src = (id: string, ...names: string[]): Named<string> => ({ item: id, id, names, label: `${names[0]} (${id})` });
const SOURCES = [
  src('oeis', 'OEIS', 'suites'),
  src('book-1', 'Calculus Volume 1', 'manuel'),
  src('book-2', 'Calculus Volume 2', 'manuel'),
  src('wiki-p', 'Wikipedia', 'physique'),
  src('wiki-c', 'Wikipedia', 'chimie'),
];
const kind = { code: 'NO_SOURCE', noun: 'source' };

describe('a source named the way a person says it', () => {
  it('folds case, accents, fillers and a plural', () => {
    expect(nameWords("les Suites de l'OEIS")).toEqual(['suite', 'oei']);
    expect(nameWords('Wikipédia en CHIMIE')).toEqual(['wikipedia', 'chimie']);
  });

  it('an id, the whole name, or every word of it', () => {
    expect(findNamed(SOURCES, 'book-2', kind)).toBe('book-2');
    expect(findNamed(SOURCES, "les suites de l'OEIS", kind)).toBe('oeis');
    expect(findNamed(SOURCES, 'calculus tome 1', kind)).toBe('book-1');
    expect(findNamed(SOURCES, 'wikipédia chimie', kind)).toBe('wiki-c');
  });

  it('several matches are refused with their names, never the first taken', () => {
    expect(() => findNamed(SOURCES, 'le manuel', kind)).toThrow('AMBIGUOUS: "le manuel" names several sources: Calculus Volume 1 (book-1), Calculus Volume 2 (book-2); say which');
    expect(() => findNamed(SOURCES, 'Wikipedia', kind)).toThrow(/^AMBIGUOUS/);
  });

  it('no match is refused with the names that exist', () => {
    expect(() => findNamed(SOURCES, 'PubMed', kind)).toThrow(/^NO_SOURCE: no source named "PubMed"; sources: OEIS \(oeis\), Calculus Volume 1/);
    expect(() => findNamed(SOURCES, '  ', kind)).toThrow(/^BAD_ARG/);
    expect(() => findNamed(SOURCES, 'la', kind)).toThrow(/^NO_SOURCE: "la" names no source/);
    expect(() => findNamed([], 'oeis', kind)).toThrow('sources: none');
  });
});
