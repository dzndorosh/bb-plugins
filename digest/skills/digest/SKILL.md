---
name: digest
description: Write the short summary card (digest) that the user sees when hovering this thread in the bb sidebar. Use at the end of every turn that did real work, asked the user for a decision, or changed what the user must do next.
---

# Thread digest and title

The user keeps many threads. When they hover one in the sidebar, bb shows a card
built from the digest you wrote. Write it so they can decide what to do
without opening the thread.

## Command

```sh
bb digest set --data "$(cat <<'EOF_DIGEST'
{
  "title": "Расписание: проверка часов по полугодиям",
  "badge": "review",
  "metrics": [
    {"value": "34", "label": "урока в плане"},
    {"value": "0", "label": "ошибок проверки", "tone": "good"}
  ],
  "done": [
    {"text": "Часы считаются по учебным неделям", "chips": ["schedule.ts"]}
  ],
  "needs": [
    {"id": "check-ui", "text": "Проверить панель «Проверить» в браузере", "approvable": true},
    {"id": "dates", "text": "Уточнить даты каникул у завуча"}
  ]
}
EOF_DIGEST
)"
```

`bb digest show` prints the current digest; `bb digest clear` removes it.

## Fields and limits

- `title` (required, 90): what the thread is about, in the user's language.
- `badge` (24): what you expect from the user: `review`, `review ui`, `question`, `done`.
- `metrics` (up to 4; `value` 12, `label` 32): real numbers only: tests passed,
  files changed, lessons counted. `tone`: `good`, `warn` or `bad`. Skip the
  field when you have no honest number.
- `done` (up to 6; `text` 140): what you finished, one line each. `chips` (up to
  2, 20 chars) name a file or report, with no paths.
- `needs` (up to 5; `text` 140): what the user must do or decide. `id` is
  `a-z0-9-`. `approvable: true` adds an Approve button; pressing it sends the
  user's "Одобрено: <text>" into this thread. Without it the item is a plain
  reminder.

## Rules

- Write one digest per turn that did real work; each call replaces the last.
  Skip pure chat answers.
- State only what happened. Do not claim tests passed that you did not run.
- Keep `needs` empty when nothing is waiting on the user.
- Never put secrets or private data in a digest.

## Thread title

On the first turn of a thread, name it once:

```sh
bb digest title "Schedule: hours by school weeks"
```

- Form `Area: summary`, in English. Area is one of the allowed list; the command prints the list when you get it wrong.
- The summary is a short noun phrase for the result, lowercase start, no final period; at most 50 characters in total.
- No model or provider in the title.
- If the command says the thread is already titled, do nothing. `--dry-run` only checks.
