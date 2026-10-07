/**
 * EntryList — the entries of one list, a filter, and the two gestures:
 * put ONE entry in memory, or put the WHOLE list (resumed where it stopped).
 *
 * The filter is local (no request): it narrows what is already listed. At
 * most ROWS lines are drawn, and the screen says when more match.
 */
import { useMemo, useState } from 'react';
import { S } from './styles';
import { fold } from './labels';
import type { Entry } from '../sources/types';
import { packDone, type PackEntry } from '../memory/library';
import type { ImportRequest, T } from './types';

const ROWS = 200;

/** A list, its filter, and the one-entry and whole-list gestures. */
export function EntryList({ t, lang, entries, req, pack, disabled, onImport, onImportAll }: {
  t: T;
  lang: string;
  entries: readonly Entry[];
  req: ImportRequest;
  /** The resume point of this exact list, if "everything" was started before. */
  pack: PackEntry | undefined;
  disabled: boolean;
  onImport: (req: ImportRequest, entry: Entry) => void;
  onImportAll: (req: ImportRequest, entries: readonly Entry[]) => void;
}) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = fold(filter.trim());
    return q ? entries.filter((e) => fold(`${e.title} ${e.detail ?? ''}`).includes(q)) : entries;
  }, [entries, filter]);
  const done = pack ? packDone(pack) : false;
  const n = entries.length.toLocaleString(lang);

  return (
    <>
      <div style={{ ...S.row, flexWrap: 'wrap' }}>
        <span style={S.small}>{t('list.count', { n })}</span>
        {entries.length > 0 && !done && (
          <button style={S.button} disabled={disabled} onClick={() => onImportAll(req, entries)}>
            {pack && pack.cursor > 0
              ? t('list.resume', { cursor: pack.cursor.toLocaleString(lang), total: pack.total.toLocaleString(lang) })
              : t('list.importAll', { n })}
          </button>
        )}
      </div>
      {pack && (
        <div style={S.small}>{t(done ? 'pack.done' : 'pack.progress', {
          cursor: pack.cursor.toLocaleString(lang), total: pack.total.toLocaleString(lang),
          inVault: pack.inVault.toLocaleString(lang), refused: pack.refused.toLocaleString(lang), failed: pack.vaultFailed.toLocaleString(lang),
        })}</div>
      )}
      {entries.length > 0 && (
        <input style={S.input} value={filter} placeholder={t('list.filter')} onChange={(e) => setFilter(e.target.value)} />
      )}
      {filter.trim() && shown.length === 0 && <div style={S.muted}>{t('list.none', { q: filter.trim() })}</div>}
      {shown.length > ROWS && <div style={S.small}>{t('list.more', { shown: ROWS, n: shown.length.toLocaleString(lang) })}</div>}
      <ul style={S.list}>
        {shown.slice(0, ROWS).map((e) => (
          <li key={e.key} style={S.row}>
            <span>
              {e.title}
              {e.detail && <span style={S.muted}> · {e.detail}</span>}
            </span>
            <button style={S.ghost} disabled={disabled} onClick={() => onImport(req, e)}>{t('list.importOne')}</button>
          </li>
        ))}
      </ul>
    </>
  );
}
