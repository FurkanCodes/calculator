#!/usr/bin/env python3
"""Recompute the expected values in calc_test.go with Python's decimal module.

Run from backend/internal/calc (standard library only):

    python3 testdata/reference.py

It reads the rows of TestCalculate and TestCalculateErrors from calc_test.go,
computes each case independently of the Go code, prints the result, and exits
with status 1 if any row's expected value, exact flag or error code differs.

The policy is the one calc implements: 34 significant digits, half-even
rounding, one rounding step, and `exact` is the absence of decimal's Inexact
flag. Each operation is rounded once by the 34-digit context:

- add, subtract, multiply, divide and sqrt: the context's own operation,
  which decimal rounds correctly.
- percentage: the exact product, divided by 100 in the context.
- power: the exact power at a much higher precision, then rounded once in the
  context; 1 divided by it for a negative exponent.

The number rules are applied before the operation, and the range rule after.
"""
import os
import re
import sys
from decimal import Context, Decimal, Inexact, ROUND_HALF_EVEN

PRECISION = 34
P = Context(prec=PRECISION, rounding=ROUND_HALF_EVEN, Emax=10**6, Emin=-10**6, traps=[])
EXACT = Context(prec=200000, rounding=ROUND_HALF_EVEN, Emax=10**7, Emin=-10**7, traps=[])
NUMBER = re.compile(r"^-?[0-9]+(\.[0-9]+)?$")
LOW, HIGH = Decimal("1e-100"), Decimal("1e100")
MAX_EXPONENT = 1000
OPERANDS = {"add": 2, "subtract": 2, "multiply": 2, "divide": 2, "percentage": 2, "power": 2, "sqrt": 1}


class Refused(Exception):
    """A calculation refused with an error code."""


def parse(s):
    if len(s) > 256:
        raise Refused("INPUT_TOO_LARGE")
    if not NUMBER.match(s):
        raise Refused("INVALID_NUMBER")
    d = Decimal(s)
    if d != 0 and len(d.normalize(EXACT).as_tuple().digits) > PRECISION:
        raise Refused("INPUT_TOO_LARGE")
    check_range(d)
    return d


def check_range(d):
    if d != 0 and not (LOW <= d.copy_abs() < HIGH):
        raise Refused("OUT_OF_RANGE")


def rounded(compute):
    """Run one rounding operation in P; return the result and whether it was exact."""
    P.clear_flags()
    result = compute()
    return result, not P.flags[Inexact]


def exact(compute):
    EXACT.clear_flags()
    result = compute()
    assert not EXACT.flags[Inexact], "the exact context was not precise enough"
    return result


def power(a, n):
    if n != n.to_integral_value() or n.copy_abs() > MAX_EXPONENT:
        raise Refused("INVALID_EXPONENT")
    k = int(n)
    if a == 0 and k < 0:
        raise Refused("DIVISION_BY_ZERO")
    if k == 0:
        return Decimal(1), True  # 0^0 is 1 by the spec; decimal calls it undefined
    p = exact(lambda: EXACT.power(a, abs(k)))
    if k > 0:
        return rounded(lambda: P.plus(p))
    return rounded(lambda: P.divide(Decimal(1), p))


def divide(a, b):
    if b == 0:
        raise Refused("DIVISION_BY_ZERO")
    return rounded(lambda: P.divide(a, b))


def sqrt(x):
    if x < 0:
        raise Refused("NEGATIVE_SQUARE_ROOT")
    return rounded(lambda: P.sqrt(x))


OPERATIONS = {
    "add": lambda a, b: rounded(lambda: P.add(a, b)),
    "subtract": lambda a, b: rounded(lambda: P.subtract(a, b)),
    "multiply": lambda a, b: rounded(lambda: P.multiply(a, b)),
    "divide": divide,
    "percentage": lambda a, b: rounded(lambda: P.divide(exact(lambda: EXACT.multiply(a, b)), Decimal(100))),
    "power": power,
    "sqrt": sqrt,
}


def calculate(operation, operands):
    """Return ("ok", value, exact) or ("error", code)."""
    try:
        if operation not in OPERATIONS:
            raise Refused("UNSUPPORTED_OPERATION")
        if len(operands) != OPERANDS[operation]:
            raise Refused("WRONG_OPERAND_COUNT")
        args = [parse(s) for s in operands]
        value, is_exact = OPERATIONS[operation](*args)
        check_range(value)
        return ("ok", plain(value), is_exact)
    except Refused as refused:
        return ("error", str(refused))


def plain(d):
    """Format d the way calc does: plain digits, no exponent, no trailing zeros."""
    return "0" if d == 0 else format(d.normalize(EXACT), "f")


# --- Reading the Go tables -------------------------------------------------

GO_VARIABLES = {}  # filled from the var block in calc_test.go
TOKEN = re.compile(r'\s*(?:("[^"]*")|([A-Za-z_][\w.]*)|(\d+)|([(),+{}]))')


def tokens(text):
    pos, out = 0, []
    while pos < len(text):
        m = TOKEN.match(text, pos)
        if not m or m.end() == pos:
            if text[pos:].strip() == "":
                break
            raise ValueError(f"cannot read Go expression at {text[pos:pos + 40]!r}")
        out.append(next(g for g in m.groups() if g is not None))
        pos = m.end()
    return out


def go_string(toks, i):
    """Evaluate a Go string expression of literals, zeros(n), strings.Repeat(s, n)
    and the test's helper variables, joined by +. Return the value and next index."""
    parts = []
    while True:
        t = toks[i]
        if t.startswith('"'):
            parts.append(t[1:-1])
            i += 1
        elif t == "zeros":
            parts.append("0" * int(toks[i + 2]))
            i += 4
        elif t == "strings.Repeat":
            parts.append(toks[i + 2][1:-1] * int(toks[i + 4]))
            i += 6
        elif t in GO_VARIABLES:
            parts.append(GO_VARIABLES[t])
            i += 1
        else:
            raise ValueError(f"unexpected token {t!r}")
        if i < len(toks) and toks[i] == "+":
            i += 1
            continue
        return "".join(parts), i


def go_strings(text):
    """Evaluate a comma-separated list of Go string expressions."""
    toks, values, i = tokens(text), [], 0
    while i < len(toks):
        value, i = go_string(toks, i)
        values.append(value)
        if i < len(toks) and toks[i] == ",":
            i += 1
    return values


def code_constant(name):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).upper()


ROW = re.compile(
    r'\{"(?P<name>[^"]*)",\s*"(?P<op>[^"]*)",\s*(?:nil|\[\]string\{(?P<operands>.*?)\}),\s*'
    r'(?:Result\{(?P<value>.*?),\s*(?P<exact>true|false)\}|(?P<code>[A-Z]\w*))\},',
    re.S,
)


def table(source, test_name):
    start = source.index(f"func {test_name}(t *testing.T)")
    end = source.index("for _, tt := range tests", start)
    return ROW.finditer(source[start:end])


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    source = open(os.path.join(here, "..", "calc_test.go"), encoding="utf-8").read()
    var_block = source[source.index("var (") : source.index(")\n", source.index("var ("))]
    for name, expr in re.findall(r"^\s*(\w+)\s*=\s*(.+?)\s*(?://.*)?$", var_block, re.M):
        GO_VARIABLES[name] = go_strings(expr)[0]

    rows = 0
    mismatches = 0
    for test_name in ("TestCalculate", "TestCalculateErrors"):
        for row in table(source, test_name):
            rows += 1
            operands = go_strings(row["operands"]) if row["operands"] else []
            got = calculate(row["op"], operands)
            if row["code"]:
                want = ("error", code_constant(row["code"]))
            else:
                want = ("ok", go_strings(row["value"])[0], row["exact"] == "true")
            status = "ok      " if got == want else "MISMATCH"
            if got != want:
                mismatches += 1
            shown = got[1] if len(got[1]) <= 60 else got[1][:57] + "..."
            extra = f" exact={got[2]}" if got[0] == "ok" else ""
            print(f"{status} {row['op']:<10} {row['name']}: {got[0]} {shown}{extra}")
            if got != want:
                print(f"         Go table expects {want}")
    print(f"\n{rows} cases, {mismatches} mismatches")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
