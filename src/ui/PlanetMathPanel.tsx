/**
 * PlanetMathPanel — choose an MSC class, then its entries. Listing a class
 * costs ONE GitHub API request out of 60 an hour without a token; the panel
 * shows what is left and, when the quota is spent, when it comes back.
 */
import { useState } from 'react';
import { S } from './styles';
import { EntryList } from './EntryList';
import { useLoad } from './useLoad';
import { cached } from '../sources/cache';
import { fetchText, withRetry } from '../sources/http';
import { PM_CLASSES, classLabel, fetchClassTree, readEntry } from '../sources/planetmath';
import { packKey } from '../memory/library';
import type { ImportRequest, PanelProps, T } from './types';

function errorLine(t: T, why: string, lang: string): string {
  if (why.startsWith('GITHUB_RATE_LIMIT|')) {
    const reset = why.split('|')[1];
    const at = reset && reset !== '?' ? new Date(reset).toLocaleTimeString(lang) : null;
    return at ? t('pm.rateLimitAt', { at }) : t('pm.rateLimit');
  }
  return t('list.failed', { why });
}

/** An MSC class chosen from the list, then its entries. */
export function PlanetMathPanel(p: PanelProps) {
  const { t, lang, def } = p;
  const [repo, setRepo] = useState<string>('');
  const state = useLoad(repo ? () => cached(`pm-tree:${repo}`, () => fetchClassTree(repo)) : null, [repo]);
  const cls = PM_CLASSES.find((c) => c.repo === repo);
  const req: ImportRequest | null = cls ? {
    sourceId: def.id,
    listKey: cls.repo,
    label: `PlanetMath · ${classLabel(cls.repo)}`,
    read: (entry, signal) => readEntry(withRetry(fetchText), cls, entry, signal),
    pauseMs: 100,
  } : null;

  return (
    <section style={S.card}>
      <div style={S.small}>{t('pm.stale')}</div>
      <div style={S.small}>{t('pm.quota')}</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={S.small}>{t('pm.class')}</span>
        <select style={S.input} value={repo} disabled={p.disabled} onChange={(e) => setRepo(e.target.value)}>
          <option value="">{t('pm.choose')}</option>
          {PM_CLASSES.map((c) => <option key={c.repo} value={c.repo}>{classLabel(c.repo)}</option>)}
        </select>
      </label>
      {cls && <div style={S.small}>{t('pm.pushed', { date: cls.pushed })}</div>}
      {state?.kind === 'loading' && <div style={S.muted}>{t('list.loading')}</div>}
      {state?.kind === 'error' && <div style={S.error}>{errorLine(t, state.why, lang)}</div>}
      {state?.kind === 'ready' && req && (
        <>
          <div style={S.small}>{state.data.rate.remaining !== null ? t('pm.remaining', { n: state.data.rate.remaining }) : t('pm.remainingUnknown')}</div>
          {state.data.truncated && <div style={S.small}>{t('pm.truncated')}</div>}
          <EntryList t={t} lang={lang} entries={state.data.entries} req={req} pack={p.packs.find((x) => x.key === packKey(def.id, req.listKey))}
            disabled={p.disabled} onImport={p.onImport} onImportAll={p.onImportAll} />
        </>
      )}
    </section>
  );
}
