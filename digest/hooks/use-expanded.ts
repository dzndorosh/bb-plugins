import { useCallback, useSyncExternalStore } from "react";

const KEY = "digest:expanded";
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

let snapshot = read();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toggleId(id: string) {
  const next = new Set(snapshot);
  if (!next.delete(id)) next.add(id);
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Storage can be unavailable; the state still works for this session.
  }
  for (const listener of listeners) listener();
}

/** Which threads show their children, shared by the sidebar and the board. */
export function useExpanded() {
  const expanded = useSyncExternalStore(subscribe, () => snapshot);
  const toggle = useCallback((id: string) => toggleId(id), []);
  return { expanded, toggle };
}
