import type { ReactNode } from "react";
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
import type { Item } from "@/hooks/use-threads-board";
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

type RowProps = {
  item: Item;
  project: PluginSidebarProject | undefined;
  now: number;
  active?: boolean;
  onNavigate?: () => void;
};

/** One thread in the sidebar: title and badge, then time, project and agent. */
export function SidebarRow({ item, project, now, active, onNavigate }: RowProps) {
  const { thread, lane, badge } = item;
  const label = badgeLabel(thread, badge, lane);
  const target = actionTarget(thread);
  return (
    <ActionsContextMenu thread={target}>
      <div className="group/row relative">
        <a
          href={thread.href}
          data-sidebar-thread-shortcut-target=""
          data-sidebar-thread-id={thread.id}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 flex-col gap-0.5 rounded-lg px-2 py-1.5 outline-none transition-colors",
            "hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50",
            active && "bg-muted",
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
            <span className="shrink-0">{timeAgo(thread.updatedAt, now)}</span>
            <span className="ml-auto flex min-w-0 items-center gap-1.5">
              <ProjectChip project={project} />
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
  );
}

/** One thread on the home board. */
export function BoardCard({ item, now }: { item: Item; now: number }) {
  const { thread, lane, badge } = item;
  const label = badgeLabel(thread, badge, lane);
  return (
    <a
      href={thread.href}
      data-sidebar-thread-id={thread.id}
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-background px-3 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
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
      <span className="flex items-center justify-between pl-[22px] text-[11px] leading-4 text-muted-foreground">
        <span>{timeAgo(thread.updatedAt, now)}</span>
        <Provider id={thread.providerId} />
      </span>
    </a>
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
