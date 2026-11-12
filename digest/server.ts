// bb-plugin-digest — backend.
//
// A thread's digest is a short, structured summary the agent writes at the end
// of a turn (`bb digest set`). It lives in the thread's plugin metadata. The
// frontend (app.tsx) shows it in a card when the pointer rests on a sidebar
// row; Approve sends the user's go-ahead back into the thread.
import {
  PluginCliError,
  cliCommand,
  defineCli,
  defineRpcContract,
  experimental_PluginRpcRefusal as PluginRpcRefusal,
  type BbPluginApi,
} from "@get-bb/plugin-sdk";
import { z } from "zod";

const chips = z.array(z.string().trim().min(1).max(20)).max(2).default([]);

const metricSchema = z.object({
  value: z.string().trim().min(1).max(12),
  label: z.string().trim().min(1).max(32),
  tone: z.enum(["good", "warn", "bad"]).optional(),
});

const doneItemSchema = z.object({
  text: z.string().trim().min(1).max(140),
  chips,
});

const needItemSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]{1,24}$/u, "id: a-z, 0-9 and '-', up to 24 characters"),
  text: z.string().trim().min(1).max(140),
  chips,
  approvable: z.boolean().default(false),
  state: z.enum(["open", "approved"]).default("open"),
});

/** What an agent writes with `bb digest set --data`. */
export const digestInputSchema = z.object({
  title: z.string().trim().min(1).max(90),
  badge: z.string().trim().min(1).max(24).optional(),
  metrics: z.array(metricSchema).max(4).default([]),
  done: z.array(doneItemSchema).max(6).default([]),
  needs: z.array(needItemSchema).max(5).default([]),
});

export const digestSchema = digestInputSchema.extend({
  updatedAt: z.number(),
});
export type Digest = z.infer<typeof digestSchema>;

export const rpcContract = defineRpcContract({
  get: {
    input: z.object({ threadId: z.string().min(1) }).strict(),
    output: z.object({ digest: digestSchema.nullable() }),
  },
  badges: {
    input: z
      .object({ threadIds: z.array(z.string().min(1)).min(1).max(200) })
      .strict(),
    output: z.object({
      badges: z.record(
        z.string(),
        z.object({ badge: z.string().nullable(), open: z.number() }),
      ),
    }),
  },
  approve: {
    input: z
      .object({ threadId: z.string().min(1), needId: z.string().min(1) })
      .strict(),
    output: z.object({ digest: digestSchema }),
  },
});

/** Realtime channel; the payload names the thread whose digest changed. */
export const DIGEST_CHANGED = "digest-changed";
const METADATA_KEY = "digest";

export default async function plugin(bb: BbPluginApi) {
  async function readDigest(threadId: string): Promise<Digest | null> {
    const metadata = await bb.sdk.threads.getPluginMetadata({ threadId });
    const parsed = digestSchema.safeParse(metadata[METADATA_KEY]);
    return parsed.success ? parsed.data : null;
  }

  async function writeDigest(threadId: string, digest: Digest): Promise<void> {
    await bb.sdk.threads.updatePluginMetadata({
      threadId,
      set: { [METADATA_KEY]: digest },
    });
    bb.realtime.publish(DIGEST_CHANGED, { threadId });
  }

  async function clearDigest(threadId: string): Promise<void> {
    await bb.sdk.threads.updatePluginMetadata({
      threadId,
      remove: [METADATA_KEY],
    });
    bb.realtime.publish(DIGEST_CHANGED, { threadId });
  }

  bb.rpc.register(rpcContract, {
    get: async ({ threadId }) => ({ digest: await readDigest(threadId) }),
    badges: async ({ threadIds }) => {
      const { threads } = await bb.sdk.threads.experimental_listPluginMetadata({
        threadIds,
      });
      const badges: Record<string, { badge: string | null; open: number }> = {};
      for (const row of threads) {
        const parsed = digestSchema.safeParse(row.metadata[METADATA_KEY]);
        if (!parsed.success) continue;
        badges[row.threadId] = {
          badge: parsed.data.badge ?? null,
          open: parsed.data.needs.filter((need) => need.state === "open").length,
        };
      }
      return { badges };
    },
    approve: async ({ threadId, needId }) => {
      const digest = await readDigest(threadId);
      const need = digest?.needs.find((item) => item.id === needId);
      if (digest === null || need === undefined || !need.approvable) {
        throw new PluginRpcRefusal({
          code: "not_found",
          message: "This item can no longer be approved",
        });
      }
      if (need.state === "approved") return { digest };
      const next: Digest = {
        ...digest,
        needs: digest.needs.map((item) =>
          item.id === needId ? { ...item, state: "approved" } : item,
        ),
      };
      await writeDigest(threadId, next);
      await bb.sdk.threads.send({
        threadId,
        mode: "auto",
        input: [{ type: "text", text: `Одобрено: ${need.text}`, mentions: [] }],
      });
      return { digest: next };
    },
  });

  function resolveThread(
    option: string | undefined,
    ctx: { threadId?: string },
  ): string {
    const threadId = option ?? ctx.threadId;
    if (threadId === undefined) {
      throw new PluginCliError("no thread to write the digest for", {
        code: "thread_required",
        hint: "Pass --thread <id>, or run the command from inside a thread.",
      });
    }
    return threadId;
  }

  const threadOption = {
    thread: {
      type: "string",
      description: "Thread id. Defaults to the thread that runs the command.",
    },
  } as const;

  bb.cli.register(
    defineCli({
      name: "digest",
      summary:
        "Write the short summary card that shows when the user hovers this thread in the sidebar",
      commands: {
        set: cliCommand({
          summary:
            "Replace this thread's digest. Run it once, at the end of a turn.",
          options: {
            data: {
              type: "string",
              required: true,
              description:
                'JSON: {"title","badge?","metrics?":[{"value","label","tone?"}],"done?":[{"text","chips?"}],"needs?":[{"id","text","chips?","approvable?"}]}. Limits: title 90, badge 24, 4 metrics (value 12, label 32), 6 done items and 5 needs (text 140), 2 chips of 20.',
            },
            ...threadOption,
          },
          async run(input, ctx) {
            const threadId = resolveThread(input.options.thread, ctx);
            let raw: unknown;
            try {
              raw = JSON.parse(input.options.data);
            } catch {
              throw new PluginCliError("--data is not valid JSON", {
                code: "invalid_json",
                hint: "Pass the JSON through a quoted heredoc so the shell keeps it intact.",
              });
            }
            const parsed = digestInputSchema.safeParse(raw);
            if (!parsed.success) {
              throw new PluginCliError(
                parsed.error.issues
                  .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                  .join("; "),
                { code: "invalid_digest" },
              );
            }
            await writeDigest(threadId, {
              ...parsed.data,
              updatedAt: Date.now(),
            });
            return { exitCode: 0, stdout: `Digest saved for ${threadId}` };
          },
        }),
        show: cliCommand({
          summary: "Print this thread's digest as JSON",
          options: { ...threadOption },
          async run(input, ctx) {
            const digest = await readDigest(
              resolveThread(input.options.thread, ctx),
            );
            return {
              exitCode: 0,
              stdout: digest === null ? "No digest." : JSON.stringify(digest),
            };
          },
        }),
        clear: cliCommand({
          summary: "Remove this thread's digest",
          options: { ...threadOption },
          async run(input, ctx) {
            await clearDigest(resolveThread(input.options.thread, ctx));
            return { exitCode: 0, stdout: "Digest cleared." };
          },
        }),
      },
    }),
  );

  bb.onDispose(() => {
    bb.log.info("disposed");
  });
}
