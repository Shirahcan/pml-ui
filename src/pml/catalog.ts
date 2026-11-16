import { PML_ENUMS } from './elements.generated';
import { ICON_NAMES, type PmlNode, type Primitive } from './primitives';

/**
 * The builder-side catalog of PML components: the "Add a section" vocabulary and the fields
 * each section exposes in the settings rail. The backend StandardLibrary is the source of
 * truth for how a component EXPANDS; this is the UI's source of truth for how a consultant
 * EDITS one. A parity test keeps the two name-sets aligned, exactly as BLOCK_TYPES is today.
 *
 * A component is authored as a node `{ component, props, style?, children? }`. Sections with
 * `hasSlot` hold child content (Markdown prose, or `item` sub-components); `isItem` components
 * are added inside a parent (a faq_item inside a faq), never at the top level.
 */

/**
 * `media` renders the media-library picker (upload or choose). It is deliberately preferred over
 * a raw `url` box for a picture: the library re-encodes every image (stripping the location data
 * a phone attaches), refuses an SVG, and enforces the storage quota.
 */
export type PmlFieldKind = 'text' | 'textarea' | 'url' | 'boolean' | 'select' | 'rich' | 'media' | 'anchor';

/**
 * The buckets the "Add a section" modal groups entries into: Basic (raw primitives), Layout
 * (containers like grid/box/table), Components (the curated std-library sections), Sections (the
 * semantic page landmarks header/nav/footer, which are container primitives), and My components (the
 * consultant's reusable partials). An entry with no `group` is a curated Component.
 */
export type PmlGroup = 'basic' | 'layout' | 'components' | 'sections' | 'portify-components' | 'my-components';

export interface PmlFieldDef {
  key: string;
  label: string;
  kind: PmlFieldKind;
  options?: string[];
  optional?: boolean;
}

export interface PmlComponentDef {
  name: string;
  label: string;
  description: string;
  /** lucide icon name (resolved in the menu). */
  icon: string;
  /** Which modal group this entry lives under. Absent = a curated Component (see groupOf). */
  group?: PmlGroup;
  fields: PmlFieldDef[];
  /** Holds child content: Markdown prose and/or `item` sub-components. */
  hasSlot: boolean;
  /**
   * A layout container whose children are ARBITRARY primitives (box/grid/table), edited by the
   * rail's generic contents editor rather than a prose slot or a single-type item list.
   */
  container?: boolean;
  /** Added inside a parent section, not offered at the top level. */
  isItem?: boolean;
  /**
   * Kept in the catalog so existing pages still edit, but no longer offered in the Add menu
   * (something newer says the same thing). Mirrors how the std library retires a section.
   */
  hidden?: boolean;
  /** Once per page (hero, contact_form, the modules). */
  singleton?: boolean;
  /**
   * A Scale-plan (premium) component. It is split out of the standard "Add a section" modal into a
   * dedicated "Add premium component" modal, alongside the consultant's own saved components.
   */
  premium?: boolean;
  /** The sub-component a container section adds into its slot (faq -> faq_item). */
  itemComponent?: string;
  /** Starter node inserted when the consultant adds the section. */
  defaults: PmlNode;
}

const heading = (key = 'heading'): PmlFieldDef => ({ key, label: 'Heading', kind: 'text', optional: true });

/** A linkable name (S1-02): typed as words, stored as a slug, used by #links and the table of contents. */
const anchor = (): PmlFieldDef => ({ key: 'anchor', label: 'Link name (for #links and the table of contents)', kind: 'anchor', optional: true });

/**
 * header/nav/footer are SELF-CONTAINED primitives: adding one drops the bare tag, and the server
 * fills its body at build time (the register-bound identity, the site.pages nav, the disclaimer -
 * see the backend `SiteChromeDefaults`). So the source stays concise, exactly like a consultant
 * writing `<header/>` by hand, and the identity/nav are never hand-edited (register-sourced,
 * unfakeable, and the s.44 scan guarantees them). Optional styling attributes ride on the tag.
 */
const NAV_DEFAULT: PmlNode = { primitive: 'nav' };
const HEADER_DEFAULT: PmlNode = { primitive: 'header' };
const FOOTER_DEFAULT: PmlNode = { primitive: 'footer' };

/**
 * The default custom `<form>`: a name/email/message form with consent, ready to edit. Mirrors the
 * shape Porter composes and the `SitePmlStarter` contact defaults. The `key` is the form's stable
 * id in the submit URL; a consultant adding a second form should give it a distinct key.
 */
const FORM_DEFAULT: PmlNode = {
  primitive: 'form',
  props: {
    key: 'contact-us',
    title: 'Get in touch',
    submit_label: 'Send',
    success_message: 'Thank you. I will be in touch shortly.',
    consent_notice: 'By sending this you agree to be contacted about your enquiry.',
  },
  children: [
    { primitive: 'field', props: { name: 'name', label: 'Your name', kind: 'text', required: true } },
    { primitive: 'field', props: { name: 'email', label: 'Your email', kind: 'email', required: true } },
    { primitive: 'field', props: { name: 'message', label: 'How can I help?', kind: 'textarea' } },
  ],
};

/** An inline element's entry: hidden from the Add menu, named and editable in the panel. */
const inline = (name: Primitive, label: string, description: string, fields: PmlFieldDef[] = []): PmlComponentDef => ({
  name,
  label,
  description,
  icon: 'Type',
  group: 'basic',
  hasSlot: false,
  hidden: true,
  fields,
  defaults: { primitive: name, children: [{ primitive: 'text', props: { value: label } }] },
});

const INLINE_ENTRIES: PmlComponentDef[] = [
  inline('span', 'Span', 'Words set apart only to give them a look of their own.'),
  inline('strong', 'Bold', 'Words that matter more than the ones around them.'),
  inline('emphasis', 'Emphasis', 'Words said with stress, drawn in italics.'),
  inline('small', 'Small print', 'A side note or fine print, drawn smaller.'),
  inline('mark', 'Highlight', 'Words highlighted for the reader.'),
  inline('link', 'Link', 'Words that go to another page, a section or an address.', [{ key: 'href', label: 'Goes to', kind: 'url' }]),
  inline('quote', 'Quote', 'A short quotation inside a sentence.', [{ key: 'cite', label: 'Where it is from (a link)', kind: 'url', optional: true }]),
  inline('keyboard', 'Key', 'A key or keys to press, like Ctrl + K.'),
  inline('sub', 'Subscript', 'Small text set below the line (H2O).'),
  inline('sup', 'Superscript', 'Small text set above the line (a footnote mark).'),
  inline('abbr', 'Abbreviation', 'A short form, with its full words shown on hover.', [{ key: 'title', label: 'Full words', kind: 'text' }]),
  inline('time', 'Date or time', 'A date or time a browser and search engines can read.', [{ key: 'datetime', label: 'Machine date (2026-11-10)', kind: 'text', optional: true }]),
  { name: 'code', label: 'Code', description: 'Code or a technical name, drawn exactly as written.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, fields: [{ key: 'text', label: 'Code', kind: 'text' }], defaults: { primitive: 'code', props: { text: 'code' } } },
  { name: 'br', label: 'Line break', description: 'Starts a new line inside a paragraph.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, fields: [], defaults: { primitive: 'br' } },
];

export const PML_CATALOG: PmlComponentDef[] = [
  {
    name: 'hero',
    label: 'Hero',
    description: 'The first thing a visitor reads. Say what you do, for whom.',
    icon: 'Sparkles',
    singleton: true,
    hasSlot: false,
    // These fields edit a LEGACY {component:'hero'} node (still rendered by the backend
    // StandardLibrary). A NEW hero is inserted as the primitive tree in `defaults` below, so it opens
    // in the rail as an ordinary box whose heading / subhead / button are each individually selectable
    // and fully stylable (the per-child win). A stored component-hero keeps editing through these
    // flat fields; only new inserts are trees. (Dual state, intentional and additive.)
    fields: [
      { key: 'headline', label: 'Headline', kind: 'text' },
      { key: 'subhead', label: 'Subhead', kind: 'textarea', optional: true },
      { key: 'cta_label', label: 'Button label', kind: 'text', optional: true },
      { key: 'cta_href', label: 'Button link', kind: 'url', optional: true },
      { key: 'image_url', label: 'Image', kind: 'media', optional: true },
      { key: 'image_alt', label: 'Describe the image (screen readers + search)', kind: 'text', optional: true },
    ],
    defaults: {
      primitive: 'box',
      props: { direction: 'column', gap: 'md' },
      style: { padding: 'spacious', align: 'center', align_items: 'center', width: 'wide' },
      children: [
        {
          primitive: 'heading',
          props: { text: 'Clear, honest guidance for your move to Canada', level: 1 },
          style: { heading_size: 'xl' },
        },
        {
          primitive: 'text',
          props: {
            value:
              'Immigration is a big decision. I help you understand your real options, prepare a careful application, and know what is happening at every step.',
          },
          style: { body_size: 'lg', text_color: 'muted' },
        },
        {
          primitive: 'button',
          props: { label: 'See how I can help', href: '#packages', variant: 'primary' },
          style: { radius: 'full', shadow: 'sm' },
        },
      ],
    },
  },
  {
    name: 'about',
    label: 'About you',
    description: 'Who you are and why someone should trust you with their file.',
    icon: 'User',
    hasSlot: true,
    fields: [
      heading(),
      { key: 'photo_url', label: 'Photo', kind: 'media', optional: true },
      { key: 'photo_alt', label: 'Describe the photo', kind: 'text', optional: true },
    ],
    defaults: { component: 'about', props: { heading: 'About me' }, children: [] },
  },
  // The three kinds of words (PML v3 L4): plain text, a paragraph that can hold bold, links and page
  // data, and rich text written in Markdown.
  {
    name: 'text',
    label: 'Text',
    description: 'Plain words, no formatting. For bold or links use a Paragraph or Rich text.',
    icon: 'Type',
    group: 'basic',
    hasSlot: false,
    // No declared fields: the rail's own words control edits `value` (and shows live page data).
    fields: [],
    defaults: { primitive: 'text', props: { value: 'Some words worth reading.' } },
  },
  {
    name: 'p',
    label: 'Paragraph',
    description: 'A paragraph whose words can be bold, linked, or show page data.',
    icon: 'Pilcrow',
    group: 'basic',
    hasSlot: false,
    fields: [anchor()],
    defaults: { primitive: 'p', children: [{ primitive: 'text', props: { value: 'A paragraph worth reading.' } }] },
  },
  {
    name: 'rich_text',
    label: 'Rich text',
    description: 'Formatted writing in Markdown: headings, lists, links, bold and quotes.',
    icon: 'FileText',
    group: 'basic',
    hasSlot: false,
    fields: [anchor()],
    defaults: { primitive: 'rich_text', props: { markdown: 'Some words worth **reading**.\n\n- A first point\n- A second point' } },
  },
  // Inline elements live inside a paragraph (written in the Code view). Hidden from the Add menu; listed
  // so the panel can name one and edit what it holds.
  ...INLINE_ENTRIES,
  // Block elements (PML v3 L5): a code block, a quote block, a disclosure, definitions and a figure.
  {
    name: 'pre',
    label: 'Code block',
    description: 'Code or commands shown exactly as written, with a language label.',
    icon: 'Code2',
    group: 'basic',
    hasSlot: false,
    // The code itself is edited by the panel's own monospace box.
    fields: [{ key: 'language', label: 'Language (a label for readers)', kind: 'select', options: [...PML_ENUMS.code_language], optional: true }, anchor()],
    defaults: { primitive: 'pre', props: { language: 'bash', text: 'echo "Hello"' } },
  },
  {
    name: 'blockquote',
    label: 'Quote block',
    description: 'A quotation set apart from the text, with an optional link to its source.',
    icon: 'Quote',
    group: 'basic',
    hasSlot: false,
    container: true,
    fields: [{ key: 'cite', label: 'Source (a link)', kind: 'url', optional: true }, anchor()],
    defaults: { primitive: 'blockquote', children: [{ primitive: 'p', children: [{ primitive: 'text', props: { value: 'Words worth quoting.' } }] }] },
  },
  {
    name: 'details',
    label: 'Show more',
    description: 'A line a visitor clicks to open more detail. Opens without any script.',
    icon: 'ListCollapse',
    group: 'basic',
    hasSlot: false,
    container: true,
    fields: [{ key: 'open', label: 'Open at first', kind: 'boolean', optional: true }, anchor()],
    defaults: {
      primitive: 'details',
      children: [
        { primitive: 'summary', children: [{ primitive: 'text', props: { value: 'What does this mean?' } }] },
        { primitive: 'p', children: [{ primitive: 'text', props: { value: 'The answer, shown when it is opened.' } }] },
      ],
    },
  },
  {
    name: 'definitions',
    label: 'Definitions',
    description: 'Terms and what they mean, side by side.',
    icon: 'BookOpen',
    group: 'basic',
    hasSlot: false,
    container: true,
    fields: [anchor()],
    defaults: {
      primitive: 'definitions',
      children: [
        { primitive: 'term', children: [{ primitive: 'text', props: { value: 'LMIA' } }] },
        { primitive: 'definition', children: [{ primitive: 'p', children: [{ primitive: 'text', props: { value: 'A labour market impact assessment.' } }] }] },
      ],
    },
  },
  {
    name: 'figure',
    label: 'Figure',
    description: 'A picture, code or a table with its caption underneath.',
    icon: 'Image',
    group: 'basic',
    hasSlot: false,
    container: true,
    fields: [anchor()],
    defaults: { primitive: 'figure', children: [{ primitive: 'image', props: {} }, { primitive: 'caption', children: [{ primitive: 'text', props: { value: 'What the picture shows.' } }] }] },
  },
  // A page's behaviour (PSL). Written by Porter (ask in the console) or in the Code view; hidden from the
  // Add menu, but named in the panel so a script is never invisible in the Visual view.
  { name: 'script', label: 'Script', description: 'Behaviour that runs in a visitor\'s browser: what happens when they click, type or open something.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, fields: [], defaults: { primitive: 'script', props: {} } },
  // Their parts: hidden from the Add menu (each comes with its element), named in the panel.
  { name: 'summary', label: 'Summary line', description: 'The line a visitor clicks to open the detail.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, fields: [], defaults: { primitive: 'summary', children: [] } },
  { name: 'term', label: 'Term', description: 'A word or phrase being defined.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, fields: [], defaults: { primitive: 'term', children: [] } },
  { name: 'definition', label: 'Definition', description: 'What the term before it means.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, container: true, fields: [], defaults: { primitive: 'definition', children: [] } },
  { name: 'caption', label: 'Caption', description: 'The words under a figure.', icon: 'Type', group: 'basic', hasSlot: false, hidden: true, fields: [], defaults: { primitive: 'caption', children: [] } },
  {
    name: 'heading',
    label: 'Heading',
    description: 'A standalone title. Its level sets the size and the page outline.',
    icon: 'Heading',
    group: 'basic',
    hasSlot: false,
    fields: [
      { key: 'text', label: 'Text', kind: 'text' },
      { key: 'level', label: 'Level', kind: 'select', options: ['1', '2', '3', '4'] },
      anchor(),
    ],
    defaults: { primitive: 'heading', props: { text: 'A clear heading', level: '2' } },
  },
  {
    name: 'button',
    label: 'Button',
    description: 'A single call-to-action link.',
    icon: 'MousePointerClick',
    group: 'basic',
    hasSlot: false,
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'href', label: 'Link', kind: 'url', optional: true },
      { key: 'variant', label: 'Style', kind: 'select', options: ['primary', 'outline', 'soft', 'ghost', 'link'] },
    ],
    // A default href so a freshly-added button RENDERS (the renderer needs a label AND an href; a
    // hrefless button showed nothing, reading as broken). The '#' is an obvious placeholder to
    // replace, and a subtle shadow gives it presence out of the box.
    defaults: { primitive: 'button', props: { label: 'Learn more', href: '#', variant: 'primary' }, style: { shadow: 'sm' } },
  },
  {
    name: 'icon',
    label: 'Icon',
    description: 'A single icon from the safe set.',
    icon: 'Star',
    group: 'basic',
    hasSlot: false,
    fields: [{ key: 'name', label: 'Icon', kind: 'select', options: [...ICON_NAMES] }],
    defaults: { primitive: 'icon', props: { name: 'star' } },
  },
  {
    name: 'image',
    label: 'Image',
    description: 'A single picture, with a description for screen readers and search.',
    icon: 'Image',
    group: 'basic',
    hasSlot: false,
    fields: [
      { key: 'src', label: 'Image', kind: 'media' },
      { key: 'alt', label: 'Describe the image (screen readers + search)', kind: 'text', optional: true },
      { key: 'caption', label: 'Caption', kind: 'textarea', optional: true },
      // Framing (S2-05): the frame's shape, how the picture fills it, and what stays in view.
      { key: 'ratio', label: 'Shape', kind: 'select', options: ['auto', 'square', '4:3', '3:2', '16:9', '3:4'], optional: true },
      { key: 'fit', label: 'Fill', kind: 'select', options: ['cover', 'contain'], optional: true },
      { key: 'focal', label: 'Keep in view', kind: 'select', options: ['center', 'top', 'bottom', 'left', 'right'], optional: true },
    ],
    // Starts empty: adding it selects the section, so the picker is already open in the rail.
    defaults: { primitive: 'image', props: {} },
  },
  // --- Layout: containers holding arbitrary primitive children, edited by the rail's generic
  // contents editor. A child is not selectable on the canvas, so it is edited (and reordered)
  // inside its parent's rail. ---
  {
    name: 'box',
    label: 'Box',
    description: 'A stack or a row that groups other elements together.',
    icon: 'Square',
    group: 'layout',
    container: true,
    hasSlot: false,
    fields: [
      { key: 'direction', label: 'Direction', kind: 'select', options: ['column', 'row'] },
      { key: 'gap', label: 'Gap', kind: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] },
      // What the box IS, for screen readers and search engines (S1-01). Optional: a plain group otherwise.
      {
        key: 'as',
        label: 'What this is (for screen readers and search)',
        kind: 'select',
        options: ['div', 'section', 'article', 'aside', 'main', 'figure', 'address', 'blockquote'],
        optional: true,
      },
      // The box's shape, like a picture's (a frame waiting for a picture keeps the picture's shape).
      { key: 'ratio', label: 'Shape', kind: 'select', options: ['auto', 'square', '4:3', '3:2', '16:9', '3:4'], optional: true },
      anchor(),
    ],
    defaults: { primitive: 'box', props: { direction: 'column', gap: 'md' }, children: [] },
  },
  {
    name: 'grid',
    label: 'Grid',
    description: 'Columns that sit side by side and stack on a phone.',
    icon: 'LayoutGrid',
    group: 'layout',
    container: true,
    hasSlot: false,
    fields: [
      { key: 'columns', label: 'Columns', kind: 'select', options: ['1', '2', '3', '4', '6', '12'] },
      { key: 'gap', label: 'Gap', kind: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] },
      anchor(),
    ],
    defaults: { primitive: 'grid', props: { columns: '2', gap: 'md' }, children: [] },
  },
  {
    name: 'table',
    label: 'Table',
    description: 'Rows and columns of content, like a fee schedule or a comparison.',
    icon: 'Table',
    group: 'layout',
    container: true,
    hasSlot: false,
    fields: [{ key: 'caption', label: 'Caption (for screen readers)', kind: 'text', optional: true }, anchor()],
    // A 2x2 starter with a header row, so the consultant edits a real table, never an empty grid.
    // A hairline frame + rounded corners so it reads as an intentional, tidy table on first add.
    defaults: {
      primitive: 'table',
      style: { border: 'hairline', border_color: 'muted', radius: 'lg' },
      children: [
        {
          primitive: 'row',
          children: [
            { primitive: 'cell', props: { header: true }, children: [{ primitive: 'text', props: { value: 'Service' } }] },
            { primitive: 'cell', props: { header: true }, children: [{ primitive: 'text', props: { value: 'Price' } }] },
          ],
        },
        {
          primitive: 'row',
          children: [
            { primitive: 'cell', children: [{ primitive: 'text', props: { value: 'Study permit' } }] },
            { primitive: 'cell', children: [{ primitive: 'text', props: { value: '$2,500' } }] },
          ],
        },
      ],
    },
  },
  // row/cell are containers edited INSIDE a table (isItem: kept out of the top-level Add menu; a
  // table-aware add action in the rail inserts them). A cell can hold Basic + Layout content.
  {
    name: 'row',
    label: 'Row',
    description: 'A row of cells.',
    icon: 'Table',
    group: 'layout',
    container: true,
    isItem: true,
    hasSlot: false,
    fields: [],
    defaults: { primitive: 'row', children: [] },
  },
  {
    name: 'cell',
    label: 'Cell',
    description: 'One table cell.',
    icon: 'Table',
    group: 'layout',
    container: true,
    isItem: true,
    hasSlot: false,
    fields: [{ key: 'header', label: 'Header cell', kind: 'boolean', optional: true }],
    defaults: { primitive: 'cell', children: [] },
  },
  {
    name: 'image_text',
    label: 'Image and text',
    description: 'A picture beside copy; the media stacks above the copy on phones.',
    icon: 'Image',
    hasSlot: true,
    fields: [
      heading(),
      { key: 'image_url', label: 'Image', kind: 'media', optional: true },
      { key: 'image_alt', label: 'Describe the image', kind: 'text', optional: true },
    ],
    // NEW inserts drop an editable grid tree (image beside copy); a legacy {component:'image_text'}
    // still renders via StandardLibrary and edits through the fields above. The grid stacks on mobile.
    defaults: {
      primitive: 'grid',
      props: { columns: '2', gap: 'lg' },
      style: { align_items: 'center' },
      children: [
        { primitive: 'image', props: {}, style: { radius: 'lg' } },
        {
          primitive: 'box',
          props: { direction: 'column', gap: 'sm' },
          style: { align_items: 'start' },
          children: [
            { primitive: 'heading', props: { text: 'How I can help', level: 2 }, style: { heading_size: 'md' } },
            {
              primitive: 'text',
              props: { value: 'Describe this service or step in a sentence or two, in your own voice.' },
              style: { body_size: 'md' },
            },
          ],
        },
      ],
    },
  },
  {
    name: 'faq',
    label: 'FAQ',
    description: 'Answers to what anxious applicants actually ask.',
    icon: 'HelpCircle',
    hasSlot: true,
    itemComponent: 'faq_item',
    fields: [heading(), anchor()],
    // A PRIMITIVE now (S1-08): the published page keeps the FAQ marker, so search engines get FAQ data.
    defaults: {
      primitive: 'faq',
      props: { heading: 'Common questions' },
      children: [
        {
          primitive: 'faq_item',
          props: { question: 'How long does it take?' },
          children: [{ primitive: 'text', props: { value: 'It depends on the program and on current processing times. We tell you what to expect at your first call.' } }],
        },
      ],
    },
  },
  {
    name: 'faq_item',
    label: 'Question',
    description: 'A question and its answer.',
    icon: 'MessageCircle',
    isItem: true,
    hasSlot: true,
    fields: [{ key: 'question', label: 'Question', kind: 'text' }],
    defaults: { primitive: 'faq_item', props: { question: 'How long does it take?' }, children: [] },
  },
  {
    name: 'stats',
    label: 'Numbers',
    description: 'A short row of true numbers with labels.',
    icon: 'BarChart3',
    hasSlot: true,
    itemComponent: 'stat',
    fields: [heading()],
    defaults: { component: 'stats', props: { heading: 'Track record' }, children: [] },
  },
  {
    name: 'stat',
    label: 'Number',
    description: 'One number and its label.',
    icon: 'Hash',
    isItem: true,
    hasSlot: false,
    fields: [
      { key: 'value', label: 'Value', kind: 'text' },
      { key: 'label', label: 'Label', kind: 'text' },
    ],
    defaults: { component: 'stat', props: { value: '500+', label: 'families helped' } },
  },
  {
    name: 'cta_banner',
    label: 'Call to action',
    description: 'A single clear invitation to act.',
    icon: 'Megaphone',
    hasSlot: false,
    fields: [
      { key: 'headline', label: 'Headline', kind: 'text' },
      { key: 'body', label: 'Body', kind: 'textarea', optional: true },
      { key: 'cta_label', label: 'Button label', kind: 'text' },
      { key: 'cta_href', label: 'Button link', kind: 'url' },
    ],
    // NEW inserts drop an editable accent banner (box) with a heading + an outline CTA that contrasts
    // on the accent background; legacy {component:'cta_banner'} still renders + edits via the fields.
    defaults: {
      primitive: 'box',
      props: { direction: 'column', gap: 'md' },
      style: { padding: 'spacious', align: 'center', align_items: 'center', background: 'accent', radius: 'lg' },
      children: [
        { primitive: 'heading', props: { text: 'Ready to start?', level: 2 }, style: { heading_size: 'lg' } },
        {
          primitive: 'button',
          props: { label: 'See packages', href: '#packages', variant: 'outline' },
          style: { shadow: 'sm' },
        },
      ],
    },
  },
  {
    name: 'packages',
    label: 'Packages',
    description: 'Your real service packages, with real prices. Content is server-resolved.',
    icon: 'Package',
    singleton: true,
    hasSlot: false,
    fields: [heading(), { key: 'intro', label: 'Intro', kind: 'textarea', optional: true }],
    // A module PRIMITIVE, not a component: the server bakes the real packages and the funnel
    // wires the "Get started" action. (Authoring it as a component would fail to compile.)
    defaults: { primitive: 'packages', props: { heading: 'How I can help' } },
  },
  {
    name: 'credentials',
    label: 'Credentials',
    description: 'Your College registration, rendered from the public register.',
    icon: 'BadgeCheck',
    singleton: true,
    hasSlot: false,
    fields: [heading()],
    defaults: { primitive: 'credentials', props: { heading: 'Regulated and accountable' } },
  },
  // The semantic page landmarks: container PRIMITIVES that render as <header>/<nav>/<footer>. You
  // place, select, restyle, and edit their contents like any container; the identity is bound from
  // the register (unfakeable) and the s.44 scan guarantees every page carries it. Auto-placed on a
  // fresh page; offered here so you can re-add one you removed, or build a page from scratch.
  {
    name: 'header',
    label: 'Header',
    description: 'The top bar: your licensee identity (from the register) and your page navigation. Renders as a <header>.',
    icon: 'PanelTop',
    group: 'sections',
    singleton: true,
    hasSlot: false,
    fields: [
      { key: 'direction', label: 'Direction', kind: 'select', options: ['row', 'column'] },
      { key: 'gap', label: 'Gap', kind: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] },
    ],
    defaults: HEADER_DEFAULT,
  },
  {
    name: 'nav',
    label: 'Navigation',
    description: 'A row of links to your published pages, in a <nav>. It updates itself as you publish or reorder pages.',
    icon: 'Navigation',
    group: 'sections',
    hasSlot: false,
    fields: [
      { key: 'direction', label: 'Direction', kind: 'select', options: ['row', 'column'] },
      { key: 'gap', label: 'Gap', kind: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] },
    ],
    defaults: NAV_DEFAULT,
  },
  {
    name: 'footer',
    label: 'Footer',
    description: 'The bottom bar: your identity, the College licence line, the register-verify link, and the required no-guarantee notice. Renders as a <footer>.',
    icon: 'PanelBottom',
    group: 'sections',
    singleton: true,
    hasSlot: false,
    fields: [
      { key: 'direction', label: 'Direction', kind: 'select', options: ['row', 'column'] },
      { key: 'gap', label: 'Gap', kind: 'select', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] },
    ],
    defaults: FOOTER_DEFAULT,
  },
  {
    name: 'testimonials',
    label: 'Testimonials',
    description: 'Real client testimonials. Each one needs the client’s written approval on file (CICC s.45).',
    icon: 'Quote',
    singleton: true,
    hasSlot: false,
    fields: [
      heading(),
      { key: 'intro', label: 'Intro', kind: 'textarea', optional: true },
      { key: 'layout', label: 'Layout', kind: 'select', options: ['grid', 'stack'], optional: true },
    ],
    // A module PRIMITIVE, not a component: the server bakes only the consultant's ATTESTED +
    // visible testimonials (managed from the Library), never authored here.
    defaults: { primitive: 'testimonials', props: { heading: 'What clients say', layout: 'grid' } },
  },
  {
    name: 'porter_intake',
    label: 'Ask Porter',
    description: 'A visitor describes their situation and Porter points them at the right service.',
    icon: 'Sparkles',
    singleton: true,
    hasSlot: false,
    fields: [
      heading(),
      { key: 'intro', label: 'Intro', kind: 'textarea', optional: true },
      { key: 'opening_line', label: 'Porter’s first message', kind: 'textarea', optional: true },
    ],
    defaults: {
      primitive: 'porter_intake',
      props: { heading: 'Not sure where to start?', intro: 'Describe your situation and I will point you to the right service.' },
    },
  },
  {
    name: 'contact_form',
    label: 'Contact form',
    description: 'The message form that reaches your inbox.',
    icon: 'Mail',
    singleton: true,
    hasSlot: false,
    fields: [
      heading(),
      { key: 'intro', label: 'Intro', kind: 'textarea', optional: true },
      { key: 'consent_notice', label: 'Consent notice', kind: 'textarea', optional: true },
    ],
    // A module primitive that owns its own consent + submit (see PmlContactForm).
    defaults: {
      primitive: 'contact_form',
      props: { heading: 'Get in touch', consent_notice: 'By sending this you agree to be contacted about your enquiry.' },
    },
  },
  // Portify's own sign-up form (S0-10): the host landing page owns its wording, consent and
  // destination, so it has no fields. Consultants never see it: their owner refuses it.
  {
    name: 'growth_form',
    label: 'Sign-up form',
    description: "The landing page's sign-up form, with its question and consent.",
    icon: 'Mail',
    singleton: true,
    hasSlot: false,
    fields: [],
    defaults: { primitive: 'growth_form' },
  },
  // A CUSTOM form: a container of `field` children, unlike the fixed contact_form module. A
  // Scale-plan feature (the publish is refused below tier, with an honest upsell), so a below-tier
  // consultant who adds one is told at publish rather than here. Add fields via the rail's contents
  // editor ("Add field"); the submit endpoint is server-owned, so no action URL is ever authored.
  {
    name: 'form',
    label: 'Form',
    description: 'A custom form that captures a visitor’s details into your inbox. A Scale-plan feature.',
    icon: 'ClipboardList',
    container: true,
    premium: true,
    hasSlot: false,
    fields: [
      { key: 'title', label: 'Title', kind: 'text', optional: true },
      { key: 'intro', label: 'Intro', kind: 'textarea', optional: true },
      // stacked: labelled fields over a full-width button; inline: one line, like a sign-up;
      // prompt: one large box with a round send button inside, like an ask box.
      { key: 'layout', label: 'Layout', kind: 'select', options: ['stacked', 'inline', 'prompt'], optional: true },
      { key: 'submit_label', label: 'Button label', kind: 'text', optional: true },
      { key: 'success_message', label: 'Thank-you message', kind: 'textarea', optional: true },
      { key: 'consent_notice', label: 'Consent notice', kind: 'textarea', optional: true },
      { key: 'notify_email', label: 'Send alerts to (optional)', kind: 'text', optional: true },
      { key: 'key', label: 'Form ID (used in the web address)', kind: 'text' },
    ],
    defaults: FORM_DEFAULT,
  },
  // One input inside a form. Added via the form's contents editor, never at the top level.
  {
    name: 'field',
    label: 'Field',
    description: 'One input in a form.',
    icon: 'Type',
    isItem: true,
    hasSlot: false,
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'name', label: 'Field name (letters, numbers, underscores)', kind: 'text' },
      {
        key: 'kind',
        label: 'Type',
        kind: 'select',
        options: ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'checkbox'],
      },
      { key: 'placeholder', label: 'Placeholder', kind: 'text', optional: true },
      { key: 'required', label: 'Required', kind: 'boolean', optional: true },
      { key: 'options', label: 'Choices for a dropdown (one per line)', kind: 'textarea', optional: true },
    ],
    defaults: { primitive: 'field', props: { name: 'new_field', label: 'New field', kind: 'text' } },
  },
  {
    // A PRIMITIVE now (PML v2 S1-04): a titled, toned <aside role="note"> holding prose. It used to
    // drop a styled box; the std-lib `callout` component it replaced is gone.
    name: 'callout',
    label: 'Callout',
    description: 'A short note a reader must not miss: a deadline, a common mistake, a tip.',
    icon: 'Info',
    container: true,
    hasSlot: false,
    fields: [
      { key: 'title', label: 'Title', kind: 'text', optional: true },
      { key: 'tone', label: 'Tone', kind: 'select', options: ['info', 'tip', 'warning', 'success', 'danger'] },
      anchor(),
    ],
    defaults: {
      primitive: 'callout',
      props: { tone: 'info', title: 'Good to know' },
      children: [{ primitive: 'text', props: { value: 'A short, important note your visitors should not miss.' } }],
    },
  },
  {
    // S1-06: built at render from the page's own headings, so it never goes out of date.
    name: 'toc',
    label: 'Table of contents',
    description: 'Links to every section of a long page, built from its headings.',
    icon: 'ListTree',
    hasSlot: false,
    fields: [
      { key: 'title', label: 'Title', kind: 'text', optional: true },
      { key: 'depth', label: 'Headings to list', kind: 'select', options: ['2', '3'] },
    ],
    defaults: { primitive: 'toc', props: { title: 'On this page', depth: '2' } },
  },
  {
    // S1-07: numbered citations for the official pages and laws a page relies on.
    name: 'sources',
    label: 'Sources',
    description: 'The official pages and laws this page relies on, as numbered citations.',
    icon: 'BookOpen',
    hasSlot: true,
    itemComponent: 'source',
    fields: [{ key: 'title', label: 'Title', kind: 'text', optional: true }, anchor()],
    defaults: {
      primitive: 'sources',
      props: { title: 'Sources' },
      children: [
        {
          primitive: 'source',
          props: {
            title: 'Immigration and citizenship',
            publisher: 'Immigration, Refugees and Citizenship Canada',
            href: 'https://www.canada.ca/en/services/immigration-citizenship.html',
          },
        },
      ],
    },
  },
  {
    name: 'source',
    label: 'Source',
    description: 'One citation.',
    icon: 'Link',
    isItem: true,
    hasSlot: false,
    fields: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'publisher', label: 'Publisher', kind: 'text', optional: true },
      { key: 'href', label: 'Link', kind: 'url', optional: true },
      { key: 'date', label: 'Date you read it (YYYY-MM-DD)', kind: 'text', optional: true },
    ],
    defaults: { primitive: 'source', props: { title: 'A new source' } },
  },
  {
    name: 'announcement',
    label: 'Announcement bar',
    description: 'A slim sticky bar with a short message and one call to action.',
    icon: 'Megaphone',
    hasSlot: false,
    fields: [
      { key: 'message', label: 'Message', kind: 'text' },
      { key: 'cta_label', label: 'Button label', kind: 'text', optional: true },
      { key: 'cta_href', label: 'Button link', kind: 'url', optional: true },
    ],
    // NEW inserts drop an editable slim sticky bar (a row box, message + one CTA, space-between);
    // legacy {component:'announcement'} still renders + edits via the fields. `motion: sticky` keeps
    // the bar pinned as the old announcement did (a premium value that still renders when set).
    defaults: {
      primitive: 'box',
      props: { direction: 'row', gap: 'md' },
      style: { padding: 'compact', padding_x: 'normal', justify: 'between', align_items: 'center', background: 'surface', motion: 'sticky' },
      children: [
        { primitive: 'text', props: { value: 'Now accepting new clients for the fall intake.' }, style: { body_size: 'sm' } },
        { primitive: 'button', props: { label: 'Get in touch', href: '#packages', variant: 'link' } },
      ],
    },
  },
  {
    name: 'list',
    label: 'List',
    description: 'A bullet, numbered, checklist, or icon-card list. One section, four styles.',
    icon: 'List',
    group: 'basic',
    hasSlot: true,
    itemComponent: 'list_item',
    fields: [
      heading(),
      { key: 'type', label: 'Style', kind: 'select', options: ['bullet', 'numbered', 'check', 'icon'] },
      anchor(),
    ],
    defaults: { primitive: 'list', props: { type: 'bullet', heading: 'What I help with' }, children: [] },
  },
  {
    name: 'list_item',
    label: 'Item',
    description: 'One list entry.',
    icon: 'Minus',
    isItem: true,
    hasSlot: false,
    fields: [
      { key: 'text', label: 'Text', kind: 'text' },
      { key: 'title', label: 'Title (icon lists only)', kind: 'text', optional: true },
      { key: 'icon', label: 'Icon (icon lists only)', kind: 'select', options: [...ICON_NAMES], optional: true },
    ],
    defaults: { primitive: 'list_item', props: { text: 'A point worth making' } },
  },
  {
    name: 'video',
    label: 'Video',
    description: 'Embed a YouTube or Vimeo video (paste the video ID, not the full URL).',
    icon: 'Video',
    hasSlot: false,
    fields: [
      { key: 'provider', label: 'Provider', kind: 'select', options: ['youtube', 'vimeo'] },
      { key: 'id', label: 'Video ID', kind: 'text' },
      { key: 'title', label: 'Title (for screen readers)', kind: 'text', optional: true },
    ],
    defaults: { primitive: 'video', props: { provider: 'youtube' } },
  },
  {
    name: 'divider',
    label: 'Divider',
    description: 'A hairline rule between sections. For blank space, use a Spacer.',
    icon: 'Minus',
    group: 'basic',
    hasSlot: false,
    fields: [{ key: 'size', label: 'Size', kind: 'select', options: ['sm', 'md', 'lg'], optional: true }],
    defaults: { primitive: 'divider', props: { size: 'md' } },
  },
  {
    name: 'spacer',
    label: 'Spacer',
    description: 'Blank vertical space between sections, with no line.',
    icon: 'MoveVertical',
    group: 'basic',
    hasSlot: false,
    fields: [{ key: 'size', label: 'Size', kind: 'select', options: ['sm', 'md', 'lg'], optional: true }],
    defaults: { primitive: 'spacer', props: { size: 'md' } },
  },
];

export const PML_CATALOG_BY_NAME: Record<string, PmlComponentDef> = Object.fromEntries(
  PML_CATALOG.map((entry) => [entry.name, entry]),
);

/**
 * Sections offered in the "Add a section" menu: everything that is not an item sub-component
 * and has not been superseded (`hidden`). Retired entries stay in PML_CATALOG so a page that
 * still holds one keeps editing.
 */
export const PML_SECTIONS: PmlComponentDef[] = PML_CATALOG.filter(
  (entry) => !entry.isItem && !entry.hidden,
);

/** The order the modal renders the groups in. */
export const PML_GROUP_ORDER: PmlGroup[] = ['basic', 'layout', 'sections', 'portify-components', 'components', 'my-components'];

/** Elements with no menu entry of their own, in the words the builder shows for them. */
const PLAIN_ELEMENT_NAMES: Record<string, string> = {
  layer: 'Decorative shape',
  slot: 'Space for page content',
  list_item: 'List item',
  row: 'Table row',
  cell: 'Table cell',
  field: 'Form field',
  faq_item: 'Question',
  source: 'Source',
};

/** What to call an element anywhere the builder names one. */
export function elementLabel(name: string, studio: Array<{ key: string; name: string }> = []): string {
  return PML_CATALOG_BY_NAME[name]?.label ?? studio.find((c) => c.key === name)?.name ?? PLAIN_ELEMENT_NAMES[name] ?? 'Element';
}

/** Human labels for each group heading in the modal. */
export const PML_GROUP_LABELS: Record<PmlGroup, string> = {
  basic: 'Basic',
  layout: 'Layout',
  components: 'Components',
  sections: 'Sections',
  'portify-components': 'Portify components',
  'my-components': 'My components',
};

/** The effective group for an entry; entries without an explicit group are curated Components. */
export function groupOf(def: PmlComponentDef): PmlGroup {
  return def.group ?? 'components';
}
