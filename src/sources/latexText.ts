/**
 * latexText — a PlanetMath entry body as readable text, the maths kept.
 *
 * Only the STRUCTURE is converted: bold and italics, PlanetMath links,
 * theorem/proof/list environments, section titles, bibliography. Every
 * formula (`$…$`, `$$…$$`, `\[…\]`, `\(…\)` and the display environments)
 * is set aside first and put back byte for byte, so nothing inside the
 * mathematics is ever rewritten. An unknown command outside maths is left as
 * written: a visible `\foo` is better than a silently dropped word.
 */

const MATH_ENVS = 'equation|equation\\*|align|align\\*|alignat|alignat\\*|eqnarray|eqnarray\\*|gather|gather\\*|multline|multline\\*|displaymath|math|xy|xymatrix|tikzpicture|tabular|array';

/** Text environments turned into a leading word (the word is English, like the source). */
const LEAD_WORDS: Record<string, string> = {
  proof: 'Proof.', theorem: 'Theorem.', thm: 'Theorem.', lemma: 'Lemma.', lem: 'Lemma.', corollary: 'Corollary.', cor: 'Corollary.',
  proposition: 'Proposition.', prop: 'Proposition.', definition: 'Definition.', defn: 'Definition.', example: 'Example.', remark: 'Remark.',
  thebibliography: 'References:',
};

/** Replaces `\cmd{a}{b}` (no nested braces in the arguments) through `fn`. */
function command(s: string, name: string, args: number, fn: (...a: string[]) => string): string {
  const re = new RegExp(`\\\\${name}\\s*${'\\{([^{}]*)\\}'.repeat(args)}`, 'g');
  return s.replace(re, (_m, ...g: string[]) => fn(...g.slice(0, args)));
}

export function latexText(body: string): string {
  // 1. Set the mathematics aside.
  const kept: string[] = [];
  const hold = (m: string) => `\u0000${kept.push(m) - 1}\u0000`;
  let s = body
    .replace(new RegExp(`\\\\begin\\{(${MATH_ENVS})\\}[\\s\\S]*?\\\\end\\{\\1\\}`, 'g'), hold)
    .replace(/\$\$[\s\S]*?\$\$/g, hold)
    .replace(/\\\[[\s\S]*?\\\]/g, hold)
    .replace(/\\\([\s\S]*?\\\)/g, hold)
    .replace(/(?<!\\)\$(?:\\\$|[^$])+?\$/g, hold);

  // 2. Structure.
  s = s
    .replace(/\{\\(?:bf|em|it|sl|sc|tt|rm)\s+([^{}]*)\}/g, '$1')
    .replace(/\\(?:noindent|medskip|bigskip|smallskip|newline|par|centering|maketitle|clearpage|newpage)\b\s*/g, '\n')
    .replace(/\\\\(\[[^\]]*\])?/g, '\n')
    .replace(/\\PMlinkescape(?:word|phrase|text)\{[^{}]*\}/g, '');
  for (const name of ['textbf', 'emph', 'textit', 'textsl', 'textsc', 'texttt', 'textrm', 'underline', 'mbox', 'PMlinkescapetext']) {
    s = command(s, name, 1, (a) => a);
  }
  s = command(s, 'PMlinkexternal', 2, (text, url) => `${text} (${url})`);
  for (const name of ['PMlinkname', 'PMlinkid', 'PMlinktofile', 'PMlinkexplicit']) s = command(s, name, 2, (text) => text);
  s = command(s, 'PMlinkexplicit', 1, (a) => a);
  for (const level of ['section', 'subsection', 'subsubsection', 'paragraph']) {
    s = s.replace(new RegExp(`\\\\${level}\\*?\\{([^{}]*)\\}`, 'g'), (_m, title: string) => `\n\n${level === 'section' ? '##' : '###'} ${title}\n\n`);
  }
  s = s
    .replace(/\\begin\{thebibliography\}\{[^{}]*\}/g, '\n\nReferences:\n')
    .replace(/\\bibitem(\[[^\]]*\])?\{[^{}]*\}/g, '\n- ')
    .replace(/\\begin\{(\w+\*?)\}(\[[^\]]*\])?(\s*)/g, (m, env: string, opt: string | undefined) => {
      const lead = LEAD_WORDS[env.replace(/\*$/, '')];
      // The lead word and the first sentence share a line: "Proof. If n is composite…".
      if (lead) return `\n\n${lead}${opt ? ` ${opt.slice(1, -1)}.` : ''} `;
      return env === 'itemize' || env === 'enumerate' || env === 'description' || env === 'center' || env === 'quote' ? '\n' : m;
    })
    .replace(/\\end\{(\w+\*?)\}/g, (m, env: string) => (LEAD_WORDS[env.replace(/\*$/, '')] || ['itemize', 'enumerate', 'description', 'center', 'quote'].includes(env) ? '\n\n' : m))
    .replace(/\\item(\[[^\]]*\])?\s*/g, (_m, label?: string) => `\n- ${label ? `${label.slice(1, -1)} ` : ''}`)
    .replace(/\\label\{[^{}]*\}/g, '')
    .replace(/``|''/g, '"')
    .replace(/(?<!\\)~/g, ' ');

  // 3. Tidy the lines (the mathematics is still set aside, so its spacing is not touched).
  s = s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // 4. Put the mathematics back, untouched.
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)]!);
}
