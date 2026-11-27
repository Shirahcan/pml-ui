import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PageSwitcher, slugFromTitle, type DocumentSetPort, type SetPage } from '../../../src/builder/pages/PageSwitcher';

/** A set adapter held in memory, with the server's rules: the root first and never deleted or hidden. */
function fakeSet(): DocumentSetPort & { list: SetPage[] } {
  const list: SetPage[] = [
    { id: 'root', slug: '', root: true, title: 'Home', navLabel: 'Home', showInNav: true, state: 'ready', publicUrl: 'https://x.test/go/pr' },
    { id: 'b', slug: 'benefits', root: false, title: 'Benefits', navLabel: null, showInNav: true, state: 'draft', publicUrl: 'https://x.test/go/pr/benefits' },
    { id: 'f', slug: 'faq', root: false, title: 'FAQ', navLabel: null, showInNav: true, state: 'draft', publicUrl: 'https://x.test/go/pr/faq' },
  ];
  const port = {
    list,
    pages: vi.fn(async () => [...list]),
    addPage: vi.fn(async ({ title, slug }: { title: string; slug: string }) => {
      const page: SetPage = { id: slug, slug, root: false, title, navLabel: null, showInNav: true, state: 'draft', publicUrl: null };
      list.push(page);

      return page;
    }),
    updatePage: vi.fn(async (id: string, change: Partial<SetPage>) => {
      const page = list.find((p) => p.id === id)!;
      if (page.root && change.state === 'hidden') throw new Error('The first page cannot be hidden.');
      Object.assign(page, change);

      return page;
    }),
    reorderPages: vi.fn(async (ids: string[]) => {
      const root = list.filter((p) => p.root);
      const rest = ids.map((id) => list.find((p) => p.id === id)!);
      list.splice(0, list.length, ...root, ...rest);

      return [...list];
    }),
    deletePage: vi.fn(async (id: string) => {
      const at = list.findIndex((p) => p.id === id);
      if (list[at].root) throw new Error('The first page cannot be deleted.');
      list.splice(at, 1);
    }),
  };

  return port;
}

function openMenu(title: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: `Actions for ${title}` }), { key: 'Enter' });
}

describe('the page switcher (E4h)', () => {
  it('lists the pages in order with the root marked, and opens another page', async () => {
    const port = fakeSet();
    const onOpen = vi.fn();
    render(<PageSwitcher port={port} currentId="root" onOpen={onOpen} />);

    await screen.findByText('Benefits');
    expect(screen.getByLabelText('First page')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('Home'), expect.stringContaining('Benefits'), expect.stringContaining('FAQ')]);

    fireEvent.click(screen.getByText('FAQ'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'f' }));
  });

  it('adds a page with a slug from its title and opens it', async () => {
    const port = fakeSet();
    const onOpen = vi.fn();
    render(<PageSwitcher port={port} currentId="root" onOpen={onOpen} />);
    await screen.findByText('Benefits');

    fireEvent.click(screen.getByRole('button', { name: /Add a page/ }));
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Why us?' } });
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('why-us');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add the page' }));
    });

    expect(port.addPage).toHaveBeenCalledWith({ title: 'Why us?', slug: 'why-us' });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'why-us' }));
    expect(await screen.findByText('Why us?')).toBeTruthy();
  });

  it('renames, hides and reorders a child page', async () => {
    const port = fakeSet();
    render(<PageSwitcher port={port} currentId="root" onOpen={() => undefined} />);
    await screen.findByText('Benefits');

    openMenu('Benefits');
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Perks' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(port.updatePage).toHaveBeenCalledWith('b', expect.objectContaining({ title: 'Perks', slug: 'benefits' }));

    openMenu('Perks');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Hide/ }));
    });
    expect(port.updatePage).toHaveBeenCalledWith('b', { state: 'hidden' });

    openMenu('Perks');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Move down/ }));
    });
    expect(port.reorderPages).toHaveBeenCalledWith(['f', 'b']);
    await waitFor(() => expect(screen.getAllByRole('listitem')[1].textContent).toContain('FAQ'));
  });

  it('offers no delete, hide or move for the root page', async () => {
    const port = fakeSet();
    render(<PageSwitcher port={port} currentId="root" onOpen={() => undefined} />);
    await screen.findByText('Benefits');

    openMenu('Home');
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent ?? '');
    expect(items.some((t) => /Delete|Hide|Move/.test(t))).toBe(false);
    expect(items.some((t) => /Copy address/.test(t))).toBe(true);
  });

  it('deletes a child page only after the confirm dialog', async () => {
    const port = fakeSet();
    render(<PageSwitcher port={port} currentId="root" onOpen={() => undefined} />);
    await screen.findByText('Benefits');

    openMenu('FAQ');
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(port.deletePage).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Delete the page' }));
    });
    expect(port.deletePage).toHaveBeenCalledWith('f');
    await waitFor(() => expect(screen.queryByText('FAQ')).toBeNull());
  });

  it('makes a slug from a title', () => {
    expect(slugFromTitle('  Frequently Asked Questions! ')).toBe('frequently-asked-questions');
    expect(slugFromTitle('Éligibilité')).toBe('eligibilite');
  });
});

describe('marking a page ready', () => {
  it('toggles a child page between draft and ready, never the root', async () => {
    const port = fakeSet();
    render(<PageSwitcher port={port} currentId="root" onOpen={() => undefined} />);
    await screen.findByText('Benefits');

    openMenu('Benefits');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Mark ready/ }));
    });
    expect(port.updatePage).toHaveBeenCalledWith('b', { state: 'ready' });

    openMenu('Home');
    expect(screen.queryByRole('menuitem', { name: /Mark ready|Back to draft/ })).toBeNull();
  });
});
