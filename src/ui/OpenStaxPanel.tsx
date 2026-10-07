/**
 * OpenStaxPanel — one textbook: its plan read live from the collection file
 * (licence included), its modules named from the shipped title list.
 */
import { useMemo } from 'react';
import { S } from './styles';
import { EntryList } from './EntryList';
import { useLoad } from './useLoad';
import { cached } from '../sources/cache';
import { fetchJson, fetchText, withRetry } from '../sources/http';
import { TITLES_BUILT_AT, bookEntries, collectionUrl, licenceOf, parseCollection, pushedAt, readModule, repoApiUrl } from '../sources/openstax';
import { packKey } from '../memory/library';
import type { ImportRequest, PanelProps } from './types';

/** The repository's last push, or absent: the GitHub API quota is 60 an hour and a refusal is not an error of the book. */
function repoDate(repo: string): Promise<string | undefined> {
  return cached(`openstax-push:${repo}`, () => fetchJson(repoApiUrl({ repo })).then(pushedAt))
    .catch((err) => { console.warn('[mnemo-science] repository date unavailable', repo, err); return undefined; });
}

/** One textbook: its live plan and licence, its modules. */
export function OpenStaxPanel(p: PanelProps) {
  const { t, lang, def } = p;
  const book = def.book!;
  const state = useLoad(async () => {
    const [plan, pushed] = await Promise.all([
      cached(`openstax-plan:${book.slug}`, async () => parseCollection(await fetchText(collectionUrl(book)))),
      repoDate(book.repo),
    ]);
    return { plan, pushed };
  }, [book.slug]);

  const ready = state?.kind === 'ready' ? state.data : null;
  const entries = useMemo(() => (ready ? bookEntries(book.slug, ready.plan) : []), [ready, book.slug]);
  const req: ImportRequest | null = ready ? {
    sourceId: def.id,
    listKey: 'book',
    label: ready.plan.title || book.title,
    read: (entry, signal) => readModule(withRetry(fetchText), book, ready.plan, entry.key, { signal, ...(ready.pushed ? { repoPushedAt: ready.pushed } : {}) }),
    pauseMs: 100,
    licence: licenceOf(ready.plan) || undefined,
  } : null;

  return (
    <section style={S.card}>
      {(!state || state.kind === 'loading') && <div style={S.muted}>{t('list.loading')}</div>}
      {state?.kind === 'error' && <div style={S.error}>{t('list.failed', { why: state.why })}</div>}
      {ready && req && (
        <>
          <div style={S.small}>{t('openstax.licenceLive', { licence: licenceOf(ready.plan) || t('openstax.noLicence') })}</div>
          <div style={S.small}>{ready.pushed ? t('openstax.pushed', { date: ready.pushed.slice(0, 10) }) : t('openstax.noDate')}</div>
          <div style={S.small}>{t('openstax.quota')}</div>
          <div style={S.small}>{t('openstax.titles', { date: TITLES_BUILT_AT })}</div>
          <EntryList t={t} lang={lang} entries={entries} req={req} pack={p.packs.find((x) => x.key === packKey(def.id, 'book'))}
            disabled={p.disabled} onImport={p.onImport} onImportAll={p.onImportAll} />
        </>
      )}
    </section>
  );
}
