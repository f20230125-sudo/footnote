"""Arithmetic for the agent. Parses with `ast` and walks only a whitelist of node types: numbers,
+ - * / // % **, unary signs, parentheses, and abs/round/min/max. No names, attributes, subscripts,
other calls ever reach evaluation, and `eval` is never used.
"""

from __future__ import annotations

import ast
import math
import operator
import re

MAX_EXPONENT = 64
MAX_MAGNITUDE = 1e30
MAX_LENGTH = 300

_BIN = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCS = {"abs": abs, "round": round, "min": min, "max": max}


class CalcError(ValueError):
    pass


def _clean(expression: str) -> str:
    """Models write money the way filings do: $1,577 and 12%. Make that plain arithmetic."""
    s = expression.strip().replace("$", "").replace("−", "-")
    s = re.sub(r"(?<=\d),(?=\d{3}\b)", "", s)  # thousands separators only
    # "12%" is a percent; "7 % 2" is a remainder. A percent sign has no operand after it.
    s = re.sub(r"(\d+(?:\.\d+)?)\s*%(?!\s*[\d(.])", r"(\1/100)", s)
    return s


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _UNARY[type(node.op)](_eval(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
        a, b = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(b) > MAX_EXPONENT:
            raise CalcError("exponent too large")
        try:
            out = _BIN[type(node.op)](a, b)
        except ZeroDivisionError:
            raise CalcError("division by zero") from None
        if isinstance(out, complex):
            raise CalcError("result is not a real number")
        return out
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in _FUNCS
        and not node.keywords
    ):
        args = [_eval(a) for a in node.args]
        try:
            return _FUNCS[node.func.id](*args)
        except (TypeError, ValueError) as e:
            raise CalcError(f"bad call to {node.func.id}: {e}") from None
    raise CalcError(f"not allowed: {type(node).__name__}")


def calculate(expression: str) -> float:
    s = _clean(expression)
    if not s or len(s) > MAX_LENGTH:
        raise CalcError("empty or too long")
    try:
        tree = ast.parse(s, mode="eval")
    except SyntaxError:
        raise CalcError("not an arithmetic expression") from None
    value = _eval(tree)
    if not math.isfinite(value) or abs(value) > MAX_MAGNITUDE:
        raise CalcError("result out of range")
    return value
