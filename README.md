# MnemoScience

Science texts, in your memory.

> The name is provisional: the trademark search has not been done yet.

MnemoScience is a cartridge for [Mnemosyne OS](https://github.com/Mnemosyne-OS).
You choose a field, then a source, then one entry or a whole list.
MnemoScience downloads the texts, keeps a copy in your knowledge folder, and
writes them into one memory pack per field. Then you ask the chat in your own
words: "what is the difference between speed and velocity?", "who was Emmy
Noether?". The chat quotes the texts and names their source.

MnemoScience copies texts. It does not check them or rewrite them.

## What is in it

| Field | Sources |
|---|---|
| Physics | OpenStax *University Physics* (3 volumes) and *College Physics 2e* in English, *Física universitaria* (3 volumes) in Spanish · Wikipedia · arXiv `physics.pop-ph` |
| Chemistry | OpenStax *Chemistry 2e* and *Chemistry: Atoms First 2e*, *Química 2ed* and *Química: Comenzando con los átomos 2ed* · Wikipedia · arXiv `physics.chem-ph` |
| Biology | OpenStax *Biology 2e* and *Concepts of Biology* · Wikipedia · arXiv `q-bio.PE` |
| Mathematics | OpenStax *Calculus* (3 volumes) and *Cálculo* (3 volumes) · Wikipedia · PlanetMath · OEIS · arXiv `math.HO` |
| Astronomy | OpenStax *Astronomy 2e* · Wikipedia · arXiv `astro-ph.EP` |
| History of science | Wikipedia · MacTutor biographies · arXiv `physics.hist-ph` |

Wikipedia is offered in English, French and Spanish. It starts on the app's
language when it is one of the three. Each field starts on one root category
(`Category:Physics`, `Catégorie:Physique`, `Categoría:Física`…); its
sub-categories are one click away.

## How an entry enters memory

1. MnemoScience reads the entry at its source: an OpenStax module, a Wikipedia
   page, a PlanetMath entry, a MacTutor biography, an OEIS sequence, an arXiv
   abstract.
2. The entry becomes one memory, or several parts when it is long (18,000
   characters each). Each memory is titled with the source and the entry:
   `OpenStax · Astronomy 2e › Orbits and Gravity · The Laws of Planetary Motion`.
3. A source line closes every memory: where the text comes from, its date when
   the source gives one, its licence in the source's own words, and the
   address where it can be checked. A date the source does not give is left
   out. The cartridge never writes today's date in its place.
4. A JSON copy of each entry is written in MnemoScience's folder inside your
   knowledge folder, filed by field and source, next to an `ATTRIBUTION.md`.
   You choose the knowledge folder once, in the Memory Packs tab of the Hub.
   If it is not chosen yet, the Hub opens on that tab at the first import.

"Put all in memory" resumes where it stopped after a stop, a closed window or
a restart. A list that gained entries since (a Wikipedia category, the newest
arXiv abstracts) reads only the new ones and keeps its count.

Nothing is written before the saved library is read. If it cannot be read,
the screen says so, offers a retry, and no import is possible: writing then
would erase every resume point.

Each field is one memory pack: Physics, Chemistry, Biology, Mathematics,
Astronomy, History of science. The chat reads a pack when you tick it under
Knowledge in the chat's scope.

## How the text is read

- Wikipedia is read as HTML (`action=parse` on the exact revision), never as
  `explaintext`, which erases every formula. Each formula is kept as its
  LaTeX between `$…$`.
- MacTutor formulas are kept once, as their LaTeX.
- OpenStax MathML becomes one line of linear notation (`(Δv)/(Δt)`).
- PlanetMath is LaTeX: its structure (bold, links, proofs, lists, sections)
  becomes text, and every formula stays LaTeX, untouched. An unknown command
  is left as written.

## Where each date comes from

| Source | Date in the source line |
|---|---|
| OpenStax | the repository's last push (GitHub API). Absent when GitHub refuses the call. |
| Wikipedia | the revision id and timestamp of the page's last revision |
| PlanetMath | the entry's own `\pmmodified` |
| MacTutor | the page's own "Last Update" line (month and year). The host's fetch returns no headers, so `Last-Modified` cannot be read. |
| OEIS | the sequence's revision number and time |
| arXiv | `<published>` and `<updated>` |

## Limits measured on 2026-10-04

- The OEIS shows at most 110 results of a search without an account:
  `start=100` still answers 200, `start=110` answers 403. The cartridge stops
  at 110. Some searches answer `null` with a 200: no result.
- PlanetMath is no longer updated: most repositories were last pushed in 2018.
  Opening a class costs one GitHub API request, out of 60 an hour without an
  account.
- arXiv asks for one request every 3 seconds. The cartridge waits between
  calls. The arXiv API gives no licence: each article sets its own.
- MacTutor, the OEIS and arXiv send no CORS header. They are read through the
  host (`social.fetch`, permission `vault:read`).
- OpenStax: the repository date costs one GitHub API request per book, out of
  the same 60 an hour as PlanetMath.

## Install

In Mnemosyne OS, open MnemoHub, choose to add an external cartridge, and paste
this repository's address.

## Develop

This folder is outside the pnpm workspace. Install it on its own:

```bash
npm install
npx vite           # serves the cartridge on port 5228
npx vite build     # writes dist/
npx vitest run
npx tsc --noEmit -p tsconfig.eslint.json
```

The OpenStax module titles ship in `src/catalogue/openstax-titles.json`, so a
book's list can be filtered before anything is read. Rebuild them with
`node scripts/build-openstax-titles.mjs`. The texts themselves are always read
live.

## Sources and attribution

Each memory names its source and its licence. The attribution of every source
is written into the `ATTRIBUTION.md` of MnemoScience's folder.

- OpenStax (Rice University): licence per book, copied from each collection's
  `md:license`. The English 2e books read « Creative Commons
  Attribution-NonCommercial-ShareAlike 4.0 International ». *Física
  universitaria* reads « Creative Commons Attribution License ». The two
  *Química* books give only the address
  `http://creativecommons.org/licenses/by/4.0/`.
- Wikipedia: « Creative Commons Attribution-Share Alike 4.0 ».
- PlanetMath: « Creative Commons Attribution-ShareAlike 3.0 Unported ».
- MacTutor: « Except where otherwise noted, the text of MacTutor by JOC/EFR is
  licensed under a Creative Commons Attribution-ShareAlike 4.0 International
  License. »
- OEIS: « Creative Commons Attribution Share-Alike 4.0 license (CC-BY-SA-4.0) ».
- arXiv: licence per article, not given by the API.

## Licence

The cartridge's code is under the MIT licence. The texts keep the terms of
their sources, listed above.
