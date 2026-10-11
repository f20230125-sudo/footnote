// A search lives in the address, so a link reproduces it: ?q=...&in=<filing>&filter=off.
// Anything missing or not recognised falls back to the page's defaults.

export type SearchState = { q: string; scope: string; narrow: boolean };

export const DEFAULT_SCOPE = "all";

const MAX_QUESTION = 400;

/** Reads a search from a query string. `scope` must be one of `docs`, or it becomes "all". */
export function readSearch(search: string, docs: string[]): SearchState {
  const params = new URLSearchParams(search);
  const q = (params.get("q") ?? "").trim().slice(0, MAX_QUESTION);
  const scope = params.get("in") ?? DEFAULT_SCOPE;
  return {
    q,
    scope: docs.includes(scope) ? scope : DEFAULT_SCOPE,
    narrow: params.get("filter") !== "off",
  };
}

/** The query string for a search ("" when there is nothing to remember), without the leading "?". */
export function writeSearch(state: SearchState): string {
  if (!state.q.trim()) return "";
  const params = new URLSearchParams({ q: state.q.trim().slice(0, MAX_QUESTION) });
  if (state.scope !== DEFAULT_SCOPE) params.set("in", state.scope);
  if (!state.narrow) params.set("filter", "off");
  return params.toString();
}
