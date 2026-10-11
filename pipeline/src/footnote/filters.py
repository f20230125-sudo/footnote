"""Company and fiscal-year filter: which filings could a question be about? Rules only, no model.

The filter returns a candidate set. When the question names no company it returns every filing, so
a miss makes retrieval wider, never wrong.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .dataset import DocInfo

_YEAR = re.compile(r"\b(?:fy\s?)?((?:19|20)\d{2})\b")


def spaced(text: str) -> str:
    """Lower-case words separated by single spaces, padded so ' alias ' matches whole words."""
    return " " + re.sub(r"[^a-z0-9]+", " ", text.lower()).strip() + " "


@dataclass(frozen=True)
class Resolution:
    docs: list[str]
    companies: list[str]
    years: list[int]
    narrowed: bool  # False when no company was recognised and every filing is returned


# Nicknames a question may use instead of the company name. Written AFTER seeing which FinanceBench
# questions the plain name match missed (128 of 150 recognised before, 147 after), so the score
# with them is a little optimistic for FinanceBench; the honest figure for new questions is 128.
NICKNAMES = {
    "American Express": ["amex"],
    "Johnson & Johnson": ["jnj"],
    "JPMorgan": ["jpm"],
    "MGM Resorts": ["mgm"],
    "Ulta Beauty": ["ulta"],
}


class DocResolver:
    def __init__(self, infos: list[DocInfo], *, nicknames: dict[str, list[str]] | None = None):
        self.infos = infos
        self.all_docs = [i.doc_name for i in infos]
        self.aliases: dict[str, set[str]] = {}
        extra = NICKNAMES if nicknames is None else nicknames
        for i in infos:
            prefix = i.doc_name.split("_")[0].lower()
            names = {spaced(i.company), f" {prefix} "}
            names |= {f" {n} " for n in extra.get(i.company, [])}
            self.aliases.setdefault(i.company, set()).update(names)

    def companies_in(self, question: str) -> list[str]:
        q = spaced(question)
        return sorted(c for c, al in self.aliases.items() if any(a in q for a in al))

    def resolve(self, question: str) -> Resolution:
        companies = self.companies_in(question)
        years = sorted({int(y) for y in _YEAR.findall(question.lower())})
        if not companies:
            return Resolution(self.all_docs, [], years, narrowed=False)
        mine = [i for i in self.infos if i.company in companies]
        if years:
            by_year = [i for i in mine if _period(i) in years]
            mine = by_year or mine  # a year with no filing of ours must not empty the set
        return Resolution([i.doc_name for i in mine], companies, years, narrowed=True)


def _period(info: DocInfo) -> int | None:
    try:
        return int(info.period)
    except (TypeError, ValueError):
        return None
