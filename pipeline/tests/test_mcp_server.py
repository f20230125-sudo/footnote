import asyncio
import json

from mcp import Client

from footnote.mcp_server import build_server


def payload(result) -> dict:
    """The tool's returned dict, whichever way this SDK version carries it."""
    sc = getattr(result, "structured_content", None) or getattr(result, "structuredContent", None)
    if sc:
        return sc.get("result", sc) if isinstance(sc, dict) and set(sc) == {"result"} else sc
    return json.loads(result.content[0].text)


def test_the_server_lists_exactly_the_four_read_only_tools(tools):
    async def go():
        async with Client(build_server(tools)) as c:
            return (await c.list_tools()).tools

    listed = asyncio.run(go())
    assert sorted(t.name for t in listed) == [
        "calculate",
        "get_page",
        "list_filings",
        "search_filings",
    ]
    assert all(t.annotations and t.annotations.read_only_hint for t in listed)


def test_tools_return_what_the_agents_tools_return(tools):
    async def go():
        async with Client(build_server(tools)) as c:
            calc = await c.call_tool("calculate", {"expression": "1,800 - 1,500"})
            page = await c.call_tool("get_page", {"doc": "ACME_2021_10K", "page": 2})
            hits = await c.call_tool("search_filings", {"query": "Acme revenue 2021"})
            bad = await c.call_tool("calculate", {"expression": "__import__('os')"})
            return calc, page, hits, bad

    calc, page, hits, bad = (payload(r) for r in asyncio.run(go()))
    assert calc["value"] == 300
    assert page["doc"] == "ACME_2021_10K" and "Revenue" in page["text"]
    assert {r["doc"] for r in hits["results"]} == {"ACME_2021_10K"}
    assert "error" in bad
