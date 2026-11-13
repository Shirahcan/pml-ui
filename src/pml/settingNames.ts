/** One `<prop ...>` or `</prop>` tag in a `<props>` block. */
const PROP_TAG = /<prop\b([^>]*?)(\/?)>|<\/prop>/g;

/**
 * A light read of the `<props>` block at the top of a component's code, only to preview the settings it
 * declares while someone types: the top-level `<prop>`s (a list's or map's own fields sit inside one and are
 * not counted). The server reads the block for real on save, with PML's own parser.
 */
export function readSettingNames(pml: string): string[] {
  const block = pml.match(/^\s*<props\b[\s\S]*?<\/props>/)?.[0];
  if (!block) return [];

  const out: string[] = [];
  let depth = 0;

  for (const tag of block.matchAll(PROP_TAG)) {
    if (tag[0] === '</prop>') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    const name = tag[1].match(/\bname="([^"]*)"/)?.[1];
    if (depth === 0 && name) out.push(name);
    if (tag[2] !== '/') depth += 1;
  }

  return Array.from(new Set(out));
}
