'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { EditorContent, mergeAttributes, Node, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Braces, Code, Italic, Link2 } from 'lucide-react';

import type { RichTextNode } from '../../language';
import { pathExpr, type PmlExpr } from '../../language';
import { docToParagraph, EXPR_NODE, keepUids, paragraphToDoc, wordsKey } from '../../language';
import type { PmlNode } from '../../language';
import { isSafeUrl } from '../../language';

/**
 * A paragraph's words, edited visually (PML v3 L6): bold, italic, inline code, links, line breaks and page
 * data as chips. The paragraph keeps its real shape (runs, <strong>, <link>...): `paragraphToDoc` /
 * `docToParagraph` convert both ways, and a paragraph that holds something the editor has no form for
 * never reaches this editor (the panel sends it to the Code view instead).
 */

/** A `{...}` run, shown as a chip and never edited as words: its expression is kept whole. */
const PageDataChip = Node.create({
  name: EXPR_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      expr: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          try {
            return JSON.parse(el.getAttribute('data-pml-expr') ?? 'null');
          } catch {
            return null;
          }
        },
        renderHTML: (attrs: { expr: PmlExpr | null }) => ({ 'data-pml-expr': JSON.stringify(attrs.expr) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-pml-expr]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const expr = node.attrs.expr as PmlExpr | null;

    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'rounded-md bg-[#4361EE]/10 px-1 font-mono text-[0.85em] text-[#4361EE]', contenteditable: 'false' }),
      `{${expr?.$expr ?? ''}}`,
    ];
  },
});

/** A dotted page-data name a person typed (owner.name, site.pages, props.title). */
const DOTTED = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export function ParagraphEditor({
  words,
  onChange,
  labelledBy,
}: {
  /** The paragraph's children (runs and inline elements). */
  words: PmlNode[];
  onChange: (children: PmlNode[]) => void;
  labelledBy?: string;
}): React.JSX.Element {
  // The paragraph this editor last wrote, ids aside: one that comes back equal to it is its own echo.
  const written = useRef(wordsKey(words));
  // The words as the page holds them (with their element ids), for keeping those ids across an edit.
  const current = useRef(words);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // One paragraph of words: no headings, lists, quotes, code blocks or rules (those are other elements).
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto', 'tel'] },
      }),
      PageDataChip,
    ],
    content: paragraphToDoc(words) ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'min-h-[88px] px-3 py-2 text-sm leading-relaxed outline-none focus:outline-none',
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const next = keepUids(docToParagraph(instance.getJSON() as RichTextNode), current.current);
      written.current = wordsKey(next);
      onChange(next);
    },
  });

  // A new paragraph from outside (the Code view, Porter, another element selected) replaces the content.
  useEffect(() => {
    current.current = words;

    const incoming = wordsKey(words);

    if (!editor || incoming === written.current) return;

    const doc = paragraphToDoc(words);

    written.current = incoming;
    if (doc) editor.commands.setContent(doc, { emitUpdate: false });
  }, [words, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const existing = editor.getAttributes('link').href as string | undefined;
    const input = window.prompt('Link address (a page, #a-section, https://, mailto: or tel:)', existing ?? 'https://');

    if (input === null) return;

    if (input.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();

      return;
    }

    const href = input.trim();

    if (!isSafeUrl(href) && !/^(#[A-Za-z][\w-]*|mailto:\S+|tel:[+\d][\d\s-]*)$/.test(href)) {
      window.alert('A link goes to a page (/...), a section (#...), https://, mailto: or tel:.');

      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const insertPageData = useCallback(() => {
    if (!editor) return;

    const input = window.prompt('Page data to show (Page data in the menu lists them), for example owner.name');

    if (input === null) return;

    const name = input.trim().replace(/^\{|\}$/g, '');

    if (!DOTTED.test(name)) {
      window.alert('Write the name with dots, like owner.name or site.username.');

      return;
    }

    editor.chain().focus().insertContent({ type: EXPR_NODE, attrs: { expr: pathExpr(name) } }).run();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[120px] rounded-xl border border-white/20 bg-white/50 dark:bg-white/5" />;
  }

  const button = (active: boolean, onClick: () => void, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md outline-none transition ${active ? 'bg-primary/15 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/20 px-2 py-1.5">
        {button(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', Bold)}
        {button(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', Italic)}
        {button(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), 'Code', Code)}
        {button(editor.isActive('link'), setLink, 'Link', Link2)}
        <span className="mx-1 h-5 w-px bg-current/15" aria-hidden />
        {button(false, insertPageData, 'Insert page data', Braces)}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

/** Whether these words can be edited here (every piece has an editor form). */
export function canEditVisually(children: PmlNode[]): boolean {
  return paragraphToDoc(children) !== null;
}
