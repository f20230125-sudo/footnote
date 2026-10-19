"""Opt-in model inference through an already authenticated Claude Code installation.

The CLI is a transport, not an agent doing the evaluation: all built-in tools,
customizations and session persistence are disabled. Only the supplied messages
reach the model. The application's own tools still run in Footnote's bounded loop.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import time

from .providers import ProviderError, RateLimited
from .store import Completion


class ClaudeCLI:
    name = "claude-cli"

    def __init__(self, executable: str = "claude", timeout: int = 180):
        self.executable = shutil.which(executable)
        if not self.executable:
            raise RuntimeError("Claude Code is not installed; run claude auth login first")
        self.timeout = timeout

    def chat(self, model, messages, *, max_tokens, temperature, json_mode):
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        prompt = "\n\n".join(
            f"{m['role'].upper()}:\n{m['content']}" for m in messages if m["role"] != "system"
        )
        if json_mode:
            system += "\nReturn one JSON object only, without markdown fences."
        # CLI does not expose temperature or a completion-token cap. Record that
        # distinction in the evaluation manifest instead of claiming API parity.
        started = time.perf_counter()
        try:
            proc = subprocess.run(
                [
                    self.executable,
                    "--print",
                    "--output-format",
                    "json",
                    "--model",
                    model,
                    "--tools",
                    "",
                    "--safe-mode",
                    "--disable-slash-commands",
                    "--no-session-persistence",
                    "--system-prompt",
                    system,
                ],
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=self.timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise ProviderError(504, "Claude CLI inference timed out") from None
        try:
            data = json.loads(proc.stdout)
        except json.JSONDecodeError:
            # Never include CLI stderr: it can contain account/configuration data.
            raise ProviderError(502, "Claude CLI returned no JSON result") from None
        if proc.returncode or data.get("is_error"):
            message = str(data.get("result", "Claude CLI inference failed"))
            if any(x in message.lower() for x in ("limit", "quota", "capacity")):
                raise RateLimited(429, "Claude subscription limit reached", None)
            raise ProviderError(502, "Claude CLI inference failed")
        usage = data.get("usage") or {}
        model_usage = data.get("modelUsage") or {}
        resolved = next(iter(model_usage), model)
        return Completion(
            text=data.get("result") or "",
            prompt_tokens=sum(
                int(usage.get(k, 0))
                for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
            ),
            completion_tokens=int(usage.get("output_tokens", 0)),
            model=resolved,
            latency_ms=round((time.perf_counter() - started) * 1000),
            cost_usd=data.get("total_cost_usd"),
        )
