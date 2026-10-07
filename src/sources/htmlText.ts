/**
 * htmlText — an HTML article as plain, readable text, formulas kept.
 *
 * Same policy as mathml.ts: a formula never becomes a hole in the prose.
 * Wikipedia and MacTutor both ship each formula three times (MathML for
 * screen readers, a rendered copy, and the LaTeX source). The LaTeX source is
 * kept ONCE, between `$…$`, and the two other copies are dropped: printing
 * them all gave `R3\mathbb{R}^{3}R3`.
 */

/** The LaTeX of a formula element, from its annotation or its `alttext`; null when it has none. */
export function texOf(el: Element): string | null {
  const ann = Array.from(el.getElementsByTagName('annotation')).find((a) => a.getAttribute('encoding') === 'application/x-tex');
  const math = el.localName === 'math' ? el : el.getElementsByTagName('math')[0];
  const raw = ann?.textContent ?? math?.getAttribute('alttext') ?? el.querySelector('img[alt]')?.getAttribute('alt') ?? null;
  if (!raw) return null;
  let tex = raw.trim();
  // Wikipedia wraps every formula in `{\displaystyle …}`: the wrapper says nothing.
  const wrapped = tex.match(/^\{\\(?:displaystyle|textstyle)\s*([\s\S]*)\}$/);
  if (wrapped) tex = wrapped[1]!.trim();
  return tex || null;
}

/** Replaces every formula container matching `selector` by a text node `$LaTeX$`. */
export function replaceFormulas(root: Element, selector: string): void {
  for (const el of Array.from(root.querySelectorAll(selector))) {
    const tex = texOf(el);
    const doc = el.ownerDocument;
    el.replaceWith(doc.createTextNode(tex ? ` $${tex}$ ` : ` ${(el.textContent ?? '').replace(/\s+/g, ' ').trim()} `));
  }
}

/** Spaces collapsed; the space a formula left before punctuation removed (`$t$ .` → `$t$.`). */
const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').replace(/\$ ([.,;:!?)])/g, '$$$1').trim();

const BLOCK_TAGS = new Set(['p', 'div', 'section', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'figure', 'figcaption', 'center']);

/**
 * Blocks of an already cleaned tree: headings as markdown, list items as
 * `- `, table rows as cells joined by ` | `, everything else as paragraphs.
 */
export function blocksOf(root: Element): string[] {
  const out: string[] = [];
  let line = '';
  const flush = () => { const t = tidy(line); if (t) out.push(t); line = ''; };
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { line += child.textContent ?? ''; continue; }
      if (child.nodeType !== 1) continue;
      const e = child as Element;
      const tag = e.tagName.toLowerCase();
      if (tag === 'br') { flush(); continue; }
      const h = tag.match(/^h([1-6])$/);
      if (h) { flush(); const t = tidy(e.textContent); if (t) out.push(`${'#'.repeat(Math.max(2, Number(h[1])))} ${t}`); continue; }
      if (tag === 'li') { flush(); const t = tidy(e.textContent); if (t) out.push(`- ${t}`); continue; }
      if (tag === 'tr') {
        flush();
        const cells = Array.from(e.children).map((c) => tidy(c.textContent)).filter(Boolean);
        if (cells.length) out.push(cells.join(' | '));
        continue;
      }
      if (tag === 'blockquote') { flush(); const t = tidy(e.textContent); if (t) out.push(`> ${t}`); continue; }
      if (BLOCK_TAGS.has(tag)) { flush(); walk(e); flush(); continue; }
      walk(e);
    }
  };
  walk(root);
  flush();
  return out;
}

/**
 * Joins blocks into text: list items and table rows stay on consecutive
 * lines, other blocks are separated by ONE blank line. A line made of spaces
 * counts as empty, so there are never more than two line breaks in a row.
 */
export function joinBlocks(blocks: readonly string[]): string {
  let text = '';
  let prevTight = false;
  for (const b of blocks) {
    const tight = b.startsWith('- ') || b.includes(' | ');
    text += text ? (tight && prevTight ? '\n' : '\n\n') : '';
    text += b;
    prevTight = tight;
  }
  return normalizeBlankLines(text);
}

/** Lines of spaces become empty, and runs of empty lines collapse to one. */
export function normalizeBlankLines(text: string): string {
  return text.replace(/\r/g, '').split('\n').map((l) => (l.trim() ? l.replace(/\s+$/, '') : '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
