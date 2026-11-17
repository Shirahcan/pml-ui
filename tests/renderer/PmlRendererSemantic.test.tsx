import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';
import { slugify, withDerivedAnchors } from '../../src/pml/anchors';

/** PML v2 S1: the semantic, long-form vocabulary renders the right elements. */
const site = { theme: {} } as unknown as PublicSite;

const renderNodes = (nodes: PmlNode[]) => render(<PmlRenderer nodes={nodes} site={site} />).container;

describe('S1-01: a box renders as what it is', () => {
  it('renders as=article as an <article>', () => {
    const c = renderNodes([
      { primitive: 'box', props: { as: 'article' }, children: [{ primitive: 'heading', props: { text: 'Fairness letters', level: 1 } }] },
    ]);

    expect(c.querySelector('article h1')?.textContent).toBe('Fairness letters');
  });

  it('renders a plain box as a <div>', () => {
    const c = renderNodes([{ primitive: 'box', props: {}, children: [{ primitive: 'text', props: { value: 'x' } }] }]);

    expect(c.querySelector('article, section, main')).toBeNull();
  });

  it('never renders an unknown as= value as that element', () => {
    const c = renderNodes([{ primitive: 'box', props: { as: 'script' }, children: [{ primitive: 'text', props: { value: 'x' } }] }]);

    expect(c.querySelector('script')).toBeNull();
  });

  it('nests a main inside the section frame without a second main', () => {
    const c = renderNodes([{ primitive: 'box', props: { as: 'main' }, children: [{ primitive: 'text', props: { value: 'x' } }] }]);

    expect(c.querySelectorAll('main')).toHaveLength(1);
  });
});

describe('S1-02: anchors', () => {
  it('derives a stable, unique anchor for every heading', () => {
    const c = renderNodes([
      { primitive: 'heading', props: { text: 'Fees', level: 2 } },
      { primitive: 'box', props: {}, children: [{ primitive: 'heading', props: { text: 'Fees', level: 3 } }] },
      { primitive: 'heading', props: { text: "Documents you'll need (2026)", level: 2 } },
    ]);

    expect([...c.querySelectorAll('h2, h3')].map((h) => h.id)).toEqual(['fees', 'fees-2', 'documents-you-ll-need-2026']);
  });

  it('keeps an explicit anchor and derives around it', () => {
    const nodes = withDerivedAnchors([
      { primitive: 'heading', props: { text: 'Fees', level: 2 } },
      { primitive: 'grid', props: { anchor: 'fees' }, children: [] },
    ]);

    expect(nodes[0].props?.anchor).toBe('fees-2');
    expect(nodes[1].props?.anchor).toBe('fees');
  });

  it('puts the id on anchored containers, and never an unsafe one', () => {
    const c = renderNodes([
      { primitive: 'box', props: { anchor: 'eligibility' }, children: [{ primitive: 'text', props: { value: 'x' } }] },
      { primitive: 'box', props: { anchor: 'x" onclick="alert(1)' }, children: [{ primitive: 'text', props: { value: 'y' } }] },
    ]);

    expect(c.querySelector('#eligibility')).not.toBeNull();
    expect(c.querySelector('[onclick]')).toBeNull();
  });

  it('does not mutate the cached snapshot it is given', () => {
    const nodes: PmlNode[] = [{ primitive: 'heading', props: { text: 'Fees', level: 2 } }];
    withDerivedAnchors(nodes);

    expect(nodes[0].props?.anchor).toBeUndefined();
  });

  it('slugifies accents, punctuation and leading digits into a valid anchor', () => {
    expect(slugify('Résumé & cover letter')).toBe('resume-cover-letter');
    expect(slugify('2026 changes')).toBe('s-2026-changes');
    expect(slugify('!!!')).toBe('section');
  });

  it('draws a list item that holds words: its bold label, its marks and links, and a nested list under it', () => {
    const c = renderNodes([
      {
        primitive: 'list',
        props: { type: 'bullet' },
        children: [
          { primitive: 'list_item', props: { text: 'Plain, as before' } },
          {
            primitive: 'list_item',
            props: { title: 'Fees' },
            children: [
              { primitive: 'text', props: { value: '– pay at ' } },
              { primitive: 'link', props: { href: 'https://ircc.example/fees' }, children: [{ primitive: 'text', props: { value: 'IRCC' } }] },
              { primitive: 'list', props: { type: 'numbered' }, children: [{ primitive: 'list_item', props: { text: 'Keep the receipt' } }] },
            ],
          },
        ],
      },
    ] as unknown as PmlNode[]);

    const items = c.querySelectorAll(':scope ul > li');
    expect(items[0].innerHTML).toBe('Plain, as before');
    expect(items[1].querySelector('strong')?.textContent).toBe('Fees');
    expect(items[1].querySelector('a')?.getAttribute('href')).toBe('https://ircc.example/fees');
    expect(items[1].textContent).toContain('Fees – pay at IRCC');
    expect(items[1].querySelector('ol li')?.textContent).toBe('Keep the receipt');
  });

  it('renders an untitled list as a plain group, not an unlabelled section', () => {
    const c = renderNodes([{ primitive: 'list', props: { type: 'bullet' }, children: [{ primitive: 'list_item', props: { text: 'One' } }] }]);

    expect(c.querySelector('section ul')).toBeNull();
    expect(c.querySelector('ul li')?.textContent).toBe('One');
  });
});

describe('S1-04: callouts', () => {
  it('renders a titled, toned note that screen readers announce', () => {
    const c = renderNodes([
      { primitive: 'callout', props: { tone: 'warning', title: 'Reply within 30 days' }, children: [{ primitive: 'text', props: { value: 'Late replies are refused.' } }] },
    ]);

    const aside = c.querySelector('aside[role="note"]');
    expect(aside?.getAttribute('aria-label')).toBe('Reply within 30 days');
    expect(aside?.className).toContain('border-amber-500');
    expect(aside?.textContent).toContain('Late replies are refused.');
    // The title is a bold line, never a heading that would break the outline.
    expect(aside?.querySelector('h1, h2, h3, h4')).toBeNull();
  });

  it('falls back to the info tone and labels an untitled note', () => {
    const c = renderNodes([{ primitive: 'callout', props: { tone: 'neon' }, children: [{ primitive: 'text', props: { value: 'x' } }] }]);

    expect(c.querySelector('aside')?.getAttribute('aria-label')).toBe('Note');
  });
});

describe('S1-05: code in prose', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Run ' }, { type: 'text', text: 'npm test', marks: [{ type: 'code' }] }] },
      { type: 'codeBlock', attrs: { language: 'html' }, content: [{ type: 'text', text: '<div class="x">\n  <script>alert(1)</script>\n</div>' }] },
    ],
  };

  it('renders inline code and an escaped code block that never executes', () => {
    // PML v3 L4: rich text, drawn from the document the server compiled from its Markdown.
    const c = renderNodes([{ primitive: 'rich_text', props: { markdown: '', doc } }]);

    expect(c.querySelector('p code')?.textContent).toBe('npm test');
    expect(c.querySelector('pre code')?.textContent).toContain('<script>alert(1)</script>');
    expect(c.querySelector('pre script')).toBeNull();
    expect(c.querySelector('figcaption')?.textContent).toBe('html');
  });
});

describe('S1-06: table of contents', () => {
  it('lists the page headings, including Markdown headings in prose, with working anchors', () => {
    const c = renderNodes([
      { primitive: 'toc', props: { title: 'On this page', depth: '3' } },
      { primitive: 'heading', props: { text: 'What a fairness letter is', level: 2 } },
      {
        primitive: 'rich_text',
        props: {
          markdown: '## How to reply',
          doc: {
            type: 'doc',
            content: [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'How to reply' }] },
              { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Deadlines' }] },
            ],
          },
        },
      },
    ]);

    const links = [...c.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['#what-a-fairness-letter-is', '#how-to-reply', '#deadlines']);
    // Each link has a real target on the page.
    for (const href of links) expect(c.querySelector(href!)).not.toBeNull();
  });

  it('depth 2 leaves level-3 headings out, and an empty outline renders nothing', () => {
    const c = renderNodes([
      { primitive: 'toc', props: { depth: '2' } },
      { primitive: 'heading', props: { text: 'Fees', level: 2 } },
      { primitive: 'heading', props: { text: 'Detail', level: 3 } },
    ]);
    expect([...c.querySelectorAll('nav a')].map((a) => a.textContent)).toEqual(['Fees']);

    const empty = renderNodes([{ primitive: 'toc', props: {} }]);
    expect(empty.querySelector('nav')).toBeNull();
  });
});

describe('S1-07: sources', () => {
  it('renders numbered citations with a safe link and the date it was read', () => {
    const c = renderNodes([
      {
        primitive: 'sources',
        props: { title: 'Sources' },
        children: [
          { primitive: 'source', props: { title: 'Procedural fairness', publisher: 'IRCC', href: 'https://www.canada.ca/en/immigration-refugees-citizenship.html', date: '2026-11-06' } },
          { primitive: 'source', props: { title: 'Bad link', href: 'javascript:alert(1)' } },
        ],
      },
    ]);

    const items = c.querySelectorAll('section[aria-label="Sources"] ol li');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('cite a')?.getAttribute('href')).toBe('https://www.canada.ca/en/immigration-refugees-citizenship.html');
    expect(items[0].textContent).toContain('IRCC');
    expect(items[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-11-06');
    expect(items[0].querySelector('time')?.textContent).toBe('November 6, 2026');
    expect(c.querySelector('a[href^="javascript"]')).toBeNull();
  });
});

describe('S1-08: FAQ', () => {
  it('renders each question as a native disclosure that works without JS', () => {
    const c = renderNodes([
      {
        primitive: 'faq',
        props: { heading: 'Common questions' },
        children: [{ primitive: 'faq_item', props: { question: 'How long does it take?' }, children: [{ primitive: 'text', props: { value: 'It depends.' } }] }],
      },
    ]);

    expect(c.querySelector('section h2')?.textContent).toBe('Common questions');
    expect(c.querySelector('details summary')?.textContent).toContain('How long does it take?');
    expect(c.querySelector('details')?.textContent).toContain('It depends.');
  });
});

describe('S1-06: depth written unquoted', () => {
  it('honours depth=3 as a number, the way the parser stores unquoted source', () => {
    const c = renderNodes([
      { primitive: 'toc', props: { depth: 3 } },
      { primitive: 'heading', props: { text: 'How to reply', level: 2 } },
      { primitive: 'heading', props: { text: 'Deadlines', level: 3 } },
    ]);

    expect([...c.querySelectorAll('nav a')].map((a) => a.textContent)).toEqual(['How to reply', 'Deadlines']);
  });
});

describe('numeric tokens written unquoted (Porter, the Code view)', () => {
  it('renders columns=3 as three columns and honours a numeric col-span', () => {
    const c = renderNodes([
      {
        primitive: 'grid',
        props: { columns: 3 },
        children: [
          { primitive: 'text', props: { value: 'a' }, style: { col_span: 2 } },
          { primitive: 'text', props: { value: 'b' } },
        ],
      },
    ]);

    expect(c.querySelector('.grid')?.className).toContain('md:grid-cols-3');
    expect(c.innerHTML).toContain('col-span');
  });
});

describe('S2-04/05: 12-column grid and image framing', () => {
  it('lays out a 7/5 split that becomes 8/4 on laptops', () => {
    const c = renderNodes([
      {
        primitive: 'grid',
        props: { columns: 12 },
        children: [
          { primitive: 'box', props: {}, style: { col_span: 7, 'lg:col_span': 8 }, children: [{ primitive: 'text', props: { value: 'a' } }] },
          { primitive: 'box', props: {}, style: { col_span: 5, 'lg:col_span': 4 }, children: [{ primitive: 'text', props: { value: 'b' } }] },
        ],
      },
    ]);

    expect(c.querySelector('.grid')?.className).toContain('md:grid-cols-12');
    const spans = [...c.querySelectorAll('.grid > div')].map((d) => d.className);
    expect(spans[0]).toContain('md:col-span-7');
    expect(spans[0]).toContain('lg:col-span-8');
    expect(spans[1]).toContain('lg:col-span-4');
  });

  it('frames an image by shape, fill and focal point', () => {
    const c = renderNodes([{ primitive: 'image', props: { src: 'https://example.com/a.png', alt: 'x', ratio: '16:9', fit: 'contain', focal: 'top' } }]);
    const img = c.querySelector('img')!;

    expect(img.className).toContain('aspect-video');
    expect(img.className).toContain('object-contain');
    expect(img.className).toContain('object-top');
  });
});

describe('S2-06/07: decorative layer, button variants, focus', () => {
  it('puts a layer behind the content, hidden from screen readers, inside a clipping box', () => {
    const c = renderNodes([
      {
        primitive: 'box',
        props: {},
        children: [
          { primitive: 'layer', props: { shape: 'blob', position: 'top-right', size: 'lg', color: 'accent' } },
          { primitive: 'heading', props: { text: 'Plan your move', level: 1 } },
        ],
      },
    ]);
    const layer = c.querySelector('[aria-hidden].-z-10')!;

    expect(layer).not.toBeNull();
    expect(layer.className).toContain('pointer-events-none');
    expect(layer.parentElement?.className).toContain('relative isolate overflow-hidden');
    expect(layer.textContent).toBe('');
  });

  it('renders soft and ghost buttons, and every button shows keyboard focus', () => {
    const c = renderNodes([
      { primitive: 'button', props: { label: 'Soft', href: '#a', variant: 'soft' } },
      { primitive: 'button', props: { label: 'Ghost', href: '#b', variant: 'ghost' } },
    ]);
    const [soft, ghost] = [...c.querySelectorAll('a')];

    expect(soft.className).toContain('color-mix(in_srgb,var(--site-accent)_16%');
    expect(ghost.className).toContain('hover:bg-[color-mix');
    for (const a of [soft, ghost]) expect(a.className).toContain('focus-visible:ring-2');
  });
});
