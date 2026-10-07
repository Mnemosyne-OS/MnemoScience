/**
 * MacTutorPanel — every biography of the chronological index, read through
 * the host (no CORS). One page at a time, one second apart: the archive is a
 * university server, not an API.
 */
import { S } from './styles';
import { EntryList } from './EntryList';
import { useLoad } from './useLoad';
import { cached } from '../sources/cache';
import { withRetry } from '../sources/http';
import { CHRONOLOGICAL_URL, parseChronological, readBiography } from '../sources/mactutor';
import { packKey } from '../memory/library';
import type { ImportRequest, PanelProps } from './types';

/** Every MacTutor biography, read through the host. */
export function MacTutorPanel(p: PanelProps) {
  const { t, lang, def, host } = p;
  const state = useLoad(() => cached('mactutor-index', async () => parseChronological(await host(CHRONOLOGICAL_URL))), []);
  const req: ImportRequest = {
    sourceId: def.id,
    listKey: 'chronological',
    label: 'MacTutor · Biographies',
    read: (entry, signal) => readBiography(withRetry(host), entry, signal),
    pauseMs: 1000,
  };
  return (
    <section style={S.card}>
      <div style={S.small}>{t('mactutor.date')}</div>
      {(!state || state.kind === 'loading') && <div style={S.muted}>{t('list.loading')}</div>}
      {state?.kind === 'error' && <div style={S.error}>{t('list.failed', { why: state.why })}</div>}
      {state?.kind === 'ready' && (
        <EntryList t={t} lang={lang} entries={state.data} req={req} pack={p.packs.find((x) => x.key === packKey(def.id, req.listKey))}
          disabled={p.disabled} onImport={p.onImport} onImportAll={p.onImportAll} />
      )}
    </section>
  );
}
