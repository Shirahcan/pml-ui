import React from 'react';

/**
 * Renders a constrained rich-text document.
 *
 * There is exactly one rule in this file, and it is the reason the file exists:
 *
 *   NOTHING HERE EVER PRODUCES MARKUP.
 *
 * No `dangerouslySetInnerHTML`. No string is ever treated as HTML. We walk the AST the
 * backend validated and emit React elements, so even a stored document that somehow got
 * past the server (a bad migration, a direct DB write, a future bug) cannot execute.
 *
 * That matters more here than on a normal marketing site: these pages render on the SAME
 * ORIGIN as the authenticated app, so a stored XSS would steal the session of every
 * client, consultant, and admin who visited a consultant's page.
 *
 * Defence in depth: the backend rejects non-http(s) hrefs on save (BlockSchema), and we
 * drop them again here at render.
 */

export interface RichTextMark {
  type: 'bold' | 'italic' | 'underline' | 'link' | 'code';
  attrs?: { href?: string; target?: string };
}

export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: RichTextMark[];
  content?: RichTextNode[];
}

/**
 * How a `{...}` in rich text is read (PML v3 L4): the PML renderer provides the page's PSL scope and
 * turns an `expr` atom (its compiled AST) into words. Absent everywhere else, so an atom draws nothing
 * there. The words come back as a string and are escaped by React like any other text.
 */
export const RichTextExprContext = React.createContext<((attrs: Record<string, unknown>) => string) | null>(null);

function ExprAtom({ attrs, marks, atomKey }: { attrs: Record<string, unknown>; marks: RichTextMark[] | undefined; atomKey: string | number }): React.ReactNode {
  const read = React.useContext(RichTextExprContext);
  const words = read ? read(attrs) : '';

  return words === '' ? null : applyMarks(words, marks, atomKey);
}

/** Only http(s) and internal paths survive. `javascript:` and `data:` never render. */
function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;

  const trimmed = href.trim();
  if (trimmed === '') return null;

  // Internal link.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;

  // Protocol-relative inherits the current scheme: not a safe link.
  if (trimmed.startsWith('//')) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

function applyMarks(text: string, marks: RichTextMark[] | undefined, key: string | number): React.ReactNode {
  if (!marks || marks.length === 0) return text;

  return marks.reduce<React.ReactNode>((node, mark, i) => {
    switch (mark.type) {
      case 'bold':
        return <strong key={`${key}-b-${i}`}>{node}</strong>;
      case 'italic':
        return <em key={`${key}-i-${i}`}>{node}</em>;
      case 'underline':
        return <u key={`${key}-u-${i}`}>{node}</u>;
      case 'code':
        // Inline code (S1-05): monospace on a faint tint of the text colour, readable on any scheme.
        return (
          <code key={`${key}-c-${i}`} className="rounded bg-current/10 px-1 py-0.5 font-mono text-[0.9em]">
            {node}
          </code>
        );
      case 'link': {
        const href = safeHref(mark.attrs?.href);

        // A link we cannot vouch for renders as plain text. It never silently becomes
        // an anchor with an unvetted href.
        if (!href) return node;

        const external = /^https?:\/\//i.test(href);

        return (
          <a
            key={`${key}-a-${i}`}
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="underline underline-offset-2 hover:opacity-80"
          >
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, text);
}

function renderNode(node: RichTextNode, key: string | number): React.ReactNode {
  switch (node.type) {
    case 'doc':
      return <>{(node.content ?? []).map((child, i) => renderNode(child, i))}</>;

    case 'paragraph':
      return (
        <p key={key} className="mb-4 leading-relaxed last:mb-0">
          {(node.content ?? []).map((child, i) => renderNode(child, i))}
        </p>
      );

    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 2), 4);
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
      // Follows the site's type scale (S2-08); exactly text-2xl / xl / lg at the default scale.
      const size = level === 2 ? 'text-[length:calc(1.5rem*var(--site-type-scale,1))]' : level === 3 ? 'text-[length:calc(1.25rem*var(--site-type-scale,1))]' : 'text-[length:calc(1.125rem*var(--site-type-scale,1))]';

      // A render-only anchor (S1-06, set by withDerivedAnchors) so links and the table of contents
      // reach headings written as Markdown. Guarded to the safe slug shape.
      const anchor = typeof node.attrs?.anchor === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(node.attrs.anchor) ? node.attrs.anchor : undefined;

      return (
        <Tag key={key} id={anchor} className={`${size} mb-3 mt-6 scroll-mt-24 font-semibold first:mt-0`}>
          {(node.content ?? []).map((child, i) => renderNode(child, i))}
        </Tag>
      );
    }

    case 'bulletList':
      return (
        <ul key={key} className="mb-4 list-disc space-y-1 pl-5">
          {(node.content ?? []).map((child, i) => renderNode(child, i))}
        </ul>
      );

    case 'orderedList':
      return (
        <ol key={key} className="mb-4 list-decimal space-y-1 pl-5">
          {(node.content ?? []).map((child, i) => renderNode(child, i))}
        </ol>
      );

    case 'listItem':
      return <li key={key}>{(node.content ?? []).map((child, i) => renderNode(child, i))}</li>;

    case 'blockquote':
      return (
        <blockquote key={key} className="mb-4 border-l-2 border-current/20 pl-4 italic opacity-90">
          {(node.content ?? []).map((child, i) => renderNode(child, i))}
        </blockquote>
      );

    case 'codeBlock': {
      // A code block (S1-05): escaped text in <pre><code>, scrolling sideways on its own so a long
      // line never widens the page. The language is a label for the reader, never executed.
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const code = (node.content ?? []).map((child) => child.text ?? '').join('');

      return (
        <figure key={key} className="mb-4 last:mb-0">
          {language ? (
            <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide opacity-60">{language}</figcaption>
          ) : null}
          <pre className="max-w-full overflow-x-auto rounded-[var(--site-radius,12px)] bg-slate-950 p-4 text-sm leading-relaxed text-slate-100">
            <code className={language ? `language-${language}` : undefined}>{code}</code>
          </pre>
        </figure>
      );
    }

    case 'hardBreak':
      return <br key={key} />;

    case 'expr':
      return <ExprAtom key={key} atomKey={key} attrs={node.attrs ?? {}} marks={node.marks} />;

    case 'text':
      return <React.Fragment key={key}>{applyMarks(node.text ?? '', node.marks, key)}</React.Fragment>;

    default:
      // An unknown node renders as NOTHING. It is never coerced into markup, and it never
      // takes the page down with it.
      return null;
  }
}

export function RichText({ doc }: { doc?: RichTextNode | null }): React.JSX.Element | null {
  if (!doc || doc.type !== 'doc') return null;

  return <div className="site-rich-text">{renderNode(doc, 'root')}</div>;
}
