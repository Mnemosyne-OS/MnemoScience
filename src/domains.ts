/**
 * domains — the sub-domains of the home screen and the sources inside each.
 *
 * A source is listed here ONLY when it is wired and was tested on 2026-10-04
 * (doc 135 §3quinquies: no "coming soon" tile). Every licence string is the
 * source's own words, copied, never shortened or judged. Sizes are the ones
 * measured that day; the screen says when a size is read live instead.
 */
import type { OpenStaxBook } from './sources/openstax';
import type { DomainId, SourceKind } from './sources/types';

/** One wired source, as a tile shows it. */
export interface SourceDef {
  /** Unique id: `openstax:astronomy-2e`, `wikipedia:physics`, `arxiv:physics.hist-ph`… */
  id: string;
  domain: DomainId;
  kind: SourceKind;
  /** Display name (a book title, a site name). */
  name: string;
  /** Languages of the text: one, or several for Wikipedia. */
  langs: readonly string[];
  /** The licence as the source states it; `null` = stated per item (arXiv), said by the screen. */
  licence: string | null;
  licenceUrl?: string;
  /** What was measured on 2026-10-04 about its size, as numbers the screen formats. */
  size: { count: number; unit: 'modules' | 'biographies' | 'preprints' | 'classes' } | { live: 'category' | 'search' };
  /** Where a person can see the source itself. */
  home: string;
  book?: OpenStaxBook;
  /** arXiv category. */
  arxivCat?: string;
}

// ── OpenStax: one book = one source, licence copied from each `md:license` ──

const NC_SA_INTL = 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International';
const NC_SA_URL = 'http://creativecommons.org/licenses/by-nc-sa/4.0/';
const BY_URL = 'http://creativecommons.org/licenses/by/4.0/';

const B = (domain: DomainId, repo: string, slug: string, title: string, lang: 'en' | 'es', modules: number, licence: string, licenceUrl: string): SourceDef => {
  const book: OpenStaxBook = { slug, repo, title, lang, modules, licence, licenceUrl };
  return {
    id: `openstax:${slug}`, domain, kind: 'openstax', name: title, langs: [lang],
    licence: licence ? `${licence} (${licenceUrl})` : licenceUrl, licenceUrl,
    size: { count: modules, unit: 'modules' },
    home: `https://github.com/openstax/${repo}`, book,
  };
};

/** The OpenStax books, one source each. */
export const OPENSTAX_SOURCES: readonly SourceDef[] = [
  B('physics', 'osbooks-university-physics-bundle', 'university-physics-volume-1', 'University Physics Volume 1', 'en', 124, NC_SA_INTL, NC_SA_URL),
  B('physics', 'osbooks-university-physics-bundle', 'university-physics-volume-2', 'University Physics Volume 2', 'en', 119, NC_SA_INTL, NC_SA_URL),
  B('physics', 'osbooks-university-physics-bundle', 'university-physics-volume-3', 'University Physics Volume 3', 'en', 95, NC_SA_INTL, NC_SA_URL),
  B('physics', 'osbooks-college-physics-bundle', 'college-physics-2e', 'College Physics 2e', 'en', 283, NC_SA_INTL, NC_SA_URL),
  B('physics', 'osbooks-fisica-universitaria-bundle', 'física-universitaria-volumen-1', 'Física universitaria volumen 1', 'es', 124, 'Creative Commons Attribution License', BY_URL),
  B('physics', 'osbooks-fisica-universitaria-bundle', 'física-universitaria-volumen-2', 'Física universitaria volumen 2', 'es', 119, 'Creative Commons Attribution License', BY_URL),
  B('physics', 'osbooks-fisica-universitaria-bundle', 'física-universitaria-volumen-3', 'Física universitaria volumen 3', 'es', 95, 'Creative Commons Attribution License', BY_URL),
  B('chemistry', 'osbooks-chemistry-bundle', 'chemistry-2e', 'Chemistry 2e', 'en', 149, NC_SA_INTL, NC_SA_URL),
  B('chemistry', 'osbooks-chemistry-bundle', 'chemistry-atoms-first-2e', 'Chemistry: Atoms First 2e', 'en', 149, NC_SA_INTL, NC_SA_URL),
  // 🪤 The two Spanish chemistry collections give the licence URL and NO text: the URL alone is shown.
  B('chemistry', 'osbooks-quimica-bundle', 'química-2ed', 'Química 2ed', 'es', 149, '', BY_URL),
  B('chemistry', 'osbooks-quimica-bundle', 'química-comenzando-átomos-2ed', 'Química: Comenzando con los átomos 2ed', 'es', 149, '', BY_URL),
  B('biology', 'osbooks-biology-bundle', 'biology-2e', 'Biology 2e', 'en', 259, NC_SA_INTL, NC_SA_URL),
  B('biology', 'osbooks-biology-bundle', 'concepts-biology', 'Concepts of Biology', 'en', 107, NC_SA_INTL, NC_SA_URL),
  B('astronomy', 'osbooks-astronomy', 'astronomy-2e', 'Astronomy 2e', 'en', 199, NC_SA_INTL, NC_SA_URL),
  B('mathematics', 'osbooks-calculus-bundle', 'calculus-volume-1', 'Calculus Volume 1', 'en', 55, NC_SA_INTL, NC_SA_URL),
  B('mathematics', 'osbooks-calculus-bundle', 'calculus-volume-2', 'Calculus Volume 2', 'en', 54, NC_SA_INTL, NC_SA_URL),
  B('mathematics', 'osbooks-calculus-bundle', 'calculus-volume-3', 'Calculus Volume 3', 'en', 54, NC_SA_INTL, NC_SA_URL),
  B('mathematics', 'osbooks-calculo-bundle', 'cálculo-volumen-1', 'Cálculo volumen 1', 'es', 55, 'Creative Commons Attribution-NonCommercial-ShareAlike License', NC_SA_URL),
  B('mathematics', 'osbooks-calculo-bundle', 'cálculo-volumen-2', 'Cálculo volumen 2', 'es', 54, 'Creative Commons Attribution-NonCommercial-ShareAlike License', NC_SA_URL),
  B('mathematics', 'osbooks-calculo-bundle', 'cálculo-volumen-3', 'Cálculo volumen 3', 'es', 54, 'Creative Commons Attribution-NonCommercial-ShareAlike License', NC_SA_URL),
];

// ── Wikipedia: one root category per sub-domain and language ──────────────

/** Licence from the API's `rightsinfo` (en, fr and es answer the same words). */
export const WIKIPEDIA_LICENCE = 'Creative Commons Attribution-Share Alike 4.0';
export const WIKIPEDIA_LICENCE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

const WIKI_DOMAINS: readonly DomainId[] = ['physics', 'chemistry', 'biology', 'mathematics', 'astronomy', 'history'];

/** Wikipedia, one source per sub-domain. */
export const WIKIPEDIA_SOURCES: readonly SourceDef[] = WIKI_DOMAINS.map((domain) => ({
  id: `wikipedia:${domain}`, domain, kind: 'wikipedia' as const, name: 'Wikipedia', langs: ['en', 'fr', 'es'],
  licence: WIKIPEDIA_LICENCE, licenceUrl: WIKIPEDIA_LICENCE_URL, size: { live: 'category' as const },
  home: 'https://www.wikipedia.org/',
}));

// ── The other sources ─────────────────────────────────────────────────────

/** Licences copied from PlanetMath's LICENSE, MacTutor's copyright page and the OEIS licence page (doc 135 §3bis). */
export const PLANETMATH_LICENCE = 'Creative Commons Attribution-ShareAlike 3.0 Unported';
export const MACTUTOR_LICENCE = 'Except where otherwise noted, the text of MacTutor by JOC/EFR is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License.';
export const OEIS_LICENCE = 'Creative Commons Attribution Share-Alike 4.0 license (CC-BY-SA-4.0)';

/** PlanetMath, the OEIS and MacTutor. */
export const OTHER_SOURCES: readonly SourceDef[] = [
  {
    id: 'planetmath', domain: 'mathematics', kind: 'planetmath', name: 'PlanetMath', langs: ['en'],
    licence: PLANETMATH_LICENCE, licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    size: { count: 63, unit: 'classes' }, home: 'https://github.com/planetmath',
  },
  {
    id: 'oeis', domain: 'mathematics', kind: 'oeis', name: 'OEIS', langs: ['en'],
    licence: OEIS_LICENCE, licenceUrl: 'https://oeis.org/wiki/The_OEIS_End-User_License_Agreement',
    size: { live: 'search' }, home: 'https://oeis.org/',
  },
  {
    id: 'mactutor', domain: 'history', kind: 'mactutor', name: 'MacTutor', langs: ['en'],
    licence: MACTUTOR_LICENCE, licenceUrl: 'https://mathshistory.st-andrews.ac.uk/Miscellaneous/copyright/',
    size: { count: 3334, unit: 'biographies' }, home: 'https://mathshistory.st-andrews.ac.uk/Biographies/',
  },
];

/** arXiv category per sub-domain, with the preprints counted on 2026-10-04 (`totalResults`). */
const ARXIV: readonly [DomainId, string, number][] = [
  ['physics', 'physics.pop-ph', 2694],
  ['chemistry', 'physics.chem-ph', 28410],
  ['biology', 'q-bio.PE', 13296],
  ['mathematics', 'math.HO', 4366],
  ['astronomy', 'astro-ph.EP', 36283],
  ['history', 'physics.hist-ph', 5746],
];

/** arXiv, one category per sub-domain. */
export const ARXIV_SOURCES: readonly SourceDef[] = ARXIV.map(([domain, cat, count]) => ({
  id: `arxiv:${cat}`, domain, kind: 'arxiv' as const, name: `arXiv ${cat}`, langs: ['en'],
  licence: null, size: { count, unit: 'preprints' as const },
  home: `https://arxiv.org/list/${cat}/recent`, arxivCat: cat,
}));

/** Every wired source. */
export const ALL_SOURCES: readonly SourceDef[] = [...OPENSTAX_SOURCES, ...WIKIPEDIA_SOURCES, ...OTHER_SOURCES, ...ARXIV_SOURCES];

/** The sources of one sub-domain, in the order the mission lists them. */
export function sourcesOf(domain: DomainId): SourceDef[] {
  const order: SourceKind[] = ['openstax', 'wikipedia', 'planetmath', 'mactutor', 'oeis', 'arxiv'];
  return ALL_SOURCES.filter((s) => s.domain === domain)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** A source by its id, or undefined. */
export function sourceById(id: string): SourceDef | undefined {
  return ALL_SOURCES.find((s) => s.id === id);
}

/** The icon of each sub-domain tile. */
export const DOMAIN_ICONS: Record<DomainId, string> = {
  physics: '⚛️', chemistry: '⚗️', biology: '🧬', mathematics: '∑', astronomy: '🔭', history: '📜',
};
