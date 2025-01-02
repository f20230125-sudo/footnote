import json

from footnote.dataset import DATASET_PAGE_OFFSET, Evidence, Question, load_questions
from footnote.evals.retrieval import score
from footnote.retrieve import Corpus


def q(qid: str, gold: list[tuple[str, int]], doc: str = "A") -> Question:
    return Question(
        id=qid,
        company="X",
        doc_name=doc,
        question_type="t",
        reasoning=None,
        question="?",
        answer="",
        justification="",
        evidence=[Evidence(doc_name=d, page=p, text="") for d, p in gold],
    )


def test_scoring_maths():
    qs = [q("1", [("A", 3)]), q("2", [("A", 1), ("A", 2)]), q("3", [("A", 9)])]
    ranked = {
        "1": [("A", 3), ("A", 4)],  # first gold page at rank 1
        "2": [("A", 5), ("A", 2), ("A", 1)],  # first gold at rank 2, both within the top 3
        "3": [("A", 1)],  # miss
    }
    s = score(qs, lambda x: ranked[x.id])
    assert s.n == 3
    assert s.hit_at[1] == 1 / 3
    assert s.hit_at[3] == 2 / 3
    assert s.all_at[1] == 1 / 3  # only question 1 has all its gold pages at rank 1
    assert s.all_at[3] == 2 / 3  # question 2 has both gold pages by rank 3
    assert abs(s.mrr - (1 + 0.5 + 0) / 3) < 1e-9


def test_a_page_in_the_wrong_filing_is_not_a_hit():
    s = score([q("1", [("A", 3)])], lambda x: [("B", 3)])
    assert s.hit_at[10] == 0


def test_doc_hit_counts_the_filing_even_when_the_page_is_wrong():
    s = score([q("1", [("A", 3)])], lambda x: [("A", 4)])
    assert s.hit_at[1] == 0 and s.doc_hit_at[1] == 1


def test_dataset_pages_become_one_based(tmp_path):
    (tmp_path / "data").mkdir()
    rec = {
        "financebench_id": "x",
        "company": "C",
        "doc_name": "C_2020_10K",
        "question_type": "t",
        "question": "?",
        "answer": "a",
        "justification": "j",
        "evidence": [{"doc_name": "C_2020_10K", "evidence_page_num": 0, "evidence_text": "t"}],
    }
    (tmp_path / "data" / "financebench_open_source.jsonl").write_text(
        json.dumps(rec) + "\n", encoding="utf-8"
    )
    [loaded] = load_questions(tmp_path)
    assert loaded.evidence[0].page == 0 + DATASET_PAGE_OFFSET == 1


def test_corpus_search_can_be_restricted_to_one_filing(tmp_path):
    for doc, pages in {"A": ["alpha one", "beta two"], "B": ["alpha alpha"]}.items():
        with (tmp_path / f"{doc}.jsonl").open("w", encoding="utf-8") as f:
            for i, t in enumerate(pages, start=1):
                f.write(json.dumps({"doc": doc, "page": i, "text": t}) + "\n")
    c = Corpus(["A", "B"], tmp_path)
    assert c.search("alpha", 5)[0][0] == ("B", 1)
    assert [h for h, _ in c.search("alpha", 5, doc="A")] == [("A", 1)]
    assert c.page("A", 2).text == "beta two"
    assert c.page("A", 3) is None
