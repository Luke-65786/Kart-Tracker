import test from "node:test";
import assert from "node:assert/strict";
import legacySample from "./fixtures/laptimes.json" with { type: "json" };
import { restoreSessions } from "../src/lib/savedSessions.js";
import { combineSessions } from "../src/lib/combineSessions.js";
import { summarizeSession } from "../src/lib/timing.js";

const uploaded = {
  id: "real-upload",
  name: "A Final",
  fileName: "A_Final_laptimes.xlsx",
  isSample: false,
  folderId: "track",
  sheets: 1,
  skipped: 0,
  karts: [{ number: "44", laps: [{ lap: 1, seconds: 77, sheet: "Laptimes" }] }],
};
const { folderId: oldFolderId, ...uploadedData } = uploaded;
const migratedUpload = { ...uploadedData, folderIds: [oldFolderId] };

test("new, empty, and unreadable saved workspaces have no starter sessions", () => {
  for (const value of [null, undefined, [], {}, "invalid"])
    assert.deepEqual(restoreSessions(value), []);
  assert.deepEqual(restoreSessions([legacySample]), []);
  assert.deepEqual(restoreSessions([{ ...legacySample, isSample: false }]), []);
});

test("upgrades remove the old sample while preserving real uploads, including matching names and folder membership", () => {
  const restored = restoreSessions([legacySample, uploaded]);
  assert.deepEqual(restored, [migratedUpload]);
  assert.equal(restored[0].karts, uploaded.karts);
  assert.equal(uploaded.folderId, "track");
});

test("removes sample laps from combined analyses without removing uploaded laps or changing their saved names", () => {
  const combined = {
    ...combineSessions([legacySample, uploaded], "My analysis"),
    folderId: "track",
  };
  const before = JSON.stringify(combined);
  const restored = restoreSessions([legacySample, uploaded, combined]);
  assert.equal(restored.length, 2);
  const migrated = restored[1];
  assert.equal(migrated.name, "My analysis");
  assert.deepEqual(migrated.folderIds, ["track"]);
  assert.equal(migrated.sources.length, 1);
  assert.equal(migrated.sources[0].id, uploaded.id);
  assert.equal(summarizeSession(migrated).totalLaps, 1);
  assert.equal(summarizeSession(migrated).karts[0].number, "44");
  assert.equal(JSON.stringify(combined), before);
  assert.deepEqual(restoreSessions(restored), restored);
});

test("one malformed stored entry does not discard unrelated valid uploads", () => {
  assert.deepEqual(restoreSessions([null, {}, uploaded]), [migratedUpload]);
});

test("folder memberships upgrade safely and remain stable after removing the last assignment", () => {
  const before = JSON.stringify(uploaded);
  const restored = restoreSessions([
    uploaded,
    {
      ...uploaded,
      id: "shared",
      folderIds: ["track", "other", "track", null, 1, ""],
    },
    { ...uploaded, id: "unfiled", folderIds: [] },
    { ...uploadedData, id: "never-filed" },
  ]);
  assert.deepEqual(
    restored.map((session) => session.folderIds),
    [["track"], ["track", "other"], [], []],
  );
  assert.ok(restored.every((session) => !Object.hasOwn(session, "folderId")));
  assert.equal(JSON.stringify(uploaded), before);
  assert.deepEqual(restoreSessions(restored), restored);
  assert.equal(restored[1].karts, uploaded.karts);
});

test("empty timing summaries have no kart data or invented times", () => {
  assert.deepEqual(summarizeSession(undefined), {
    karts: [],
    totalLaps: 0,
    average: null,
    fastest: null,
  });
});

test("temporary analyses are never restored, while originals and previously saved analyses remain", () => {
  const second = { ...uploaded, id: "second-upload", name: "Second heat" };
  const legacy = combineSessions([uploaded, second], "Previously saved");
  const temporary = combineSessions([uploaded, second], "Temporary preview", {
    temporary: true,
  });
  const restored = restoreSessions([uploaded, second, legacy, temporary]);
  assert.deepEqual(
    restored.map((session) => session.id),
    [uploaded.id, second.id, legacy.id],
  );
  assert.equal(summarizeSession(restored[2]).totalLaps, 2);
  assert.equal(temporary.isTemporary, true);
});
