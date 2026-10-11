import json

import pytest

from footnote.dataset import DocInfo
from footnote.filters import DocResolver
from footnote.llm.store import Completion
from footnote.retrieve import Corpus
from footnote.tools import FilingTools

PAGES = {
    "ACME_2020_10K": [
        "Acme Corp annual report\nBusiness overview and risk factors",
        "Consolidated statements of income\nRevenue\n$\n1,500\nNet income\n$\n300",
        "Cash flow statement\nPurchases of property, plant and equipment\n(120)",
    ],
    "ACME_2021_10K": [
        "Acme Corp annual report 2021",
        "Consolidated statements of income\nRevenue\n$\n1,800\nNet income\n$\n450",
    ],
    "ZETA_2020_10K": [
        "Zeta Inc annual report",
        "Consolidated statements of income\nRevenue\n$\n900",
    ],
}


def info(name: str, company: str, period: int) -> DocInfo:
    return DocInfo(doc_name=name, company=company, sector="", doc_type="10k", period=period)


@pytest.fixture
def corpus(tmp_path):
    for doc, pages in PAGES.items():
        with (tmp_path / f"{doc}.jsonl").open("w", encoding="utf-8") as f:
            for i, t in enumerate(pages, start=1):
                f.write(json.dumps({"doc": doc, "page": i, "text": t}) + "\n")
    return Corpus(list(PAGES), tmp_path)


@pytest.fixture
def resolver():
    return DocResolver(
        [
            info("ACME_2020_10K", "Acme", 2020),
            info("ACME_2021_10K", "Acme", 2021),
            info("ZETA_2020_10K", "Zeta", 2020),
        ],
        nicknames={},
    )


@pytest.fixture
def tools(corpus, resolver):
    return FilingTools(corpus, resolver, page_chars=200)


class ScriptedChat:
    """Replies from a script, in order; records every prompt it was sent."""

    def __init__(self, replies: list[str]):
        self.replies, self.seen = list(replies), []

    def complete(self, messages, *, max_tokens=512, temperature=0.0, json_mode=False):
        self.seen.append(messages)
        if not self.replies:
            raise AssertionError("the script ran out of replies")
        return Completion(self.replies.pop(0), 100, 20, "fake")


def answer_json(
    text="Revenue was $1,500 million.", quote="Revenue\n$\n1,500", doc="ACME_2020_10K", page=2, **kw
):
    body = {
        "answer": text,
        "numbers_used": ["1,500"],
        "citations": [{"doc": doc, "page": page, "quote": quote}],
        "confidence": "high",
        "refused": False,
    }
    body.update(kw)
    return json.dumps(body)
