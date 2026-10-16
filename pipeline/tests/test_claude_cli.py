import json
from types import SimpleNamespace

import pytest

from footnote.llm.claude_cli import ClaudeCLI
from footnote.llm.providers import ProviderError, RateLimited
from footnote.llm.store import Completion, Store


def cli(monkeypatch, response):
    monkeypatch.setattr("shutil.which", lambda _: "claude.exe")
    captured = {}

    def run(args, **kwargs):
        captured.update(args=args, **kwargs)
        return SimpleNamespace(stdout=json.dumps(response), returncode=0)

    monkeypatch.setattr("subprocess.run", run)
    return ClaudeCLI(), captured


def test_cli_disables_tools_customizations_and_sessions_and_passes_input_on_stdin(monkeypatch):
    provider, captured = cli(
        monkeypatch,
        {
            "result": '{"ok":true}',
            "usage": {
                "input_tokens": 10,
                "cache_read_input_tokens": 20,
                "cache_creation_input_tokens": 5,
                "output_tokens": 3,
            },
            "modelUsage": {"resolved-model": {}},
            "total_cost_usd": 0.02,
        },
    )
    result = provider.chat(
        "sonnet",
        [
            {"role": "system", "content": "Only JSON"},
            {"role": "user", "content": "a shell-looking $(command)"},
        ],
        max_tokens=50,
        temperature=0,
        json_mode=True,
    )
    args = captured["args"]
    assert args[args.index("--tools") + 1] == ""
    assert "--safe-mode" in args and "--no-session-persistence" in args
    assert "$(command)" in captured["input"] and not captured.get("shell")
    assert result.model == "resolved-model" and result.prompt_tokens == 35
    assert result.cost_usd == 0.02


def test_subscription_limit_is_reported_without_leaking_cli_output(monkeypatch):
    provider, _ = cli(
        monkeypatch, {"is_error": True, "result": "quota exceeded private account details"}
    )
    with pytest.raises(RateLimited, match="subscription limit") as error:
        provider.chat("m", [], max_tokens=10, temperature=0, json_mode=True)
    assert "private account" not in str(error.value)


def test_unreadable_cli_response_is_an_inference_failure(monkeypatch):
    monkeypatch.setattr("shutil.which", lambda _: "claude.exe")
    monkeypatch.setattr(
        "subprocess.run", lambda *a, **k: SimpleNamespace(stdout="bad", returncode=1)
    )
    with pytest.raises(ProviderError, match="no JSON"):
        ClaudeCLI().chat("m", [], max_tokens=10, temperature=0, json_mode=True)


def test_cached_completion_preserves_provider_cost_estimate():
    store = Store(":memory:")
    store.put("key", Completion("ok", 10, 3, "m", cost_usd=0.12))
    assert store.get("key").cost_usd == 0.12
    assert store.get("key").cached
