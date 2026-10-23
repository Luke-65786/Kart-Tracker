import test from "node:test";
import assert from "node:assert/strict";
import { combineSessions } from "../src/lib/combineSessions.js";
import { summarizeSession, resultsCsv } from "../src/lib/timing.js";

function session(id, times, extras = {}) {
  return {
    id,
    name: `Heat ${id}`,
    fileName: `${id}.xlsx`,
    skipped: 1,
    sheets: 1,
    karts: Object.entries(times).map(([number, laps]) => ({
      number,
      laps: laps.map((seconds, i) => ({
        lap: i + 1,
        seconds,
        sheet: "Laptimes",
      })),
    })),
    ...extras,
  };
}

test("combines matching kart numbers by pooling raw laps and weighting unequal sessions correctly", () => {
  const first = session("A", { 2: [60], 7: [70] });
  const second = session("B", { 2: [90, 90, 90], 8: [80] });
  const before = JSON.stringify([first, second]);
  const combined = combineSessions([first, second], "  Race day  ");
  const stats = summarizeSession(combined);
  assert.equal(combined.name, "Race day");
  assert.equal(combined.isCombined, true);
  assert.equal(stats.totalLaps, 6);
  assert.equal(stats.karts.length, 3);
  assert.equal(stats.karts.find((k) => k.number === "2").average, 82.5);
  assert.equal(stats.average, 80);
  assert.equal(combined.skipped, 2);
  assert.equal(combined.sources.length, 2);
  assert.equal(combined.karts[0].laps[0].sourceName, "Heat A");
  assert.equal(combined.karts[0].laps[1].sourceName, "Heat B");
  assert.equal(JSON.stringify([first, second]), before);
  assert.ok(resultsCsv(combined).includes("2,4,82.500,60.000,90.000"));
});

test("overlapping combined sessions and originals count each source session once", () => {
  const a = session("A", { 2: [60] });
  const b = session("B", { 2: [70, 80] });
  const c = session("C", { 2: [90] });
  const ab = combineSessions([a, b]);
  const bc = combineSessions([b, c]);
  const combined = combineSessions([ab, bc, a]);
  assert.equal(combined.sources.length, 3);
  assert.equal(combined.sheets, 3);
  assert.equal(combined.skipped, 3);
  assert.deepEqual(
    combined.karts[0].laps.map((l) => l.seconds),
    [60, 70, 80, 90],
  );
  assert.equal(summarizeSession(combined).karts[0].average, 75);
  assert.deepEqual(
    combined.karts[0].laps.map((l) => l.sourceId),
    ["A", "B", "B", "C"],
  );
});

test("requires two distinct sources and supports existing sessions with optional metadata absent", () => {
  const a = session("A", { 13: [61] });
  const b = session("B", { 13: [63] });
  delete b.sheets;
  delete b.skipped;
  assert.throws(() => combineSessions([]), /at least two/);
  assert.throws(() => combineSessions([a, a]), /at least two/);
  const combined = combineSessions([a, b], "");
  assert.equal(combined.name, "Combined analysis");
  assert.equal(combined.sheets, 2);
  assert.equal(combined.skipped, 1);
  assert.equal(summarizeSession(combined).totalLaps, 2);
});
