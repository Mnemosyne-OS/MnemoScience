import { describe, it, expect, vi } from 'vitest';
import { sourceById } from '../domains';
import type { Entry, Unit } from '../sources/types';
import { PART_CHARS } from './chronicle';
import {
  ATTRIBUTION_FILE, EMPTY_LIBRARY, STATE_BUDGET, attributionText, domainSummary, entryFileName, ingestUnit, newPack, packDone, parseLibrary, parsePack,
  resumePack, runPack, safeName, sourceSummary, stateSize, withPack,
  type HostPort, type PackEntry,
} from './library';

const def = sourceById('openstax:astronomy-2e')!;
const entries: Entry[] = ['m1', 'm2', 'm3', 'm4'].map((k) => ({ key: k, title: `Title ${k}` }));
const unitOf = (e: Entry): Unit => ({ key: e.key, title: `OpenStax · Astronomy 2e · ${e.title}`, text: `Text of ${e.key}`, origin: 'OpenStax, Astronomy 2e', licence: 'L', url: `https://x/${e.key}`, lang: 'en' });

function fakePort(over: Partial<HostPort> = {}) {
  const files = new Map<string, string>();
  const ingested: { content: string; sourceRef: string }[] = [];
  const port: HostPort = {
    writeFile: async (p, c) => { files.set(p, c); return { success: true }; },
    mkdir: async () => ({ success: true }),
    ingest: async (e) => { ingested.push(e); },
    ...over,
  };
  return { port, files, ingested };
}

const base = (port: HostPort, extra: Partial<Parameters<typeof runPack>[0]> = {}) => ({
  def, read: async (e: Entry) => unitOf(e), port, vault: 'APP_SCIENCE', folder: 'C:\\Docs\\MnemoScience',
  save: vi.fn(async () => undefined), now: () => new Date('2026-10-04T08:00:00Z'), ...extra,
});

describe('parseLibrary', () => {
  it('reads the host shape { state: { library } } and drops what it cannot read', () => {
    const p = newPack(def, 'book', 'Astronomy 2e', 4, new Date('2026-10-04T08:00:00Z'));
    const lib = parseLibrary({ state: { library: { folder: 'C:\\x', packs: [p, { key: 'broken' }] } }, updatedAt: 1 });
    expect(lib.folder).toBe('C:\\x');
    expect(lib.packs).toEqual([p]);
    expect(parseLibrary(undefined)).toEqual(EMPTY_LIBRARY);
  });
});

describe('runPack', () => {
  it('writes a copy per entry, the attribution, and one memory per entry with its source line', async () => {
    const { port, files, ingested } = fakePort();
    const end = await runPack(base(port), entries, newPack(def, 'book', 'Astronomy 2e', 4, new Date()));
    expect(end).toMatchObject({ cursor: 4, inVault: 4, refused: 0, vaultFailed: 0 });
    expect(packDone(end)).toBe(true);
    expect(files.has('C:\\Docs\\MnemoScience\\' + ATTRIBUTION_FILE)).toBe(true);
    expect([...files.keys()].some((k) => k.startsWith('C:\\Docs\\MnemoScience\\Astronomy\\Astronomy 2e\\Title m1 [m1].json'))).toBe(true);
    expect(ingested[0]!.content.split('\n').pop()).toBe('Source: OpenStax, Astronomy 2e. Licence: L. Check at https://x/m1');
    expect(ingested[0]!.sourceRef).toBe('mnemo-science:openstax:astronomy-2e:m1');
  });

  it('resumes on the keys already done and keeps the earlier counts', async () => {
    const { port, ingested } = fakePort();
    const start = { ...newPack(def, 'book', 'Astronomy 2e', 4, new Date()), cursor: 2, inVault: 2, done: ['m1', 'm2'] };
    const end = await runPack(base(port), entries, start);
    expect(ingested.map((i) => i.sourceRef)).toEqual(['mnemo-science:openstax:astronomy-2e:m3', 'mnemo-science:openstax:astronomy-2e:m4']);
    expect(end).toMatchObject({ cursor: 4, inVault: 4 });
  });

  it('a stop keeps what was written and leaves the cursor on the next entry', async () => {
    const { port } = fakePort();
    const ctrl = new AbortController();
    const save = vi.fn(async () => undefined);
    const read = async (e: Entry) => { if (e.key === 'm3') ctrl.abort(); return unitOf(e); };
    const end = await runPack(base(port, { read, signal: ctrl.signal, save }), entries, newPack(def, 'book', 'B', 4, new Date()));
    expect(end).toMatchObject({ cursor: 2, inVault: 2 });
    expect(save).toHaveBeenLastCalledWith(end);
  });

  it('a pack saved before key lists existed resumes on its cursor', async () => {
    const { port, ingested } = fakePort();
    const { done: _d, ...legacy } = { ...newPack(def, 'book', 'B', 4, new Date()), cursor: 3, inVault: 3 };
    const end = await runPack(base(port), entries, legacy);
    expect(ingested.map((i) => i.sourceRef)).toEqual(['mnemo-science:openstax:astronomy-2e:m4']);
    expect(end).toMatchObject({ cursor: 4, inVault: 4, done: ['m1', 'm2', 'm3', 'm4'] });
  });

  it('saves the progress every 10 entries and at the end', async () => {
    const { port } = fakePort();
    const many: Entry[] = Array.from({ length: 25 }, (_, i) => ({ key: `k${i}`, title: `T${i}` }));
    const save = vi.fn(async () => undefined);
    await runPack(base(port, { save }), many, newPack(def, 'book', 'B', 25, new Date()));
    expect(save.mock.calls.map((c) => (c as unknown as [PackEntry])[0].cursor)).toEqual([10, 20, 25]);
  });

  it('waits between entries through the shared sleep, and a stop during the wait ends the run', async () => {
    const { port } = fakePort();
    const ctrl = new AbortController();
    const wait = vi.fn(async (_ms: number, signal?: AbortSignal) => { ctrl.abort(); if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); });
    const end = await runPack(base(port, { pauseMs: 300, wait, signal: ctrl.signal }), entries, newPack(def, 'book', 'B', 4, new Date()));
    expect(wait).toHaveBeenCalledWith(300, ctrl.signal);
    expect(end.cursor).toBe(1);
  });

  it('a stop that came before an entry reads nothing more (no request after "Stop")', async () => {
    const { port } = fakePort();
    const ctrl = new AbortController();
    ctrl.abort();
    const read = vi.fn(async (e: Entry) => unitOf(e));
    const end = await runPack(base(port, { read, signal: ctrl.signal }), entries, newPack(def, 'book', 'B', 4, new Date()));
    expect(read).not.toHaveBeenCalled();
    expect(end.cursor).toBe(0);
  });

  it('counts an entry its source refuses and goes on; a network failure stops ON the entry', async () => {
    const { port } = fakePort();
    const refusing = async (e: Entry) => { if (e.key === 'm2') throw new Error('HTTP_404'); return unitOf(e); };
    expect(await runPack(base(port, { read: refusing }), entries, newPack(def, 'book', 'B', 4, new Date()))).toMatchObject({ cursor: 4, inVault: 3, refused: 1 });
    const save = vi.fn(async () => undefined);
    const broken = async (e: Entry) => { if (e.key === 'm3') throw new Error('HTTP_503'); return unitOf(e); };
    await expect(runPack(base(port, { read: broken, save }), entries, newPack(def, 'book', 'B', 4, new Date()))).rejects.toThrow('HTTP_503');
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 2 }));
  });

  it('an entry whose text is empty is refused, not stored as an empty memory', async () => {
    const { port, ingested } = fakePort();
    const empty = async (e: Entry) => ({ ...unitOf(e), text: '  ' });
    expect(await runPack(base(port, { read: empty }), entries.slice(0, 1), newPack(def, 'book', 'B', 1, new Date()))).toMatchObject({ refused: 1, inVault: 0 });
    expect(ingested).toHaveLength(0);
  });

  it('a refused memory is counted apart; a failed folder write stops everything', async () => {
    const { port } = fakePort({ ingest: async () => { throw new Error('VAULT_LOCKED'); } });
    expect(await runPack(base(port), entries.slice(0, 2), newPack(def, 'book', 'B', 2, new Date()))).toMatchObject({ inVault: 0, vaultFailed: 2 });
    const { port: noDisk } = fakePort({ writeFile: async () => ({ success: false, error: 'EACCES' }) });
    await expect(runPack(base(noDisk), entries, newPack(def, 'book', 'B', 4, new Date()))).rejects.toThrow('WRITE_FAILED: EACCES');
  });
});

describe('the folder copy', () => {
  it('names files readably and safely on every OS', () => {
    expect(safeName('a/b:c*?"<>|. ')).toBe('a-b-c-');
    expect(entryFileName({ title: 'Wikipedia (fr) · Étoile', key: '42', lang: 'fr' }, true)).toBe('Étoile [fr-42].json');
  });

  it('the attribution copies a licence read live over the one measured', () => {
    expect(attributionText({ 'openstax:astronomy-2e': 'Live licence (http://x/)' })).toContain('- Astronomy 2e: Live licence (http://x/)\n');
    expect(attributionText()).toContain('(as measured on 2026-10-04)');
  });

  it('the attribution names every licence in the source’s own words', () => {
    const text = attributionText();
    expect(text).toContain('Creative Commons Attribution-Share Alike 4.0');
    expect(text).toContain('Creative Commons Attribution-ShareAlike 3.0 Unported');
    expect(text).toContain('the text of MacTutor by JOC/EFR is licensed under');
    expect(text).toContain('Química 2ed: http://creativecommons.org/licenses/by/4.0/');
  });
});

describe('summaries', () => {
  it('count only what reached memory, with the latest date', () => {
    const a = { ...newPack(def, 'book', 'B', 4, new Date('2026-10-01T00:00:00Z')), inVault: 3, updatedAt: '2026-10-02T00:00:00Z' };
    const lib = withPack(EMPTY_LIBRARY, a);
    expect(domainSummary(lib, 'astronomy')).toEqual({ entries: 3, lastAt: '2026-10-02T00:00:00Z' });
    expect(domainSummary(lib, 'physics')).toEqual({ entries: 0, lastAt: null });
  });
});

describe('ingestUnit', () => {
  it('an entry whose SECOND part is refused is never counted as whole', async () => {
    let n = 0;
    const { port } = fakePort({ ingest: async () => { if (++n === 2) throw new Error('VAULT_REFUSED'); } });
    const long = { ...unitOf(entries[0]!), text: `${'word '.repeat(PART_CHARS / 5)}

${'more '.repeat(PART_CHARS / 5)}

${'end '.repeat(100)}` };
    expect(await ingestUnit(port, 'V', def, long)).toBe('failed');
    expect(n).toBe(3);
  });
});

describe('parsePack', () => {
  it('refuses a negative or fractional count and a key list that is not strings', () => {
    const ok = newPack(def, 'book', 'B', 4, new Date());
    expect(parsePack(ok)).toEqual(ok);
    expect(parsePack({ ...ok, cursor: -1 })).toBeNull();
    expect(parsePack({ ...ok, inVault: 1.5 })).toBeNull();
    expect(parsePack({ ...ok, done: [1, 2] })).toBeNull();
  });
});

describe('resumePack', () => {
  const list = (n: number): Entry[] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, title: `T${i}` }));

  it('a list that GAINED an entry keeps its counts and reads only the new one', async () => {
    const prior = { ...newPack(def, 'cat', 'C', 3, new Date()), cursor: 3, inVault: 3, done: ['k0', 'k1', 'k2'] };
    const grown = [{ key: 'new', title: 'New' }, ...list(3)];
    const { pack, archive } = resumePack(prior, def, 'cat', 'C', grown, new Date());
    expect(archive).toBeUndefined();
    expect(pack).toMatchObject({ inVault: 3, cursor: 3, total: 4 });
    const { port, ingested } = fakePort();
    const end = await runPack(base(port), grown, pack);
    expect(ingested.map((i) => i.sourceRef)).toEqual(['mnemo-science:openstax:astronomy-2e:new']);
    expect(end).toMatchObject({ inVault: 4, cursor: 4, total: 4 });
  });

  it('a changed list whose keys were dropped starts fresh and hands its counts to the archive', () => {
    const { done: _d, ...prior } = { ...newPack(def, 'cat', 'C', 3, new Date()), cursor: 3, inVault: 3 };
    const { pack, archive } = resumePack(prior, def, 'cat', 'C', list(4), new Date());
    expect(pack.inVault).toBe(0);
    expect(archive).toBe(prior);
  });
});

describe('withPack keeps the state far under 256 KB', () => {
  it('when stripping key lists is not enough, the oldest packs leave and their counts move to the archive', () => {
    let lib = EMPTY_LIBRARY;
    for (let i = 0; i < 30; i++) {
      lib = withPack(lib, { ...newPack(def, `l${i}`, `List ${i}`, 1, new Date(Date.UTC(2026, 9, 4, 0, 0, i))), cursor: 1, inVault: 1 }, 2_000);
    }
    expect(stateSize(lib)).toBeLessThanOrEqual(2_000);
    expect(lib.packs.length).toBeLessThan(30);
    expect(lib.archived[def.id]!.inVault).toBe(30 - lib.packs.length);
    expect(sourceSummary(lib, def.id).entries).toBe(30);
  });

  it('200 big lists (3,334 keys each) stay under the budget, and no count is lost', () => {
    let lib = EMPTY_LIBRARY;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const p: PackEntry = {
        ...newPack(def, `list${i}`, `List ${i}`, 3334, new Date(Date.UTC(2026, 9, 4, 0, 0, i))),
        cursor: 3334, inVault: 3000 + i, done: Array.from({ length: 3334 }, (_, k) => `Slug_Name_${k}`),
      };
      total += p.inVault;
      lib = withPack(lib, p);
    }
    expect(stateSize(lib)).toBeLessThanOrEqual(STATE_BUDGET);
    expect(STATE_BUDGET).toBeLessThan(256_000 * 0.7);
    expect(sourceSummary(lib, def.id).entries).toBe(total);
    // The newest pack keeps its keys, so it can still resume a grown list.
    expect(lib.packs[0]!.key).toBe(`${def.id}|list199`);
    expect(lib.packs[0]!.done).toHaveLength(3334);
    // A deliberate worst case (200 x 3 334 keys): ~0.4 s since withPack measures only before a strip.
  }, 30_000);
});
