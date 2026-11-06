/**
 * scienceAgent.ts — what an agent may do in MnemoScience (doc 149), as plain functions over the
 * app's own state and its own moves. Declared in `mnemo-plugin.json` › agentActions, served by
 * `ScienceAgentActions` while the window is open.
 *
 * 🚨 Every move is the one the person's own control makes: a field or a source opens through
 * `go` (a tile), and Stop is the job line's Stop.
 *
 * ⛔ Importing is NOT offered: each source's list and reader are built inside its own panel
 * (a book's modules, a Wikipedia category, an arXiv feed), so an agent import would be a second
 * path, not the button's. An agent opens the source; the person presses.
 *
 * Refusals throw `CODE: reason`.
 */
import { ALL_SOURCES, sourceById, sourcesOf, type SourceDef } from '../domains';
import { findNamed, type Named } from './agentFind';
import type { LibraryState } from '../memory/library';
import type { DomainId } from '../sources/types';
import type { Job, LibRead, View } from './types';

/** The fields of the home screen, in its order: what the manifest declares as `field`'s enum. */
export const FIELDS: readonly DomainId[] = ['physics', 'chemistry', 'biology', 'mathematics', 'astronomy', 'history'];

/** The app's state and its own moves, read fresh at every call. */
export interface ScienceAgentContext {
  view: View;
  lib: LibraryState;
  libRead: LibRead;
  job: Job | null;
  notice: string[];
  go: (next: View) => void;
  stop: () => void;
  /** The source's « site » link: resolves to null once the host opened it, else the reason. */
  openSite: (url: string) => Promise<string | null>;
}

/** A field of the app, or the refusal that lists them. */
export function readField(v: unknown): DomainId {
  if (typeof v !== 'string' || !(FIELDS as readonly string[]).includes(v)) throw new Error(`NOT_FOUND: no field "${String(v)}"; fields: ${FIELDS.join(', ')}`);
  return v as DomainId;
}

/** The words a person uses for each field, in English, French and Spanish: every source of the field answers to them. */
const FIELD_WORDS: Record<DomainId, readonly string[]> = {
  physics: ['physics', 'physique', 'física'],
  chemistry: ['chemistry', 'chimie', 'química'],
  biology: ['biology', 'biologie', 'biología'],
  mathematics: ['mathematics', 'maths', 'math', 'mathématiques', 'matemáticas', 'mates'],
  astronomy: ['astronomy', 'astronomie', 'astronomía'],
  history: ['history', 'histoire', 'historia', 'sciences', 'ciencias'],
};

/** The words a person uses for each kind of source (« le manuel », « les biographies », « les suites »). */
const KIND_WORDS: Record<SourceDef['kind'], readonly string[]> = {
  openstax: ['OpenStax', 'manuel', 'livre', 'textbook', 'book', 'libro', 'manual'],
  wikipedia: ['Wikipedia', 'wiki'],
  planetmath: ['PlanetMath', 'encyclopédie', 'encyclopedia', 'enciclopedia'],
  mactutor: ['MacTutor', 'biographies', 'biography', 'biografías', 'mathématiciens', 'mathematicians', 'matemáticos'],
  oeis: ['OEIS', 'suites', 'sequences', 'sucesiones', 'entiers', 'integer'],
  arxiv: ['arXiv', 'preprints', 'prépublications', 'articles', 'artículos', 'résumés', 'abstracts', 'resúmenes'],
};

const asNamed = (list: readonly SourceDef[]): Array<Named<SourceDef>> => list.map((s) => ({
  item: s, id: s.id, label: `${s.name} (${s.id})`,
  names: [s.name, s.id, ...KIND_WORDS[s.kind], ...FIELD_WORDS[s.domain]],
}));
const SOURCE_KIND = { code: 'NO_SOURCE', noun: 'source' };

/**
 * A source by its id or by the words a person says (« Wikipédia », « le manuel
 * d'astronomie », « Calculus volume 2 »). Looked up in the field asked, else
 * in the field on screen, else everywhere: « montre Wikipédia » on the physics
 * screen is physics' Wikipedia. A field asked that holds no such source is
 * refused with ITS sources, never taken from another field.
 */
export function findSource(ref: unknown, field: DomainId | undefined, here: DomainId | undefined): SourceDef {
  if (typeof ref !== 'string') throw new Error('BAD_ARG: name the source');
  const byId = sourceById(ref.trim());
  if (byId) return byId;
  const scope = field ?? here;
  if (scope) {
    try {
      return findNamed(asNamed(sourcesOf(scope)), ref, SOURCE_KIND);
    } catch (err) {
      // Only a source missing from the field on SCREEN is looked up elsewhere.
      if (field || !(err instanceof Error) || !err.message.startsWith('NO_SOURCE')) throw err;
    }
  }
  return findNamed(asNamed(ALL_SOURCES), ref, SOURCE_KIND);
}

/** The field of the screen, if any. */
const fieldOf = (v: View): DomainId | undefined => (v.kind === 'home' ? undefined : v.domain);

/** A source as an agent reads it. */
export function sourceLine(s: SourceDef, lib: LibraryState) {
  const mine = lib.packs.filter((p) => p.sourceId === s.id);
  return {
    source: s.id,
    name: s.name,
    kind: s.kind,
    langs: [...s.langs],
    licence: s.licence ?? 'stated per item',
    size: 'count' in s.size ? `${s.size.count} ${s.size.unit}` : `read live (${s.size.live})`,
    inMemory: mine.reduce((n, p) => n + p.inVault, 0),
  };
}

/** A job, as an agent reads it. */
export function jobLine(job: Job | null) {
  if (!job) return null;
  const seconds = Math.max(0, Math.round((Date.now() - job.startedAt) / 1000));
  if (job.kind === 'list') return { kind: 'listing', seconds };
  if (job.kind === 'one') return { kind: 'adding one', title: job.title, seconds };
  return { kind: 'adding a list', list: job.label, at: job.cursor, of: job.total, inVault: job.inVault, seconds };
}

/** The handlers `sdk.onAgentActions` serves, over a context read fresh at every call. */
export function scienceAgentHandlers(get: () => ScienceAgentContext) {
  return {
    // agent-actions:begin
    status: () => {
      const c = get();
      const lr = c.libRead;
      const read = lr.kind === 'read';
      return {
        screen: c.view.kind === 'home' ? 'home' : c.view.kind === 'domain' ? { field: c.view.domain } : { field: c.view.domain, source: c.view.sourceId },
        library: lr.kind === 'unreadable' ? `unreadable: ${lr.why}` : lr.kind,
        job: jobLine(c.job),
        onScreen: c.notice,
        folder: c.lib.folder,
        // Only a library that was read says what is in memory: unread is never « nothing ».
        inMemory: read ? c.lib.packs.map((p) => ({
          list: p.label, source: p.sourceId, field: p.domain, inVault: p.inVault, refused: p.refused, failed: p.vaultFailed,
          ...(p.total ? { at: p.cursor, of: p.total } : {}),
        })) : null,
      };
    },

    sources: (args: Record<string, unknown>) => {
      const c = get();
      const list = args.field === undefined ? ALL_SOURCES : sourcesOf(readField(args.field));
      return FIELDS
        .filter((f) => list.some((s) => s.domain === f))
        .map((field) => ({ field, sources: list.filter((s) => s.domain === field).map((s) => sourceLine(s, c.lib)) }));
    },

    open: (args: Record<string, unknown>) => {
      const c = get();
      if (c.job) throw new Error('BUSY: an import is running; stop it first or wait');
      if (args.source !== undefined) {
        const s = findSource(args.source, args.field === undefined ? undefined : readField(args.field), fieldOf(c.view));
        c.go({ kind: 'source', domain: s.domain, sourceId: s.id });
        return { shown: { field: s.domain, source: s.id } };
      }
      if (args.field === undefined) {
        c.go({ kind: 'home' });
        return { shown: 'home' };
      }
      const field = readField(args.field);
      c.go({ kind: 'domain', domain: field });
      return { shown: { field } };
    },

    back: () => {
      const c = get();
      if (c.job) throw new Error('BUSY: an import is running; stop it first or wait');
      // The Back link: a source goes up to its field, a field to the home screen.
      if (c.view.kind === 'source') {
        c.go({ kind: 'domain', domain: c.view.domain });
        return { shown: { field: c.view.domain } };
      }
      if (c.view.kind === 'domain') c.go({ kind: 'home' });
      return { shown: 'home' };
    },

    openSite: async (args: Record<string, unknown>) => {
      const c = get();
      const s = args.source !== undefined
        ? findSource(args.source, undefined, fieldOf(c.view))
        : c.view.kind === 'source' ? sourceById(c.view.sourceId) : undefined;
      if (!s) throw new Error('NO_SOURCE: no source on screen; name one (Wikipedia, OEIS, MacTutor, a book title…)');
      const why = await c.openSite(s.home);
      if (why !== null) throw new Error(`WRITE_FAILED: the browser did not open ${s.home}: ${why}`);
      return { opened: s.home, source: s.id };
    },

    stop: () => {
      const c = get();
      if (!c.job) return { stopped: false, note: 'nothing is running' };
      c.stop();
      return { stopped: true, was: jobLine(c.job) };
    },
    // agent-actions:end
  };
}
