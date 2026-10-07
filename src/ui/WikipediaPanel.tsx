/**
 * WikipediaPanel — the pages of one category in one language, and its
 * sub-categories one click away. The language starts on the app's own when
 * Wikipedia is offered in it (en, fr, es), English otherwise.
 */
import { useState } from 'react';
import { S } from './styles';
import { EntryList } from './EntryList';
import { useLoad } from './useLoad';
import { fetchText, withRetry } from '../sources/http';
import { API_USER_AGENT, MEMBER_CAP, WIKI_LANGS, WIKI_ROOTS, categoryName, listCategory, readPage, type WikiLang } from '../sources/wikipedia';
import { packKey } from '../memory/library';
import type { ImportRequest, PanelProps } from './types';

/** JSON from the MediaWiki API, with the identifying header its etiquette asks for. */
const wikiText = withRetry((url, signal) => fetchText(url, signal, { 'Api-User-Agent': API_USER_AGENT }));
const wikiJson = async (url: string, signal?: AbortSignal) => JSON.parse(await wikiText(url, signal)) as unknown;

/** A category's pages in one language, its sub-categories one click away. */
export function WikipediaPanel(p: PanelProps) {
  const { t, lang, def } = p;
  const start: WikiLang = (WIKI_LANGS as readonly string[]).includes(lang) ? lang as WikiLang : 'en';
  const [wlang, setWlang] = useState<WikiLang>(start);
  const [path, setPath] = useState<string[]>([WIKI_ROOTS[def.domain][start]]);
  const category = path[path.length - 1]!;
  const state = useLoad(() => listCategory(wikiJson, wlang, category), [wlang, category]);

  const chooseLang = (l: WikiLang) => { setWlang(l); setPath([WIKI_ROOTS[def.domain][l]]); };
  const req: ImportRequest = {
    sourceId: def.id,
    listKey: `${wlang}|${category}`,
    label: `Wikipedia (${wlang}) · ${categoryName(category)}`,
    read: (entry, signal) => readPage(wikiJson, wlang, entry, signal),
    pauseMs: 300,
  };

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={S.small}>{t('wiki.lang')}</span>
        {WIKI_LANGS.map((l) => (
          <button key={l} style={l === wlang ? S.button : S.ghost} disabled={p.disabled} aria-pressed={l === wlang} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {path.map((c, i) => (
          <span key={c}>
            {i > 0 && <span style={S.muted}> › </span>}
            {i < path.length - 1
              ? <button style={S.link} disabled={p.disabled} onClick={() => setPath(path.slice(0, i + 1))}>{categoryName(c)}</button>
              : <strong>{categoryName(c)}</strong>}
          </span>
        ))}
      </div>
      {(!state || state.kind === 'loading') && <div style={S.muted}>{t('list.loading')}</div>}
      {state?.kind === 'error' && <div style={S.error}>{t('list.failed', { why: state.why })}</div>}
      {state?.kind === 'ready' && (
        <>
          {state.data.subcats.length > 0 && (
            <>
              <div style={S.small}>{t('wiki.subcats', { n: state.data.subcats.length.toLocaleString(lang) })}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {state.data.subcats.map((c) => (
                  <button key={c.title} style={S.ghost} disabled={p.disabled} onClick={() => setPath([...path, c.title])}>
                    {categoryName(c.title)}{c.pages !== null ? ` (${c.pages.toLocaleString(lang)})` : ''}
                  </button>
                ))}
              </div>
            </>
          )}
          {state.data.capped && <div style={S.small}>{t('wiki.capped', { max: MEMBER_CAP.toLocaleString(lang) })}</div>}
          <EntryList t={t} lang={lang} entries={state.data.pages} req={req} pack={p.packs.find((x) => x.key === packKey(def.id, req.listKey))}
            disabled={p.disabled} onImport={p.onImport} onImportAll={p.onImportAll} />
        </>
      )}
    </section>
  );
}
