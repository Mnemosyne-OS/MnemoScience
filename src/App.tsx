/**
 * MnemoScience (doc 135 §3quinquies): science texts in memory, by field.
 *
 * Three screens, MnemoLaw's shape: the fields (sub-domains), one field (a
 * tile per source), one source (its list, one entry or everything into
 * memory). The import logic and the host calls live here; the screens only
 * draw and call back.
 *
 * Nothing downloads before a gesture, every long step shows what it measured
 * so far (entries, seconds), and "everything" resumes where it stopped.
 *
 * Where the texts go (doc 135, decision of 07/10): one Memory Pack per field,
 * answered by the host with its vault AND the app's folder under the
 * knowledge root. The cartridge never asks for a folder and boots no sandbox
 * vault: nothing would ever be written to it, and its tile would count zero
 * forever.
 *
 * 🚨 The saved library is read BEFORE anything may be written. A `state.get`
 * that failed used to leave an empty library on screen ("nothing in memory")
 * and the next save overwrote every resume point with it. Now an unread or
 * unreadable library writes nothing, offers no import, and says so.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MnemoCartridgeSDK } from './sdk/mnemo-sdk';
import { useI18n } from './i18n/useI18n';
import { translate } from './i18n/strings';
import { sourceById } from './domains';
import { hostFetcher, withTimeout } from './sources/http';
import type { Entry } from './sources/types';
import {
  EMPTY_LIBRARY, SPINE, archivePack, newPack, packKey, packOfDomain, parseLibrary, resumePack, runPack, withPack,
  type HostPort, type LibraryState, type PackEntry,
} from './memory/library';
import { useClock } from './memory/useClock';
import { S } from './ui/styles';
import { Home } from './ui/Home';
import { DomainView } from './ui/DomainView';
import { SourceView } from './ui/SourceView';
import { Footer } from './ui/Footer';
import type { ImportRequest, Job, LibRead, View } from './ui/types';

// Must match "name" in mnemo-plugin.json: the host keys the Memory Packs on it.
const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-science');

/** Every host call is local IPC; 15 s is the house default (rule 9). */
const HOST_TIMEOUT_MS = 15_000;

/**
 * A first `vault.pack.ensure` creates and mounts a vault; the host bounds it
 * at 30 s itself, so the cartridge waits a little longer than that.
 */
const PACK_TIMEOUT_MS = 35_000;

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The cartridge: three screens over the saved library, the Memory Packs and the sources. */
export default function App() {
  const { t, lang } = useI18n();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [lib, setLib] = useState<LibraryState>(EMPTY_LIBRARY);
  const [libRead, setLibRead] = useState<LibRead>({ kind: 'reading' });
  const [job, setJob] = useState<Job | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // The library as last saved, read by async steps that would otherwise
  // write back a copy taken before an await (two saves racing).
  const libRef = useRef(lib);
  libRef.current = lib;
  const libReadRef = useRef(libRead);
  libReadRef.current = libRead;

  const host = useMemo(() => hostFetcher((action, payload, timeoutMs) => sdk.invoke(action, payload, timeoutMs)), []);

  // ── Boot: the saved library, three states ─────────────────────────────
  const readLibrary = useCallback(() => {
    let alive = true;
    setLibRead({ kind: 'reading' });
    sdk.invoke('state.get', undefined, HOST_TIMEOUT_MS)
      .then((raw) => { if (alive) { setLib(parseLibrary(raw)); setLibRead({ kind: 'read' }); } })
      .catch((err) => {
        console.error('[mnemo-science] state.get failed', err);
        if (alive) setLibRead({ kind: 'unreadable', why: errText(err) });
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => readLibrary(), [readLibrary]);

  const saveLib = useCallback(async (next: LibraryState) => {
    // Never write over a library that was not read: it would erase every resume point.
    if (libReadRef.current.kind !== 'read') throw new Error('LIBRARY_NOT_READ');
    setLib(next);
    libRef.current = next;
    try {
      await sdk.invoke('state.set', { state: { library: next } }, HOST_TIMEOUT_MS);
    } catch (err) {
      console.error('[mnemo-science] state.set failed', err);
      setNotice((n) => [...n, translate(lang, 'import.failed', { why: errText(err) })]);
    }
  }, [lang]);

  const now = useClock(job !== null);

  // Cancel any running read when the window goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const openExternal = (url: string) => {
    sdk.invoke('shell.openExternal', { url }, HOST_TIMEOUT_MS)
      .catch((err) => setNotice([t('import.failed', { why: errText(err) })]));
  };

  // ── The Memory Pack of a field: its vault and the copy folder ─────────
  // Pack → vault name and folder, for this window's life (the host answers the same).
  const packVaults = useRef(new Map<string, { vault: string; folder: string | null }>());

  /**
   * The vault of one Memory Pack (host doc 135 §6.6): one per field, so the
   * person ticks « Physics » under Knowledge in the chat scope without the
   * other fields. Not lexical-only: science is asked in natural language, so
   * the entries keep their vectors.
   */
  const packVault = useCallback(async (pack: string): Promise<{ vault: string; folder: string | null }> => {
    const known = packVaults.current.get(pack);
    if (known) return known;
    const res = await sdk.invoke<{ vault?: string; folder?: string }>('vault.pack.ensure', { pack, lexicalOnly: false }, PACK_TIMEOUT_MS);
    if (!res?.vault) throw new Error('ENSURE_PACK_FAILED');
    // `folder` = `<knowledge root>/<app>/`: the copies go there and the person
    // is never asked for a folder (decision of 07/10).
    const found = { vault: res.vault, folder: typeof res.folder === 'string' && res.folder ? res.folder : null };
    packVaults.current.set(pack, found);
    // Display only: the footer shows where the copies really go. A folder a
    // person picked before this change is superseded, never written to again.
    if (found.folder && libRef.current.folder !== found.folder) {
      await saveLib({ ...libRef.current, folder: found.folder });
    }
    return found;
  }, [saveLib]);

  /** A failure, worded when it is one the person can act on. */
  const failureText = useCallback((err: unknown): string => {
    const why = errText(err);
    return why.includes('NO_KNOWLEDGE_ROOT') ? t('import.noKnowledgeRoot') : t('import.failed', { why });
  }, [t]);

  const port: HostPort = {
    writeFile: (path, content) => withTimeout(sdk.writeFile(path, content), HOST_TIMEOUT_MS, 'WRITE'),
    // Only an explicit `success: false` is a failure.
    mkdir: async (dirPath) => {
      const made = await sdk.invoke<{ success?: boolean; error?: string }>('dialog.mkdir', { dirPath }, HOST_TIMEOUT_MS);
      return { success: made?.success !== false, ...(made?.error ? { error: made.error } : {}) };
    },
    ingest: async (entry) => {
      await sdk.invoke('mnemosyne.ingest', { ...entry, spineType: SPINE }, HOST_TIMEOUT_MS);
    },
  };

  /** Runs one list (or one entry) through the pack runner. */
  const run = async (req: ImportRequest, entries: readonly Entry[], start: PackEntry, onStep: (p: PackEntry) => void) => {
    const def = sourceById(req.sourceId);
    if (!def || libReadRef.current.kind !== 'read') throw new Error('NOT_READY');
    if (req.licence && libRef.current.licences[def.id] !== req.licence) {
      await saveLib({ ...libRef.current, licences: { ...libRef.current.licences, [def.id]: req.licence } });
    }
    // The pack first: a missing knowledge folder is said before any download.
    // The folder always comes from the host, never from an older saved library.
    const { vault: target, folder } = await packVault(packOfDomain(def.domain));
    // An older host answers no folder: said, never a guessed path.
    if (!folder) throw new Error('NO_PACK_FOLDER');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const end = await runPack({
      def, read: req.read, port, vault: target, folder, licences: libRef.current.licences,
      save: (p) => saveLib(withPack(libRef.current, p)),
      signal: ctrl.signal, onStep, ...(req.pauseMs ? { pauseMs: req.pauseMs } : {}),
    }, entries, start);
    return { end, stopped: ctrl.signal.aborted };
  };

  // ── One entry ─────────────────────────────────────────────────────────
  const importOne = async (req: ImportRequest, entry: Entry) => {
    const def = sourceById(req.sourceId);
    if (!def) return;
    setNotice([]);
    const key = packKey(def.id, 'single');
    const before = libRef.current.packs.find((p) => p.key === key) ?? newPack(def, 'single', `${def.name} · ${t('list.importOne')}`, 0, new Date());
    setJob({ kind: 'one', startedAt: Date.now(), title: entry.title });
    try {
      const { end, stopped } = await run(req, [entry], before, () => undefined);
      if (stopped) setNotice([t('import.stopped')]);
      else if (end.inVault > before.inVault) setNotice([t('import.doneOne', { title: entry.title })]);
      else if (end.refused > before.refused) setNotice([t('import.refusedOne', { title: entry.title })]);
      else setNotice([t('import.partOne', { title: entry.title })]);
    } catch (err) {
      setNotice([failureText(err)]);
    } finally {
      setJob(null);
    }
  };

  // ── A whole list, resumed on what is not done yet ─────────────────────
  const importAll = async (req: ImportRequest, entries: readonly Entry[]) => {
    const def = sourceById(req.sourceId);
    if (!def) return;
    setNotice([]);
    const prior = libRef.current.packs.find((p) => p.key === packKey(def.id, req.listKey));
    const { pack: start, archive } = resumePack(prior, def, req.listKey, req.label, entries, new Date());
    const startedAt = Date.now();
    setJob({ kind: 'pack', startedAt, label: req.label, cursor: start.cursor, startCursor: start.cursor, total: entries.length, inVault: start.inVault });
    try {
      // A changed list whose keys the budget took: its counts stay on the tile.
      if (archive) await saveLib(archivePack(libRef.current, archive));
      const { end, stopped } = await run(req, entries, start, (p) => setJob({ kind: 'pack', startedAt, label: req.label, cursor: p.cursor, startCursor: start.cursor, total: p.total, inVault: p.inVault }));
      setNotice([stopped ? t('import.stopped') : t('import.finished', {
        inVault: end.inVault.toLocaleString(lang), refused: end.refused.toLocaleString(lang), failed: end.vaultFailed.toLocaleString(lang),
      })]);
    } catch (err) {
      setNotice([failureText(err)]);
    } finally {
      setJob(null);
    }
  };

  const go = (next: View) => { setNotice([]); setView(next); };
  const def = view.kind === 'source' ? sourceById(view.sourceId) : undefined;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.title}>🔭 MnemoScience</div>
        <div style={S.muted}>{t('app.subtitle')}</div>
      </header>

      {libRead.kind === 'unreadable' && (
        <section style={S.card} role="alert">
          <div style={S.error}>{t('lib.unreadable', { why: libRead.why })}</div>
          <button style={S.ghost} onClick={readLibrary}>{t('lib.retry')}</button>
        </section>
      )}

      {view.kind === 'home' && <Home t={t} lang={lang} lib={lib} libRead={libRead} onOpen={(domain) => go({ kind: 'domain', domain })} />}

      {view.kind === 'domain' && (
        <DomainView t={t} lang={lang} domain={view.domain} lib={lib} libRead={libRead} onBack={() => go({ kind: 'home' })}
          onOpen={(sourceId) => go({ kind: 'source', domain: view.domain, sourceId })} />
      )}

      {view.kind === 'source' && def && (
        <SourceView
          key={def.id}
          t={t} lang={lang} def={def} lib={lib} libRead={libRead} job={job} now={now} notice={notice} host={host}
          onBack={() => go({ kind: 'domain', domain: view.domain })}
          onOpenSite={openExternal}
          onImport={(req, entry) => { void importOne(req, entry); }}
          onImportAll={(req, entries) => { void importAll(req, entries); }}
          onStop={() => abortRef.current?.abort()}
        />
      )}

      <Footer
        t={t}
        folder={lib.folder}
        onOpenFolder={() => {
          if (!lib.folder) return;
          withTimeout(sdk.openInOS(lib.folder), HOST_TIMEOUT_MS, 'OPEN_FOLDER')
            .then((r) => { if (!r?.success) console.error('[mnemo-science] open folder refused', r?.error); })
            .catch((err) => console.error('[mnemo-science] open folder failed', err));
        }}
      />
    </div>
  );
}
