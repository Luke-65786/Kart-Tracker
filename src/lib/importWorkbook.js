import ExcelJS from "exceljs";
import JSZip from "jszip";
import { kartNumber, parseLapTime } from "./timing.js";

function cellValue(cell) {
  const v = cell.value;
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

function readHeader(row) {
  let lapColumn = null;
  const columns = [];
  row.eachCell((cell, column) => {
    const value = cellValue(cell);
    if (
      typeof value === "string" &&
      /^lap(?:s|\s*(?:#|no\.?|number))?$/i.test(value.trim())
    )
      lapColumn = column;
    else {
      const number = kartNumber(value);
      if (number !== null) columns.push({ column, number });
    }
  });
  return lapColumn !== null && columns.length ? { lapColumn, columns } : null;
}

export async function importWorkbook(buffer, fileName) {
  const workbook = new ExcelJS.Workbook();
  try {
    // Timing exporters can qualify every SpreadsheetML tag (e.g. x:workbook).
    // ExcelJS expects unprefixed elements. Normalize those namespaces in memory,
    // preserving cell contents and relationship attributes such as r:id.
    const zip = await JSZip.loadAsync(buffer);
    let normalized = false;
    for (const entry of Object.values(zip.files)) {
      if (!/^(xl\/|docProps\/).*\.xml$/.test(entry.name) || entry.dir) continue;
      let xml = await entry.async("string");
      const namespaces = [
        ...xml.matchAll(
          /xmlns:([A-Za-z_][\w.-]*)=["'](http:\/\/schemas\.openxmlformats\.org\/(?:spreadsheetml\/2006\/main|officeDocument\/2006\/extended-properties))["']/g,
        ),
      ];
      for (const [declaration, prefix, namespace] of namespaces) {
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        xml = xml
          .replace(new RegExp(`(<\\/?)${escaped}:`, "g"), "$1")
          .replace(declaration, `xmlns="${namespace}"`);
      }
      if (namespaces.length) {
        zip.file(entry.name, xml);
        normalized = true;
      }
    }
    await workbook.xlsx.load(
      normalized ? await zip.generateAsync({ type: "uint8array" }) : buffer,
    );
  } catch {
    throw new Error(
      "This file could not be read. Please upload a valid, unprotected .xlsx workbook.",
    );
  }
  const karts = new Map();
  let skipped = 0;
  let sheets = 0;
  let title = "";
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > 20000 || sheet.columnCount > 500)
      throw new Error(
        "This sheet is too large. Please use up to 20,000 rows and 500 columns per sheet.",
      );
    let header = null;
    let usedSheet = false;
    sheet.eachRow((row) => {
      const nextHeader = readHeader(row);
      if (nextHeader) {
        header = nextHeader;
        if (!title) {
          for (let r = 1; r < row.number; r++) {
            const v = cellValue(sheet.getRow(r).getCell(1));
            if (typeof v === "string" && v.trim() && !/lap\s*times/i.test(v)) {
              title = v.trim();
              break;
            }
          }
        }
        return;
      }
      if (!header) return;
      const lap = Number(cellValue(row.getCell(header.lapColumn)));
      if (!Number.isSafeInteger(lap) || lap <= 0) return;
      for (const { column, number } of header.columns) {
        const cell = row.getCell(column);
        const seconds = parseLapTime(cellValue(cell), cell.numFmt);
        if (seconds === null) {
          skipped++;
          continue;
        }
        if (!karts.has(number)) karts.set(number, { number, laps: [] });
        karts.get(number).laps.push({ lap, seconds, sheet: sheet.name });
        usedSheet = true;
      }
    });
    if (usedSheet) sheets++;
  }
  if (!karts.size)
    throw new Error(
      "No lap times found. Your sheet needs a “Lap” column and kart headings such as “2 - Driver name” or “Kart 2”, with lap times underneath.",
    );
  return {
    id: globalThis.crypto.randomUUID(),
    name: title || fileName.replace(/\.xlsx$/i, "").replace(/[_-]/g, " "),
    fileName,
    importedAt: new Date().toISOString(),
    isSample: false,
    karts: [...karts.values()],
    skipped,
    sheets,
  };
}
