/**
 * mathml — a MathML expression as one line of plain text.
 *
 * Policy (doc 135 §3bis.3, OpenStax CNXML): an equation must never become an
 * empty hole in the prose, and the text must stay readable by a person AND a
 * chat model. So the leaves (mi, mn, mo, mtext) are kept verbatim and the
 * layout elements become the usual linear notation: a fraction is
 * `(a)/(b)`, a subscript `x_0`, a power `x^2`, a root `√(x)`. Nothing is
 * computed or simplified.
 */

const PADDED_OPERATORS = new Set(['=', '+', '−', '-', '×', '·', '<', '>', '≤', '≥', '≈', '≠', '→', '⇒', '±', '∝', '≡']);

function kids(el: Element): Element[] {
  return Array.from(el.children);
}

/** Wraps a piece in parentheses when it is longer than one symbol. */
function group(s: string): string {
  const t = s.trim();
  return t.length <= 1 || /^[\w.]+$/.test(t) ? t : `(${t})`;
}

/** Linear text of one MathML element (namespace prefix ignored). */
export function mathText(el: Element): string {
  const name = el.localName;
  const c = kids(el);
  const at = (i: number) => (c[i] ? mathText(c[i]!) : '');
  switch (name) {
    case 'mi': case 'mn': case 'mtext': case 'ms':
      return (el.textContent ?? '').replace(/\s+/g, ' ');
    case 'mo': {
      const op = (el.textContent ?? '').trim();
      return PADDED_OPERATORS.has(op) ? ` ${op} ` : op;
    }
    case 'mspace':
      return ' ';
    case 'mfrac':
      return `${group(at(0))}/${group(at(1))}`;
    case 'msub':
      return `${at(0)}_${group(at(1))}`;
    case 'msup':
      return `${at(0)}^${group(at(1))}`;
    case 'msubsup':
      return `${at(0)}_${group(at(1))}^${group(at(2))}`;
    case 'msqrt':
      return `√${group(c.map(mathText).join(''))}`;
    case 'mroot':
      return `root(${at(0).trim()}, ${at(1).trim()})`;
    case 'mover':
      return `${at(0)}${at(1).trim()}`;
    case 'munder':
      return `${at(0)}_${group(at(1))}`;
    case 'munderover':
      return `${at(0)}_${group(at(1))}^${group(at(2))}`;
    case 'mfenced': {
      const open = el.getAttribute('open') ?? '(';
      const close = el.getAttribute('close') ?? ')';
      return `${open}${c.map(mathText).join(', ')}${close}`;
    }
    case 'mtable':
      return c.map(mathText).join('; ');
    case 'mtr': case 'mlabeledtr':
      return c.map(mathText).join(' ');
    case 'semantics':
      return at(0);
    case 'annotation': case 'annotation-xml':
      return '';
    default:
      return c.length ? c.map(mathText).join('') : (el.textContent ?? '');
  }
}

/** A whole `<math>` element, spaces tidied. */
export function mathLine(el: Element): string {
  return mathText(el).replace(/\s+/g, ' ').trim();
}
