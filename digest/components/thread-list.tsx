import { useState } from "react";
import type { PluginThreadListProps } from "@get-bb/plugin-sdk/app";
import { useThreadsBoard } from "@/hooks/use-threads-board";
import { SectionHeader, SidebarRow } from "@/components/thread-ui";
import type { Node } from "@/hooks/use-threads-board";

const COLLAPSE_KEY = "digest:earlier-open";

export function DigestThreadList({ activeThreadId, onNavigate }: PluginThreadListProps) {
  const { status, nodes, projects, now } = useThreadsBoard();
  const [earlierOpen, setEarlierOpen] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const byProject = new Map(projects.map((project) => [project.id, project]));

  const pinned = nodes.filter((node) => node.item.thread.isPinned);
  const rest = nodes.filter((node) => !node.item.thread.isPinned);
  const needs = rest.filter((node) => node.lane === "needs");
  const running = rest.filter((node) => node.lane === "running");
  const done = rest.filter((node) => node.lane === "done");
  const earlier = rest.filter((node) => node.lane === "other");

  const renderRows = (list: Node[]) =>
    list.map((node) => (
      <SidebarRow
        key={node.item.id}
        node={node}
        projects={byProject}
        now={now}
        activeThreadId={activeThreadId}
        onNavigate={onNavigate}
      />
    ));

  const group = (list: Node[]) =>
    list.length > 0 ? <div className="mt-2 first:mt-1">{renderRows(list)}</div> : null;

  if (status === "loading" && nodes.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">Загрузка…</div>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-3">
      {group(pinned)}
      {group(needs)}
      {group(running)}
      {group(done)}
      {earlier.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={earlierOpen}
            onClick={() => {
              const next = !earlierOpen;
              setEarlierOpen(next);
              localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
            }}
            className="text-left"
          >
            <SectionHeader label="Раньше" count={earlier.length}>
              <span aria-hidden="true" className="ml-auto text-[10px]">
                {earlierOpen ? "▾" : "▸"}
              </span>
            </SectionHeader>
          </button>
          {earlierOpen ? renderRows(earlier) : null}
        </>
      ) : null}
      {nodes.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">Тредов пока нет.</div>
      ) : null}
    </div>
  );
}
