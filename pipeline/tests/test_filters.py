from footnote.dataset import DocInfo
from footnote.filters import DocResolver, spaced


def info(name: str, company: str, period: int, kind: str = "10k") -> DocInfo:
    return DocInfo(doc_name=name, company=company, sector="", doc_type=kind, period=period)


INFOS = [
    info("3M_2018_10K", "3M", 2018),
    info("3M_2019_10K", "3M", 2019),
    info("BESTBUY_2023_10K", "Best Buy", 2023),
    info("BLOCK_2020_10K", "Block", 2020),
    info("JOHNSON_JOHNSON_2022_10K", "Johnson & Johnson", 2022),
    info("AMERICANEXPRESS_2022_10K", "American Express", 2022),
]


def test_spaced_pads_and_splits_on_punctuation():
    assert spaced("3M's capex, FY2018") == " 3m s capex fy2018 "


def test_company_and_year_narrow_to_one_filing():
    r = DocResolver(INFOS).resolve("What is the FY2018 capital expenditure for 3M?")
    assert r.docs == ["3M_2018_10K"] and r.narrowed and r.years == [2018]


def test_company_without_a_year_keeps_all_its_filings():
    r = DocResolver(INFOS).resolve("Is 3M a capital-intensive business?")
    assert r.docs == ["3M_2018_10K", "3M_2019_10K"]


def test_a_year_with_no_filing_does_not_empty_the_set():
    r = DocResolver(INFOS).resolve("How did 3M do in 2031?")
    assert r.docs == ["3M_2018_10K", "3M_2019_10K"]


def test_unrecognised_company_means_every_filing_and_not_narrowed():
    r = DocResolver(INFOS).resolve("Who won the shareholder vote?")
    assert not r.narrowed and r.docs == [i.doc_name for i in INFOS]


def test_names_match_whole_words_only():
    # "3m" must not match inside another token, and "block" inside "blockchain" is not Block Inc.
    assert DocResolver(INFOS).companies_in("about 13mm units of blockchain") == []


def test_two_companies_give_both_candidate_sets():
    r = DocResolver(INFOS).resolve("Compare Best Buy and 3M in FY2018")
    assert set(r.companies) == {"3M", "Best Buy"}


def test_filing_prefix_and_nicknames_are_aliases():
    res = DocResolver(INFOS)
    assert res.companies_in("Is JnJ growing?") == ["Johnson & Johnson"]
    assert res.companies_in("Does AMEX have a good margin?") == ["American Express"]
    assert DocResolver(INFOS, nicknames={}).companies_in("Is JnJ growing?") == []
