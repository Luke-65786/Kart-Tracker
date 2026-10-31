import test from "node:test";
import assert from "node:assert/strict";
import {
  folderAnalysis,
  folderName,
  unfileFolder,
  inFolder,
  withFolderMembership,
} from "../src/lib/folders.js";
import { combineSessions } from "../src/lib/combineSessions.js";
import {
  formatDelta,
  summarizeSession,
  resultsCsv,
} from "../src/lib/timing.js";

const folder = { id: "track", name: "Race day" };
function session(id, times, folderIds = [folder.id]) {
  return {
    id,
    name: id,
    fileName: `${id}.xlsx`,
    folderIds,
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

test("folder averages and deltas apply IQR to pooled member laps, excluding other folders and unfiled files", () => {
  const a = session("Morning", { 2: [60], 13: [64] });
  const b = session("Afternoon", { 2: [90, 90, 90], 13: [66, 66, 66] });
  const outside = session("Elsewhere", { 2: [1], 13: [1] }, ["other-track"]);
  const unfiled = session("Unfiled", { 2: [2] }, []);
  const stats = summarizeSession(
    folderAnalysis(folder, [a, b, outside, unfiled]),
  );
  assert.equal(stats.totalLaps, 6);
  assert.equal(stats.karts[0].number, "13");
  assert.equal(stats.karts[0].average, 66);
  assert.equal(stats.karts[0].delta, 0);
  assert.equal(stats.karts[1].average, 90);
  assert.equal(stats.karts[1].delta, 24);
  assert.equal(formatDelta(stats.karts[1].delta), "+24.000s");
});

test("folder comparisons update after membership changes and deduplicate overlapping combined analyses", () => {
  const a = session("A", { 2: [60] });
  const b = session("B", { 2: [90, 90, 90] });
  const combined = { ...combineSessions([a, b]), folderIds: [folder.id] };
  const stats = summarizeSession(folderAnalysis(folder, [a, b, combined]));
  assert.equal(stats.totalLaps, 3);
  assert.equal(stats.karts[0].average, 90);
  const moved = { ...b, folderIds: ["elsewhere"] };
  const updated = summarizeSession(folderAnalysis(folder, [a, moved]));
  assert.equal(updated.totalLaps, 1);
  assert.equal(updated.karts[0].average, 60);
});

test("removing a folder preserves every session and leaves other memberships untouched", () => {
  const a = session("A", { 2: [60] }, [folder.id, "other-track"]);
  const b = session("B", { 13: [70] }, ["other-track"]);
  const next = unfileFolder([a, b], folder.id);
  assert.equal(next.length, 2);
  assert.deepEqual(next[0].folderIds, ["other-track"]);
  assert.deepEqual(next[0].karts, a.karts);
  assert.deepEqual(a.folderIds, [folder.id, "other-track"]);
  assert.equal(next[1], b);
});

test("sharing a session adds its laps once to each folder, with independent averages and removals", () => {
  const original = session("Shared heat", { 2: [60], 13: [64] });
  const shared = withFolderMembership(
    withFolderMembership(original, "other-track", true),
    "other-track",
    true,
  );
  assert.deepEqual(shared.folderIds, [folder.id, "other-track"]);
  assert.deepEqual(original.folderIds, [folder.id]);
  assert.equal(shared.karts, original.karts);
  const a = session("Race heat", { 2: [90, 90, 90], 13: [66, 66, 66] });
  const b = session("Other heat", { 2: [58], 13: [70] }, ["other-track"]);
  const other = { id: "other-track", name: "Other track" };
  const combined = { ...combineSessions([shared, a]), folderIds: [folder.id] };
  const saved = [shared, a, b, combined];
  const raceStats = summarizeSession(folderAnalysis(folder, saved));
  const otherStats = summarizeSession(folderAnalysis(other, saved));
  assert.equal(raceStats.totalLaps, 6);
  assert.equal(raceStats.karts.find((kart) => kart.number === "2").average, 90);
  assert.equal(otherStats.totalLaps, 4);
  assert.equal(
    otherStats.karts.find((kart) => kart.number === "2").average,
    59,
  );
  assert.equal(otherStats.karts.find((kart) => kart.number === "13").delta, 8);
  const removed = withFolderMembership(shared, folder.id, false);
  assert.equal(inFolder(removed, folder.id), false);
  assert.equal(inFolder(removed, other.id), true);
  assert.deepEqual(
    summarizeSession(folderAnalysis(other, [removed, a, b, combined])),
    otherStats,
  );
  const unfiled = withFolderMembership(removed, other.id, false);
  assert.deepEqual(unfiled.folderIds, []);
  assert.equal(unfiled.karts, original.karts);
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
