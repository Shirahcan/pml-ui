import { diagnosticRect, type PmlDiagnostic } from '../../src/pml/diagnostics';

const metrics = { charW: 8, lineH: 20, padL: 56, padT: 12 };

const diag = (over: Partial<PmlDiagnostic>): PmlDiagnostic => ({
  severity: 'error',
  message: 'x',
  line: 1,
  col: 1,
  source: 'compile',
  ...over,
});

describe('diagnosticRect', () => {
  it('maps the first line/col to the padding origin, one char wide', () => {
    expect(diagnosticRect(diag({ line: 1, col: 1 }), metrics)).toEqual({ left: 56, top: 12, width: 8 });
  });

  it('offsets left by (col-1)*charW and top by (line-1)*lineH', () => {
    // left = 56 + (5-1)*8 = 88; top = 12 + (3-1)*20 = 52
    expect(diagnosticRect(diag({ line: 3, col: 5 }), metrics)).toEqual({ left: 88, top: 52, width: 8 });
  });

  it('spans the underline from col to endCol', () => {
    // width = (7-2)*8 = 40
    expect(diagnosticRect(diag({ col: 2, endCol: 7 }), metrics).width).toBe(40);
  });

  it('never produces a zero-width underline', () => {
    // endCol === col -> max(1, 0) = 1 char
    expect(diagnosticRect(diag({ col: 5, endCol: 5 }), metrics).width).toBe(8);
  });
});
