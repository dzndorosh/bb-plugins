import { useEffect, useRef } from "react";
import { useThreadsBoard, type Item } from "@/hooks/use-threads-board";
import { BoardCard, ProjectChip } from "@/components/thread-ui";
import type { Lane } from "@/lib/classify";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";

const COLUMNS: { lane: Lane; label: string; dot: string; limit: number }[] = [
  { lane: "needs", label: "needs you", dot: "bg-amber-500", limit: 12 },
  { lane: "done", label: "done", dot: "bg-emerald-500", limit: 8 },
  { lane: "running", label: "running", dot: "bg-sky-500", limit: 12 },
];

function Column({
  label,
  dot,
  items,
  limit,
  projects,
  now,
}: {
  label: string;
  dot: string;
  items: Item[];
  limit: number;
  projects: Map<string, PluginSidebarProject>;
  now: number;
}) {
  const shown = items.slice(0, limit);
  const groups = new Map<string, Item[]>();
  for (const item of shown) {
    const list = groups.get(item.thread.projectId) ?? [];
    list.push(item);
    groups.set(item.thread.projectId, list);
  }
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
        <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
        <span className={items.length === 0 ? "font-medium text-muted-foreground" : ""}>
          {label}
        </span>
        <span className="font-medium tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </h3>
      {[...groups].map(([projectId, list]) => (
        <div key={projectId} className="flex flex-col gap-1.5">
          <div className="flex">
            <ProjectChip project={projects.get(projectId)} />
          </div>
          {list.map((item) => (
            <BoardCard key={item.thread.id} item={item} now={now} />
          ))}
        </div>
      ))}
      {items.length > limit ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          и ещё {items.length - limit}
        </p>
      ) : null}
    </section>
  );
}

export function HomeBoard() {
  const { items, projects, now } = useThreadsBoard();
  const byProject = new Map(projects.map((project) => [project.id, project]));
  const rootRef = useRef<HTMLDivElement | null>(null);
  // The host prints the section title above the board; the board needs none.
  useEffect(() => {
    const heading = rootRef.current
      ?.closest("section")
      ?.querySelector<HTMLElement>(":scope > h2");
    if (!heading) return;
    heading.style.display = "none";
    return () => {
      heading.style.display = "";
    };
  }, []);
  return (
    <div ref={rootRef} className="mx-auto flex w-full max-w-[760px] gap-5 px-1 pt-2">
      {COLUMNS.map(({ lane, ...column }) => (
        <Column
          key={lane}
          {...column}
          items={items.filter((item) => item.lane === lane)}
          projects={byProject}
          now={now}
        />
      ))}
    </div>
  );
}
