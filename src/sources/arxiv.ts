/**
 * arxiv — abstracts of arXiv preprints, newest first, by category
 * (doc 135 §3bis.3). Abstracts only: the full texts are PDFs.
 *
 * Measured 2026-10-04 (`export.arxiv.org/api/query`, Atom, no CORS header:
 * read through the host):
 *  - `search_query=cat:<cat>&sortBy=submittedDate&sortOrder=descending`
 *    answers entries with title, summary, authors, categories, `<published>`
 *    and `<updated>`; `opensearch:totalResults` counts the category;
 *  - 🪤 `max_results=0` answers a total of 1 whatever the category: the count
 *    is read from a real page;
 *  - the feed carries NO licence: arXiv licences are per article, shown on the
 *    article page. The memory says so; a licence is never guessed;
 *  - arXiv asks for one request every 3 seconds: every call goes through one
 *    throttle.
 */
import { createThrottle } from './http';
import type { Entry, FetchText, Unit } from './types';

/** Entries per page: one call stays well under the host's 12 s timeout. */
export const ARXIV_PAGE = 50;

/** The arXiv API terms: no more than one request every 3 seconds. */
export const ARXIV_GAP_MS = 3_000;

/** Shared by every arXiv call of the window. */
export const arxivThrottle = createThrottle(ARXIV_GAP_MS);

export const queryUrl = (cat: string, start: number, max = ARXIV_PAGE) =>
  `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`cat:${cat}`)}&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${max}`;

export interface ArxivEntry {
  /** `2609.38292v1`. */
  id: string;
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published?: string;
  updated?: string;
  comment?: string;
  url: string;
}

const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function childText(el: Element, local: string): string {
  const c = Array.from(el.children).find((x) => x.localName === local);
  return tidy(c?.textContent);
}

export function parseFeed(xml: string): { total: number | null; entries: ArxivEntry[] } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('ARXIV_XML_UNREADABLE');
  const root = doc.documentElement;
  if (root.localName !== 'feed') throw new Error('ARXIV_NOT_A_FEED');
  const totalText = childText(root, 'totalResults');
  const total = /^\d+$/.test(totalText) ? Number(totalText) : null;
  const entries: ArxivEntry[] = [];
  for (const e of Array.from(root.children).filter((x) => x.localName === 'entry')) {
    const idUrl = childText(e, 'id');
    const id = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, '');
    const title = childText(e, 'title');
    const summary = childText(e, 'summary');
    if (!id || !title || !summary) continue;
    const authors = Array.from(e.children).filter((x) => x.localName === 'author').map((a) => childText(a, 'name')).filter(Boolean);
    const categories = Array.from(e.children).filter((x) => x.localName === 'category').map((c) => c.getAttribute('term') ?? '').filter(Boolean);
    const alt = Array.from(e.children).find((x) => x.localName === 'link' && x.getAttribute('rel') === 'alternate')?.getAttribute('href');
    const published = childText(e, 'published');
    const updated = childText(e, 'updated');
    const comment = childText(e, 'comment');
    entries.push({
      id, title, summary, authors, categories,
      ...(published ? { published } : {}), ...(updated ? { updated } : {}), ...(comment ? { comment } : {}),
      url: alt || `https://arxiv.org/abs/${id}`,
    });
  }
  return { total, entries };
}

export function arxivEntry(a: ArxivEntry): Entry {
  const who = a.authors.length > 3 ? `${a.authors.slice(0, 3).join(', ')} et al.` : a.authors.join(', ');
  return { key: a.id, title: a.title, detail: [who, a.published?.slice(0, 10)].filter(Boolean).join(' · ') };
}

/** Submitted and updated, as the feed gives them; absent when it gives neither. */
export function arxivDate(a: Pick<ArxivEntry, 'published' | 'updated'>): string | undefined {
  if (a.published && a.updated && a.updated !== a.published) return `Submitted ${a.published}, last updated ${a.updated}`;
  if (a.published) return `Submitted ${a.published}`;
  if (a.updated) return `Last updated ${a.updated}`;
  return undefined;
}

/** Never a licence name: the feed has none. */
export const ARXIV_LICENCE_LINE = 'per article, not given by the arXiv API; see the article page';

export function arxivUnit(a: ArxivEntry): Unit {
  const date = arxivDate(a);
  return {
    key: a.id,
    title: `arXiv · ${a.id} · ${a.title}`,
    text: [
      a.title,
      a.authors.length ? `Authors: ${a.authors.join(', ')}` : '',
      a.categories.length ? `Categories: ${a.categories.join(', ')}` : '',
      `Abstract: ${a.summary}`,
      a.comment ? `Comment: ${a.comment}` : '',
    ].filter(Boolean).join('\n\n'),
    origin: `arXiv preprint ${a.id} (abstract only)`,
    ...(date ? { date } : {}),
    licence: ARXIV_LICENCE_LINE,
    url: a.url,
    lang: 'en',
  };
}

export async function readPage(fetchText: FetchText, cat: string, start: number, signal?: AbortSignal, run = arxivThrottle): Promise<{ total: number | null; entries: ArxivEntry[] }> {
  return parseFeed(await run(() => fetchText(queryUrl(cat, start), signal)));
}
