import { describe, it, expect, vi } from 'vitest';
import astronomy from './fixtures/openstax-astronomy-2e.collection.xml?raw';
import quimica from './fixtures/openstax-quimica-2ed.collection.xml?raw';
import physicsModule from './fixtures/openstax-m58284.cnxml?raw';
import { bookEntries, licenceOf, moduleText, parseCollection, pushedAt, readModule } from './openstax';

describe('OpenStax collection (real file, Astronomy 2e, 2026-10-04)', () => {
  const plan = parseCollection(astronomy);

  it('reads the title, the language and every module with its chapter', () => {
    expect(plan.title).toBe('Astronomy 2e');
    expect(plan.lang).toBe('en');
    expect(plan.modules).toHaveLength(199);
    expect(plan.modules[0]).toEqual({ id: 'm63293', chapter: [] });
    expect(plan.modules.find((m) => m.id === 'm59747')?.chapter).toEqual(['Science and the Universe: A Brief Tour']);
  });

  it('copies the licence text AND its url from md:license', () => {
    expect(licenceOf(plan)).toBe('Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (http://creativecommons.org/licenses/by-nc-sa/4.0/)');
  });

  it('a licence tag with no text gives its url alone, never a name filled in (Química 2ed)', () => {
    const q = parseCollection(quimica);
    expect(q.licence).toBe('');
    expect(licenceOf(q)).toBe('http://creativecommons.org/licenses/by/4.0/');
  });

  it('names modules from the shipped list, and an unknown id by its id', () => {
    const entries = bookEntries('astronomy-2e', plan);
    expect(entries.find((e) => e.key === 'm59747')?.title).toBe('The Nature of Astronomy');
    expect(bookEntries('not-a-book', plan)[1]?.title).toBe('m59743');
  });
});

describe('OpenStax module text (real module m58284, University Physics 1)', () => {
  const { title, text } = moduleText(physicsModule);

  it('keeps the prose and turns each equation into a readable line, never a hole', () => {
    expect(title).toBe('Average and Instantaneous Acceleration');
    expect(text).toContain('average acceleration');
    expect(text).toMatch(/\(Δv\)\/\(Δt\)/);
    expect(text).not.toMatch(/<m:|<\/?para/);
    // An equation that vanished leaves "where  is" behind.
    expect(text).not.toMatch(/where\s{2,}is/);
  });

  it('keeps figure captions and drops images', () => {
    expect(text).toContain('[Figure]');
    expect(text).not.toContain('.jpg');
  });
});

describe('readModule', () => {
  const plan = parseCollection(astronomy);
  const book = { repo: 'osbooks-astronomy', slug: 'astronomy-2e' };

  it('titles the unit with the book and the chapter, and has NO date when the repository date is unknown', async () => {
    const fetch = vi.fn(async () => physicsModule);
    const unit = await readModule(fetch, book, plan, 'm59747');
    expect(fetch).toHaveBeenCalledWith('https://raw.githubusercontent.com/openstax/osbooks-astronomy/main/modules/m59747/index.cnxml', undefined);
    expect(unit.title).toBe('OpenStax · Astronomy 2e › Science and the Universe: A Brief Tour · Average and Instantaneous Acceleration');
    expect(unit.date).toBeUndefined();
    expect(unit.licence).toContain('NonCommercial');
  });

  it('carries the repository date when it was read', async () => {
    const unit = await readModule(async () => physicsModule, book, plan, 'm59747', { repoPushedAt: '2026-10-01T10:00:00Z' });
    expect(unit.date).toBe('Repository last updated 2026-10-01T10:00:00Z');
  });

  it('reads pushed_at only when it looks like a date', () => {
    expect(pushedAt({ pushed_at: '2026-10-01T10:00:00Z' })).toBe('2026-10-01T10:00:00Z');
    expect(pushedAt({ message: 'API rate limit exceeded' })).toBeUndefined();
    expect(pushedAt(null)).toBeUndefined();
  });
});
