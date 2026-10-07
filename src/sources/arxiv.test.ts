import { describe, it, expect } from 'vitest';
import feed from './fixtures/arxiv-hist-ph.xml?raw';
import { arxivDate, arxivUnit, parseFeed, queryUrl } from './arxiv';
import { createThrottle } from './http';

describe('arXiv feed (real answer, physics.hist-ph, 3 newest)', () => {
  const { total, entries } = parseFeed(feed);

  it('reads the total and each abstract with its authors and dates', () => {
    expect(total).toBe(5746);
    expect(entries).toHaveLength(3);
    const a = entries[0]!;
    expect(a.id).toBe('2609.38292v1');
    expect(a.authors).toEqual(['Kartik Tiwari']);
    expect(a.categories).toContain('physics.hist-ph');
    expect(a.published).toBe('2026-09-29T17:23:38Z');
    expect(a.url).toBe('https://arxiv.org/abs/2609.38292v1');
  });

  it('never names a licence: the feed carries none', () => {
    const unit = arxivUnit(entries[0]!);
    expect(unit.licence).toMatch(/per article/);
    expect(unit.licence).not.toMatch(/Creative Commons|CC BY/);
    expect(unit.text).toContain('Abstract:');
  });

  it('dates with the feed’s own fields, and with nothing when it has none', () => {
    expect(arxivDate({ published: '2026-01-01T00:00:00Z', updated: '2026-02-01T00:00:00Z' })).toBe('Submitted 2026-01-01T00:00:00Z, last updated 2026-02-01T00:00:00Z');
    expect(arxivDate({})).toBeUndefined();
  });

  it('asks the newest first', () => {
    expect(queryUrl('math.HO', 50)).toContain('sortBy=submittedDate&sortOrder=descending&start=50');
  });
});

describe('the 3-second gap arXiv asks for', () => {
  it('spaces the start of every call by at least the gap, in order', async () => {
    let clock = 0;
    const waits: number[] = [];
    const run = createThrottle(3000, () => clock, async (ms) => { waits.push(ms); clock += ms; });
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map(() => run(async () => { starts.push(clock); clock += 500; })));
    expect(starts).toEqual([0, 3000, 6000]);
    expect(waits).toEqual([2500, 2500]);
  });

  it('a failed call does not jam the queue', async () => {
    let clock = 0;
    const run = createThrottle(3000, () => clock, async (ms) => { clock += ms; });
    await expect(run(async () => { throw new Error('HTTP_503'); })).rejects.toThrow('HTTP_503');
    await expect(run(async () => 'ok')).resolves.toBe('ok');
  });
});
