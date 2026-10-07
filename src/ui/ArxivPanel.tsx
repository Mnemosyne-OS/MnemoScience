/**
 * ArxivPanel — the newest abstracts of one arXiv category, 50 at a time,
 * through the host (no CORS) and one request every 3 seconds at most. The
 * feed holds the abstract in full, so putting it in memory costs nothing more.
 */
import { useEffect, useRef, useState } from 'react';
import { S } from './styles';
import { EntryList } from './EntryList';
import { arxivEntry, arxivThrottle, arxivUnit, readPage, type ArxivEntry } from '../sources/arxiv';
import { packKey } from '../memory/library';
import type { ImportRequest, PanelProps } from './types';

type State = { kind: 'loading' } | { kind: 'error'; why: string } | { kind: 'ready' };

/** The newest abstracts of one arXiv category. */
export function ArxivPanel(p: PanelProps) {
  const { t, lang, def, host } = p;
  const cat = def.arxivCat!;
  const [items, setItems] = useState<ArxivEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = async (start: number, prior: ArxivEntry[]) => {
    setState({ kind: 'loading' });
    try {
      const page = await readPage(host, cat, start, undefined, arxivThrottle);
      if (!alive.current) return;
      const seen = new Set(prior.map((a) => a.id));
      setItems([...prior, ...page.entries.filter((a) => !seen.has(a.id))]);
      setTotal(page.total);
      setState({ kind: 'ready' });
    } catch (err) {
      console.error('[mnemo-science] arXiv page failed', err);
      if (alive.current) setState({ kind: 'error', why: err instanceof Error ? err.message : String(err) });
    }
  };

  useEffect(() => { void load(0, []); }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const byKey = new Map(items.map((a) => [a.id, a]));
  const entries = items.map(arxivEntry);
  const req: ImportRequest = {
    sourceId: def.id,
    // One key per category: the list grows at the top every day and with each
    // "Load more", and the pack resumes on the keys it already did.
    listKey: 'newest',
    label: `arXiv ${cat}`,
    read: async (entry) => {
      const a = byKey.get(entry.key);
      if (!a) throw new Error('ARXIV_ENTRY_NOT_LOADED');
      return arxivUnit(a);
    },
  };

  return (
    <section style={S.card}>
      <div style={S.small}>{t('arxiv.note')}</div>
      {total !== null && <div style={S.small}>{t('arxiv.total', { n: total.toLocaleString(lang), cat })}</div>}
      {state.kind === 'error' && <div style={S.error}>{t('list.failed', { why: state.why })}</div>}
      {items.length > 0 && (
        <EntryList t={t} lang={lang} entries={entries} req={req} pack={p.packs.find((x) => x.key === packKey(def.id, req.listKey))}
          disabled={p.disabled} onImport={p.onImport} onImportAll={p.onImportAll} />
      )}
      {state.kind === 'loading' && <div style={S.muted}>{t('list.loading')}</div>}
      {state.kind !== 'loading' && (total === null || items.length < total) && (
        <button style={S.ghost} disabled={p.disabled} onClick={() => { void load(items.length, items); }}>{t('list.loadMore')}</button>
      )}
    </section>
  );
}
