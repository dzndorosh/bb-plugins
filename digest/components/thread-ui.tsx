import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
  experimental_ProviderIcon as ProviderIcon,
  experimental_ThreadActionsContextMenu as ActionsContextMenu,
  experimental_ThreadActionsMenu as ActionsMenu,
  experimental_ThreadStatusGlyph as StatusGlyph,
  experimental_useProviders as useProviders,
  ThreadTitle,
} from "@get-bb/plugin-sdk/app";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { badgeLabel, timeAgo, type Lane } from "@/lib/classify";
import type { Node } from "@/hooks/use-threads-board";
import { useExpanded } from "@/hooks/use-expanded";
import { cn } from "@/lib/utils";

export function BadgePill({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded-md bg-amber-100 px-1.5 py-px text-[11px] font-semibold leading-4 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", className)}>
      {label}
    </span>
  );
}

export function ProjectChip({ project }: { project: PluginSidebarProject | undefined }) {
  if (project === undefined) return null;
  return (
    <span className="inline-flex min-w-0 max-w-[110px] items-center gap-1 rounded-md bg-muted px-1.5 py-px text-[11px] font-medium leading-4 text-foreground/80">
      <span
        aria-hidden="true"
        className="flex size-3 shrink-0 items-center justify-center rounded-[3px] bg-foreground/80 text-[8px] font-bold text-background"
      >
        {project.name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="truncate">{project.name}</span>
    </span>
  );
}

function Provider({ id }: { id: string }) {
  const { providers } = useProviders();
  const provider = providers.find((candidate) => candidate.id === id);
  return (
    <span className="flex size-3.5 shrink-0 items-center justify-center overflow-hidden [&>*]:size-3.5">
      <ProviderIcon providerKind="agent" provider={provider ?? { id }} />
    </span>
  );
}

function LaneMark({ thread, lane }: { thread: PluginSidebarThread; lane: Lane }) {
  if (thread.indicator !== "none") {
    return <StatusGlyph indicator={thread.indicator} size="compact" />;
  }
  return lane === "needs" ? (
    <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
  ) : null;
}

function actionTarget(thread: PluginSidebarThread) {
  const environment = thread.environment;
  return {
    ...thread,
    environment:
      environment?.id != null
        ? { id: environment.id, path: environment.path }
        : null,
  };
}

/** "▸ 3" on a thread with children: expands them, shows who needs you or runs. */
function TreeToggle({ node }: { node: Node }) {
  const { expanded, toggle } = useExpanded();
  if (node.children.length === 0) return null;
  const open = expanded.has(node.item.id);
  const flip = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(node.item.id);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={open ? "Свернуть дочерние треды" : "Показать дочерние треды"}
      onClick={flip}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") flip(event);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-px text-[11px] font-medium leading-4 text-foreground/80 hover:bg-muted-foreground/15"
    >
      <svg
        viewBox="0 0 8 8"
        aria-hidden="true"
        className={cn("size-2 transition-transform motion-reduce:transition-none", open && "rotate-90")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 1l3 3-3 3" />
      </svg>
      <span className="tabular-nums">{node.descendants}</span>
      {node.needs > 0 ? (
        <span
          title={`Нужен ты: ${node.needs}`}
          className="size-1.5 rounded-full bg-amber-500"
        />
      ) : null}
      {node.running > 0 ? (
        <span
          title={`В работе: ${node.running}`}
          className="size-1.5 rounded-full bg-sky-500"
        />
      ) : null}
    </span>
  );
}

type RowProps = {
  node: Node;
  projects: ReadonlyMap<string, PluginSidebarProject>;
  now: number;
  activeThreadId: string | null;
  onNavigate?: () => void;
  depth?: number;
};

/** One thread in the sidebar, with its children nested and expandable below. */
export function SidebarRow({
  node,
  projects,
  now,
  activeThreadId,
  onNavigate,
  depth = 0,
}: RowProps) {
  const { expanded } = useExpanded();
  const { thread, lane, badge } = node.item;
  const label = badgeLabel(thread, badge, lane);
  const target = actionTarget(thread);
  const open = node.children.length > 0 && expanded.has(thread.id);
  const shownAt = node.children.length > 0 ? node.latest : thread.updatedAt;
  return (
    <>
      <ActionsContextMenu thread={target}>
        <div className="group/row relative">
          <a
            href={thread.href}
            data-sidebar-thread-shortcut-target=""
            data-sidebar-thread-id={thread.id}
            aria-current={thread.id === activeThreadId ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 rounded-lg px-2 py-1.5 outline-none transition-colors",
              "hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50",
              thread.id === activeThreadId && "bg-muted",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex size-4 shrink-0 items-center justify-center">
                <LaneMark thread={thread} lane={lane} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">
                <ThreadTitle threadId={thread.id} />
              </span>
              {label !== null ? (
                <BadgePill label={label} className="group-hover/row:invisible" />
              ) : null}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 pl-[22px] text-[11px] leading-4 text-muted-foreground">
              <span className="shrink-0">{timeAgo(shownAt, now)}</span>
              <TreeToggle node={node} />
              <span className="ml-auto flex min-w-0 items-center gap-1.5">
                {depth === 0 ? (
                  <ProjectChip project={projects.get(thread.projectId)} />
                ) : null}
                <Provider id={thread.providerId} />
              </span>
            </span>
          </a>
          <ActionsMenu
            thread={target}
            side="bottom"
            align="end"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label="Действия с тредом"
                className="absolute right-1.5 top-1.5 hidden size-5 items-center justify-center rounded-md bg-background/90 text-muted-foreground hover:text-foreground group-hover/row:flex focus-visible:flex"
              >
                <span aria-hidden="true">···</span>
              </button>
            )}
          />
        </div>
      </ActionsContextMenu>
      {open ? (
        <div className="ml-3.5 border-l border-border/70 pl-1">
          {node.children.map((child) => (
            <SidebarRow
              key={child.item.id}
              node={child}
              projects={projects}
              now={now}
              activeThreadId={activeThreadId}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function ChildRow({ node, now, depth }: { node: Node; now: number; depth: number }) {
  const { expanded } = useExpanded();
  const { thread, lane, badge } = node.item;
  const label = badgeLabel(thread, badge, lane);
  const open = node.children.length > 0 && expanded.has(thread.id);
  return (
    <>
      <a
        href={thread.href}
        data-sidebar-thread-id={thread.id}
        style={{ paddingLeft: 4 + depth * 12 }}
        className="flex min-w-0 items-center gap-1.5 rounded-lg py-1 pr-1.5 text-[12px] leading-5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <LaneMark thread={thread} lane={lane} />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          <ThreadTitle threadId={thread.id} />
        </span>
        <TreeToggle node={node} />
        {label !== null ? <BadgePill label={label} /> : null}
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {timeAgo(thread.updatedAt, now)}
        </span>
        <Provider id={thread.providerId} />
      </a>
      {open
        ? node.children.map((child) => (
            <ChildRow key={child.item.id} node={child} now={now} depth={depth + 1} />
          ))
        : null}
    </>
  );
}

/** One thread on the home board; its children open inside the card. */
export function BoardCard({ node, now }: { node: Node; now: number }) {
  const { expanded } = useExpanded();
  const { thread, lane, badge } = node.item;
  const label = badgeLabel(thread, badge, lane);
  const open = node.children.length > 0 && expanded.has(thread.id);
  const shownAt = node.children.length > 0 ? node.latest : thread.updatedAt;
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-background transition-colors focus-within:ring-2 focus-within:ring-ring/50">
      <a
        href={thread.href}
        data-sidebar-thread-id={thread.id}
        className="flex min-w-0 flex-col gap-1 rounded-xl px-3 py-2 outline-none hover:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex size-4 shrink-0 items-center justify-center">
            <LaneMark thread={thread} lane={lane} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">
            <ThreadTitle threadId={thread.id} />
          </span>
          {label !== null ? <BadgePill label={label} /> : null}
        </span>
        <span className="flex items-center gap-1.5 pl-[22px] text-[11px] leading-4 text-muted-foreground">
          <span>{timeAgo(shownAt, now)}</span>
          <TreeToggle node={node} />
          <span className="ml-auto">
            <Provider id={thread.providerId} />
          </span>
        </span>
      </a>
      {open ? (
        <div className="border-t border-border/70 px-1 py-1">
          {node.children.map((child) => (
            <ChildRow key={child.item.id} node={child} now={now} depth={0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SectionHeader({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium tabular-nums">{count}</span>
      {children}
    </div>
  );
}
