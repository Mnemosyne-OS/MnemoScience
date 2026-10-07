/**
 * OeisPanel — a search of the OEIS, 10 sequences a page, never past the first
 * 100 results (the OEIS answers 403 beyond that without an account). The
 * search answer already holds each sequence in full, so putting it in memory
 * costs no second request.
 */
import { useEffect, useRef, useState } from 'react';
import { S } from './styles';
import { EntryList } from './EntryList';
import { OEIS_DEFAULT_QUERY, OEIS_MAX_RESULTS, OEIS_PAGE, searchPage, sequenceEntry, sequenceUnit, type OeisSequence } from '../sources/oeis';
import { packKey } from '../memory/library';
import type { Entry } from '../sources/types';
import type { ImportRequest, PanelProps } from './types';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; why: string } | { kind: 'ready' };

/** A search of the OEIS, page by page up to its anonymous cap. */
export function OeisPanel(p: PanelProps) {
  const { t, lang, def, host } = p;
  const [draft, setDraft] = useState(OEIS_DEFAULT_QUERY);
  const [query, setQuery] = useState(OEIS_DEFAULT_QUERY);
  const [seqs, setSeqs] = useState<OeisSequence[]>([]);
  const [end, setEnd] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = async (q: string, start: number, prior: OeisSequence[]) => {
    setState({ kind: 'loading' });
    try {
      const page = await searchPage(host, q, start);
      if (!alive.current) return;
      setSeqs([...prior, ...page]);
      setEnd(page.length < OEIS_PAGE || start + OEIS_PAGE >= OEIS_MAX_RESULTS);
      setState({ kind: 'ready' });
    } catch (err) {
      console.error('[mnemo-science] OEIS search failed', err);
      if (!alive.current) return;
      const why = err instanceof Error ? err.message : String(err);
      // 403 past the first page = the OEIS's cap on anonymous searches: the end of the
      // list, said as such. A 403 on the FIRST page is a refusal, never "nothing found".
      if (why === 'HTTP_403' && start > 0) { setEnd(true); setState({ kind: 'ready' }); return; }
      if (why === 'HTTP_403') { setState({ kind: 'error', why: 'REFUSED' }); return; }
      setState({ kind: 'error', why });
    }
  };

  // The default search runs once, on open.
  useEffect(() => { void load(OEIS_DEFAULT_QUERY, 0, []); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const search = () => {
    const q = draft.trim();
    if (!q) return;
    setQuery(q);
    setSeqs([]);
    setEnd(false);
    void load(q, 0, []);
  };

  const byKey = new Map(seqs.map((s) => [sequenceEntry(s).key, s]));
  const entries: Entry[] = seqs.map(sequenceEntry);
  const req: ImportRequest = {
    sourceId: def.id,
    // One key per search: "Load more" grows the same list, it does not start a new one.
    listKey: `q=${query}`,
    label: `OEIS · ${query}`,
    read: async (entry) => {
      const s = byKey.get(entry.key);
      if (!s) throw new Error('OEIS_SEQUENCE_NOT_LOADED');
      return sequenceUnit(s);
    },
  };

  return (
    <section style={S.card}>
      <div style={S.small}>{t('oeis.cap', { max: OEIS_MAX_RESULTS })}</div>
      <form style={{ display: 'flex', gap: 6 }} onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input style={{ ...S.input, flex: 1 }} value={draft} placeholder={t('oeis.placeholder')} onChange={(e) => setDraft(e.target.value)} />
        <button style={S.ghost} type="submit" disabled={state.kind === 'loading' || p.disabled}>{t('oeis.search')}</button>
      </form>
      {state.kind === 'error' && <div style={S.error}>{state.why === 'REFUSED' ? t('oeis.refused') : t('list.failed', { why: state.why })}</div>}
      {state.kind === 'ready' && seqs.length === 0 && <div style={S.muted}>{t('oeis.none', { q: query })}</div>}
      {seqs.length > 0 && (
        <EntryList t={t} lang={lang} entries={entries} req={req} pack={p.packs.find((x) => x.key === packKey(def.id, req.listKey))}
          disabled={p.disabled} onImport={p.onImport} onImportAll={p.onImportAll} />
      )}
      {state.kind === 'loading' && <div style={S.muted}>{t('list.loading')}</div>}
      {state.kind === 'ready' && seqs.length > 0 && !end && (
        <button style={S.ghost} disabled={p.disabled} onClick={() => { void load(query, seqs.length, seqs); }}>{t('list.loadMore')}</button>
      )}
      {end && seqs.length > 0 && <div style={S.small}>{t('oeis.end', { n: seqs.length })}</div>}
    </section>
  );
}
