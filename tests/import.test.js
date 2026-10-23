import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { importWorkbook } from "../src/lib/importWorkbook.js";
import { summarizeSession } from "../src/lib/timing.js";

test("imports numbered bold headings, ignores summaries, skips invalid laps, and discards driver names", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laptimes");
  sheet.addRow(["Test final"]);
  sheet.addRow(["Lap times"]);
  sheet.addRow(["Lap", "2 - Private driver", "13 - Another private driver"]);
  sheet.getRow(3).font = { bold: true };
  sheet.addRow([1, 62.1, "1:00.500"]);
  sheet.addRow([2, 61.9, 60.4]);
  sheet.addRow([3, "DNF", 0]);
  sheet.addRow(["Average", 123, 456]);
  const imported = await importWorkbook(
    await wb.xlsx.writeBuffer(),
    "test.xlsx",
  );
  assert.equal(imported.name, "Test final");
  assert.equal(imported.skipped, 2);
  assert.deepEqual(
    imported.karts.map((k) => k.number),
    ["2", "13"],
  );
  assert.equal(summarizeSession(imported).totalLaps, 4);
  assert.equal(
    summarizeSession(imported).karts.find((k) => k.number === "2").average,
    62,
  );
  assert.ok(!JSON.stringify(imported).includes("Private driver"));
  assert.ok(!JSON.stringify(imported).includes("Another private driver"));
});

test("combines matching kart numbers from multiple worksheets and header blocks", async () => {
  const wb = new ExcelJS.Workbook();
  for (const name of ["Heat 1", "Heat 2"]) {
    const sheet = wb.addWorksheet(name);
    sheet.addRow(["Lap", "Kart 2", "Kart 13"]);
    sheet.addRow([1, 60, 62]);
    sheet.addRow([2, 64, 61]);
  }
  const session = await importWorkbook(
    await wb.xlsx.writeBuffer(),
    "weekend.xlsx",
  );
  assert.equal(session.sheets, 2);
  assert.equal(session.karts[0].laps.length, 4);
  assert.equal(summarizeSession(session).totalLaps, 8);
});

test("rejects unreadable files and workbooks without a lap table", async () => {
  await assert.rejects(
    importWorkbook(new Uint8Array([1, 2, 3]), "broken.xlsx"),
    /could not be read/,
  );
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Notes").addRow(["No race data here"]);
  await assert.rejects(
    importWorkbook(await wb.xlsx.writeBuffer(), "notes.xlsx"),
    /No lap times found/,
  );
});

test("Excel time-formatted cells retain their duration when read as Date objects", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laps");
  sheet.addRow(["Lap", "Kart 4"]);
  sheet.addRow([1, 62.125 / 86400]);
  sheet.getCell("B2").numFmt = "mm:ss.000";
  const session = await importWorkbook(
    await wb.xlsx.writeBuffer(),
    "times.xlsx",
  );
  assert.ok(Math.abs(session.karts[0].laps[0].seconds - 62.125) < 0.002);
});

test("supports namespace-prefixed XML from timing exporters, including document properties", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laptimes");
  sheet.addRow(["Lap", "13 - Private name"]);
  sheet.addRow([1, 60.614]);
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  for (const entry of Object.values(zip.files)) {
    if (!/^(xl\/|docProps\/).*\.xml$/.test(entry.name) || entry.dir) continue;
    let xml = await entry.async("string");
    if (
      !/xmlns="http:\/\/schemas.openxmlformats.org\/(spreadsheetml\/2006\/main|officeDocument\/2006\/extended-properties)"/.test(
        xml,
      )
    )
      continue;
    xml = xml
      .replace('xmlns="', 'xmlns:exporter="')
      .replace(/(<\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, "$1exporter:$2");
    zip.file(entry.name, xml);
  }
  const session = await importWorkbook(
    await zip.generateAsync({ type: "uint8array" }),
    "exporter.xlsx",
  );
  assert.equal(session.karts[0].number, "13");
  assert.equal(session.karts[0].laps[0].seconds, 60.614);
});
