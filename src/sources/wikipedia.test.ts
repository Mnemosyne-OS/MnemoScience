import { describe, it, expect, vi } from 'vitest';
import members from './fixtures/wikipedia-members-fr-astronomie.json';
import parse from './fixtures/wikipedia-parse-schrodinger.json';
import rev from './fixtures/wikipedia-rev-schrodinger.json';
import { normalizeBlankLines } from './htmlText';
import { MEMBER_CAP, listCategory, membersUrl, parseHtmlAnswer, parseMembers, parseRevision, readPage, revisionDate, wikiHtmlText, WIKI_ROOTS } from './wikipedia';

describe('Wikipedia members (real answer, Catégorie:Astronomie, fr, 2026-10-04)', () => {
  const m = parseMembers(members);

  it('splits articles from sub-categories and keeps the page counts', () => {
    expect(m.pages.length).toBeGreaterThan(40);
    expect(m.pages.some((p) => p.title === 'Astronomie' && p.key === '64')).toBe(true);
    const mec = m.subcats.find((c) => c.title === 'Catégorie:Mécanique céleste');
    expect(mec?.pages).toBe(117);
    expect(m.cont).toBeUndefined();
  });

  it('sorts both lists for a person to read', () => {
    const titles = m.pages.map((p) => p.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('asks for articles and sub-categories only (no Portal: pages)', () => {
    const url = new URL(membersUrl('en', WIKI_ROOTS.physics.en));
    expect(url.searchParams.get('gcmnamespace')).toBe('0|14');
    expect(url.searchParams.get('origin')).toBe('*');
  });

  it('stops at MEMBER_CAP and says the list was cut', async () => {
    expect(MEMBER_CAP).toBe(2000);
    let n = 0;
    const fetch = vi.fn(async () => ({ query: { pages: Array.from({ length: 500 }, () => ({ pageid: ++n, ns: 0, title: `P${n}` })) }, continue: { gcmcontinue: 'more' } }));
    const res = await listCategory(fetch, 'en', 'Category:Huge');
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(res.pages).toHaveLength(2000);
    expect(res.capped).toBe(true);
  });

  it('follows gcmcontinue until the end', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ query: { pages: [{ pageid: 1, ns: 0, title: 'B' }] }, continue: { gcmcontinue: 'x' } })
      .mockResolvedValueOnce({ query: { pages: [{ pageid: 2, ns: 0, title: 'A' }] } });
    const res = await listCategory(fetch, 'en', 'Category:X');
    expect(res.pages.map((p) => p.title)).toEqual(['A', 'B']);
    expect(res.capped).toBe(false);
    expect(fetch.mock.calls[1]![0]).toContain('gcmcontinue=x');
  });
});

describe('Wikipedia page (real answers, "Schrödinger equation", en, HTML cut at 165 KB)', () => {
  const html = parseHtmlAnswer(parse);
  const text = wikiHtmlText(html);

  it('keeps every formula as its LaTeX: no sentence ends on "where" and nothing', () => {
    expect(html.match(/<math/g)!.length).toBeGreaterThan(50);
    expect(text).toContain(String.raw`$i\hbar {\frac {\partial }{\partial t}}\Psi (x,t)`);
    // The explaintext reader left 17 of these on this page.
    expect(text).not.toMatch(/\bwhere\s*(\n|$)/);
    expect(text).not.toMatch(/\bwhere\s+[,.;:]/);
    expect(text).not.toContain('displaystyle');
  });

  it('never leaves more than one blank line, and no line of spaces', () => {
    expect(text).not.toMatch(/\n[ \t]*\n[ \t]*\n/);
    expect(text.split('\n').some((l) => l.length > 0 && !l.trim())).toBe(false);
  });

  it('drops edit links, references and styles; keeps headings', () => {
    expect(text).not.toMatch(/\[edit\]|\[\d+\]|mw-parser-output/);
    expect(text).toMatch(/^## Definition$/m);
  });

  it('reads the revision as the date, and the text of THAT revision', async () => {
    const r = parseRevision(rev);
    expect(r).toMatchObject({ title: 'Schrödinger equation', revid: 1377056761, timestamp: '2026-09-27T18:14:06Z' });
    const fetch = vi.fn().mockResolvedValueOnce(rev).mockResolvedValueOnce(parse);
    const unit = await readPage(fetch, 'en', { key: '59874', title: 'Schrödinger equation' });
    expect(fetch.mock.calls[1]![0]).toContain('oldid=1377056761');
    expect(unit.title).toBe('Wikipedia (en) · Schrödinger equation');
    expect(unit.date).toBe('Revision 1377056761 of 2026-09-27T18:14:06Z');
    expect(unit.licence).toBe('Creative Commons Attribution-Share Alike 4.0');
  });

  it('a page without a revision has no date at all', () => {
    expect(revisionDate({ revid: null, timestamp: null })).toBeUndefined();
  });

  it('refuses a missing page instead of storing an empty memory', () => {
    expect(() => parseRevision({ query: { pages: [{ ns: 0, title: 'X', missing: true }] } })).toThrow('WIKI_PAGE_MISSING');
  });

  it('drops the reference tail and headings with nothing under them', () => {
    expect(wikiHtmlText('<p>Intro.</p><h2>Empty</h2><h2>History</h2><p>Text.</p><h2>References</h2><p>[1] x</p>')).toBe('Intro.\n\n## History\n\nText.');
  });

  it('turns lines of spaces into empty lines', () => {
    expect(normalizeBlankLines('a\n   \n\t\n\nb  ')).toBe('a\n\nb');
  });
});
