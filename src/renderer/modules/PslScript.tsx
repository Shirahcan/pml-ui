'use client';

import React from 'react';

import { PageRuntime } from '../../psl';
import type { Node, Program, Value } from '../../psl';
import { buildLocation, buildNatives, deviceFor, type PmlNativesPayload } from '../../pml/expressions';
import type { PmlNode } from '../../pml/primitives';

/**
 * The page's PSL scope (PML v3 L3). EVERY render has one: a page's `{...}` values are PSL expressions
 * read against the natives (owner / site / page from the server, location / device from the browser),
 * so the builder canvas draws `{owner.registered_name}` exactly as the live page will.
 *
 * What CHANGES the page stays behind `interactive` (the live public page passes `enableScripts`, the
 * `PslScriptsGate`): `<script>`s run, `on-*` handlers fire and `dom.el` edits apply only then. With it
 * off (the builder, a preview) state stays empty and nothing reacts, the inert preview it always was.
 */
export interface PmlScope {
  runtime: PageRuntime;
  /** Scripts, events and dom edits are live (the public page with the scripts gate on). */
  interactive: boolean;
  /** Bumped on every state write, so readers re-render. */
  version: number;
  /** location / device: null in the server render and the first paint, set once the page has loaded. */
  browser: Record<string, Value>;
}

const PmlScopeContext = React.createContext<PmlScope | null>(null);

/** The page's scope (always present under a PmlRenderer). */
export function usePmlScope(): PmlScope | null {
  return React.useContext(PmlScopeContext);
}

/** The page's runtime ONLY where the page is interactive (scripts on); null in the builder. */
export function usePslRuntime(): PageRuntime | null {
  const scope = React.useContext(PmlScopeContext);

  return scope && scope.interactive ? scope.runtime : null;
}

/** An expression's value in the page scope, with the browser natives and an element's `each` items. */
export function evaluateIn(scope: PmlScope, ast: Node, locals: Record<string, Value> = {}): Value {
  return scope.runtime.evaluate(ast, { ...scope.browser, ...locals });
}

/** Run an `on-*` handler in the page scope (interactive pages only; the caller checks). */
export function handleIn(scope: PmlScope, ast: Node, locals: Record<string, Value> = {}): void {
  scope.runtime.handle(ast, { ...scope.browser, ...locals });
}

// The browser natives as one comparable snapshot (path, query, hash, screen), read only in the browser.
const subscribeBrowser = (onChange: () => void): (() => void) => {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener('resize', onChange);

  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('resize', onChange);
  };
};
const readBrowser = (): string =>
  [window.location.pathname, window.location.search, window.location.hash, deviceFor(window.innerWidth)].join('\n');
const readBrowserOnServer = (): string => '';

export function PmlScopeProvider({
  now,
  natives,
  interactive,
  children,
}: {
  /** "Today" as YYYY-MM-DD, injected by the page (never a wall clock), so date helpers stay deterministic. */
  now?: string;
  /** owner / site / page, sent with the render. */
  natives?: PmlNativesPayload | null;
  interactive: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  // ONE runtime per page mount (a lazy state, never rebuilt), so a re-render never loses the functions
  // earlier scripts defined. This is what makes the page-global scope real.
  const [runtime] = React.useState(() => new PageRuntime({ now, context: { ...buildNatives(natives), now: now ?? null } }));

  // Re-render whenever a script or a handler writes state.
  const version = React.useSyncExternalStore(
    (onChange) => runtime.store.subscribe(onChange),
    () => runtime.store.version(),
    () => 0,
  );

  const browserKey = React.useSyncExternalStore(subscribeBrowser, readBrowser, readBrowserOnServer);
  const browser = React.useMemo<Record<string, Value>>(() => {
    if (browserKey === '') {
      return { location: null, device: null };
    }

    const [path, search, hash, device] = browserKey.split('\n');

    return { location: buildLocation({ path, search, hash }), device };
  }, [browserKey]);

  const value = React.useMemo<PmlScope>(() => ({ runtime, interactive, version, browser }), [runtime, interactive, version, browser]);

  return <PmlScopeContext.Provider value={value}>{children}</PmlScopeContext.Provider>;
}

/**
 * A PSL `<script>`: a behaviour leaf that renders NOTHING. When the page is interactive (the live public
 * page), it EXECUTES its compiled program into the shared page-global scope on mount, so a function it
 * defines is callable by a later `<script>` or an `on-click`. Client-only (a `useEffect`), so it never
 * runs during the server render and cannot cause a hydration mismatch. In the builder it is inert. A
 * fault soft-fails inside the runtime and is recorded there; it never throws at the page.
 */
export function PslScript({ node }: { node: PmlNode }): null {
  const runtime = usePslRuntime();
  const program = (node.props ?? {}).program as Program | undefined;

  React.useEffect(() => {
    if (!runtime || !program) {
      return;
    }
    runtime.run(program);
  }, [runtime, program]);

  return null;
}
