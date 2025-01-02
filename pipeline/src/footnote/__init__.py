"""Footnote: a filings analyst scored on FinanceBench."""

from pathlib import Path

# pipeline/src/footnote/__init__.py: parents[2] is `pipeline`, parents[3] is the repository root.
ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data"
FINANCEBENCH = DATA / "financebench"
PAGES = DATA / "pages"
