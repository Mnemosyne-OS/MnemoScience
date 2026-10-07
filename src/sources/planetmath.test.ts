import { describe, it, expect, vi } from 'vitest';
import tree from './fixtures/planetmath-tree-11.json';
import tex from './fixtures/planetmath-ConverseOfWilsonsTheorem.tex?raw';
import { PM_CLASSES, fetchClassTree, mscFromPath, nameFromPath, parseTex, parseTree, rateInfo, readEntry } from './planetmath';

describe('PlanetMath tree (real answer, 11_Number_theory, first 40 paths)', () => {
  it('keeps the .tex entries only, with their MSC code', () => {
    const { entries, truncated } = parseTree(tree);
    expect(truncated).toBe(false);
    expect(entries.length).toBeGreaterThan(5);
    expect(entries.every((e) => e.key.endsWith('.tex'))).toBe(true);
    const wilson = entries.find((e) => e.key === '11-00-ConverseOfWilsonsTheorem.tex');
    expect(wilson).toEqual({ key: '11-00-ConverseOfWilsonsTheorem.tex', title: 'Converse Of Wilsons Theorem', detail: 'MSC 11-00' });
  });

  it('reads both file-name forms of the repositories', () => {
    expect(mscFromPath('11A05-AbundantNumber.tex')).toBe('11A05');
    expect(nameFromPath('11A05-AbundantNumber.tex')).toBe('Abundant Number');
    expect(mscFromPath('11-00-Coprime.tex')).toBe('11-00');
  });

  it('lists 63 classes, without the 2016 edition', () => {
    expect(PM_CLASSES).toHaveLength(63);
    expect(PM_CLASSES.some((c) => c.repo === 'fem2016')).toBe(false);
  });
});

describe('PlanetMath entry (real file)', () => {
  it('reads the title, the entry modification date and the body, comments removed', () => {
    const e = parseTex(tex);
    expect(e.title).toBe("converse of Wilson's theorem");
    expect(e.modified).toBe('2013-03-22 17:58:55');
    expect(e.msc).toBe('11-00');
    expect(e.body.startsWith('{\\bf Theorem}')).toBe(true);
    expect(e.body).not.toContain('%%%%%');
  });

  it('dates the memory with the entry, and leaves the date out when the file has none', async () => {
    const cls = PM_CLASSES.find((c) => c.repo === '11_Number_theory')!;
    const entry = { key: '11-00-ConverseOfWilsonsTheorem.tex', title: 'x' };
    const unit = await readEntry(async () => tex, cls, entry);
    expect(unit.date).toBe('Entry last modified 2013-03-22 17:58:55');
    expect(unit.licence).toBe('Creative Commons Attribution-ShareAlike 3.0 Unported');
    expect(unit.origin).toContain('no longer updated');
    const undated = await readEntry(async () => tex.replace(/\\pmmodified\{[^}]*\}/, ''), cls, entry);
    expect(undated.date).toBeUndefined();
  });
});

describe('GitHub quota', () => {
  it('reads what is left and when it comes back', () => {
    const h = new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790000000' });
    expect(rateInfo(h)).toEqual({ remaining: 0, reset: new Date(1790000000 * 1000).toISOString() });
    expect(rateInfo(new Headers())).toEqual({ remaining: null, reset: null });
  });

  it('a spent quota is said as such, with the reset time', async () => {
    const fake = vi.fn(async () => new Response('{"message":"API rate limit exceeded"}', {
      status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790000000' },
    }));
    await expect(fetchClassTree('11_Number_theory', undefined, fake as unknown as typeof fetch))
      .rejects.toThrow(`GITHUB_RATE_LIMIT|${new Date(1790000000 * 1000).toISOString()}`);
  });
});
