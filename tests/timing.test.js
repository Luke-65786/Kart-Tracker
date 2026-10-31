import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  kartNumber,
  parseLapTime,
  formatTime,
  summarizeSession,
  resultsCsv,
  summarizeKart,
  iqrRange,
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

test("the supplied workbook fixture has 12 karts, 300 raw laps and independently checked IQR-filtered averages", async () => {
  const sample = JSON.parse(
    await readFile(new URL("./fixtures/laptimes.json", import.meta.url)),
  );
  const stats = summarizeSession(sample);
  assert.equal(stats.karts.length, 12);
  assert.equal(stats.recordedLaps, 300);
  assert.equal(stats.totalLaps, 280);
  assert.equal(stats.excludedLaps, 20);
  assert.equal(stats.karts[0].number, "13");
  assert.ok(Math.abs(stats.karts[0].average - 60.859863636363634) < 1e-8);
  assert.ok(
    Math.abs(
      stats.karts.find((k) => k.number === "2").average - 62.31691304347826,
    ) < 1e-8,
  );
  assert.equal(stats.fastest.best, 60.614);
  assert.equal(stats.karts[0].count, 22);
  assert.equal(formatTime(stats.karts[0].average), "1:00.860");
  const csv = resultsCsv(sample);
  assert.equal(csv.split("\r\n").length, 13);
  assert.ok(csv.includes("1,13,22,60.860,60.614"));
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

function kart(times, number = "2") {
  return {
    number,
    laps: times.map((seconds, i) => ({ lap: i + 1, seconds, sheet: "Laps" })),
  };
}

test("IQR uses inclusive interpolated quartiles without sorting or changing original laps", () => {
  const times = [8, 1, 7, 2, 6, 3, 5, 4];
  const before = [...times];
  assert.deepEqual(iqrRange(times), {
    q1: 2.75,
    q3: 6.25,
    iqr: 3.5,
    lower: -2.5,
    upper: 11.5,
  });
  assert.deepEqual(times, before);
});

test("IQR rejects fast and slow outliers while preserving their original indices and values", () => {
  const raw = kart([5, 59, 60, 60, 61, 62, 63, 64, 65, 180]);
  const before = JSON.stringify(raw);
  const result = summarizeKart(raw);
  assert.equal(result.count, 8);
  assert.equal(result.recordedCount, 10);
  assert.equal(result.excludedCount, 2);
  assert.deepEqual(result.excludedIndices, [0, 9]);
  assert.equal(result.average, 61.75);
  assert.equal(result.best, 59);
  assert.equal(result.worst, 65);
  assert.equal(result.allLaps, raw.laps);
  assert.equal(JSON.stringify(raw), before);
  const scaled = summarizeKart(kart(raw.laps.map((lap) => lap.seconds * 10)));
  assert.deepEqual(scaled.excludedIndices, result.excludedIndices);
});

test("IQR keeps boundary laps, handles equal times, and leaves fewer than four laps unchanged", () => {
  const boundary = summarizeKart(kart([8.5, 10, 10, 10, 11, 11, 11, 12.5]));
  assert.equal(boundary.excludedCount, 0);
  assert.equal(boundary.iqrRange.lower, 8.5);
  assert.equal(boundary.iqrRange.upper, 12.5);
  const decimals = summarizeKart(
    kart([0.085, 0.1, 0.1, 0.1, 0.11, 0.11, 0.11, 0.125]),
  );
  assert.equal(decimals.excludedCount, 0);
  assert.equal(summarizeKart(kart([60, 60, 60, 60])).excludedCount, 0);
  assert.equal(summarizeKart(kart([60, 60, 60, 60, 61])).average, 60);
  assert.equal(summarizeKart(kart([60, 60, 60, 60, 61])).excludedCount, 1);
  for (const times of [[1], [1, 3000], [1, 60, 600]]) {
    const result = summarizeKart(kart(times));
    assert.equal(result.iqrRange, null);
    assert.equal(result.count, times.length);
  }
});

test("ranking, deltas, best laps, weighted averages and CSV all use the same IQR-included laps", () => {
  const raw = {
    karts: [
      kart([1, 40, 41, 42, 43, 44, 120]),
      kart([2, 44, 45, 46, 47, 48, 150], "13"),
    ],
  };
  const stats = summarizeSession(raw);
  assert.equal(stats.totalLaps, 10);
  assert.equal(stats.recordedLaps, 14);
  assert.equal(stats.excludedLaps, 4);
  assert.equal(stats.average, 44);
  assert.equal(stats.fastest.best, 40);
  assert.equal(stats.karts[1].delta, 4);
  assert.ok(
    resultsCsv(raw).includes("1,2,5,42.000,40.000,44.000,1.414,7,2,0.000"),
  );
  assert.ok(resultsCsv(raw).includes("Recorded laps,IQR excluded"));
});
