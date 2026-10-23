import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
} from "../src/lib/preferences.js";

test("unavailable or malformed preferences recover to an empty workspace's display defaults", () => {
  for (const value of [
    undefined,
    null,
    [],
    "invalid",
    42,
    { theme: "unknown", scale: "125", density: "tiny", defaultSort: "name" },
  ]) {
    assert.deepEqual(normalizePreferences(value), DEFAULT_PREFERENCES);
  }
});

test("saved display preferences retain supported choices and ignore unrelated data", () => {
  assert.deepEqual(
    normalizePreferences({
      theme: "light",
      scale: 115,
      density: "compact",
      showTrends: false,
      defaultSort: "number",
      reduceMotion: true,
      sessions: ["unrelated"],
    }),
    {
      theme: "light",
      scale: 115,
      density: "compact",
      showTrends: false,
      defaultSort: "number",
      reduceMotion: true,
    },
  );
  assert.equal(
    normalizePreferences({ showTrends: "false", reduceMotion: "true" })
      .showTrends,
    true,
  );
  assert.equal(
    normalizePreferences({ reduceMotion: "true" }).reduceMotion,
    false,
  );
});

test("saved UI scales are bounded and rounded so a corrupt setting cannot make controls inaccessible", () => {
  for (const [scale, expected] of [
    [0, 80],
    [-100, 80],
    [9999, 125],
    [112, 110],
    [113, 115],
    [NaN, 100],
    [Infinity, 100],
  ]) {
    assert.equal(normalizePreferences({ scale }).scale, expected);
  }
});
