export const DEFAULT_AREAS = [
  "Schedule",
  "Plans",
  "Files",
  "Chat",
  "Documents",
  "Lessons",
  "Sidebar",
  "Mobile",
  "Backend",
  "Design",
  "Review",
  "Benchmark",
  "Requirements",
  "Infra",
  "bb",
  "Misc",
] as const;

export const DEFAULT_MAX_LENGTH = 50;

export type TitleCheck =
  | { ok: true; title: string }
  | { ok: false; problems: string[] };

/** "a, b ,c" -> ["a", "b", "c"]; falls back to the defaults when empty. */
export function parseAreas(raw: string): string[] {
  const areas = raw
    .split(",")
    .map((area) => area.trim())
    .filter((area) => area !== "");
  return areas.length > 0 ? areas : [...DEFAULT_AREAS];
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Normalizes and validates a thread title of the form `Area: summary`.
 * Cosmetic issues (spacing, a final period, a capital first letter of the
 * summary) are fixed; everything else is reported so the caller can retry.
 */
export function checkTitle(
  raw: string,
  areas: readonly string[],
  maxLength: number,
): TitleCheck {
  const collapsed = raw.replace(/\s+/gu, " ").trim();
  const match = /^([^:]{1,24}):\s*(.*)$/u.exec(collapsed);
  const problems: string[] = [];

  if (match === null) {
    return {
      ok: false,
      problems: [
        `use the form "Area: summary", with Area one of: ${areas.join(", ")}`,
      ],
    };
  }
  const area = match[1]!.trim();
  let summary = match[2]!.trim().replace(/[.\s]+$/u, "");

  if (!areas.includes(area)) {
    problems.push(`area "${area}" is not allowed; use one of: ${areas.join(", ")}`);
  }
  if (summary.length < 3) problems.push("the summary after the colon is too short");
  if (CYRILLIC.test(collapsed)) problems.push("write the title in English");
  if (EMOJI.test(collapsed)) problems.push("no emoji");
  if (/^\[/u.test(collapsed)) {
    problems.push("no [provider · model] prefix; the sidebar shows the agent");
  }
  if (/^\p{Lu}\p{Ll}/u.test(summary)) {
    summary = summary.charAt(0).toLowerCase() + summary.slice(1);
  }
  const title = `${area}: ${summary}`;
  if (title.length > maxLength) {
    problems.push(`${title.length} characters; keep it to ${maxLength} or fewer`);
  }
  return problems.length === 0 ? { ok: true, title } : { ok: false, problems };
}

/** The standing instruction every thread's agent receives. */
export function titleInstruction(
  areas: readonly string[],
  maxLength: number,
): string {
  return [
    "Thread title (digest plugin): on your first turn, name this thread once with",
    '`bb digest title "Area: summary"`.',
    `- Area is one of: ${areas.join(", ")}.`,
    `- The summary is a short noun phrase for the result in English, lowercase start, no final period; the whole title is at most ${maxLength} characters.`,
    '- Example: `bb digest title "Schedule: hours by school weeks"`.',
    "- No model or provider in the title. If the command says the thread is already titled, do nothing.",
  ].join("\n");
}
