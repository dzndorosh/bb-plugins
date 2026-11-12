import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AREAS,
  checkTitle,
  parseAreas,
  titleInstruction,
} from "./title-rules.ts";

const areas = [...DEFAULT_AREAS];

test("accepts a well-formed title", () => {
  assert.deepEqual(checkTitle("Schedule: hours by school weeks", areas, 50), {
    ok: true,
    title: "Schedule: hours by school weeks",
  });
});

test("fixes spacing, a final period and a capitalized summary", () => {
  assert.deepEqual(checkTitle("  Chat:   Fix  send retry. ", areas, 50), {
    ok: true,
    title: "Chat: fix send retry",
  });
});

test("keeps acronyms capitalized", () => {
  const result = checkTitle("Backend: PDF export", areas, 50);
  assert.deepEqual(result, { ok: true, title: "Backend: PDF export" });
});

test("rejects Russian text", () => {
  const result = checkTitle("Chat: исправить отправку", areas, 50);
  assert.equal(result.ok, false);
});

test("rejects an unknown area and lists the allowed ones", () => {
  const result = checkTitle("Cooking: pasta", areas, 50);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.problems.join(" "), /Schedule/u);
});

test("rejects a missing colon", () => {
  assert.equal(checkTitle("fix the thing", areas, 50).ok, false);
});

test("rejects a title over the length limit", () => {
  const long = `Chat: ${"x".repeat(60)}`;
  const result = checkTitle(long, areas, 50);
  assert.equal(result.ok, false);
});

test("rejects a provider prefix and emoji", () => {
  assert.equal(checkTitle("[Codex · Sol] Chat: fix retry", areas, 50).ok, false);
  assert.equal(checkTitle("Chat: fix retry 🚀", areas, 50).ok, false);
});

test("parseAreas trims and falls back to the defaults", () => {
  assert.deepEqual(parseAreas(" A, B ,,C "), ["A", "B", "C"]);
  assert.deepEqual(parseAreas("  "), [...DEFAULT_AREAS]);
});

test("the instruction names the areas and the limit", () => {
  const text = titleInstruction(["A", "B"], 42);
  assert.match(text, /A, B/u);
  assert.match(text, /42/u);
});
