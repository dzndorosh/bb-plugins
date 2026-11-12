import assert from "node:assert/strict";
import test from "node:test";
import { buildTree } from "./tree.ts";

const t = (
  id: string,
  parentId: string | null,
  lane: "needs" | "running" | "done" | "other",
  updatedAt: number,
) => ({ id, parentId, lane, updatedAt });

test("nests children under their parent, newest first", () => {
  const tree = buildTree([
    t("p", null, "done", 10),
    t("a", "p", "done", 20),
    t("b", "p", "done", 30),
  ]);
  assert.equal(tree.length, 1);
  assert.deepEqual(tree[0]!.children.map((n) => n.item.id), ["b", "a"]);
  assert.equal(tree[0]!.descendants, 2);
});

test("the parent takes the most urgent lane of its subtree", () => {
  const tree = buildTree([
    t("p", null, "other", 1),
    t("a", "p", "running", 2),
    t("b", "p", "needs", 3),
  ]);
  assert.equal(tree[0]!.lane, "needs");
  assert.equal(tree[0]!.needs, 1);
  assert.equal(tree[0]!.running, 1);
  assert.equal(tree[0]!.latest, 3);
});

test("counts grandchildren and rolls their lanes up", () => {
  const tree = buildTree([
    t("p", null, "done", 1),
    t("a", "p", "done", 2),
    t("g", "a", "needs", 3),
  ]);
  assert.equal(tree[0]!.descendants, 2);
  assert.equal(tree[0]!.needs, 1);
  assert.equal(tree[0]!.children[0]!.lane, "needs");
});

test("a child whose parent is missing becomes a root", () => {
  const tree = buildTree([t("a", "gone", "done", 5), t("p", null, "done", 9)]);
  assert.deepEqual(tree.map((n) => n.item.id), ["p", "a"]);
});

test("roots are ordered by the newest update in their subtree", () => {
  const tree = buildTree([
    t("old", null, "done", 1),
    t("new", null, "done", 5),
    t("c", "old", "done", 9),
  ]);
  assert.deepEqual(tree.map((n) => n.item.id), ["old", "new"]);
});

test("a parent cycle does not hang", () => {
  const tree = buildTree([t("a", "b", "done", 1), t("b", "a", "done", 2)]);
  assert.deepEqual(tree, []);
});
