import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';

import type { DocumentLibraryComponent, DocumentPartial } from '../../../src/builder/components';
import { CatalogProvider, useCatalogComponent, useCatalogPartial } from '../../../src/builder/editor/catalog';
import { PageLayers } from '../../../src/builder/editor/PageLayers';
import { SelectionBreadcrumb } from '../../../src/builder/editor/SelectionBreadcrumb';
import type { PmlNode } from '../../../src/language';

const hero: DocumentLibraryComponent = { key: 'hero_band', tag: 'hero-band', name: 'Hero band', description: null, category: 'sections', offered: true, current_version: 1, replaced_by_key: null, versions: {} };
const cta: DocumentPartial = { id: 'p1', handle: 'cta-band', name: 'Call to action', pml: '<box/>', params: [], slots: [], updated_at: null };

const nodes = [
  { primitive: 'box', props: {}, children: [{ primitive: 'heading', props: { text: 'Welcome', level: 1 } }] },
  { component: 'hero_band', props: {} },
] as unknown as PmlNode[];

const wrap = ({ children }: { children: React.ReactNode }) => (
  <CatalogProvider components={[hero]} partials={[cta]}>
    {children}
  </CatalogProvider>
);

/** The section catalog as a package context (shared program E4a4d), and the two panels that read it. */
describe('catalog', () => {
  it('finds a library component by key and a partial by its PML name', () => {
    expect(renderHook(() => useCatalogComponent('hero_band'), { wrapper: wrap }).result.current?.name).toBe('Hero band');
    expect(renderHook(() => useCatalogPartial('cta_band'), { wrapper: wrap }).result.current?.name).toBe('Call to action');
    expect(renderHook(() => useCatalogComponent('hero_band')).result.current).toBeUndefined();
  });

  it('the breadcrumb names each step and selects a parent', () => {
    const onSelect = vi.fn();
    render(<SelectionBreadcrumb nodes={nodes} path={[0, 0]} onSelect={onSelect} />, { wrapper: wrap });

    const nav = screen.getByRole('navigation', { name: 'Selected element' });
    expect(nav.querySelector('[aria-current="location"]')?.textContent).toBeTruthy();
    fireEvent.click(nav.querySelector('button') as HTMLButtonElement);
    expect(onSelect).toHaveBeenCalledWith([0]);
  });

  it('the layers list names a library component from the catalog and selects a row', () => {
    const onSelect = vi.fn();
    render(<PageLayers nodes={nodes} selectedPath={null} onSelect={onSelect} onMoved={vi.fn()} />, { wrapper: wrap });

    expect(screen.getByRole('button', { name: 'Hero band' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Welcome/ }));
    expect(onSelect).toHaveBeenCalledWith([0, 0]);
  });

  it('dragging the first section below the second reorders the page', () => {
    const onMoved = vi.fn();
    render(<PageLayers nodes={nodes} selectedPath={null} onSelect={vi.fn()} onMoved={onMoved} />, { wrapper: wrap });

    const rows = screen.getByRole('region', { name: 'Layers' }).querySelectorAll('[draggable="true"]');
    const first = rows[0] as HTMLElement;
    const last = rows[rows.length - 1] as HTMLElement;
    last.getBoundingClientRect = () => ({ top: 0, height: 20, bottom: 20, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.dragStart(first, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(last, { clientY: 19 });
    fireEvent.drop(last);

    expect(onMoved).toHaveBeenCalledTimes(1);
  });
});

describe('the selected layer', () => {
  it('is tinted through a theme variable, never an opacity on var() (Tailwind 3 hosts drop that class)', () => {
    render(<PageLayers nodes={nodes} selectedPath={[1]} onSelect={vi.fn()} onMoved={vi.fn()} />, { wrapper: wrap });

    const row = screen.getByRole('button', { name: 'Hero band' }).parentElement as HTMLElement;
    expect(row.className).toContain('bg-[var(--pb-accent-soft)]');
    expect(screen.getByRole('region', { name: 'Layers' }).getAttribute('style')).toContain('--pb-accent-soft: color-mix(in srgb, #4361EE 10%, transparent)');
  });
});
