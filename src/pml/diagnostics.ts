import { useEffect, useRef, useState } from 'react';


/**
 * One located problem in the Code view, as returned by the diagnose-pml endpoint (1-based line/col).
 * `source` says which pass found it: a PSL `<script>` error, a PML tag `syntax` error, a
 * primitive/vocabulary `compile` error, or `advice` (structure + accessibility suggestions). `endCol` (when present) is the end of the underline span.
 */
export type PmlDiagnostic = {
  severity: 'error' | 'warning';
  message: string;
  line: number;
  col: number;
  endCol?: number;
  /** `advice` (S1-03): structure + accessibility suggestions, always warnings, never blocking. */
  source: 'psl' | 'syntax' | 'compile' | 'advice';
};

/** The monospace geometry the editor measures once, so a (line, col) maps to a pixel rect. */
/**
 * The one call the diagnostics hook makes, supplied by the host (E1: the package never calls a product's API
 * itself). Portify passes its site-builder API, which already has this method.
 */
export interface PmlDiagnosticsApi {
  diagnosePml(pageId: string, source: string): Promise<{ diagnostics: PmlDiagnostic[] }>;
}

export interface DiagnosticMetrics {
  /** Width of one character in the editor's mono font. */
  charW: number;
  /** Height of one line. */
  lineH: number;
  /** Left padding before the text column (gutter + gap). */
  padL: number;
  /** Top padding before the first line. */
  padT: number;
}

/**
 * Map a diagnostic's (line, col) to a pixel rect in the text layer's own coordinate space. The
 * caller subtracts the current scroll offset to place it in the viewport. No-wrap is assumed (the
 * editor is horizontal-scroll, established by the highlighter), so col -> x is linear in charW.
 */
export function diagnosticRect(
  d: PmlDiagnostic,
  m: DiagnosticMetrics,
): { left: number; top: number; width: number } {
  const left = m.padL + (d.col - 1) * m.charW;
  const top = m.padT + (d.line - 1) * m.lineH;
  const endCol = d.endCol ?? d.col + 1;
  const width = Math.max(1, endCol - d.col) * m.charW;

  return { left, top, width };
}

/**
 * Fetch located diagnostics for the current buffer on a debounce. It NEVER throws and never blocks
 * typing: a failed request (or the feature being disabled) just yields an empty list, so the
 * squiggles quietly vanish. A monotonically increasing request id drops stale responses, so a slow
 * earlier request can never overwrite the diagnostics of a newer keystroke.
 */
export function usePmlDiagnostics(
  api: PmlDiagnosticsApi,
  pageId: string,
  source: string,
  enabled: boolean,
): { diagnostics: PmlDiagnostic[]; loading: boolean } {
  const [diagnostics, setDiagnostics] = useState<PmlDiagnostic[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  // Disabled means no squiggles: dropped during render against the last-seen flag, not in an effect.
  const [wasEnabled, setWasEnabled] = useState(enabled);

  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);

    if (!enabled) {
      setDiagnostics([]);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handle = setTimeout(() => {
      const myReq = ++reqIdRef.current;
      setLoading(true);

      api.diagnosePml(pageId, source)
        .then((res) => {
          if (myReq !== reqIdRef.current) return; // a newer request has superseded this one
          setDiagnostics(Array.isArray(res?.diagnostics) ? res.diagnostics : []);
        })
        .catch(() => {
          if (myReq !== reqIdRef.current) return;
          setDiagnostics([]); // diagnostics are advisory; never surface a failure to the editor
        })
        .finally(() => {
          if (myReq === reqIdRef.current) setLoading(false);
        });
    }, 400);

    return () => clearTimeout(handle);
  }, [api, pageId, source, enabled]);

  return { diagnostics, loading };
}
