import { describe, it, expect } from 'vitest';
import { PART_CHARS, sourceLine, splitText, unitChronicles, unitRef } from './chronicle';
import type { Unit } from '../sources/types';

const unit: Unit = {
  key: 'm1', title: 'OpenStax · Astronomy 2e · Orbits', text: 'Kepler.', origin: 'OpenStax, Astronomy 2e',
  licence: 'Creative Commons Attribution License', url: 'https://example.org/m1', lang: 'en',
};

describe('the source line', () => {
  it('a date the source did not give stays ABSENT: no placeholder, no today', () => {
    const line = sourceLine(unit);
    expect(line).toBe('Source: OpenStax, Astronomy 2e. Licence: Creative Commons Attribution License. Check at https://example.org/m1');
    expect(line).not.toMatch(/undefined|unknown|date|\d{4}-\d{2}/i);
  });

  it('a date the source gave is written as read', () => {
    expect(sourceLine({ ...unit, date: 'Revision 12 of 2026-09-21T14:49:27Z' })).toContain('OpenStax, Astronomy 2e. Revision 12 of 2026-09-21T14:49:27Z. Licence:');
  });

  it('a licence quoted with its own full stop does not get a second one', () => {
    expect(sourceLine({ ...unit, licence: 'Licensed under CC BY-SA 4.0.' })).toContain('Licence: Licensed under CC BY-SA 4.0. Check at');
  });

  it('closes every memory, part by part', () => {
    const long = { ...unit, text: `${'a '.repeat(PART_CHARS)}\n\nend` };
    const bodies = unitChronicles(long);
    expect(bodies.length).toBeGreaterThan(1);
    for (const b of bodies) {
      expect(b.split('\n').pop()).toBe(sourceLine(long));
      expect(b.startsWith('# OpenStax · Astronomy 2e · Orbits (part ')).toBe(true);
    }
  });
});

describe('splitText', () => {
  it('cuts at 18,000 characters, the DocWatch part size', () => {
    expect(PART_CHARS).toBe(18_000);
    expect(splitText('a'.repeat(18_000))).toHaveLength(1);
    expect(splitText('a'.repeat(18_001))).toHaveLength(2);
  });

  it('parts join back to the text and never exceed the cap', () => {
    const text = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} ${'word '.repeat(30)}`).join('\n\n');
    const parts = splitText(text, 2000);
    expect(parts.join('')).toBe(text);
    expect(parts.every((p) => p.length <= 2000)).toBe(true);
  });
});

it('refs name the cartridge, the source, the entry and the part', () => {
  expect(unitRef('wikipedia:physics', '42')).toBe('mnemo-science:wikipedia:physics:42');
  expect(unitRef('wikipedia:physics', '42', 2)).toBe('mnemo-science:wikipedia:physics:42#2');
});
