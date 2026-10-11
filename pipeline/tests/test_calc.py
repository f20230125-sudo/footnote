import pytest

from footnote.calc import CalcError, calculate


@pytest.mark.parametrize(
    ("expr", "want"),
    [
        ("1 + 2 * 3", 7),
        ("(1577 - 1488) / 1488", (1577 - 1488) / 1488),
        ("$1,577 + $2,000", 3577),
        ("12% * 200", 24),
        ("-5 + +3", -2),
        ("2 ** 10", 1024),
        ("round(10 / 3, 2)", 3.33),
        ("max(3, 9, 4) - min(3, 9, 4)", 6),
        ("7 // 2 + 7 % 2", 4),
        ("abs(-4.5)", 4.5),
    ],
)
def test_arithmetic(expr, want):
    assert calculate(expr) == pytest.approx(want)


@pytest.mark.parametrize(
    "expr",
    [
        "__import__('os').system('echo hi')",
        "open('x')",
        "().__class__",
        "[1, 2][0]",
        "(lambda: 1)()",
        "a + 1",
        "x = 3",
        "1; 2",
        "'a' * 3",
        "pow(2, 3)",
        "round(5, ndigits=1)",
        "True + 1",
        "2 ** 1000",
        "9 ** 9 ** 9",
        "1 / 0",
        "(-8) ** 0.5",
        "1e308 * 10",
        "",
        "1 + " + "1 + " * 200 + "1",
    ],
)
def test_everything_else_is_refused(expr):
    with pytest.raises(CalcError):
        calculate(expr)


def test_thousands_commas_only_in_numbers():
    # max(1, 2) keeps its comma: only a comma between digit groups of three is a separator
    assert calculate("max(1, 2)") == 2
    assert calculate("1,000 + 1") == 1001
