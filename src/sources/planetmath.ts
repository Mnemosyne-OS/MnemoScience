/**
 * planetmath — the PlanetMath encyclopedia, one GitHub repository per MSC
 * class (doc 135 §3bis.3).
 *
 * Measured 2026-10-04:
 *  - 64 repositories under github.com/planetmath: 63 MSC classes plus
 *    `fem2016` (a 2016 edition, left out);
 *  - LICENSE of the repositories: « Creative Commons Attribution-ShareAlike 3.0 Unported »;
 *  - most repositories were last pushed in March 2018, a few later (2024 at
 *    most): the encyclopedia is no longer maintained, and the screen says so;
 *  - listing a repository's files needs the GitHub API (60 requests an hour
 *    without a token, CORS `*`): ONE call per class, `git/trees/master?
 *    recursive=1` (11_Number_theory: 2 175 paths, 1 071 `.tex`, not truncated);
 *  - each entry is a `.tex` file on raw.githubusercontent.com (CORS `*`), with
 *    `\pmtitle{…}` and `\pmmodified{YYYY-MM-DD hh:mm:ss}`: the date of the
 *    memory is that entry's own modification date;
 *  - the body is LaTeX: its structure (bold, links, proofs, lists) becomes
 *    text and every formula is kept as LaTeX (latexText.ts).
 */
import { PLANETMATH_LICENCE } from '../domains';
import { latexText } from './latexText';
import type { Entry, FetchText, Unit } from './types';

export interface PmClass {
  repo: string;
  /** Repository `pushed_at` measured 2026-10-04 (date only). */
  pushed: string;
}

/** The 63 MSC class repositories, as listed by the GitHub API on 2026-10-04. */
export const PM_CLASSES: readonly PmClass[] = ([
  ['00_General', '2018-03-10'], ['01_History_and_biography', '2018-03-10'], ['03_Mathematical_logic_and_foundations', '2024-01-24'],
  ['05_Combinatorics', '2023-05-03'], ['06_Order_lattices_ordered_algebraic_structures', '2018-03-10'], ['08_General_algebraic_systems', '2022-06-24'],
  ['11_Number_theory', '2023-06-26'], ['12_Field_theory_and_polynomials', '2018-03-10'], ['13_Commutative_rings_and_algebras', '2018-03-10'],
  ['14_Algebraic_geometry', '2018-03-10'], ['15_Linear_and_multilinear_algebra_matrix_theory', '2018-05-03'], ['16_Associative_rings_and_algebras', '2024-02-19'],
  ['17_Nonassociative_rings_and_algebras', '2018-03-10'], ['18_Category_theory_homological_algebra', '2018-03-03'], ['19_K-theory', '2018-03-10'],
  ['20_Group_theory_and_generalizations', '2020-04-19'], ['22_Topological_groups_Lie_groups', '2018-03-10'], ['26_Real_functions', '2018-03-10'],
  ['28_Measure_and_integration', '2018-03-10'], ['30_Functions_of_a_complex_variable', '2022-11-02'], ['31_Potential_theory', '2018-03-10'],
  ['32_Several_complex_variables_and_analytic_spaces', '2018-03-10'], ['33_Special_functions', '2018-03-10'], ['34_Ordinary_differential_equations', '2018-03-10'],
  ['35_Partial_differential_equations', '2018-03-10'], ['37_Dynamical_systems_and_ergodic_theory', '2018-03-10'], ['39_Difference_and_functional_equations', '2018-03-10'],
  ['40_Sequences_series_summability', '2023-08-14'], ['41_Approximations_and_expansions', '2018-03-10'], ['42_Fourier_analysis', '2018-03-10'],
  ['43_Abstract_harmonic_analysis', '2018-03-10'], ['44_Integral_transforms_operational_calculus', '2023-01-21'], ['45_Integral_equations', '2018-03-10'],
  ['46_Functional_analysis', '2018-03-10'], ['47_Operator_theory', '2018-03-10'], ['49_Calculus_of_variations_and_optimal_control_optimization', '2018-03-10'],
  ['51_Geometry', '2018-03-10'], ['52_Convex_and_discrete_geometry', '2018-03-10'], ['53_Differential_geometry', '2018-03-10'],
  ['54_General_topology', '2021-11-02'], ['55_Algebraic_topology', '2018-03-10'], ['57_Manifolds_and_cell_complexes', '2018-03-10'],
  ['58_Global_analysis_analysis_on_manifolds', '2018-03-10'], ['60_Probability_theory_and_stochastic_processes', '2021-07-23'], ['62_Statistics', '2018-03-10'],
  ['65_Numerical_analysis', '2018-03-10'], ['68_Computer_science', '2024-02-05'], ['70_Mechanics_of_particles_and_systems', '2018-03-10'],
  ['74_Mechanics_of_deformable_solids', '2018-03-03'], ['76_Fluid_mechanics', '2018-03-03'], ['78_Optics_electromagnetic_theory', '2018-03-10'],
  ['80_Classical_thermodynamics_heat_transfer', '2018-03-03'], ['81_Quantum_theory', '2018-03-10'], ['82_Statistical_mechanics_structure_of_matter', '2018-03-03'],
  ['83_Relativity_and_gravitational_theory', '2018-03-10'], ['85_Astronomy_and_astrophysics', '2018-03-10'], ['86_Geophysics', '2018-03-10'],
  ['90_Operations_research_mathematical_programming', '2018-03-10'], ['91_Game_theory_economics_social_and_behavioral_sciences', '2018-03-10'],
  ['92_Biology_and_other_natural_sciences', '2018-03-10'], ['93_Systems_theory_control', '2018-03-10'], ['94_Information_and_communication_circuits', '2018-03-10'],
  ['97_Mathematics_education', '2022-11-30'],
] as const).map(([repo, pushed]) => ({ repo, pushed }));

/** `11_Number_theory` → `11 Number theory`. */
export function classLabel(repo: string): string {
  return repo.replace(/_/g, ' ');
}

export const treeUrl = (repo: string) => `https://api.github.com/repos/planetmath/${repo}/git/trees/master?recursive=1`;
export const texUrl = (repo: string, path: string) => `https://raw.githubusercontent.com/planetmath/${repo}/master/${path.split('/').map(encodeURIComponent).join('/')}`;
export const texWebUrl = (repo: string, path: string) => `https://github.com/planetmath/${repo}/blob/master/${path.split('/').map(encodeURIComponent).join('/')}`;

/** The MSC code before the name: `11-00-` or `11A05-` (both forms are in the repositories). */
const MSC_PREFIX = /^\d\d[0-9A-Z-]*?-(?=[A-Za-z])/;

/** `11A05-AbundantNumber.tex` → `11A05`; absent when the file has no code. */
export function mscFromPath(path: string): string | undefined {
  const m = path.split('/').pop()!.match(MSC_PREFIX);
  return m ? m[0].slice(0, -1) : undefined;
}

/** `11-00-ConverseOfWilsonsTheorem.tex` → `Converse Of Wilsons Theorem` (the real title is read at import). */
export function nameFromPath(path: string): string {
  const base = path.split('/').pop()!.replace(/\.tex$/, '').replace(MSC_PREFIX, '');
  return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim() || path;
}

/** The `.tex` entries of a repository tree (GitHub API answer). */
export function parseTree(json: unknown): { entries: Entry[]; truncated: boolean } {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (!Array.isArray(j.tree)) throw new Error('PLANETMATH_NOT_A_TREE');
  const entries = (j.tree as Record<string, unknown>[])
    .filter((n) => n.type === 'blob' && typeof n.path === 'string' && (n.path as string).endsWith('.tex'))
    .map((n) => {
      const path = n.path as string;
      const msc = mscFromPath(path);
      return { key: path, title: nameFromPath(path), ...(msc ? { detail: `MSC ${msc}` } : {}) };
    });
  entries.sort((a, b) => a.title.localeCompare(b.title));
  return { entries, truncated: j.truncated === true };
}

export interface RateInfo {
  remaining: number | null;
  /** When the hourly quota comes back, ISO; null when not given. */
  reset: string | null;
}

export function rateInfo(headers: Pick<Headers, 'get'>): RateInfo {
  const rem = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const remaining = rem !== null && /^\d+$/.test(rem) ? Number(rem) : null;
  const resetIso = reset !== null && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : null;
  return { remaining, reset: resetIso };
}

/**
 * The tree of one class through the GitHub API. A spent quota is
 * `GITHUB_RATE_LIMIT|<reset ISO or ?>`, so the screen can say when to retry.
 */
export async function fetchClassTree(repo: string, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<{ entries: Entry[]; truncated: boolean; rate: RateInfo }> {
  const deadline = AbortSignal.timeout(30_000);
  const res = await fetchImpl(treeUrl(repo), { signal: signal ? AbortSignal.any([signal, deadline]) : deadline, headers: { Accept: 'application/vnd.github+json' } });
  const rate = rateInfo(res.headers);
  if ((res.status === 403 || res.status === 429) && rate.remaining === 0) throw new Error(`GITHUB_RATE_LIMIT|${rate.reset ?? '?'}`);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return { ...parseTree(await res.json()), rate };
}

/** The argument of the first `\name{…}` (no nested braces in PlanetMath metadata). */
function meta(tex: string, name: string): string | undefined {
  const m = tex.match(new RegExp(`\\\\${name}\\{([^}]*)\\}`));
  return m ? m[1]!.trim() : undefined;
}

export interface PmEntry {
  title: string;
  /** `\pmmodified`, as written (`2013-03-22 17:58:55`). */
  modified?: string;
  msc?: string;
  type?: string;
  /** The document body, LaTeX kept, comment lines removed. */
  body: string;
}

export function parseTex(tex: string): PmEntry {
  const start = tex.indexOf('\\begin{document}');
  const end = tex.lastIndexOf('\\end{document}');
  if (start < 0) throw new Error('PLANETMATH_NOT_AN_ENTRY');
  const body = tex.slice(start + '\\begin{document}'.length, end > start ? end : undefined)
    .split('\n')
    .filter((l) => !/^\s*%/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const modified = meta(tex, 'pmmodified');
  const msc = tex.match(/\\pmclassification\{msc\}\{([^}]*)\}/)?.[1];
  const type = meta(tex, 'pmtype');
  return {
    title: meta(tex, 'pmtitle') || meta(tex, 'pmcanonicalname') || '',
    ...(modified ? { modified } : {}),
    ...(msc ? { msc } : {}),
    ...(type ? { type } : {}),
    body,
  };
}

export async function readEntry(fetchText: FetchText, cls: PmClass, entry: Entry, signal?: AbortSignal): Promise<Unit> {
  const e = parseTex(await fetchText(texUrl(cls.repo, entry.key), signal));
  const title = e.title || entry.title;
  const head = [e.type ? `Type: ${e.type}` : '', e.msc ? `MSC: ${e.msc}` : ''].filter(Boolean).join(' · ');
  return {
    key: entry.key,
    title: `PlanetMath · ${classLabel(cls.repo)} · ${title}`,
    // Structure commands become text; every formula stays LaTeX (latexText.ts).
    text: head ? `${head}\n\n${latexText(e.body)}` : latexText(e.body),
    origin: `PlanetMath, "${title}" (github.com/planetmath/${cls.repo}; the encyclopedia is no longer updated, repository last pushed ${cls.pushed})`,
    ...(e.modified ? { date: `Entry last modified ${e.modified}` } : {}),
    licence: PLANETMATH_LICENCE,
    url: texWebUrl(cls.repo, entry.key),
    lang: 'en',
  };
}
