"""The four tools, defined once. The agent calls them in-process and the MCP server exposes the same
functions, so what Claude Desktop sees is exactly what the evaluated agent used.

Page text is untrusted: a filing could contain text written to look like an instruction. It is only
ever returned as a JSON string field named `text`, and the prompts say to treat it as data.
"""

from __future__ import annotations

import re
from typing import Any

from .calc import CalcError, calculate
from .filters import DocResolver
from .retrieve import Corpus

TOOL_DOCS = {
    "list_filings": "list_filings(company: str | null) -> filings (doc id, company, period, type)",
    "search_filings": (
        "search_filings(query: str, doc: str | null, k: int = 5) -> best pages with a short "
        "preview; `doc` limits the search to one filing id from list_filings"
    ),
    "get_page": "get_page(doc: str, page: int) -> the full text of one page (1-based)",
    "calculate": "calculate(expression: str) -> number; arithmetic only, e.g. (1577 - 1488) / 1488",
}


def _preview(text: str, n: int = 220) -> str:
    return re.sub(r"\s+", " ", text).strip()[:n]


class FilingTools:
    def __init__(
        self,
        corpus: Corpus,
        resolver: DocResolver,
        *,
        page_chars: int = 4500,
        use_filter: bool = True,
    ):
        self.corpus, self.resolver = corpus, resolver
        self.page_chars, self.use_filter = page_chars, use_filter
        self.restrict: list[str] | None = None  # the oracle setting pins searches to one filing
        self.infos = {i.doc_name: i for i in resolver.infos}

    def list_filings(self, company: str | None = None) -> dict[str, Any]:
        rows = [
            {"doc": i.doc_name, "company": i.company, "period": i.period, "type": i.doc_type}
            for i in self.infos.values()
            if company is None or spaced_in(company, i.company, i.doc_name)
        ]
        return {"filings": rows[:40], "truncated": len(rows) > 40}

    def search_filings(self, query: str, doc: str | None = None, k: int = 5) -> dict[str, Any]:
        k = max(1, min(int(k), 8))
        if doc is not None and doc not in self.corpus.by_doc:
            return {"error": f"unknown filing {doc!r}; use list_filings"}
        if doc is not None:
            docs: list[str] | None = [doc]
        elif self.restrict is not None:
            docs = self.restrict
        elif self.use_filter:
            res = self.resolver.resolve(query)
            docs = res.docs if res.narrowed else None
        else:
            docs = None
        hits = self.corpus.search(query, k, docs=docs)
        return {
            "results": [
                {
                    "doc": d,
                    "page": p,
                    "score": round(s, 2),
                    "preview": _preview(self.corpus.page(d, p).text),  # type: ignore[union-attr]
                }
                for (d, p), s in hits
            ]
        }

    def get_page(self, doc: str, page: int) -> dict[str, Any]:
        pg = self.corpus.page(doc, int(page))
        if pg is None:
            return {"error": f"no page {page} in {doc!r}"}
        text = pg.text.strip()
        return {
            "doc": doc,
            "page": pg.page,
            "text": text[: self.page_chars],
            "truncated": len(text) > self.page_chars,
        }

    def calculate(self, expression: str) -> dict[str, Any]:
        try:
            return {"value": calculate(expression)}
        except CalcError as e:
            return {"error": str(e)}

    def call(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Run a tool by name. Bad names and arguments come back as an error the model can read."""
        if name not in TOOL_DOCS:
            return {"error": f"unknown tool {name!r}; tools are {', '.join(TOOL_DOCS)}"}
        try:
            return getattr(self, name)(**args)
        except TypeError as e:
            return {"error": f"bad arguments for {name}: {e}"}
        except (ValueError, KeyError) as e:
            return {"error": f"bad arguments for {name}: {e}"}


def spaced_in(needle: str, *haystacks: str) -> bool:
    n = re.sub(r"[^a-z0-9]+", "", needle.lower())
    return bool(n) and any(n in re.sub(r"[^a-z0-9]+", "", h.lower()) for h in haystacks)
