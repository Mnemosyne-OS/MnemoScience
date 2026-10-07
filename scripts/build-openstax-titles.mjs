#!/usr/bin/env node
/**
 * build-openstax-titles.mjs — the module titles of the OpenStax books the
 * cartridge offers, so a book's list can be searched before anything is read.
 *
 * Why a shipped list: an OpenStax collection file names its modules by id
 * only (`<col:module document="m59747"/>`). The title lives in each module's
 * own index.cnxml, so listing a 259-module book live would cost 259 requests
 * before the person sees one line. The cartridge still reads the collection
 * LIVE (structure, licence) and the module LIVE at import; this file only
 * gives names to the ids in the list. An id missing here is shown as its id.
 *
 * Run from the cartridge folder: `node scripts/build-openstax-titles.mjs`.
 * Plain fetch to raw.githubusercontent.com (no API quota involved).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'catalogue', 'openstax-titles.json');

// Keep in step with OPENSTAX_BOOKS in src/domains.ts (repo + collection slug).
const BOOKS = [
  ['osbooks-university-physics-bundle', 'university-physics-volume-1'],
  ['osbooks-university-physics-bundle', 'university-physics-volume-2'],
  ['osbooks-university-physics-bundle', 'university-physics-volume-3'],
  ['osbooks-college-physics-bundle', 'college-physics-2e'],
  ['osbooks-fisica-universitaria-bundle', 'física-universitaria-volumen-1'],
  ['osbooks-fisica-universitaria-bundle', 'física-universitaria-volumen-2'],
  ['osbooks-fisica-universitaria-bundle', 'física-universitaria-volumen-3'],
  ['osbooks-chemistry-bundle', 'chemistry-2e'],
  ['osbooks-chemistry-bundle', 'chemistry-atoms-first-2e'],
  ['osbooks-quimica-bundle', 'química-2ed'],
  ['osbooks-quimica-bundle', 'química-comenzando-átomos-2ed'],
  ['osbooks-biology-bundle', 'biology-2e'],
  ['osbooks-biology-bundle', 'concepts-biology'],
  ['osbooks-astronomy', 'astronomy-2e'],
  ['osbooks-calculus-bundle', 'calculus-volume-1'],
  ['osbooks-calculus-bundle', 'calculus-volume-2'],
  ['osbooks-calculus-bundle', 'calculus-volume-3'],
  ['osbooks-calculo-bundle', 'cálculo-volumen-1'],
  ['osbooks-calculo-bundle', 'cálculo-volumen-2'],
  ['osbooks-calculo-bundle', 'cálculo-volumen-3'],
];

const raw = (repo, path) => `https://raw.githubusercontent.com/openstax/${repo}/main/${path.split('/').map(encodeURIComponent).join('/')}`;

async function text(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) return await res.text();
      if (res.status === 404) throw new Error(`HTTP_404 ${url}`);
      console.warn('retry', res.status, url);
    } catch (err) {
      if (String(err).includes('HTTP_404')) throw err;
      console.warn('retry', String(err), url);
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`FAILED ${url}`);
}

const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const books = {};
let missing = 0;
for (const [repo, slug] of BOOKS) {
  const col = await text(raw(repo, `collections/${slug}.collection.xml`));
  // 🪤 The Spanish calculus collections use unprefixed elements (`<module …/>`).
  const ids = [...col.matchAll(/<(?:col:)?module document="(m\d+)"/g)].map((m) => m[1]);
  const titles = await pool(ids, 8, async (id) => {
    try {
      const cnxml = await text(raw(repo, `modules/${id}/index.cnxml`));
      const m = cnxml.match(/<title>([\s\S]*?)<\/title>/);
      return m ? decode(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) : null;
    } catch (err) {
      console.warn('no title', id, String(err));
      return null;
    }
  });
  const map = {};
  ids.forEach((id, i) => { if (titles[i]) map[id] = titles[i]; else missing++; });
  books[slug] = map;
  console.log(slug, ids.length, 'modules,', Object.keys(map).length, 'titled');
}

writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), books }, null, 0) + '\n');
console.log('wrote', OUT, 'missing titles:', missing);
