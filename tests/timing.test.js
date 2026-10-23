import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  kartNumber,
  parseLapTime,
  formatTime,
  summarizeSession,
  resultsCsv,
} from "../src/lib/timing.js";

test("kart headings discard names and retain only the number", () => {
  assert.equal(kartNumber("2 - A driver"), "2");
  assert.equal(kartNumber("Kart #013"), "13");
  assert.equal(kartNumber("24 – Another driver"), "24");
  assert.equal(kartNumber(7), "7");
  assert.equal(kartNumber("Lap"), null);
  assert.equal(kartNumber("A Final"), null);
  assert.equal(kartNumber(-4), null);
});

test("lap times support decimal seconds, formatted strings, formulas, and Excel time cells", () => {
  assert.equal(parseLapTime(62.125), 62.125);
  assert.equal(parseLapTime("1:02.125"), 62.125);
  assert.equal(parseLapTime("1:01:02.125"), 3662.125);
  assert.equal(parseLapTime("62,125"), 62.125);
  assert.equal(parseLapTime({ formula: "A1+1", result: 62.125 }), 62.125);
  assert.equal(parseLapTime(62.125, '0.000 "s"'), 62.125);
  assert.ok(
    Math.abs(parseLapTime(62.125 / 86400, "mm:ss.000") - 62.125) < 1e-9,
  );
  for (const v of ["", null, undefined, "DNF", "-", 0, -1, NaN, "1:85.000"])
    assert.equal(parseLapTime(v), null);
});

test("formatting rounds milliseconds across minute boundaries", () => {
  assert.equal(formatTime(60.614), "1:00.614");
  assert.equal(formatTime(59.9999), "1:00.000");
  assert.equal(formatTime(7.1), "0:07.100");
});

test("the supplied workbook fixture has 12 karts, 300 laps and exact per-kart averages", async () => {
  const sample = JSON.parse(
    await readFile(new URL("./fixtures/laptimes.json", import.meta.url)),
  );
  const stats = summarizeSession(sample);
  assert.equal(stats.karts.length, 12);
  assert.equal(stats.totalLaps, 300);
  assert.equal(stats.karts[0].number, "13");
  assert.ok(Math.abs(stats.karts[0].average - 61.11748) < 1e-8);
  assert.ok(
    Math.abs(stats.karts.find((k) => k.number === "2").average - 62.5256) <
      1e-8,
  );
  assert.equal(stats.fastest.best, 60.614);
  assert.equal(stats.karts[0].count, 25);
  assert.equal(formatTime(stats.karts[0].average), "1:01.117");
  const csv = resultsCsv(sample);
  assert.equal(csv.split("\r\n").length, 13);
  assert.ok(csv.includes("1,13,25,61.117,60.614"));
  assert.ok(!csv.includes("Driver"));
});

test("session average weights by lap count instead of averaging kart averages", () => {
  const stats = summarizeSession({
    karts: [
      { number: "1", laps: [{ seconds: 60 }] },
      {
        number: "2",
        laps: [{ seconds: 90 }, { seconds: 90 }, { seconds: 90 }],
      },
    ],
  });
  assert.equal(stats.average, 82.5);
  assert.equal(stats.totalLaps, 4);
});
