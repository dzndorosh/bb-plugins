import type { Lane } from "./classify";

export interface TreeInput {
  id: string;
  parentId: string | null;
  lane: Lane;
  updatedAt: number;
}

export interface TreeNode<T extends TreeInput> {
  item: T;
  children: TreeNode<T>[];
  /** The most urgent lane in this thread's subtree: needs, running, done, other. */
  lane: Lane;
  /** Newest update anywhere in the subtree. */
  latest: number;
  /** Every thread below this one, at any depth. */
  descendants: number;
  /** Threads in the subtree (this one excluded) that need you. */
  needs: number;
  /** Threads in the subtree (this one excluded) that are running. */
  running: number;
}

const URGENCY: Record<Lane, number> = { needs: 3, running: 2, done: 1, other: 0 };

/**
 * Nests threads under their parents. A thread whose parent is missing from the
 * input (archived, hidden) becomes a root. Roots and children are newest first.
 */
export function buildTree<T extends TreeInput>(items: readonly T[]): TreeNode<T>[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const item of items) {
    const parent = item.parentId === null ? undefined : byId.get(item.parentId);
    if (parent === undefined || parent.id === item.id) {
      roots.push(item);
    } else {
      const list = childrenOf.get(parent.id) ?? [];
      list.push(item);
      childrenOf.set(parent.id, list);
    }
  }

  const seen = new Set<string>();
  const build = (item: T): TreeNode<T> => {
    seen.add(item.id);
    const children = (childrenOf.get(item.id) ?? [])
      .filter((child) => !seen.has(child.id))
      .map(build)
      .sort((a, b) => b.latest - a.latest);
    let lane = item.lane;
    let latest = item.updatedAt;
    let descendants = 0;
    let needs = 0;
    let running = 0;
    for (const child of children) {
      if (URGENCY[child.lane] > URGENCY[lane]) lane = child.lane;
      latest = Math.max(latest, child.latest);
      descendants += 1 + child.descendants;
      needs += child.needs + (child.item.lane === "needs" ? 1 : 0);
      running += child.running + (child.item.lane === "running" ? 1 : 0);
    }
    return { item, children, lane, latest, descendants, needs, running };
  };

  // A parent cycle has no root; its members never get built and are dropped.
  return roots.map(build).sort((a, b) => b.latest - a.latest);
}
