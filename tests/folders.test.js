import test from "node:test";
import assert from "node:assert/strict";
import {
  folderAnalysis,
  folderName,
  unfileFolder,
} from "../src/lib/folders.js";
import { combineSessions } from "../src/lib/combineSessions.js";
import {
  formatDelta,
  summarizeSession,
  resultsCsv,
} from "../src/lib/timing.js";

const folder = { id: "track", name: "Race day" };
function session(id, times, folderId = folder.id) {
  return {
    id,
    name: id,
    fileName: `${id}.xlsx`,
    folderId,
    sheets: 1,
    skipped: 0,
    karts: Object.entries(times).map(([number, values]) => ({
      number,
      laps: values.map((seconds, i) => ({
        lap: i + 1,
        seconds,
        sheet: "Laptimes",
      })),
    })),
  };
}

test("folder comparison supports an empty folder and a single file without changing stored sessions", () => {
  const a = session("Morning", { 2: [60], 13: [64] });
  const before = JSON.stringify(a);
  assert.equal(folderAnalysis(folder, []), null);
  const overall = folderAnalysis(folder, [a]);
  assert.equal(overall.id, "folder:track");
  assert.equal(overall.isFolder, true);
  assert.equal(overall.sources.length, 1);
  assert.equal(summarizeSession(overall).totalLaps, 2);
  assert.equal(JSON.stringify(a), before);
});

test("folder averages and deltas use all member laps, excluding other folders and unfiled files", () => {
  const a = session("Morning", { 2: [60], 13: [64] });
  const b = session("Afternoon", { 2: [90, 90, 90], 13: [66, 66, 66] });
  const outside = session("Elsewhere", { 2: [1], 13: [1] }, "other-track");
  const unfiled = session("Unfiled", { 2: [2] }, null);
  const stats = summarizeSession(
    folderAnalysis(folder, [a, b, outside, unfiled]),
  );
  assert.equal(stats.totalLaps, 8);
  assert.equal(stats.karts[0].number, "13");
  assert.equal(stats.karts[0].average, 65.5);
  assert.equal(stats.karts[0].delta, 0);
  assert.equal(stats.karts[1].average, 82.5);
  assert.equal(stats.karts[1].delta, 17);
  assert.equal(formatDelta(stats.karts[1].delta), "+17.000s");
});

test("folder comparisons update after membership changes and deduplicate overlapping combined analyses", () => {
  const a = session("A", { 2: [60] });
  const b = session("B", { 2: [90, 90, 90] });
  const combined = { ...combineSessions([a, b]), folderId: folder.id };
  const stats = summarizeSession(folderAnalysis(folder, [a, b, combined]));
  assert.equal(stats.totalLaps, 4);
  assert.equal(stats.karts[0].average, 82.5);
  const moved = { ...b, folderId: "elsewhere" };
  const updated = summarizeSession(folderAnalysis(folder, [a, moved]));
  assert.equal(updated.totalLaps, 1);
  assert.equal(updated.karts[0].average, 60);
});

test("removing a folder preserves every session and leaves other memberships untouched", () => {
  const a = session("A", { 2: [60] });
  const b = session("B", { 13: [70] }, "other-track");
  const next = unfileFolder([a, b], folder.id);
  assert.equal(next.length, 2);
  assert.equal(next[0].folderId, null);
  assert.deepEqual(next[0].karts, a.karts);
  assert.equal(a.folderId, folder.id);
  assert.equal(next[1], b);
});

test("folder names are trimmed, unique, and safely renameable", () => {
  assert.equal(folderName("  Practice  ", [folder]), "Practice");
  assert.equal(folderName("race DAY", [folder], folder.id), "race DAY");
  assert.throws(() => folderName("race DAY", [folder]), /already exists/);
  assert.throws(() => folderName("  ", []), /name/);
});

test("delta formatting and CSV exports preserve zero gaps, ties, and millisecond precision", () => {
  assert.equal(formatDelta(0), "0.000s");
  assert.equal(formatDelta(0.53312), "+0.533s");
  assert.equal(formatDelta(0.00001), "0.000s");
  assert.equal(formatDelta(NaN), "—");
  const tied = session("Tied", { 2: [60], 13: [60], 7: [61.25] });
  const stats = summarizeSession(tied);
  assert.deepEqual(
    stats.karts.map((k) => k.delta),
    [0, 0, 1.25],
  );
  const rows = resultsCsv(tied)
    .split("\r\n")
    .map((line) => line.split(","));
  assert.equal(rows[0].at(-1), "Gap to fastest average (seconds)");
  assert.deepEqual(
    rows.slice(1).map((row) => row.at(-1)),
    ["0.000", "0.000", "1.250"],
  );
});
