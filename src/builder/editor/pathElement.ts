/**
 * The element a `data-pml-path` holder marks. Most holders are a `display: contents` wrapper, so the
 * element is its first child; a table row or cell cannot be wrapped and carries the path itself,
 * marked `data-pml-self` (PmlRenderer's SelfPathContext, 2026-11-07).
 */
export function pathElement(holder: Element | null | undefined): HTMLElement | null {
  if (!holder) return null;

  return (holder.hasAttribute('data-pml-self') ? holder : holder.firstElementChild) as HTMLElement | null;
}
