'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, SquareCode } from 'lucide-react';

import type { RichTextNode } from '../../language';
import { docToMarkdown, markdownToDoc } from '../../language';
import { isSafeUrl, toSafeDoc } from '../../language';

/**
 * Rich text, edited visually, saved as Markdown (PML v3 L6, owner decision 4A: rich text stores the Markdown
 * the author wrote). The editor holds the document the SERVER reads from that Markdown (`markdownToDoc` is
 * a port of its parser, held to it by a shared fixture), and every change is written back as Markdown.
 *
 * StarterKit is cut down to what Markdown here can say: headings, bold, italic, inline code, lists, a quote,
 * a code block and links. Underline, strikethrough, rules and line breaks are off, because the page could
 * not keep them. There is no HTML input and no paste-as-HTML: this renders on the app's own origin.
 */

/** The editor's document for this Markdown, without the empty text nodes the editor refuses. */
function editorDoc(markdown: string): RichTextNode {
  const clean = (node: RichTextNode): RichTextNode => ({
    ...node,
    ...(node.content ? { content: node.content.filter((c) => !(c.type === 'text' && (c.text ?? '') === '')).map(clean) } : {}),
  });

  return clean(markdownToDoc(markdown));
}

export function MarkdownEditor({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** The id of the visible label (the editor is not an <input>, so it is labelled, never wrapped). */
  labelledBy?: string;
}): React.JSX.Element {
  // The Markdown this editor last wrote: a value that comes back equal to it is its own echo.
  const written = useRef(value);

  const editor = useEditor({
    immediatelyRender: false, // SSR: Next would otherwise hydrate-mismatch
    extensions: [
      StarterKit.configure({
        strike: false,
        underline: false,
        horizontalRule: false,
        hardBreak: false,
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: false, protocols: ['http', 'https'] },
      }),
    ],
    content: editorDoc(value),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[140px] px-3 py-2 outline-none dark:prose-invert focus:outline-none',
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = docToMarkdown(toSafeDoc(instance.getJSON()));
      written.current = markdown;
      onChange(markdown);
    },
  });

  // A new value from outside (the Code view, Porter, another element selected) replaces the content.
  useEffect(() => {
    if (!editor || value === written.current) return;

    written.current = value;
    editor.commands.setContent(editorDoc(value), { emitUpdate: false });
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const existing = editor.getAttributes('link').href as string | undefined;
    const input = window.prompt('Link address', existing ?? 'https://');

    if (input === null) return;

    if (input.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();

      return;
    }

    if (!isSafeUrl(input)) {
      // A field-level problem stays on the field. Porter stays out of form validation.
      window.alert('A link has to start with http:// or https://, or be a page on this site (/...).');

      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: input.trim() }).run();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[180px] rounded-xl border border-white/20 bg-white/50 dark:bg-white/5" />;
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
        {button(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading', Heading2)}
        {button(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', Bold)}
        {button(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', Italic)}
        {button(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), 'Code', Code)}
        <span className="mx-1 h-5 w-px bg-current/15" aria-hidden />
        {button(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bulleted list', List)}
        {button(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', ListOrdered)}
        {button(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote', Quote)}
        {button(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'Code block', SquareCode)}
        <span className="mx-1 h-5 w-px bg-current/15" aria-hidden />
        {button(editor.isActive('link'), setLink, 'Link', Link2)}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
