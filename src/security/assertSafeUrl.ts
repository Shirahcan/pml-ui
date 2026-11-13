/**
 * A total URL sanitizer for the site renderer's URL sinks (a button `href`, an image `src`, the
 * credentials link). It is the ONE value-sanitizer the closed PSL vocabulary needs: attribute NAMES
 * are already constrained by the primitive schema, but a URL-typed VALUE - authored, bound, or (soon)
 * PSL-computed - can still be a `javascript:` / `data:text/html` payload aimed at a site visitor who
 * never consented to the consultant's script. Bad input yields a safe fallback so a page never blanks.
 *
 * Allowed: `http`, `https`, `mailto`, `tel`, and relative references (path / query / fragment, and
 * protocol-relative `//host`, which just links off-site under the page's own scheme). Rejected:
 * `javascript:`, `data:`, `vbscript:`, `file:`, and any other or unparseable scheme.
 *
 * Obfuscation is handled the way a browser's URL parser does: tab and newline (and other C0 controls +
 * DEL) are dropped from anywhere, so a broken-up scheme like "java<TAB>script:" cannot smuggle a
 * scheme past the check; leading/trailing whitespace is trimmed; then the scheme is read
 * case-insensitively. A LITERAL space inside a scheme is deliberately NOT removed - a browser treats
 * "java script:" as a relative path, not a script URL, so passing it through as relative matches real
 * behavior and never executes.
 */
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/** Drop C0 control chars (0x00-0x1F, incl. tab/newline the URL parser strips anywhere) and DEL (0x7F). */
function stripControls(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code > 0x1f && code !== 0x7f) {
      out += ch;
    }
  }

  return out;
}

/** Returns the URL if safe, else `null` (for a caller that prefers to omit the attribute entirely). */
export function safeUrlOrNull(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const cleaned = stripControls(raw).trim();
  if (cleaned === '') {
    return null;
  }

  // A scheme is `[a-z][a-z0-9+.-]*` immediately before a ':'. If there is one, it must be allow-listed.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
  if (scheme) {
    return ALLOWED_SCHEMES.has(scheme[1].toLowerCase()) ? cleaned : null;
  }

  // No scheme => a relative reference (path/query/fragment) or protocol-relative `//host`. Neither can
  // introduce a script scheme, so it is safe to pass through.
  return cleaned;
}

/** Returns the URL if safe, else `'#'` - a harmless in-page anchor, so the element still renders. */
export function assertSafeUrl(raw: unknown): string {
  return safeUrlOrNull(raw) ?? '#';
}
