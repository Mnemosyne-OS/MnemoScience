/**
 * library — what the person put in memory, where it lives, and how it gets there.
 *
 * Two copies, two jobs (as in MnemoLaw, doc 134 §10):
 *  - one JSON file per entry in the app's folder under the knowledge root
 *    (answered by the host with the pack, never asked of the person), filed
 *    by sub-domain and source, next to an ATTRIBUTION.md (CC BY-SA asks for
 *    the attribution where the text lives);
 *  - one memory per entry (or per part of a long entry) in the Memory Pack of
 *    its field, read by the chat when the person ticks it under Knowledge.
 *
 * `LibraryState.folder` is display only: the footer's "copies are kept in".
 * A folder saved before the packs is never written to again.
 *
 * The durable state (doc 73) is capped at 256 KB. It holds ONE pack per list
 * (a book, a category, a class, a search…) with the keys of the entries
 * already done, which is what lets "everything" resume after a stop, a closed
 * window, a restart, or a list that gained entries since. `withPack` keeps
 * the whole state under STATE_BUDGET: the oldest packs give up their key
 * lists first, then leave, and their counts move to `archived` so no tile
 * ever loses what it already holds.
 *
 * The host is reached through a port so the logic is testable without a bridge.
 */
import { ALL_SOURCES, MACTUTOR_LICENCE, OEIS_LICENCE, PLANETMATH_LICENCE, WIKIPEDIA_LICENCE, type SourceDef } from '../domains';
import { ARXIV_LICENCE_LINE } from '../sources/arxiv';
import { sleep } from '../sources/http';
import type { DomainId, Entry, Unit } from '../sources/types';
import { unitChronicles, unitRef } from './chronicle';

/** One list put in memory, entirely or entry by entry. */
export interface PackEntry {
  /** `<sourceId>|<listKey>`; `listKey` is `single` for entries imported one by one. */
  key: string;
  sourceId: string;
  domain: DomainId;
  /** Human name of the list (`University Physics Volume 1`, `Wikipedia (fr) · Astronomie`). */
  label: string;
  /** Entries in the list at the last run; 0 for singles. */
  total: number;
  /** Entries of the list already handled. Singles: entries imported. */
  cursor: number;
  /** Entries whose every part reached the vault. */
  inVault: number;
  /** Entries the vault refused (one part or more). */
  vaultFailed: number;
  /** Entries the source refused (missing page, empty text), counted and skipped. */
  refused: number;
  /**
   * Keys of the entries already handled, so a list that changed resumes on
   * what is NEW instead of starting over. Absent when the budget took it
   * (then only an unchanged list can resume, by its cursor).
   */
  done?: string[];
  startedAt: string;
  updatedAt: string;
}

/** What packs that left the state had put in memory, per source. */
export interface ArchivedCount {
  domain: DomainId;
  inVault: number;
  lastAt: string;
}

/** What the durable state holds. */
export interface LibraryState {
  folder: string | null;
  packs: PackEntry[];
  archived: Record<string, ArchivedCount>;
  /** Licences read live from the source (an OpenStax `md:license`), by source id, for ATTRIBUTION.md. */
  licences: Record<string, string>;
}

/** A library with nothing in it (used only once the saved one was read and is empty). */
export const EMPTY_LIBRARY: LibraryState = { folder: null, packs: [], archived: {}, licences: {} };

/** The spine of every memory this cartridge writes (counted by its vault tile). */
export const SPINE = 'SCIENCE_ENTRY';

/** Bytes the library may take in the durable state: well under the host's 256 KB. */
export const STATE_BUDGET = 160_000;

/** The pack key of a list: `<sourceId>|<listKey>`. */
export const packKey = (sourceId: string, listKey: string) => `${sourceId}|${listKey}`;

/** A fresh pack, nothing done yet. */
export function newPack(def: Pick<SourceDef, 'id' | 'domain'>, listKey: string, label: string, total: number, now: Date): PackEntry {
  const at = now.toISOString();
  return { key: packKey(def.id, listKey), sourceId: def.id, domain: def.domain, label, total, cursor: 0, inVault: 0, vaultFailed: 0, refused: 0, ...(listKey === 'single' ? {} : { done: [] }), startedAt: at, updatedAt: at };
}

/** True when every entry of the list was handled (never for singles). */
export function packDone(p: Pick<PackEntry, 'cursor' | 'total' | 'key'>): boolean {
  return !p.key.endsWith('|single') && p.cursor >= p.total;
}

/** Reads a pack back; anything else (a negative count, a key list of non-strings) is refused, not guessed. */
export function parsePack(v: unknown): PackEntry | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const nums = ['total', 'cursor', 'inVault', 'vaultFailed', 'refused'] as const;
  const strs = ['key', 'sourceId', 'domain', 'label', 'startedAt', 'updatedAt'] as const;
  if (!nums.every((k) => typeof p[k] === 'number' && Number.isInteger(p[k]) && (p[k] as number) >= 0)) return null;
  if (!strs.every((k) => typeof p[k] === 'string' && p[k])) return null;
  if (p.done !== undefined && !(Array.isArray(p.done) && p.done.every((k) => typeof k === 'string'))) return null;
  return p as unknown as PackEntry;
}

function parseArchived(v: unknown): Record<string, ArchivedCount> {
  const out: Record<string, ArchivedCount> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [id, a] of Object.entries(v as Record<string, unknown>)) {
    const c = a as Record<string, unknown> | null;
    if (c && typeof c.domain === 'string' && typeof c.inVault === 'number' && c.inVault >= 0 && typeof c.lastAt === 'string') {
      out[id] = { domain: c.domain as DomainId, inVault: c.inVault, lastAt: c.lastAt };
    }
  }
  return out;
}

/** Reads the stored library defensively. `state.get` answers `{ state: { library }, updatedAt }`. */
export function parseLibrary(raw: unknown): LibraryState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // 🪤 Same shape trap MnemoLaw paid for: the library sits under `state`, not at the root.
  const holder = (r.state && typeof r.state === 'object' ? r.state : r) as Record<string, unknown>;
  const lib = (holder.library && typeof holder.library === 'object' ? holder.library : {}) as Record<string, unknown>;
  const licences: Record<string, string> = {};
  if (lib.licences && typeof lib.licences === 'object') {
    for (const [k, v] of Object.entries(lib.licences as Record<string, unknown>)) if (typeof v === 'string' && v) licences[k] = v;
  }
  return {
    folder: typeof lib.folder === 'string' && lib.folder ? lib.folder : null,
    packs: Array.isArray(lib.packs) ? lib.packs.map(parsePack).filter((p): p is PackEntry => p !== null) : [],
    archived: parseArchived(lib.archived),
    licences,
  };
}

/** Bytes the library takes once stored (characters of its JSON; the keys are ASCII). */
export function stateSize(lib: LibraryState): number {
  return JSON.stringify({ library: lib }).length;
}

/**
 * Replaces a pack already in the library, or adds it, then keeps the state
 * under `budget`: the oldest packs drop their key lists first, then leave
 * with their counts moved to `archived`. The pack just written is never cut.
 */
export function withPack(lib: LibraryState, entry: PackEntry, budget = STATE_BUDGET): LibraryState {
  const others = lib.packs.filter((p) => p.key !== entry.key).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  let next: LibraryState = { ...lib, packs: [entry, ...others], archived: { ...lib.archived } };
  for (let i = next.packs.length - 1; i >= 1; i--) {
    // A pack whose keys are already gone changes nothing: measure only before
    // a strip. Serialising the whole state for every pack walked made one
    // call quadratic (200 lists: 8 s locally, past 30 s on a CI runner).
    if (!next.packs[i]!.done) continue;
    if (stateSize(next) <= budget) break;
    const { done: _dropped, ...rest } = next.packs[i]!;
    next = { ...next, packs: next.packs.map((p, j) => (j === i ? rest : p)) };
  }
  while (next.packs.length > 1 && stateSize(next) > budget) {
    const old = next.packs[next.packs.length - 1]!;
    next = archivePack({ ...next, packs: next.packs.slice(0, -1) }, old);
  }
  return next;
}

/**
 * The pack a "put all" starts from. A known list resumes: on its keys when
 * it has them (a list that gained entries keeps its counts and reads only the
 * new ones), on its cursor when it is unchanged. A changed list whose keys
 * the budget took starts a fresh pack, and the old counts are archived so
 * the tile keeps them; `archive` says what to add.
 */
export function resumePack(
  prior: PackEntry | undefined,
  def: Pick<SourceDef, 'id' | 'domain'>,
  listKey: string,
  label: string,
  entries: readonly Entry[],
  now: Date,
): { pack: PackEntry; archive?: PackEntry } {
  if (!prior) return { pack: newPack(def, listKey, label, entries.length, now) };
  if (prior.done) {
    const done = new Set(prior.done);
    return { pack: { ...prior, label, total: entries.length, cursor: entries.filter((e) => done.has(e.key)).length } };
  }
  if (prior.total === entries.length) {
    return { pack: { ...prior, label, done: entries.slice(0, prior.cursor).map((e) => e.key) } };
  }
  return { pack: newPack(def, listKey, label, entries.length, now), archive: prior };
}

/** Adds a pack's counts to `archived` (its key list is gone, its memories are not). */
export function archivePack(lib: LibraryState, old: PackEntry): LibraryState {
  const prev = lib.archived[old.sourceId];
  return {
    ...lib,
    archived: {
      ...lib.archived,
      [old.sourceId]: { domain: old.domain, inVault: (prev?.inVault ?? 0) + old.inVault, lastAt: prev && prev.lastAt > old.updatedAt ? prev.lastAt : old.updatedAt },
    },
  };
}

/** What a tile says: entries in memory and the latest date, or nothing at all. */
export interface MemorySummary {
  entries: number;
  /** ISO of the latest write; null when nothing was ever written. */
  lastAt: string | null;
}

/** Sums the packs and the archived counts given. */
export function summarize(packs: readonly PackEntry[], archived: readonly ArchivedCount[] = []): MemorySummary {
  let entries = 0;
  let lastAt: string | null = null;
  for (const p of packs) {
    entries += p.inVault;
    if (p.inVault > 0 && (!lastAt || p.updatedAt > lastAt)) lastAt = p.updatedAt;
  }
  for (const a of archived) {
    entries += a.inVault;
    if (a.inVault > 0 && (!lastAt || a.lastAt > lastAt)) lastAt = a.lastAt;
  }
  return { entries, lastAt };
}

/** What one sub-domain holds. */
export const domainSummary = (lib: LibraryState, domain: DomainId) =>
  summarize(lib.packs.filter((p) => p.domain === domain), Object.values(lib.archived).filter((a) => a.domain === domain));

/** What one source holds. */
export const sourceSummary = (lib: LibraryState, sourceId: string) =>
  summarize(lib.packs.filter((p) => p.sourceId === sourceId), lib.archived[sourceId] ? [lib.archived[sourceId]!] : []);

// ── The folder copy ──────────────────────────────────────────────────────

/** Joins a folder and a name with the folder's own separator. */
export function joinPath(folder: string, file: string): string {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
  return folder.replace(/[\\/]+$/, '') + sep + file;
}

/** A file or folder name every OS accepts: no reserved characters, no trailing dot, bounded. */
export function safeName(s: string, max = 80): string {
  const t = s.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return (t.slice(0, max).replace(/[. ]+$/, '')) || 'entry';
}

/** English folder names, so the tree does not change with the app's language. */
const DOMAIN_FOLDERS: Record<DomainId, string> = {
  physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', mathematics: 'Mathematics', astronomy: 'Astronomy', history: 'History of science',
};

/**
 * The Memory Pack a field's entries go into (host doc 135 §6.6): one per
 * field, so the chat scope offers six boxes under Knowledge, not one per book
 * or category. English and stable, like the folder tree: the host slugs it
 * into the vault and folder names, so it must never change with the language.
 */
export function packOfDomain(domain: DomainId): string {
  return DOMAIN_FOLDERS[domain].toLowerCase().replace(/\s+/g, '-');
}

/** `<folder>/<Domain>/<Source>`. */
export function sourceFolder(folder: string, def: Pick<SourceDef, 'domain' | 'name'>): string {
  return joinPath(joinPath(folder, DOMAIN_FOLDERS[def.domain]), safeName(def.name));
}

/** `<title of the entry> [<key>].json`: readable, and unique inside its source folder. */
export function entryFileName(unit: Pick<Unit, 'title' | 'key' | 'lang'>, multiLang: boolean): string {
  const last = unit.title.split(' · ').pop() ?? unit.key;
  return `${safeName(last, 80)} [${safeName(`${multiLang ? `${unit.lang}-` : ''}${unit.key}`, 60)}].json`;
}

/** Written at the root of the copy folder. */
export const ATTRIBUTION_FILE = 'ATTRIBUTION.md';

/**
 * The attribution of every source the cartridge can write, licences in their
 * own words. A licence read live from the source (`live`, by source id) wins
 * over the one measured on 2026-10-04.
 */
export function attributionText(live: Record<string, string> = {}): string {
  const books = ALL_SOURCES.filter((s) => s.kind === 'openstax');
  return [
    '# Science texts in this folder',
    '',
    'These files were downloaded by MnemoScience. Each file names its source, its date when the source gives one, its licence and the address where the text can be checked.',
    '',
    '## OpenStax textbooks (Rice University), from github.com/openstax',
    '',
    'Licence per book, copied from the `md:license` of each collection file:',
    '',
    ...books.map((b) => `- ${b.name}: ${live[b.id] ?? b.licence}${live[b.id] ? '' : ' (as measured on 2026-10-04)'}`),
    '',
    '## Wikipedia (en, fr, es)',
    '',
    `- Licence: ${WIKIPEDIA_LICENCE} (https://creativecommons.org/licenses/by-sa/4.0/). Each file gives the revision it was copied from.`,
    '',
    '## PlanetMath, from github.com/planetmath',
    '',
    `- Licence: ${PLANETMATH_LICENCE}. The encyclopedia is no longer updated; most repositories were last pushed in 2018.`,
    '',
    '## MacTutor History of Mathematics (University of St Andrews)',
    '',
    `- Licence: ${MACTUTOR_LICENCE}`,
    '',
    '## The On-Line Encyclopedia of Integer Sequences (OEIS)',
    '',
    `- Licence: ${OEIS_LICENCE}`,
    '',
    '## arXiv (abstracts only)',
    '',
    `- Licence: ${ARXIV_LICENCE_LINE}.`,
    '',
  ].join('\n');
}

/** The host operations an import needs. */
export interface HostPort {
  writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }>;
  mkdir(path: string): Promise<{ success: boolean; error?: string }>;
  ingest(entry: { vault: string; content: string; sourceRef: string }): Promise<void>;
}

/** The copy written in the folder: the unit as read, nothing added but the source id. */
export function copyBody(def: Pick<SourceDef, 'id'>, unit: Unit): string {
  return JSON.stringify({ source: def.id, ...unit }, null, 1);
}

/**
 * Writes every part of a unit. `whole` only when EVERY part landed: a page
 * missing its second half would be cited as if it were complete.
 */
export async function ingestUnit(port: HostPort, vault: string, def: Pick<SourceDef, 'id'>, unit: Unit, signal?: AbortSignal): Promise<'whole' | 'failed' | 'stopped'> {
  const bodies = unitChronicles(unit);
  let whole = true;
  for (let p = 0; p < bodies.length; p++) {
    if (signal?.aborted) return 'stopped';
    try {
      await port.ingest({ vault, content: bodies[p]!, sourceRef: unitRef(def.id, unit.key, bodies.length > 1 ? p + 1 : undefined) });
    } catch (err) {
      whole = false;
      console.error('[mnemo-science] memory refused', def.id, unit.key, p, err);
    }
  }
  return whole ? 'whole' : 'failed';
}

/** Errors that mean "this entry has nothing to give", counted and skipped, never a stop. */
const SKIP = /^(WIKI_PAGE_MISSING|MACTUTOR_|PLANETMATH_NOT_AN_ENTRY|OPENSTAX_NOT_A_MODULE|OPENSTAX_XML_UNREADABLE|HTTP_404|EMPTY_TEXT)/;

/** What `runPack` needs. */
export interface RunDeps {
  def: SourceDef;
  read: (entry: Entry, signal?: AbortSignal) => Promise<Unit>;
  port: HostPort;
  vault: string;
  folder: string;
  save: (pack: PackEntry) => Promise<void>;
  /** Licences read live, for ATTRIBUTION.md. */
  licences?: Record<string, string>;
  signal?: AbortSignal;
  onStep?: (pack: PackEntry) => void;
  now?: () => Date;
  /** Saves the progress every N entries (and always at the end). */
  saveEvery?: number;
  /** Pause between two entries, to be gentle with the source. */
  pauseMs?: number;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Imports the entries of a list not handled yet, until the end or a stop. A
 * read that still fails after its retries ends the run with that entry NOT
 * marked done, so the next press reads it again. A failed folder write stops
 * everything (the copy would silently miss entries).
 */
export async function runPack(deps: RunDeps, entries: readonly Entry[], start: PackEntry): Promise<PackEntry> {
  const now = deps.now ?? (() => new Date());
  const saveEvery = deps.saveEvery ?? 10;
  const wait = deps.wait ?? sleep;
  const single = start.key.endsWith('|single');
  const multiLang = deps.def.langs.length > 1;
  const dir = sourceFolder(deps.folder, deps.def);
  const made = await deps.port.mkdir(dir);
  if (!made.success) throw new Error(`WRITE_FAILED: ${made.error ?? 'unknown'}`);
  const attr = await deps.port.writeFile(joinPath(deps.folder, ATTRIBUTION_FILE), attributionText(deps.licences));
  if (!attr.success) throw new Error(`WRITE_FAILED: ${attr.error ?? 'unknown'}`);
  const done = new Set(single ? [] : (start.done ?? entries.slice(0, start.cursor).map((e) => e.key)));
  let pack: PackEntry = single ? { ...start } : { ...start, total: entries.length, done: [...done] };
  const todo = single ? [...entries] : entries.filter((e) => !done.has(e.key));
  let sinceSave = 0;
  try {
    for (let i = 0; i < todo.length; i++) {
      if (deps.signal?.aborted) break;
      const entry = todo[i]!;
      let refused = false;
      let outcome: 'whole' | 'failed' | 'stopped' = 'failed';
      try {
        const unit = await deps.read(entry, deps.signal);
        if (!unit.text.trim()) throw new Error('EMPTY_TEXT');
        const wrote = await deps.port.writeFile(joinPath(dir, entryFileName(unit, multiLang)), copyBody(deps.def, unit));
        if (!wrote.success) throw new Error(`WRITE_FAILED: ${wrote.error ?? 'unknown'}`);
        outcome = await ingestUnit(deps.port, deps.vault, deps.def, unit, deps.signal);
      } catch (err) {
        if (deps.signal?.aborted) break;
        const msg = err instanceof Error ? err.message : String(err);
        if (!SKIP.test(msg)) throw err;
        console.warn('[mnemo-science] entry refused by its source', deps.def.id, entry.key, msg);
        refused = true;
      }
      // An entry cut by a stop is read again next time: it is not marked done.
      if (outcome === 'stopped' || deps.signal?.aborted) break;
      pack = {
        ...pack,
        cursor: pack.cursor + 1,
        inVault: pack.inVault + (!refused && outcome === 'whole' ? 1 : 0),
        vaultFailed: pack.vaultFailed + (!refused && outcome === 'failed' ? 1 : 0),
        refused: pack.refused + (refused ? 1 : 0),
        ...(single ? {} : { done: [...(pack.done ?? []), entry.key] }),
        updatedAt: now().toISOString(),
      };
      deps.onStep?.(pack);
      if (++sinceSave >= saveEvery) { sinceSave = 0; await deps.save(pack); }
      if (deps.pauseMs && i < todo.length - 1) {
        try {
          await wait(deps.pauseMs, deps.signal);
        } catch (err) {
          if (deps.signal?.aborted) break;
          throw err;
        }
      }
    }
  } finally {
    await deps.save(pack);
  }
  return pack;
}
