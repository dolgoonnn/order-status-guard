import ts from "typescript";

export interface StatusWrite {
  line: number;
  code: string;
  /** Name of the function or method that contains the write, if any. */
  inside: string | null;
}

function isStatusName(name: ts.PropertyName | ts.Expression): boolean {
  if (ts.isIdentifier(name)) return name.text === "status";
  if (ts.isStringLiteralLike(name)) return name.text === "status";
  if (ts.isComputedPropertyName(name)) return isStatusName(name.expression);
  return false;
}

function isAssignment(node: ts.BinaryExpression): boolean {
  return (
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  );
}

function enclosingName(node: ts.Node): string | null {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      (ts.isMethodDeclaration(parent) || ts.isFunctionDeclaration(parent)) &&
      parent.name
    ) {
      return parent.name.getText();
    }
  }
  return null;
}

/**
 * Finds every place a source file writes a `status` value: an object literal
 * key, or an assignment to `.status` / `["status"]`. It reads the syntax tree,
 * so type casts (`as`, `<T>`, `satisfies`), spacing and comments do not hide a
 * write. It is still a text-level check: a key built at runtime gets past it.
 */
export function findStatusWrites(fileName: string, source: string): StatusWrite[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true);
  const found: StatusWrite[] = [];
  const report = (node: ts.Node): void => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    found.push({
      line: line + 1,
      code: node.getText(file).split("\n")[0] ?? "",
      inside: enclosingName(node),
    });
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
      isStatusName(node.name)
    ) {
      report(node);
    } else if (ts.isBinaryExpression(node) && isAssignment(node)) {
      const left = node.left;
      if (
        (ts.isPropertyAccessExpression(left) && isStatusName(left.name)) ||
        (ts.isElementAccessExpression(left) && isStatusName(left.argumentExpression))
      ) {
        report(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}
