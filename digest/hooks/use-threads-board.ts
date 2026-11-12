import { useCallback, useEffect, useMemo, useState } from "react";
import {
  experimental_useSidebarThreads as useSidebarThreads,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../server";
import { laneOf, type Badge, type Lane } from "@/lib/classify";
import { buildTree, type TreeNode } from "@/lib/tree";

export type Item = {
  id: string;
  parentId: string | null;
  updatedAt: number;
  thread: PluginSidebarThread;
  lane: Lane;
  badge: Badge | undefined;
};
export type Node = TreeNode<Item>;

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

/** Threads nested under their parents, classified into lanes, with digest badges. */
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
  const nodes = useMemo(
    () =>
      buildTree(
        live.map((thread): Item => {
          const badge = badges[thread.id];
          return {
            id: thread.id,
            parentId: thread.parentThreadId,
            updatedAt: thread.updatedAt,
            thread,
            lane: laneOf(thread, badge, now),
            badge,
          };
        }),
      ),
    [live, badges, now],
  );
  return { status, nodes, projects, now };
}
