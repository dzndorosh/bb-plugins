import { useCallback, useEffect, useMemo, useState } from "react";
import {
  experimental_useSidebarThreads as useSidebarThreads,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../server";
import { isListed, laneOf, type Badge, type Lane } from "@/lib/classify";

export type Item = { thread: PluginSidebarThread; lane: Lane; badge: Badge | undefined };

const CHUNK = 200;

function useBadges(ids: readonly string[]) {
  const rpc = useRpc<typeof rpcContract>();
  const [badges, setBadges] = useState<Record<string, Badge>>({});
  const key = ids.join(",");
  const load = useCallback(() => {
    const list = key === "" ? [] : key.split(",");
    const chunks: string[][] = [];
    for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
    Promise.all(chunks.map((threadIds) => rpc.call("badges", { threadIds }))).then(
      (results) => setBadges(Object.assign({}, ...results.map((r) => r.badges))),
      () => undefined,
    );
  }, [rpc, key]);
  useEffect(load, [load]);
  useRealtime("digest-changed", load);
  return badges;
}

/** Threads classified into lanes, newest first, with digest badges attached. */
export function useThreadsBoard() {
  const { status, threads, projects } = useSidebarThreads();
  const live = useMemo(
    () => threads.filter((thread) => !thread.isHidden && !thread.isArchived),
    [threads],
  );
  const badges = useBadges(useMemo(() => live.map((thread) => thread.id), [live]));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const items = useMemo(() => {
    const result: Item[] = [];
    for (const thread of live) {
      const badge = badges[thread.id];
      const lane = laneOf(thread, badge, now);
      if (isListed(thread, lane)) result.push({ thread, lane, badge });
    }
    return result.sort((a, b) => b.thread.updatedAt - a.thread.updatedAt);
  }, [live, badges, now]);
  return { status, items, projects, now };
}
