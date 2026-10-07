/**
 * openstax — OpenStax textbooks from their GitHub repositories (doc 135 §3bis.3).
 *
 * Measured 2026-10-04 (raw.githubusercontent.com, CORS `*`):
 *  - `META-INF/books.xml` names the collections of a repository;
 *  - `collections/<slug>.collection.xml` holds the plan: units and chapters
 *    as nested `col:subcollection` with an `md:title`, modules by id only,
 *    and the licence in `md:license` (text AND url; the two Spanish chemistry
 *    books carry the url with NO text);
 *  - `modules/<id>/index.cnxml` holds one module (a section of the book):
 *    its `<title>`, paragraphs, lists, figures, tables, MathML.
 *
 * Unit = one module, titled with the book and its chapter. The licence is
 * read from the collection each time, never assumed from the edition. The
 * date is the repository's last push (GitHub API, one call per book and per
 * session); when that call fails the date is ABSENT.
 */
import { mathLine } from './mathml';
import type { Entry, FetchText, Unit } from './types';
import titlesFile from '../catalogue/openstax-titles.json';

export interface OpenStaxBook {
  /** Collection slug, unique: `astronomy-2e`. */
  slug: string;
  repo: string;
  /** Title as measured 2026-10-04, shown before the collection is read. */
  title: string;
  lang: 'en' | 'es';
  /** Modules counted in the collection on 2026-10-04. */
  modules: number;
  /** `md:license` text measured 2026-10-04 (empty when the file gives none). */
  licence: string;
  licenceUrl: string;
}

/** One module in the plan, with the titles of the subcollections around it (unit, chapter). */
export interface PlanModule {
  id: string;
  chapter: string[];
}

export interface BookPlan {
  title: string;
  lang: string;
  /** `md:license` text, '' when absent. */
  licence: string;
  licenceUrl: string;
  modules: PlanModule[];
}

const RAW = 'https://raw.githubusercontent.com/openstax';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const collectionUrl = (b: Pick<OpenStaxBook, 'repo' | 'slug'>) => `${RAW}/${b.repo}/main/${encodePath(`collections/${b.slug}.collection.xml`)}`;
export const moduleUrl = (b: Pick<OpenStaxBook, 'repo'>, id: string) => `${RAW}/${b.repo}/main/modules/${id}/index.cnxml`;
export const moduleWebUrl = (b: Pick<OpenStaxBook, 'repo'>, id: string) => `https://github.com/openstax/${b.repo}/blob/main/modules/${id}/index.cnxml`;
export const repoApiUrl = (b: Pick<OpenStaxBook, 'repo'>) => `https://api.github.com/repos/openstax/${b.repo}`;

/** Children of an element with the given local name (namespaces ignored). */
function childrenNamed(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function firstNamed(root: Document | Element, name: string): Element | null {
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) if (all[i]!.localName === name) return all[i]!;
  return null;
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('OPENSTAX_XML_UNREADABLE');
  return doc;
}

/** The plan of a book from its collection file. */
export function parseCollection(xml: string): BookPlan {
  const doc = parseXml(xml);
  const meta = firstNamed(doc, 'metadata');
  const content = firstNamed(doc, 'content');
  if (!meta || !content) throw new Error('OPENSTAX_NOT_A_COLLECTION');
  const metaText = (name: string) => (meta ? childrenNamed(meta, name)[0]?.textContent?.trim() ?? '' : '');
  const lic = meta ? childrenNamed(meta, 'license')[0] : undefined;
  const modules: PlanModule[] = [];
  const walk = (el: Element, path: string[]) => {
    for (const child of Array.from(el.children)) {
      if (child.localName === 'module') {
        const id = child.getAttribute('document');
        if (id) modules.push({ id, chapter: path });
      } else if (child.localName === 'subcollection') {
        const title = childrenNamed(child, 'title')[0]?.textContent?.trim() ?? '';
        const inner = childrenNamed(child, 'content')[0];
        if (inner) walk(inner, title ? [...path, title] : path);
      }
    }
  };
  walk(content, []);
  return {
    title: metaText('title'),
    lang: metaText('language'),
    licence: lic?.textContent?.trim() ?? '',
    licenceUrl: lic?.getAttribute('url') ?? '',
    modules,
  };
}

/** The licence as the collection states it: its text, its url beside it, or the url alone. */
export function licenceOf(plan: Pick<BookPlan, 'licence' | 'licenceUrl'>): string {
  if (plan.licence && plan.licenceUrl) return `${plan.licence} (${plan.licenceUrl})`;
  return plan.licence || plan.licenceUrl || '';
}

const TITLES = (titlesFile as { builtAt: string; books: Record<string, Record<string, string>> });

/** Date the shipped module-title list was built. */
export const TITLES_BUILT_AT = TITLES.builtAt;

/** The list of a book: every module, named from the shipped titles or by its id. */
export function bookEntries(slug: string, plan: BookPlan): Entry[] {
  const names = TITLES.books[slug] ?? {};
  return plan.modules.map((m) => ({
    key: m.id,
    title: names[m.id] ?? m.id,
    ...(m.chapter.length ? { detail: m.chapter.join(' › ') } : {}),
  }));
}

// ── CNXML → text ─────────────────────────────────────────────────────────

const BLOCKS = new Set(['para', 'list', 'figure', 'table', 'equation', 'note', 'example', 'exercise', 'problem', 'solution', 'section', 'definition', 'glossary', 'quote', 'preformat', 'commentary']);

function inline(el: Element | ChildNode): string {
  if (el.nodeType === 3) return (el.textContent ?? '').replace(/\s+/g, ' ');
  if (el.nodeType !== 1) return '';
  const e = el as Element;
  switch (e.localName) {
    case 'math': return ` ${mathLine(e)} `;
    case 'sup': return `^${inline_children(e)}`;
    case 'sub': return `_${inline_children(e)}`;
    case 'newline': return '\n';
    case 'media': case 'image': return '';
    default: return inline_children(e);
  }
}

function inline_children(e: Element): string {
  return Array.from(e.childNodes).map(inline).join('');
}

/** Blocks of an element: one string per paragraph-like piece. */
function blocks(el: Element, depth: number, out: string[]): void {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const e = node as Element;
    const name = e.localName;
    if (name === 'metadata' || name === 'media' || name === 'image') continue;
    if (name === 'title') {
      const t = inline_children(e).replace(/\s+/g, ' ').trim();
      if (t) out.push(`${'#'.repeat(Math.min(6, depth + 1))} ${t}`);
      continue;
    }
    if (name === 'para' || name === 'quote' || name === 'preformat') {
      const t = inline_children(e).replace(/[ \t]+/g, ' ').trim();
      if (t) out.push(t);
      continue;
    }
    if (name === 'list') {
      const items = childrenNamed(e, 'item').map((it) => `- ${inline_children(it).replace(/\s+/g, ' ').trim()}`).filter((s) => s !== '- ');
      const title = childrenNamed(e, 'title')[0];
      if (title) out.push(inline_children(title).trim());
      if (items.length) out.push(items.join('\n'));
      continue;
    }
    if (name === 'figure') {
      const caption = childrenNamed(e, 'caption')[0];
      const t = caption ? inline_children(caption).replace(/\s+/g, ' ').trim() : '';
      if (t) out.push(`[Figure] ${t}`);
      continue;
    }
    if (name === 'table') {
      const rows = Array.from(e.getElementsByTagName('*')).filter((r) => r.localName === 'row')
        .map((r) => childrenNamed(r, 'entry').map((c) => inline_children(c).replace(/\s+/g, ' ').trim()).join(' | '))
        .filter((r) => r.replace(/[|\s]/g, ''));
      const title = childrenNamed(e, 'title')[0];
      if (title) out.push(inline_children(title).trim());
      if (rows.length) out.push(rows.join('\n'));
      continue;
    }
    if (name === 'equation') {
      const t = inline_children(e).replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      continue;
    }
    if (name === 'definition') {
      const term = childrenNamed(e, 'term')[0];
      const meaning = childrenNamed(e, 'meaning').map((m) => inline_children(m).replace(/\s+/g, ' ').trim()).join(' ');
      const t = `${term ? inline_children(term).trim() : ''}${term && meaning ? ': ' : ''}${meaning}`.trim();
      if (t) out.push(t);
      continue;
    }
    if (name === 'section') {
      blocks(e, depth + 1, out);
      continue;
    }
    if (BLOCKS.has(name) || e.children.length) {
      blocks(e, depth, out);
      continue;
    }
    const t = inline_children(e).replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
}

/** Title and plain text of a module. MathML is linearized, images are dropped, captions kept. */
export function moduleText(cnxml: string): { title: string; text: string } {
  const doc = parseXml(cnxml);
  const root = doc.documentElement;
  const title = childrenNamed(root, 'title')[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const content = childrenNamed(root, 'content')[0];
  if (!content) throw new Error('OPENSTAX_NOT_A_MODULE');
  const out: string[] = [];
  blocks(content, 1, out);
  const text = out.map((b) => b.replace(/ +\n/g, '\n').replace(/ {2,}/g, ' ').trim()).filter(Boolean).join('\n\n');
  return { title, text };
}

/** `pushed_at` of a repository from the GitHub API answer, or absent. */
export function pushedAt(apiAnswer: unknown): string | undefined {
  const v = (apiAnswer && typeof apiAnswer === 'object' ? (apiAnswer as Record<string, unknown>).pushed_at : undefined);
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : undefined;
}

/** Reads one module and makes it a unit. `repoPushedAt` absent = no date in the source line. */
export async function readModule(
  fetchText: FetchText,
  book: Pick<OpenStaxBook, 'repo' | 'slug'>,
  plan: BookPlan,
  id: string,
  opts: { signal?: AbortSignal; repoPushedAt?: string } = {},
): Promise<Unit> {
  const { title, text } = moduleText(await fetchText(moduleUrl(book, id), opts.signal));
  const where = plan.modules.find((m) => m.id === id)?.chapter ?? [];
  const book_ = plan.title || book.slug;
  return {
    key: id,
    title: `OpenStax · ${[book_, ...where].join(' › ')} · ${title || id}`,
    text,
    origin: `OpenStax, ${book_}, module ${id} (github.com/openstax/${book.repo})`,
    ...(opts.repoPushedAt ? { date: `Repository last updated ${opts.repoPushedAt}` } : {}),
    licence: licenceOf(plan) || 'not stated in the collection file',
    url: moduleWebUrl(book, id),
    lang: plan.lang || 'en',
  };
}
