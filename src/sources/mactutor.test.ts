import { describe, it, expect } from 'vitest';
import chrono from './fixtures/mactutor-chronological.html?raw';
import noether from './fixtures/mactutor-noether.html?raw';
import gauss from './fixtures/mactutor-gauss.html?raw';
import { parseBiography, parseChronological, readBiography } from './mactutor';

describe('MacTutor chronological index (real page, first 60 list items)', () => {
  it('lists biographies with their dates and skips menu links', () => {
    const entries = parseChronological(chrono);
    // 60 items, one of them the empty `../test/` link the real page carries.
    expect(entries.length).toBe(59);
    expect(entries.some((e) => e.key === 'test')).toBe(false);
    expect(entries[0]).toEqual({ key: 'Ahmes', title: 'Ahmes', detail: '1680 BC - 1620 BC' });
    expect(entries.some((e) => e.key.startsWith('category-') || e.key === 'chronological')).toBe(false);
  });
});

describe('MacTutor biography (real page, Emmy Noether)', () => {
  const b = parseBiography(noether);

  it('reads the name, Quick Info and the authors', () => {
    expect(b.name).toBe('Emmy Amalie Noether');
    expect(b.born).toContain('23 March 1882');
    expect(b.died).toContain('14 April 1935');
    expect(b.writtenBy).toBe("J J O'Connor and E F Robertson");
  });

  it('takes its date from the page’s own "Last Update" line', () => {
    expect(b.lastUpdate).toBe('November 2014');
  });

  it('keeps quotations and drops the translation marks and popups', () => {
    expect(b.text).toContain('> Emmy did not appear exceptional as a child.');
    expect(b.text).not.toContain('Ⓣ');
    expect(b.text).not.toContain('data-popup');
    expect(b.text).not.toMatch(/<\/?span/);
  });

  it('a page without "Last Update" gives a memory with NO date', async () => {
    const undated = noether.replace(/Last Update [A-Z][a-z]+ \d{4}/, '');
    const unit = await readBiography(async () => undated, { key: 'Noether_Emmy', title: 'Emmy Noether' });
    expect(unit.date).toBeUndefined();
    const dated = await readBiography(async () => noether, { key: 'Noether_Emmy', title: 'Emmy Noether' });
    expect(dated.date).toBe('Last update stated by the page: November 2014');
    expect(dated.url).toBe('https://mathshistory.st-andrews.ac.uk/Biographies/Noether_Emmy/');
  });

  it('refuses a page that is not a biography', () => {
    expect(() => parseBiography('<html><body><p>nothing</p></body></html>')).toThrow('MACTUTOR_NOT_A_BIOGRAPHY');
  });
});

describe('MacTutor formulas (real page, Gauss)', () => {
  it('keeps each KaTeX formula once, as its LaTeX', () => {
    const b = parseBiography(gauss);
    expect(b.text).toContain(String.raw`$\mathbb{R}^{3}$`);
    expect(b.text).not.toContain(String.raw`R3\mathbb{R}^{3}R3`);
    expect(b.text).not.toMatch(/R3\s*\$\mathbb/);
  });
});
