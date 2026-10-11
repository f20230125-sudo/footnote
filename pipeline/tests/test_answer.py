import json

import pytest

from conftest import answer_json
from footnote.answer import Answer, AnswerError, check_grounding, parse_answer


def test_a_valid_answer_parses_and_fenced_json_is_accepted():
    a = parse_answer(answer_json())
    assert a.citations[0].page == 2 and not a.refused
    assert parse_answer("```json\n" + answer_json() + "\n```").answer.startswith("Revenue")


def test_the_agent_wrapper_is_unwrapped():
    wrapped = json.dumps({"action": "finish", "answer": json.loads(answer_json())})
    assert parse_answer(wrapped).citations[0].doc == "ACME_2020_10K"


def test_bad_json_and_bad_shapes_give_a_message_for_the_model():
    with pytest.raises(AnswerError, match="not valid JSON"):
        parse_answer("The answer is 1,500")
    with pytest.raises(AnswerError, match="cite at least one page"):
        parse_answer(json.dumps({"answer": "1,500", "citations": []}))
    with pytest.raises(AnswerError, match="page"):
        parse_answer(answer_json(page=0))
    with pytest.raises(AnswerError, match="empty"):
        parse_answer(json.dumps({"answer": "  ", "refused": True}))


def test_a_refusal_needs_no_citation():
    a = parse_answer(json.dumps({"answer": "Not in the filings.", "refused": True}))
    assert a.refused and a.citations == []


def test_grounding_ignores_whitespace_dollar_signs_commas_and_case(corpus):
    a = parse_answer(answer_json(quote="REVENUE $1500 net income"))
    # "Revenue\n$\n1,500\nNet income" on the page
    assert check_grounding(a, corpus).ok


def test_a_paraphrase_is_not_grounded(corpus):
    a = parse_answer(answer_json(quote="Total sales were 1,500 million dollars"))
    g = check_grounding(a, corpus)
    assert not g.ok and "not found" in g.issues[0]


def test_a_wrong_page_or_filing_is_not_grounded(corpus):
    assert not check_grounding(parse_answer(answer_json(page=1)), corpus).ok
    assert "does not exist" in check_grounding(parse_answer(answer_json(page=9)), corpus).issues[0]
    assert not check_grounding(parse_answer(answer_json(doc="ZETA_2020_10K")), corpus).ok


def test_ellipsis_quotes_check_each_part(corpus):
    ok = parse_answer(answer_json(quote="Consolidated statements ... Net income $ 300"))
    assert check_grounding(ok, corpus).ok
    bad = parse_answer(answer_json(quote="Consolidated statements ... Net income $ 999"))
    assert not check_grounding(bad, corpus).ok


def test_a_quote_too_short_to_mean_anything_is_not_accepted(corpus):
    a = parse_answer(answer_json(quote="1,5"))
    assert not check_grounding(a, corpus).ok


def test_answer_model_rejects_unknown_confidence():
    with pytest.raises(Exception):  # noqa: B017
        Answer(answer="x", confidence="certain", refused=True)  # type: ignore[arg-type]
