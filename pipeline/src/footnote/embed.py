"""Cached, budgeted embeddings. A vector is stored under a hash of (model, task, text), so a page is
embedded once however many questions retrieve it, and a rerun makes no calls."""

from __future__ import annotations

import hashlib
from typing import Protocol

import numpy as np

from .llm.budget import Budget
from .llm.store import Store


class EmbedProvider(Protocol):
    def embed(self, model: str, texts: list[str], *, task: str) -> list[list[float]]: ...


def _key(model: str, task: str, text: str) -> str:
    return hashlib.sha256(f"{model}\x00{task}\x00{text}".encode()).hexdigest()


class Embedder:
    def __init__(
        self,
        provider: EmbedProvider,
        model: str,
        store: Store,
        budget: Budget,
        *,
        max_chars: int = 6000,
        batch: int = 100,
    ):
        self.provider, self.model, self.store, self.budget = provider, model, store, budget
        self.max_chars, self.batch = max_chars, batch
        self.requests_made = 0

    def embed(self, texts: list[str], task: str) -> np.ndarray:
        """Unit-length float32 vectors, one row per text, in order."""
        texts = [t[: self.max_chars] for t in texts]
        keys = [_key(self.model, task, t) for t in texts]
        have = self.store.get_vectors(sorted(set(keys)))
        todo: list[int] = []  # first position of each text that has no stored vector yet
        queued: set[str] = set()
        for i, k in enumerate(keys):
            if k not in have and k not in queued:
                queued.add(k)
                todo.append(i)
        for start in range(0, len(todo), self.batch):
            idx = todo[start : start + self.batch]
            chunk = [texts[i] for i in idx]
            self.budget.reserve(
                sum(len(t) for t in chunk) // 3
            )  # the estimate stands: no usage reply
            vecs = self.provider.embed(self.model, chunk, task=task)
            self.requests_made += 1
            self.store.put_vectors({keys[i]: v for i, v in zip(idx, vecs, strict=True)})
            for i, v in zip(idx, vecs, strict=True):
                have[keys[i]] = np.asarray(v, dtype=np.float32)
        out = (
            np.stack([np.asarray(have[k], dtype=np.float32) for k in keys])
            if keys
            else np.zeros((0, 1))
        )
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        return out / np.where(norms == 0, 1, norms)
