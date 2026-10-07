import { describe, it, expect, vi } from 'vitest';
import core from './fixtures/oeis-core.json';
import { OEIS_MAX_RESULTS, aNumber, parseResults, searchPage, sequenceEntry, sequenceUnit } from './oeis';

describe('OEIS search (real answer, keyword:core, 2 sequences)', () => {
  const seqs = parseResults(core);

  it('reads each sequence with its revision and time', () => {
    expect(seqs).toHaveLength(2);
    const s = seqs[0]!;
    expect(s.number).toBe(1221);
    expect(typeof s.revision).toBe('number');
    expect(s.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sequenceEntry(s).key).toBe('A001221');
  });

  it('dates the memory with the sequence’s last revision and keeps code out of the text', () => {
    const unit = sequenceUnit(seqs[0]!);
    expect(unit.date).toBe(`Revision #${seqs[0]!.revision} of ${seqs[0]!.time}`);
    expect(unit.text).toContain('Terms');
    expect(unit.text).not.toMatch(/\(PARI\)|\(Python\)|Table\[/);
    expect(unit.licence).toBe('Creative Commons Attribution Share-Alike 4.0 license (CC-BY-SA-4.0)');
    expect(unit.url).toBe('https://oeis.org/A001221');
  });

  it('a sequence without a time has no date', () => {
    expect(sequenceUnit({ number: 45, name: 'Fibonacci numbers' }).date).toBeUndefined();
  });

  it('"null" (no match) is an empty page, anything else unexpected is an error', () => {
    expect(parseResults(null)).toEqual([]);
    expect(() => parseResults({ error: 'x' })).toThrow('OEIS_UNEXPECTED_ANSWER');
    expect(aNumber(45)).toBe('A000045');
  });

  it('never asks past the 110 results the OEIS shows without an account (200 at start=100, 403 at 110)', async () => {
    const fetch = vi.fn(async () => '[]');
    expect(await searchPage(fetch, 'keyword:core', OEIS_MAX_RESULTS)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(OEIS_MAX_RESULTS).toBe(110);
    await searchPage(fetch, 'keyword:core', 100);
    expect(fetch).toHaveBeenCalledWith('https://oeis.org/search?q=keyword%3Acore&fmt=json&start=100', undefined);
  });
});
