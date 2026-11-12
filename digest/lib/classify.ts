import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";

export type Badge = { badge: string | null; open: number };
export type Lane = "running" | "needs" | "done" | "other";

const RUNNING = new Set(["starting", "active", "stopping"]);
const ATTENTION = new Set(["unread-error", "waiting-for-input", "queued-failed"]);
const DONE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function laneOf(
  thread: PluginSidebarThread,
  badge: Badge | undefined,
  now: number,
): Lane {
  if (RUNNING.has(thread.status)) return "running";
  if (
    thread.hasPendingInteraction ||
    thread.isUnread ||
    ATTENTION.has(thread.indicator) ||
    (badge?.open ?? 0) > 0
  ) {
    return "needs";
  }
  return now - thread.updatedAt <= DONE_WINDOW_MS ? "done" : "other";
}

/** What the thread waits for, as a short badge; the agent's own digest badge wins. */
export function badgeLabel(
  thread: PluginSidebarThread,
  badge: Badge | undefined,
  lane: Lane,
): string | null {
  if (badge?.badge) return badge.badge;
  if (lane === "running") return null;
  if (thread.hasPendingInteraction) return "question";
  if (thread.status === "error" || thread.indicator === "unread-error") return "error";
  if (lane === "needs") return "review";
  return null;
}

export function timeAgo(from: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - from) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

/** Roots always show; a child shows only while it needs you or is running. */
export function isListed(thread: PluginSidebarThread, lane: Lane): boolean {
  if (thread.isHidden || thread.isArchived) return false;
  return thread.parentThreadId === null || lane === "needs" || lane === "running";
}
