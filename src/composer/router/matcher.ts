// ---------------------------------------------------------------------------
// Pure URL matching utilities
// ---------------------------------------------------------------------------

export type RouteSegment =
  | { type: 'static'; value: string }
  | { type: 'param'; name: string }
  | { type: 'splat'; name: string };

export interface RouteMatch {
  name: string;
  params: Record<string, string>;
}

export interface ParsedURL {
  pathname: string;
  query: Record<string, string>;
  hash: string;
}

export function parsePattern(pattern: string): RouteSegment[] {
  if (pattern === '/') return [];
  const parts = pattern.split('/').filter(Boolean);
  return parts.map(p => {
    if (p.startsWith(':')) return { type: 'param', name: p.slice(1) };
    if (p.startsWith('*')) return { type: 'splat', name: p.slice(1) || 'rest' };
    return { type: 'static', value: p };
  });
}

export function matchURL(
  pathname: string,
  routes: { name: string; pattern: string }[],
): RouteMatch | null {
  const pathParts = pathname === '/' ? [] : pathname.split('/').filter(Boolean);

  for (const route of routes) {
    const segments = parsePattern(route.pattern);
    const params: Record<string, string> = {};
    let matched = true;
    let pi = 0;

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      if (seg.type === 'static') {
        if (pi >= pathParts.length || pathParts[pi] !== seg.value) {
          matched = false;
          break;
        }
        pi++;
      } else if (seg.type === 'param') {
        if (pi >= pathParts.length) {
          matched = false;
          break;
        }
        params[seg.name] = pathParts[pi];
        pi++;
      } else if (seg.type === 'splat') {
        params[seg.name] = pathParts.slice(pi).join('/');
        pi = pathParts.length;
      }
    }

    if (matched && pi === pathParts.length) {
      return { name: route.name, params };
    }
  }

  return null;
}

export function parseURL(url: string): ParsedURL {
  let pathname = url;
  let queryStr = '';
  let hash = '';

  const hashIdx = pathname.indexOf('#');
  if (hashIdx >= 0) {
    hash = pathname.slice(hashIdx + 1);
    pathname = pathname.slice(0, hashIdx);
  }

  const qIdx = pathname.indexOf('?');
  if (qIdx >= 0) {
    queryStr = pathname.slice(qIdx + 1);
    pathname = pathname.slice(0, qIdx);
  }

  const query: Record<string, string> = {};
  if (queryStr) {
    for (const pair of queryStr.split('&')) {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    }
  }

  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  return { pathname, query, hash };
}

export function buildPath(pattern: string, params: Record<string, string>): string {
  if (pattern === '/') return '/';
  const parts = pattern.split('/').filter(Boolean);
  const result = parts.map(p => {
    if (p.startsWith(':')) return encodeURIComponent(params[p.slice(1)] ?? '');
    if (p.startsWith('*')) return params[p.slice(1) || 'rest'] ?? '';
    return p;
  });
  return '/' + result.join('/');
}
