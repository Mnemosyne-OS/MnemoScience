/**
 * wikipedia — Wikipedia pages by category, in English, French or Spanish
 * (doc 135 §3bis.1). Never the whole encyclopedia: one category at a time.
 *
 * Measured 2026-10-04 (`w/api.php?…&origin=*`, CORS `*`):
 *  - the six root categories below exist in the three languages; a root holds
 *    few pages of its own (en Physics: 27, fr Mathématiques: 2) and many
 *    sub-categories, so the screen lists both and the person goes one level
 *    down by choice;
 *  - `generator=categorymembers` + `prop=categoryinfo` gives pages and
 *    sub-categories with their page counts in one call (500 per call);
 *  - `prop=revisions` gives a page's last revid and its timestamp: that pair
 *    is the date of the memory. `action=parse&oldid=<revid>` then gives the
 *    HTML of exactly that revision.
 *  - 🪤 `prop=extracts&explaintext` was the first reader and it ERASES every
 *    formula ("Schrödinger equation": 17 sentences ending on "where" and
 *    nothing) and leaves lines of spaces. The HTML carries each formula's
 *    LaTeX in `alttext`, which is what the memory keeps (htmlText.ts).
 *  - licence (`rightsinfo`, en/fr/es): « Creative Commons Attribution-Share Alike 4.0 ».
 */
import { WIKIPEDIA_LICENCE } from '../domains';
import { blocksOf, joinBlocks, replaceFormulas } from './htmlText';
import type { DomainId, Entry, Unit } from './types';

export type WikiLang = 'en' | 'fr' | 'es';
export const WIKI_LANGS: readonly WikiLang[] = ['en', 'fr', 'es'];

/** Root category per sub-domain and language, each checked to exist on 2026-10-04. */
export const WIKI_ROOTS: Record<DomainId, Record<WikiLang, string>> = {
  physics: { en: 'Category:Physics', fr: 'Catégorie:Physique', es: 'Categoría:Física' },
  chemistry: { en: 'Category:Chemistry', fr: 'Catégorie:Chimie', es: 'Categoría:Química' },
  biology: { en: 'Category:Biology', fr: 'Catégorie:Biologie', es: 'Categoría:Biología' },
  mathematics: { en: 'Category:Mathematics', fr: 'Catégorie:Mathématiques', es: 'Categoría:Matemáticas' },
  astronomy: { en: 'Category:Astronomy', fr: 'Catégorie:Astronomie', es: 'Categoría:Astronomía' },
  history: { en: 'Category:History of science', fr: 'Catégorie:Histoire des sciences', es: 'Categoría:Historia de la ciencia' },
};

/** Asked by the MediaWiki API etiquette; sent as `Api-User-Agent` since a browser owns `User-Agent`. */
export const API_USER_AGENT = 'MnemoScience/0.1 (Mnemosyne OS cartridge; https://github.com/Mnemosyne-OS)';

/** Most members read for one category: a few calls of 500, never a crawl. */
export const MEMBER_CAP = 2000;

export function apiUrl(lang: WikiLang, params: Record<string, string>): string {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  return `https://${lang}.wikipedia.org/w/api.php?${q.toString()}`;
}

export function membersUrl(lang: WikiLang, category: string, cont?: string): string {
  return apiUrl(lang, {
    action: 'query', generator: 'categorymembers', gcmtitle: category, gcmlimit: '500',
    gcmtype: 'page|subcat', gcmnamespace: '0|14', prop: 'categoryinfo',
    ...(cont ? { gcmcontinue: cont } : {}),
  });
}

/** The last revision of a page, with its address. */
export function revisionUrl(lang: WikiLang, pageid: string): string {
  return apiUrl(lang, { action: 'query', pageids: pageid, prop: 'revisions|info', rvprop: 'ids|timestamp', inprop: 'url' });
}

/** The HTML of one exact revision. */
export function parseUrl(lang: WikiLang, revid: number): string {
  return apiUrl(lang, { action: 'parse', oldid: String(revid), prop: 'text', disableeditsection: '1', disabletoc: '1' });
}

export interface SubCategory {
  title: string;
  /** Pages directly in it, from `categoryinfo`; null when the API gave none. */
  pages: number | null;
}

export interface MembersPage {
  pages: Entry[];
  subcats: SubCategory[];
  /** `gcmcontinue` for the next call, absent at the end. */
  cont?: string;
}

/** One answer of the members call. A missing `query` is an empty category, not an error. */
export function parseMembers(json: unknown): MembersPage {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (j.error) throw new Error(`WIKI_API_${String((j.error as Record<string, unknown>).code ?? 'error')}`);
  const raw = ((j.query as Record<string, unknown> | undefined)?.pages ?? []) as Record<string, unknown>[];
  const pages: Entry[] = [];
  const subcats: SubCategory[] = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const title = typeof p.title === 'string' ? p.title : '';
    if (!title) continue;
    if (p.ns === 0 && typeof p.pageid === 'number') pages.push({ key: String(p.pageid), title });
    else if (p.ns === 14) {
      const info = p.categoryinfo as Record<string, unknown> | undefined;
      subcats.push({ title, pages: typeof info?.pages === 'number' ? info.pages : null });
    }
  }
  // The generator returns members in no stable order: sort for a list a person reads.
  pages.sort((a, b) => a.title.localeCompare(b.title));
  subcats.sort((a, b) => a.title.localeCompare(b.title));
  const cont = (j.continue as Record<string, unknown> | undefined)?.gcmcontinue;
  return { pages, subcats, ...(typeof cont === 'string' ? { cont } : {}) };
}

/** The display name of a category without its namespace (`Catégorie:Chimie` → `Chimie`). */
export function categoryName(title: string): string {
  const i = title.indexOf(':');
  return i >= 0 ? title.slice(i + 1) : title;
}

/** Every member of a category, up to MEMBER_CAP; `capped` says when the list was cut. */
export async function listCategory(
  fetchJson: (url: string, signal?: AbortSignal) => Promise<unknown>,
  lang: WikiLang,
  category: string,
  signal?: AbortSignal,
): Promise<{ pages: Entry[]; subcats: SubCategory[]; capped: boolean }> {
  const pages: Entry[] = [];
  const subcats: SubCategory[] = [];
  let cont: string | undefined;
  do {
    const page = parseMembers(await fetchJson(membersUrl(lang, category, cont), signal));
    pages.push(...page.pages);
    subcats.push(...page.subcats);
    cont = page.cont;
  } while (cont && pages.length + subcats.length < MEMBER_CAP);
  pages.sort((a, b) => a.title.localeCompare(b.title));
  subcats.sort((a, b) => a.title.localeCompare(b.title));
  return { pages, subcats, capped: !!cont };
}

export interface WikiRevision {
  title: string;
  revid: number | null;
  timestamp: string | null;
  url: string;
}

/** The revision answer. A missing page is refused. */
export function parseRevision(json: unknown): WikiRevision {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (j.error) throw new Error(`WIKI_API_${String((j.error as Record<string, unknown>).code ?? 'error')}`);
  const p = (((j.query as Record<string, unknown> | undefined)?.pages ?? []) as Record<string, unknown>[])[0];
  if (!p || p.missing || typeof p.title !== 'string') throw new Error('WIKI_PAGE_MISSING');
  const rev = (Array.isArray(p.revisions) ? p.revisions[0] : undefined) as Record<string, unknown> | undefined;
  return {
    title: p.title,
    revid: typeof rev?.revid === 'number' ? rev.revid : null,
    timestamp: typeof rev?.timestamp === 'string' ? rev.timestamp : null,
    url: typeof p.fullurl === 'string' ? p.fullurl : '',
  };
}

/** The HTML of a parse answer. */
export function parseHtmlAnswer(json: unknown): string {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (j.error) throw new Error(`WIKI_API_${String((j.error as Record<string, unknown>).code ?? 'error')}`);
  const text = (j.parse as Record<string, unknown> | undefined)?.text;
  const html = typeof text === 'string' ? text : (text && typeof text === 'object' ? (text as Record<string, unknown>)['*'] : undefined);
  if (typeof html !== 'string') throw new Error('WIKI_PAGE_MISSING');
  return html;
}

/** Page furniture that is not the article: boxes, navigation, references, edit links, styles. */
const NOISE = [
  'style', 'script', 'link', 'meta', '.mw-editsection', 'sup.reference', '.reference', '.mw-references-wrap', 'ol.references',
  '.reflist', '.navbox', '.navbox-styles', '.vertical-navbox', '.sidebar', '.infobox', '.metadata', '.ambox', '.mbox-small',
  '.hatnote', '.shortdescription', '.noprint', '.mw-empty-elt', '#toc', '.toc', '.thumb', 'figure', '.gallery', '.mw-cite-backlink',
].join(',');

/** Headings after which a page holds only links and references. */
const TAIL = /^(References|External links|See also|Notes|Further reading|Bibliography|Sources|Notes and references|Références|Liens externes|Voir aussi|Notes et références|Bibliographie|Articles connexes|Referencias|Enlaces externos|Véase también|Notas|Bibliografía)$/i;

/**
 * The article as text: every formula as its LaTeX between `$…$`, headings as
 * markdown, furniture and the reference tail dropped, blank lines normalized.
 */
export function wikiHtmlText(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;
  replaceFormulas(root, '.mwe-math-element');
  root.querySelectorAll(NOISE).forEach((n) => n.remove());
  const blocks = blocksOf(root);
  const cut = blocks.findIndex((b) => /^#{2} /.test(b) && TAIL.test(b.replace(/^#+ /, '')));
  const kept = cut >= 0 ? blocks.slice(0, cut) : blocks;
  // Drop headings left with nothing under them.
  const out = kept.filter((b, i) => {
    const h = b.match(/^(#+) /);
    if (!h) return true;
    const next = kept[i + 1]?.match(/^(#+) /);
    return i + 1 < kept.length && !(next && next[1]!.length <= h[1]!.length);
  });
  return joinBlocks(out);
}

/** The date phrase of a page, or absent when the API gave no revision. */
export function revisionDate(page: Pick<WikiRevision, 'revid' | 'timestamp'>): string | undefined {
  if (page.revid !== null && page.timestamp) return `Revision ${page.revid} of ${page.timestamp}`;
  if (page.timestamp) return `Last revised ${page.timestamp}`;
  return undefined;
}

/** Reads the page's last revision, then the HTML of THAT revision, so text and date always match. */
export async function readPage(
  fetchJson: (url: string, signal?: AbortSignal) => Promise<unknown>,
  lang: WikiLang,
  entry: Entry,
  signal?: AbortSignal,
): Promise<Unit> {
  const rev = parseRevision(await fetchJson(revisionUrl(lang, entry.key), signal));
  if (rev.revid === null) throw new Error('WIKI_PAGE_MISSING');
  const text = wikiHtmlText(parseHtmlAnswer(await fetchJson(parseUrl(lang, rev.revid), signal)));
  const date = revisionDate(rev);
  return {
    key: entry.key,
    title: `Wikipedia (${lang}) · ${rev.title}`,
    text,
    origin: `Wikipedia (${lang}), "${rev.title}"`,
    ...(date ? { date } : {}),
    licence: WIKIPEDIA_LICENCE,
    url: rev.url || `https://${lang}.wikipedia.org/?curid=${entry.key}`,
    lang,
  };
}
