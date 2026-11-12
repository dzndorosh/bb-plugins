// bb-plugin-digest — frontend.
//
// An app-wide overlay watches the pointer over bb's sidebar thread rows (each
// row's anchor carries data-sidebar-thread-id) and, when the thread has a
// digest, floats a summary card beside the row.
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { definePluginApp, useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { Digest, rpcContract } from "./server";
import { usePortalScopeProps } from "@/lib/portal-scope";
import { cn } from "@/lib/utils";
import { DigestThreadList } from "@/components/thread-list";
import { HomeBoard } from "@/components/home-board";

const OPEN_DELAY_MS = 280;
const SWITCH_DELAY_MS = 90;
const CLOSE_DELAY_MS = 220;
const CARD_WIDTH = 400;
const GAP = 10;
const EDGE = 8;
const ROW_SELECTOR = "[data-sidebar-thread-id]";

type Anchor = { threadId: string; rect: DOMRect; edge: number };

/** Right edge of the scrolling list that holds the row, so the card sits
 *  beside the sidebar rather than on top of its rows. */
function listEdge(row: HTMLElement): number {
  for (let node = row.parentElement; node !== null; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return node.getBoundingClientRect().right;
    }
  }
  return row.getBoundingClientRect().right;
}

function rowAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? (target.closest(ROW_SELECTOR) as HTMLElement | null)
    : null;
}

function useDigest(threadId: string | null) {
  const rpc = useRpc<typeof rpcContract>();
  const [digest, setDigest] = useState<Digest | null>(null);
  const load = useCallback(
    (id: string) => {
      rpc.call("get", { threadId: id }).then(
        (result) => setDigest(result.digest),
        () => setDigest(null),
      );
    },
    [rpc],
  );
  useEffect(() => {
    setDigest(null);
    if (threadId !== null) load(threadId);
  }, [threadId, load]);
  useRealtime("digest-changed", (payload: unknown) => {
    const changed = (payload as { threadId?: string } | null)?.threadId;
    if (threadId !== null && changed === threadId) load(threadId);
  });
  return { digest, setDigest, rpc };
}

function DigestOverlay() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const openTimer = useRef<number>(0);
  const closeTimer = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const current = useRef<string | null>(null);
  current.current = anchor?.threadId ?? null;

  useEffect(() => {
    const cancelClose = () => window.clearTimeout(closeTimer.current);
    const cancelOpen = () => window.clearTimeout(openTimer.current);
    const scheduleClose = () => {
      cancelClose();
      closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target as Node | null;
      if (target !== null && cardRef.current?.contains(target)) {
        cancelClose();
        return;
      }
      const row = rowAt(event.target);
      if (row === null) {
        cancelOpen();
        scheduleClose();
        return;
      }
      const threadId = row.getAttribute("data-sidebar-thread-id");
      if (threadId === null) return;
      cancelClose();
      if (threadId === current.current) return;
      cancelOpen();
      openTimer.current = window.setTimeout(
        () => setAnchor({
          threadId,
          rect: row.getBoundingClientRect(),
          edge: listEdge(row),
        }),
        current.current === null ? OPEN_DELAY_MS : SWITCH_DELAY_MS,
      );
    };
    const close = () => {
      cancelOpen();
      cancelClose();
      setAnchor(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("blur", close);
    return () => {
      cancelOpen();
      cancelClose();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("blur", close);
    };
  }, []);

  const { digest, setDigest, rpc } = useDigest(anchor?.threadId ?? null);
  if (anchor === null || digest === null) return null;
  return (
    <DigestCard
      ref={cardRef}
      anchor={anchor}
      digest={digest}
      onApprove={async (needId) => {
        try {
          const result = await rpc.call("approve", {
            threadId: anchor.threadId,
            needId,
          });
          setDigest(result.digest);
        } catch (cause) {
          toast.error(
            cause instanceof Error ? cause.message : "Не удалось отправить",
          );
        }
      }}
    />
  );
}

const DigestCard = forwardRef<
  HTMLDivElement,
  {
    anchor: Anchor;
    digest: Digest;
    onApprove: (needId: string) => Promise<void>;
  }
>(function DigestCard({ anchor, digest, onApprove }, forwardedRef) {
  const scope = usePortalScopeProps();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const height = innerRef.current?.offsetHeight ?? 0;
    const room = window.innerWidth - anchor.edge - GAP - EDGE;
    const left =
      room >= CARD_WIDTH
        ? anchor.edge + GAP
        : Math.max(EDGE, anchor.rect.left - GAP - CARD_WIDTH);
    const top = Math.min(
      Math.max(EDGE, anchor.rect.top - 10),
      Math.max(EDGE, window.innerHeight - height - EDGE),
    );
    setPosition({ left, top });
  }, [anchor, digest]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const setRefs = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  return createPortal(
    <div
      {...scope}
      ref={setRefs}
      role="dialog"
      aria-label={digest.title}
      style={{
        position: "fixed",
        zIndex: 60,
        width: CARD_WIDTH,
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
      }}
      className={cn(
        "rounded-2xl border border-border bg-popover p-2.5 text-popover-foreground shadow-xl",
        "transition duration-150 ease-out motion-reduce:transition-none",
        shown && position !== null
          ? "translate-x-0 opacity-100"
          : "-translate-x-1 opacity-0",
      )}
    >
      <Header digest={digest} />
      {digest.metrics.length > 0 ? <Metrics metrics={digest.metrics} /> : null}
      {digest.done.length > 0 ? (
        <Group label="agent" tone="agent">
          {digest.done.map((item, index) => (
            <Row key={index} icon={<CheckDot />} chips={item.chips}>
              {item.text}
            </Row>
          ))}
        </Group>
      ) : null}
      {digest.needs.length > 0 ? (
        <Group label="you" tone="you">
          {digest.needs.map((need) => (
            <Row
              key={need.id}
              icon={
                need.state === "approved" ? (
                  <CheckDot />
                ) : need.approvable ? (
                  <OpenDot />
                ) : (
                  <HollowDot />
                )
              }
              chips={need.chips}
              strong={need.approvable && need.state === "open"}
              action={
                need.approvable && need.state === "open" ? (
                  <ApproveButton onClick={() => onApprove(need.id)} />
                ) : null
              }
            >
              {need.text}
            </Row>
          ))}
        </Group>
      ) : null}
    </div>,
    document.body,
  );
});

function Header({ digest }: { digest: Digest }) {
  return (
    <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
      <svg
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M3 13V8M8 13V3M13 13V6" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
        {digest.title}
      </span>
      {digest.badge !== undefined ? (
        <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          {digest.badge}
        </span>
      ) : null}
    </div>
  );
}

const TONE = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-rose-600 dark:text-rose-400",
} as const;

function Metrics({ metrics }: { metrics: Digest["metrics"] }) {
  return (
    <div
      className="mb-2 grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
    >
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="min-w-0 rounded-xl border border-border px-2.5 py-2"
        >
          <div
            className={cn(
              "truncate text-[18px] font-semibold leading-6 tabular-nums",
              metric.tone !== undefined && TONE[metric.tone],
            )}
          >
            {metric.value}
          </div>
          <div className="text-[11px] leading-[14px] text-muted-foreground">
            {metric.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Group({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "agent" | "you";
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-3 rounded-xl border border-border">
      <span
        className={cn(
          "absolute -top-2 left-2.5 bg-popover px-1 text-[10px] font-medium leading-4",
          tone === "agent"
            ? "text-sky-700 dark:text-sky-400"
            : "text-amber-800 dark:text-amber-500",
        )}
      >
        {label}
      </span>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function Row({
  icon,
  chips,
  action,
  strong,
  children,
}: {
  icon: React.ReactNode;
  chips: readonly string[];
  action?: React.ReactNode;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 px-2.5 py-2 text-[13px] leading-5">
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className={cn("min-w-0", strong && "font-medium")}>{children}</span>
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-px text-[11px] font-medium text-foreground/80"
          >
            <span aria-hidden="true">↗</span>
            {chip}
          </span>
        ))}
      </span>
      {action}
    </li>
  );
}

function CheckDot() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-emerald-600 dark:text-emerald-500" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path
        d="M4.9 8.3l2 2 4.2-4.4"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OpenDot() {
  return (
    <span
      className="size-2 rounded-full bg-amber-800 dark:bg-amber-500"
      aria-hidden="true"
    />
  );
}

function HollowDot() {
  return (
    <span
      className="size-3.5 rounded-full border-[1.5px] border-muted-foreground/60"
      aria-hidden="true"
    />
  );
}

function ApproveButton({ onClick }: { onClick: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void onClick().finally(() => setPending(false));
      }}
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      <span aria-hidden="true">✓</span>
      Approve
    </button>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({
    id: "digest-hover-card",
    component: DigestOverlay,
  });
  app.slots.homepageSection({
    id: "board",
    title: "Треды",
    component: HomeBoard,
  });
  app.slots.experimental_threadList({
    id: "digest-list",
    title: "Digest",
    description: "Нужен ты, в работе, готово: время, агент и статус в каждой строке.",
    component: DigestThreadList,
  });
});
