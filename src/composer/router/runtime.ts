// ---------------------------------------------------------------------------
// Router controller — memory history + reactive location signal
// ---------------------------------------------------------------------------

import { signal } from '../../index.js';
import type { RouteDef } from '../document/model.js';
import { matchURL, parseURL } from './matcher.js';

export interface RouterLocation {
  pathname: string;
  query: Record<string, string>;
  hash: string;
  params: Record<string, string>;
  routeName: string | null;
}

export interface RouterController {
  location: ReturnType<typeof signal<RouterLocation>>;
  pathname(): string;
  params(): Record<string, string>;
  query(): Record<string, string>;
  hash(): string;
  routeName(): string | null;
  push(path: string): void;
  replace(path: string): void;
  back(): void;
  forward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  syncRoutes(routes: RouteDef[]): void;
  reset(): void;
}

function defaultLocation(): RouterLocation {
  return { pathname: '/', query: {}, hash: '', params: {}, routeName: null };
}

function shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

let instance: RouterController | null = null;

function createRouter(): RouterController {
  const stack: string[] = ['/'];
  let cursor = 0;
  let currentRoutes: { name: string; pattern: string }[] = [];

  const location = signal<RouterLocation>(defaultLocation());

  function rematch() {
    const path = stack[cursor];
    const parsed = parseURL(path);
    const match = matchURL(parsed.pathname, currentRoutes);
    const prev = location();
    const nextRouteName = match?.name ?? null;
    if (
      prev.pathname === parsed.pathname &&
      prev.hash === parsed.hash &&
      prev.routeName === nextRouteName &&
      shallowEqual(prev.query, parsed.query) &&
      shallowEqual(prev.params, match?.params ?? {})
    ) {
      return;
    }
    location.set({
      pathname: parsed.pathname,
      query: parsed.query,
      hash: parsed.hash,
      params: match?.params ?? {},
      routeName: nextRouteName,
    });
  }

  function push(path: string) {
    stack.length = cursor + 1;
    stack.push(path);
    cursor = stack.length - 1;
    rematch();
  }

  function replace(path: string) {
    stack[cursor] = path;
    rematch();
  }

  function back() {
    if (cursor > 0) {
      cursor--;
      rematch();
    }
  }

  function forward() {
    if (cursor < stack.length - 1) {
      cursor++;
      rematch();
    }
  }

  function canGoBack() {
    return cursor > 0;
  }

  function canGoForward() {
    return cursor < stack.length - 1;
  }

  function syncRoutes(routes: RouteDef[]) {
    currentRoutes = routes
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(r => ({ name: r.name, pattern: r.pattern }));
    rematch();
  }

  function reset() {
    stack.length = 0;
    stack.push('/');
    cursor = 0;
    currentRoutes = [];
    location.set(defaultLocation());
  }

  const controller: RouterController = {
    location,
    pathname: () => location().pathname,
    params: () => location().params,
    query: () => location().query,
    hash: () => location().hash,
    routeName: () => location().routeName,
    push,
    replace,
    back,
    forward,
    canGoBack,
    canGoForward,
    syncRoutes,
    reset,
  };

  instance = controller;
  return controller;
}

export function getRouter(): RouterController {
  if (!instance) createRouter();
  return instance!;
}

export function resetRouter(): void {
  if (instance) {
    instance.reset();
  }
}
