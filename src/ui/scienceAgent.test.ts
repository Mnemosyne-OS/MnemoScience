/**
 * MnemoScience's agent handlers (doc 149): open moves the screen as a tile does, stop stops only
 * what runs, and an unread library is never said to be empty.
 */
import { describe, it, expect, vi } from 'vitest';
import { findSource, readField, scienceAgentHandlers, type ScienceAgentContext } from './scienceAgent';
import { EMPTY_LIBRARY, type LibraryState } from '../memory/library';

const lib: LibraryState = {
  ...EMPTY_LIBRARY,
  packs: [{ key: 'wikipedia:physics|en|Category:Physics', sourceId: 'wikipedia:physics', domain: 'physics', label: 'Wikipedia (en) · Physics', total: 40, cursor: 12, inVault: 11, vaultFailed: 0, refused: 1, startedAt: '2026-10-12', updatedAt: '2026-10-12' } as LibraryState['packs'][number]],
};

function ctx(over: Partial<ScienceAgentContext> = {}): ScienceAgentContext {
  return { view: { kind: 'home' }, lib, libRead: { kind: 'read' }, job: null, notice: [], go: vi.fn(), stop: vi.fn(), openSite: vi.fn(async () => null), ...over };
}
const H = (c: ScienceAgentContext) => scienceAgentHandlers(() => c);

describe('the handlers', () => {
  it('readField refuses an unknown field with the list', () => {
    expect(readField('history')).toBe('history');
    expect(() => readField('geology')).toThrow(/^NOT_FOUND: .*physics, chemistry/);
  });

  it('status says what is in memory only once the library was read', () => {
    expect(H(ctx()).status().inMemory).toEqual([{ list: 'Wikipedia (en) · Physics', source: 'wikipedia:physics', field: 'physics', inVault: 11, refused: 1, failed: 0, at: 12, of: 40 }]);
    expect(H(ctx({ libRead: { kind: 'reading' } })).status()).toMatchObject({ library: 'reading', inMemory: null });
    expect(H(ctx({ libRead: { kind: 'unreadable', why: 'EIO' } })).status()).toMatchObject({ library: 'unreadable: EIO', inMemory: null });
  });

  it('sources lists one field, with what each source holds in memory', () => {
    const out = H(ctx()).sources({ field: 'physics' });
    expect(out.map((f) => f.field)).toEqual(['physics']);
    expect(out[0]!.sources.find((s) => s.source === 'wikipedia:physics')).toMatchObject({ inMemory: 11 });
    expect(H(ctx()).sources({}).length).toBe(6);
  });

  it('open moves to a source, a field or home, and refuses during an import', () => {
    const c = ctx();
    expect(H(c).open({ source: 'wikipedia:physics' })).toEqual({ shown: { field: 'physics', source: 'wikipedia:physics' } });
    expect(c.go).toHaveBeenCalledWith({ kind: 'source', domain: 'physics', sourceId: 'wikipedia:physics' });
    expect(H(c).open({ field: 'biology' })).toEqual({ shown: { field: 'biology' } });
    expect(H(c).open({})).toEqual({ shown: 'home' });
    expect(() => H(c).open({ source: 'nope' })).toThrow(/^NO_SOURCE: no source named "nope"; sources: /);
    const busy = ctx({ job: { kind: 'one', startedAt: 0, title: 'Gravity' } });
    expect(() => H(busy).open({ field: 'biology' })).toThrow(/^BUSY/);
    expect(busy.go).not.toHaveBeenCalled();
  });

  it('stop stops only what runs', () => {
    const idle = ctx();
    expect(H(idle).stop()).toMatchObject({ stopped: false });
    expect(idle.stop).not.toHaveBeenCalled();
    const busy = ctx({ job: { kind: 'pack', startedAt: 0, label: 'L', cursor: 1, startCursor: 0, total: 9, inVault: 1 } });
    expect(H(busy).stop()).toMatchObject({ stopped: true, was: { kind: 'adding a list', at: 1, of: 9 } });
    expect(busy.stop).toHaveBeenCalled();
  });

  it('open takes a source by the words a person says, and an id still works', () => {
    const c = ctx();
    expect(H(c).open({ source: "le manuel d'astronomie" })).toEqual({ shown: { field: 'astronomy', source: 'openstax:astronomy-2e' } });
    expect(H(c).open({ source: 'Calculus volume 2' })).toEqual({ shown: { field: 'mathematics', source: 'openstax:calculus-volume-2' } });
    expect(H(c).open({ source: 'les biographies de MacTutor' })).toEqual({ shown: { field: 'history', source: 'mactutor' } });
    expect(H(c).open({ source: 'Wikipédia', field: 'chemistry' })).toEqual({ shown: { field: 'chemistry', source: 'wikipedia:chemistry' } });
    expect(H(c).open({ source: 'arxiv:physics.hist-ph' })).toEqual({ shown: { field: 'history', source: 'arxiv:physics.hist-ph' } });
  });

  it('a source named in several fields is refused with their names, never the first taken', () => {
    const c = ctx();
    expect(() => H(c).open({ source: 'Wikipedia' })).toThrow(/^AMBIGUOUS: "Wikipedia" names several sources: Wikipedia \(wikipedia:physics\), .*Wikipedia \(wikipedia:history\); say which$/);
    expect(c.go).not.toHaveBeenCalled();
  });

  it('the field on screen settles « Wikipédia », and a source of another field is still found', () => {
    const here = ctx({ view: { kind: 'domain', domain: 'physics' } });
    expect(H(here).open({ source: 'wikipédia' })).toEqual({ shown: { field: 'physics', source: 'wikipedia:physics' } });
    expect(H(here).open({ source: 'OEIS' })).toEqual({ shown: { field: 'mathematics', source: 'oeis' } });
    // A field ASKED that holds no such source says its own sources.
    expect(() => findSource('OEIS', 'physics', undefined)).toThrow(/^NO_SOURCE: no source named "OEIS"; sources: University Physics Volume 1/);
  });

  it('back goes one screen up, and refuses during an import', () => {
    const src = ctx({ view: { kind: 'source', domain: 'biology', sourceId: 'wikipedia:biology' } });
    expect(H(src).back()).toEqual({ shown: { field: 'biology' } });
    expect(src.go).toHaveBeenCalledWith({ kind: 'domain', domain: 'biology' });
    const dom = ctx({ view: { kind: 'domain', domain: 'biology' } });
    expect(H(dom).back()).toEqual({ shown: 'home' });
    expect(dom.go).toHaveBeenCalledWith({ kind: 'home' });
    const home = ctx();
    expect(H(home).back()).toEqual({ shown: 'home' });
    expect(home.go).not.toHaveBeenCalled();
    expect(() => H(ctx({ view: src.view, job: { kind: 'list', startedAt: 0 } })).back()).toThrow(/^BUSY/);
  });

  it('openSite opens the named source or the one on screen, and a refused open is never reported done', async () => {
    const c = ctx();
    await expect(H(c).openSite({ source: 'OEIS' })).resolves.toEqual({ opened: 'https://oeis.org/', source: 'oeis' });
    expect(c.openSite).toHaveBeenCalledWith('https://oeis.org/');
    const onScreen = ctx({ view: { kind: 'source', domain: 'history', sourceId: 'mactutor' } });
    await expect(H(onScreen).openSite({})).resolves.toMatchObject({ source: 'mactutor' });
    await expect(H(ctx()).openSite({})).rejects.toThrow(/^NO_SOURCE: no source on screen/);
    await expect(H(ctx()).openSite({ source: 'Wikipedia' })).rejects.toThrow(/^AMBIGUOUS/);
    const refused = ctx({ openSite: vi.fn(async () => 'EBLOCKED') });
    await expect(H(refused).openSite({ source: 'OEIS' })).rejects.toThrow(/^WRITE_FAILED: .*EBLOCKED/);
  });
});
