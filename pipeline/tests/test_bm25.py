from footnote.bm25 import BM25, tokenize


def test_numbers_ignore_thousands_commas():
    assert tokenize("Capex was $1,577 million") == ["capex", "was", "1577", "million"]
    assert tokenize("margin 12.5%") == ["margin", "12.5"]


def test_sentence_final_comma_does_not_join_numbers():
    assert tokenize("in 2018, sales rose") == ["in", "2018", "sales", "rose"]


def test_rare_term_outranks_common_term():
    docs = [
        tokenize(t)
        for t in [
            "the cash flow statement",
            "the the the",
            "goodwill impairment charge",
            "the cash",
        ]
    ]
    idx = BM25(docs)
    assert idx.top(tokenize("goodwill"), 1)[0][0] == 2


def test_allowed_restricts_the_search():
    docs = [tokenize("revenue revenue"), tokenize("revenue"), tokenize("other")]
    idx = BM25(docs)
    assert [i for i, _ in idx.top(tokenize("revenue"), 5)] == [0, 1]
    assert [i for i, _ in idx.top(tokenize("revenue"), 5, allowed={1})] == [1]


def test_ties_break_by_position_so_runs_repeat():
    docs = [tokenize("alpha beta"), tokenize("alpha beta")]
    idx = BM25(docs)
    assert [i for i, _ in idx.top(tokenize("alpha"), 2)] == [0, 1]


def test_empty_query_and_unknown_terms_score_nothing():
    idx = BM25([tokenize("alpha")])
    assert idx.top([], 3) == []
    assert idx.top(tokenize("zzz"), 3) == []
