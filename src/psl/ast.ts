/**
 * The PSL AST - the typed mirror of the AST-JSON contract that the PHP parser emits and this TS
 * evaluator consumes. See `backend/resources/psl/conformance/README.md` for the canonical shape.
 *
 * This file is TYPES ONLY - zero runtime code, so importing it cannot affect the bundle. The
 * evaluator narrows on `node.type`; a parity test asserts every `type` produced by the PHP side is
 * a member of this union, catching cross-language drift.
 */

/** Every node carries its source position (for diagnostics that point back at the author's code). */
export interface Pos {
  line: number;
  col: number;
}

export type TypeName = 'number' | 'string' | 'boolean' | 'list' | 'map' | 'any';

export interface NumberLit extends Pos {
  type: 'NumberLit';
  /** Canonical decimal as a string, so no float ever touches the value. */
  value: string;
}

export interface StringLit extends Pos {
  type: 'StringLit';
  value: string;
}

export interface BoolLit extends Pos {
  type: 'BoolLit';
  value: boolean;
}

export interface NullLit extends Pos {
  type: 'NullLit';
}

export interface ListLit extends Pos {
  type: 'ListLit';
  elements: Node[];
}

export interface MapEntry {
  key: string;
  value: Node;
}

export interface MapLit extends Pos {
  type: 'MapLit';
  entries: MapEntry[];
}

export interface Identifier extends Pos {
  type: 'Identifier';
  name: string;
}

export interface Unary extends Pos {
  type: 'Unary';
  op: '!' | '-';
  operand: Node;
}

export interface Binary extends Pos {
  type: 'Binary';
  op: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';
  left: Node;
  right: Node;
}

export interface Ternary extends Pos {
  type: 'Ternary';
  cond: Node;
  then: Node;
  else: Node;
}

/** target is Identifier | Member | Index (assignable l-values). */
export interface Assign extends Pos {
  type: 'Assign';
  op: '=' | '+=' | '-=' | '*=' | '/=';
  target: Node;
  value: Node;
}

/** A prefix or postfix increment/decrement (++x / x++). operand is Identifier | Member | Index. */
export interface Update extends Pos {
  type: 'Update';
  op: '++' | '--';
  operand: Node;
  prefix: boolean;
}

export interface Call extends Pos {
  type: 'Call';
  callee: Node;
  args: Node[];
}

export interface Member extends Pos {
  type: 'Member';
  object: Node;
  name: string;
}

export interface Index extends Pos {
  type: 'Index';
  object: Node;
  index: Node;
}

export interface Param {
  name: string;
  paramType: TypeName | null;
}

export interface FuncExpr extends Pos {
  type: 'FuncExpr';
  params: Param[];
  returnType: TypeName | null;
  body: Block;
}

export interface VarDecl extends Pos {
  type: 'VarDecl';
  kind: 'const' | 'let';
  name: string;
  varType: TypeName | null;
  init: Node | null;
}

export interface FuncDecl extends Pos {
  type: 'FuncDecl';
  name: string;
  params: Param[];
  returnType: TypeName | null;
  body: Block;
}

export interface Block extends Pos {
  type: 'Block';
  body: Node[];
}

export interface IfBranch {
  /** null on the trailing `else` branch. */
  cond: Node | null;
  body: Block;
}

export interface If extends Pos {
  type: 'If';
  branches: IfBranch[];
}

export interface For extends Pos {
  type: 'For';
  itemVar: string;
  /** present for `for (k, v in map)`. */
  keyVar: string | null;
  iterable: Node;
  body: Block;
}

export interface While extends Pos {
  type: 'While';
  cond: Node;
  body: Block;
}

export interface Return extends Pos {
  type: 'Return';
  value: Node | null;
}

export interface Break extends Pos {
  type: 'Break';
}

export interface Continue extends Pos {
  type: 'Continue';
}

export interface Program extends Pos {
  type: 'Program';
  body: Node[];
}

export type Node =
  | NumberLit
  | StringLit
  | BoolLit
  | NullLit
  | ListLit
  | MapLit
  | Identifier
  | Unary
  | Binary
  | Ternary
  | Assign
  | Update
  | Call
  | Member
  | Index
  | FuncExpr
  | VarDecl
  | FuncDecl
  | Block
  | If
  | For
  | While
  | Return
  | Break
  | Continue
  | Program;

/** Every node `type` string - the parity test checks the PHP side emits only these. */
export const NODE_TYPES = [
  'NumberLit',
  'StringLit',
  'BoolLit',
  'NullLit',
  'ListLit',
  'MapLit',
  'Identifier',
  'Unary',
  'Binary',
  'Ternary',
  'Assign',
  'Update',
  'Call',
  'Member',
  'Index',
  'FuncExpr',
  'VarDecl',
  'FuncDecl',
  'Block',
  'If',
  'For',
  'While',
  'Return',
  'Break',
  'Continue',
  'Program',
] as const;
