"""Reads `.env` and builds the model endpoints. Keys are never printed or logged."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from . import ROOT
from .embed import Embedder
from .llm import Budget, Endpoint, Gemini, Groq, Limits, Store
from .llm.router import LLM

# Groq's published free limits for these models (console.groq.com/docs/rate-limits, 2026-10-11).
GROQ_LIMITS = Limits(rpm=30, tpm=8000, rpd=1000, tpd=200_000)
# Gemini's free limits are only shown in the user's own AI Studio, so the default is deliberately low
# and `GEMINI_LIMITS=rpm,tpm,rpd,tpd` replaces it once he has read the real numbers.
GEMINI_LIMITS = Limits(rpm=5, tpm=200_000, rpd=100, tpd=1_000_000)
GEMINI_EMBED_LIMITS = Limits(rpm=30, tpm=1_000_000, rpd=1000, tpd=50_000_000)

GROQ_CALL_CAP = 6500  # tokens in one call; the per-minute limit is 8,000


def load_env(path: Path = ROOT / ".env") -> dict[str, str]:
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _limits(raw: str | None, default: Limits) -> Limits:
    if not raw:
        return default
    parts = [int(x) for x in raw.split(",")]
    if len(parts) != 4:
        raise ValueError("limits must be rpm,tpm,rpd,tpd")
    return Limits(*parts)


class MissingKey(RuntimeError):
    pass


@dataclass
class Runtime:
    answer: LLM
    judge: LLM
    embedder: Embedder | None
    store: Store
    answer_models: list[str]
    judge_models: list[str]


def build_runtime(env: Mapping[str, str] | None = None, store: Store | None = None) -> Runtime:
    if env is None:
        e = load_env()
        for k in (
            "GROQ_API_KEY",
            "GEMINI_API_KEY",
            "FOOTNOTE_PROVIDER",
            "CLAUDE_ANSWER_MODEL",
            "CLAUDE_JUDGE_MODEL",
            "GROQ_MODELS",
            "GROQ_LIMITS",
            "GEMINI_MODEL",
            "GEMINI_LIMITS",
            "GEMINI_EMBED_MODEL",
            "GEMINI_EMBED_LIMITS",
        ):
            # A real environment variable wins over .env.
            if k in os.environ:
                e[k] = os.environ[k]
    else:
        e = dict(env)
    store = store or Store()
    if e.get("FOOTNOTE_PROVIDER", os.environ.get("FOOTNOTE_PROVIDER")) == "claude-cli":
        from .llm.claude_cli import ClaudeCLI

        provider = ClaudeCLI()
        answer_model = e.get("CLAUDE_ANSWER_MODEL", "sonnet")
        judge_model = e.get("CLAUDE_JUDGE_MODEL", "haiku")
        if answer_model == judge_model:
            raise ValueError("Use different answer and judge models")
        limits = Limits(rpm=30, tpm=2_000_000, rpd=1000, tpd=10_000_000)

        def cli_endpoint(model: str) -> Endpoint:
            return Endpoint(provider, model, Budget(f"claude-cli/{model}", limits, store))

        return Runtime(
            LLM([cli_endpoint(answer_model)], store, retries=0),
            LLM([cli_endpoint(judge_model)], store, retries=0),
            None,
            store,
            [answer_model],
            [judge_model],
        )
    groq_key, gemini_key = e.get("GROQ_API_KEY"), e.get("GEMINI_API_KEY")
    if not groq_key and not gemini_key:
        raise MissingKey("put GROQ_API_KEY and/or GEMINI_API_KEY in .env (see .env.example)")

    def budget(name: str, limits: Limits, cap: int | None = None) -> Budget:
        return Budget(name, limits, store, max_call_tokens=cap)

    answer_eps: list[Endpoint] = []
    judge_eps: list[Endpoint] = []
    groq_models = [
        m for m in e.get("GROQ_MODELS", "openai/gpt-oss-120b,qwen/qwen3.8-27b").split(",") if m
    ]
    if groq_key:
        groq = Groq(groq_key)
        lim = _limits(e.get("GROQ_LIMITS"), GROQ_LIMITS)
        eps = [Endpoint(groq, m, budget(f"groq/{m}", lim, GROQ_CALL_CAP)) for m in groq_models]
        answer_eps += eps
        judge_eps += eps[-1:]  # a different model from the first answerer
    embedder = None
    if gemini_key:
        gem = Gemini(gemini_key)
        model = e.get("GEMINI_MODEL")
        if model:
            lim = _limits(e.get("GEMINI_LIMITS"), GEMINI_LIMITS)
            ep = Endpoint(gem, model, budget(f"gemini/{model}", lim))
            judge_eps.insert(0, ep)
            if not groq_key:
                answer_eps.append(ep)
        embed_model = e.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
        embedder = Embedder(
            gem,
            embed_model,
            store,
            budget(
                f"gemini/{embed_model}", _limits(e.get("GEMINI_EMBED_LIMITS"), GEMINI_EMBED_LIMITS)
            ),
        )
    if not answer_eps:
        raise MissingKey(
            "no model to answer with: set GROQ_API_KEY, or GEMINI_API_KEY with GEMINI_MODEL"
        )
    if not judge_eps:
        judge_eps = answer_eps[-1:]
    return Runtime(
        answer=LLM(answer_eps, store),
        judge=LLM(judge_eps, store),
        embedder=embedder,
        store=store,
        answer_models=[ep.model for ep in answer_eps],
        judge_models=[ep.model for ep in judge_eps],
    )
