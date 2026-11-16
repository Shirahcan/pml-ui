import type { StudioParam } from '../components';
import { bindingName } from './authoring';
import type { PmlNode } from '../../language';

/** Does this design have a space for a page's own elements (a `<slot/>`)? */
export function slotIn(node: PmlNode): boolean {
  return node.component === 'slot' || (node.children ?? []).some(slotIn);
}

/** A setting's name, made from its label and unique among the component's settings. */
export function uniqueName(label: string, params: StudioParam[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[0-9_]+/, '') || 'setting';
  const taken = new Set(params.map((p) => p.name));
  let name = base;

  for (let n = 2; taken.has(name); n += 1) {
    name = `${base}_${n}`;
  }

  return name;
}

/**
 * The design with a setting's bindings replaced by a fixed value, typed by the setting's kind (component props
 * p06a): a yes/no goes back as true or false, a number as a number. Its style bindings are fixed too, and a
 * "show or hide" condition reading it is removed, so the element simply shows.
 */
export function bindingFree(node: PmlNode, settingName: string, value: string, kind: StudioParam['kind'] = 'text'): PmlNode {
  const fixed: unknown = kind === 'yes_no' ? value === 'true' : kind === 'number' && value !== '' && Number.isFinite(Number(value)) ? Number(value) : value;
  const fix = (bag: Record<string, unknown> | undefined) =>
    bag ? Object.fromEntries(Object.entries(bag).map(([key, prop]) => [key, bindingName(prop) === settingName ? fixed : prop])) : undefined;
  const next: PmlNode = {
    ...node,
    ...(node.props ? { props: fix(node.props as Record<string, unknown>) } : {}),
    ...(node.style ? { style: fix(node.style as Record<string, unknown>) } : {}),
    ...(node.children ? { children: node.children.map((child) => bindingFree(child, settingName, value, kind)) } : {}),
  } as PmlNode;

  if (bindingName(next.if) === settingName) delete next.if;

  // A rich-text setting fills the whole Markdown (`{props.intro}`): it goes back as the Markdown itself.
  const markdown = (next.props as Record<string, unknown> | undefined)?.markdown;
  if (next.primitive === 'rich_text' && typeof markdown === 'string' && richTextSetting(markdown) === settingName) {
    next.props = { ...(next.props as Record<string, unknown>), markdown: value } as PmlNode['props'];
  }

  return next;
}

/** The setting a rich text's whole Markdown reads (`{props.intro}` -> "intro"), or null. */
export function richTextSetting(markdown: string): string | null {
  return /^\{\s*props\.([A-Za-z_][A-Za-z0-9_]*)\s*\}$/.exec(markdown.trim())?.[1] ?? null;
}
