/**
 * mactutor — biographies from the MacTutor History of Mathematics archive
 * (University of St Andrews; doc 135 §3bis.5).
 *
 * Measured 2026-10-04:
 *  - no CORS header: the cartridge reads it through the host (`social.fetch`);
 *  - `Biographies/chronological/` lists every biography in ONE page (384 KB,
 *    3 334 entries of the form `<li> (1882 - 1935) <a href="../Noether_Emmy/">…`);
 *  - a biography page holds the name (`<h1>`), a Quick Info block (Born, Died,
 *    Summary), the biography (`<h3>Biography</h3>` then `span.markup`), and a
 *    line `Written by … Last Update November 2014`;
 *  - the server sends `Last-Modified` (Noether: 2026-05-29) but `social.fetch`
 *    returns no headers, so the date of the memory is the page's own
 *    "Last Update" line, and ABSENT when a page has none.
 *  - licence: « Except where otherwise noted, the text of MacTutor by JOC/EFR
 *    is licensed under a Creative Commons Attribution-ShareAlike 4.0
 *    International License. »
 */
import { MACTUTOR_LICENCE } from '../domains';
import { replaceFormulas } from './htmlText';
import type { Entry, FetchText, Unit } from './types';

export const MACTUTOR_BASE = 'https://mathshistory.st-andrews.ac.uk/Biographies/';
export const CHRONOLOGICAL_URL = `${MACTUTOR_BASE}chronological/`;
export const biographyUrl = (slug: string) => `${MACTUTOR_BASE}${encodeURIComponent(slug)}/`;

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Every biography of the chronological index: slug, name, dates. */
export function parseChronological(html: string): Entry[] {
  const doc = parseHtml(html);
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const li of Array.from(doc.querySelectorAll('li'))) {
    const a = li.querySelector('a[href^="../"]');
    const href = a?.getAttribute('href') ?? '';
    const m = href.match(/^\.\.\/([^/]+)\/$/);
    // Only entries with dates are biographies; the menu items and the empty
    // `../test/` link have none.
    const dates = tidy(li.textContent?.replace(a?.textContent ?? '', '')).match(/^\((.+)\)$/)?.[1];
    if (!m || !dates || !tidy(a?.textContent)) continue;
    const slug = decodeURIComponent(m[1]!);
    if (seen.has(slug) || slug.startsWith('category-') || slug.startsWith('letter-')) continue;
    seen.add(slug);
    out.push({ key: slug, title: tidy(a?.textContent), detail: dates });
  }
  return out;
}

export interface Biography {
  name: string;
  born?: string;
  died?: string;
  summary?: string;
  text: string;
  writtenBy?: string;
  /** The page's own "Last Update" words (`November 2014`). */
  lastUpdate?: string;
}

/** Text of a markup block: paragraphs from `<br>`, quotes from `<blockquote>`, popups and Ⓣ marks removed. */
function markupText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('a.translation').forEach((n) => n.remove());
  clone.querySelectorAll('script, style').forEach((n) => n.remove());
  // KaTeX ships each formula as MathML + LaTeX annotation + a rendered copy:
  // keep the LaTeX once, or the text reads `R3\mathbb{R}^{3}R3` (Gauss).
  replaceFormulas(clone, '.katex');
  const parts: string[] = [];
  let line = '';
  const flush = () => { const t = tidy(line); if (t) parts.push(t); line = ''; };
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { line += child.textContent ?? ''; continue; }
      if (child.nodeType !== 1) continue;
      const e = child as Element;
      const tag = e.tagName.toLowerCase();
      if (tag === 'br') { flush(); continue; }
      if (tag === 'blockquote') { flush(); const t = tidy(e.textContent); if (t) parts.push(`> ${t}`); continue; }
      if (tag === 'p' || tag === 'div' || tag === 'li') { flush(); walk(e); flush(); continue; }
      walk(e);
    }
  };
  walk(clone);
  flush();
  return parts.join('\n\n');
}

export function parseBiography(html: string): Biography {
  const doc = parseHtml(html);
  const main = doc.querySelector('main') ?? doc.body;
  const name = tidy(main.querySelector('h1')?.textContent);
  if (!name) throw new Error('MACTUTOR_NOT_A_BIOGRAPHY');
  const dd = (label: string) => {
    const dt = Array.from(main.querySelectorAll('dt')).find((d) => tidy(d.textContent) === label);
    const next = dt?.nextElementSibling;
    return next && next.tagName.toLowerCase() === 'dd' ? tidy(next.textContent) || undefined : undefined;
  };
  const h3 = Array.from(main.querySelectorAll('h3')).find((h) => tidy(h.textContent) === 'Biography');
  let bio: Element | null = null;
  for (let n = h3?.nextElementSibling ?? null; n; n = n.nextElementSibling) {
    if (n.classList.contains('markup')) { bio = n; break; }
  }
  const text = bio ? markupText(bio) : '';
  if (!text) throw new Error('MACTUTOR_NO_BIOGRAPHY_TEXT');
  const body = tidy(doc.body.textContent);
  const writtenBy = body.match(/Written by (.+?)(?= Last Update|$)/)?.[1]?.trim();
  const lastUpdate = body.match(/Last Update ([A-Z][a-z]+ \d{4})/)?.[1];
  const born = dd('Born');
  const died = dd('Died');
  const summary = dd('Summary');
  return {
    name, text,
    ...(born ? { born } : {}), ...(died ? { died } : {}), ...(summary ? { summary } : {}),
    ...(writtenBy ? { writtenBy } : {}), ...(lastUpdate ? { lastUpdate } : {}),
  };
}

export async function readBiography(fetchText: FetchText, entry: Entry, signal?: AbortSignal): Promise<Unit> {
  const b = parseBiography(await fetchText(biographyUrl(entry.key), signal));
  const head = [b.born ? `Born: ${b.born}` : '', b.died ? `Died: ${b.died}` : '', b.summary ? `Summary: ${b.summary}` : ''].filter(Boolean).join('\n');
  return {
    key: entry.key,
    title: `MacTutor · Biography · ${b.name}`,
    text: head ? `${head}\n\n${b.text}` : b.text,
    origin: `MacTutor History of Mathematics, University of St Andrews${b.writtenBy ? `, written by ${b.writtenBy}` : ''}`,
    ...(b.lastUpdate ? { date: `Last update stated by the page: ${b.lastUpdate}` } : {}),
    licence: MACTUTOR_LICENCE,
    url: biographyUrl(entry.key),
    lang: 'en',
  };
}
