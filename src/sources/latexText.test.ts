import { describe, it, expect } from 'vitest';
import tex from './fixtures/planetmath-ConverseOfWilsonsTheorem.tex?raw';
import { parseTex } from './planetmath';
import { latexText } from './latexText';

describe('latexText (real PlanetMath body, converse of Wilson’s theorem)', () => {
  const text = latexText(parseTex(tex).body);

  it('turns the structure into text', () => {
    expect(text.startsWith('Theorem. Given an integer $n > 1$')).toBe(true);
    expect(text).toContain('Proof. If $n$ is composite');
    expect(text).toContain('References:');
    expect(text).toContain('- Thomas Kochy, "Elementary Number Theory with Applications"');
    expect(text).not.toMatch(/\\begin\{|\\end\{|\{\\bf|\\bibitem/);
  });

  it('keeps every formula byte for byte', () => {
    expect(text).toContain(String.raw`$\displaystyle \frac{n}{2}$`);
    expect(text).toContain(String.raw`$(n - 1)! \equiv -1 \mod n$`);
  });
});

describe('latexText rules', () => {
  it('keeps the text of a PlanetMath link, not its target', () => {
    expect(latexText(String.raw`the \PMlinkname{neighbourhoods}{NeighborhoodOfAVertex} of $x$`)).toBe('the neighbourhoods of $x$');
    expect(latexText(String.raw`\PMlinkescapeword{group} a \emph{group}`)).toBe('a group');
  });

  it('never rewrites inside display maths, even its spacing', () => {
    const display = String.raw`\begin{align*}
  a  &= {\bf b} \\
  c &= d
\end{align*}`;
    expect(latexText(`Then\n${display}\nso.`)).toBe(`Then\n${display}\nso.`);
  });

  it('lists and sections become markdown', () => {
    expect(latexText(String.raw`\section*{Facts}\begin{itemize}\item one\item[(b)] two\end{itemize}`)).toBe('## Facts\n\n- one\n- (b) two');
  });

  it('an unknown command stays visible rather than dropping a word', () => {
    expect(latexText(String.raw`see \foo{bar}`)).toBe(String.raw`see \foo{bar}`);
  });
});

describe('latexText inline maths', () => {
  it('never applies a text rule inside $…$', () => {
    const inline = String.raw`a $x~y = {\bf v}''$ and $\textbf{w}$ b`;
    expect(latexText(inline)).toBe(inline);
  });
});
