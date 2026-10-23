import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import sample from "../src/data/sample.json" with { type: "json" };

async function timingFile(fileName, title, times) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laptimes");
  sheet.addRow([title]);
  sheet.addRow(["Lap", "2 - Do not import this name"]);
  times.forEach((time, i) => sheet.addRow([i + 1, time]));
  return {
    name: fileName,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  };
}

async function workbookUpload(page) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laptimes");
  sheet.addRow(["Uploaded final"]);
  sheet.addRow([
    "Lap",
    ...sample.karts.map((k) => `${k.number} - Never save this driver name`),
  ]);
  sheet.getRow(2).font = { bold: true };
  for (let i = 0; i < 25; i++)
    sheet.addRow([i + 1, ...sample.karts.map((k) => k.laps[i].seconds)]);
  await page.getByLabel("Upload Excel lap times").setInputFiles({
    name: "uploaded-final.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  });
  await expect(page.locator(".imported-badge")).toBeVisible();
}

test("sample rankings, search, sort and kart details show correct results", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Know your karts." }),
  ).toBeVisible();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "1:01.117",
  );
  await page.getByLabel("Search kart number").fill("13");
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(1);
  await page.locator(".leaderboard .kart-button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".detail-table tbody tr")).toHaveCount(25);
  await expect(page.locator(".detail-metrics")).toContainText("1:00.614");
  await page.keyboard.press("Escape");
  await page.getByLabel("Clear search").click();
  await page.getByLabel("Sort leaderboard").selectOption("number");
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "Kart 2",
  );
  await page.getByLabel("Search kart number").fill("999");
  await expect(page.getByText("No karts found")).toBeVisible();
  expect(errors).toEqual([]);
});

test("uploads Excel, drops driver names, persists sessions and exports accurate CSV", async ({
  page,
}) => {
  await page.goto("/");
  await workbookUpload(page);
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "1:01.117",
  );
  const saved = await page.evaluate(() =>
    localStorage.getItem("kartlab.sessions.v1"),
  );
  expect(saved).not.toContain("Never save this driver name");
  await page.reload();
  await expect(page.locator(".imported-badge")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export results" }).click();
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("1,13,25,61.117,60.614");
  expect(csv.trim().split("\r\n")).toHaveLength(13);
  await page.getByRole("button", { name: /^Sessions/ }).click();
  const input = page.getByLabel("Session name for uploaded-final.xlsx");
  await input.fill("Sunday final");
  await input.press("Enter");
  await page.getByLabel("Close dialog").click();
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Sunday final",
  );
  await page.reload();
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Sunday final",
  );
});

test("rejects unsupported and corrupt uploads without losing the active session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Upload Excel lap times").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a workbook"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Please choose an Excel .xlsx file",
  );
  await page.getByLabel("Upload Excel lap times").setInputFiles({
    name: "broken.xlsx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
});

test("compares up to four karts and supports choosing a different chart", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Kart for lap chart").selectOption("2");
  await expect(page.locator(".chart-legend")).toContainText("Kart 2");
  await page.getByRole("button", { name: "Compare karts" }).click();
  await expect(page.locator(".comparison-summary>div")).toHaveCount(3);
  await page.getByRole("button", { name: "Kart 2", exact: true }).click();
  await expect(page.locator(".comparison-summary>div")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Kart 5", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Kart 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Kart 5", exact: true }),
  ).toBeEnabled();
});

test("mobile layout has no overflow and navigation reaches sessions and help", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Open navigation").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Sessions/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your track record." }),
  ).toBeVisible();
  await page.getByLabel("Close dialog").click();
  await page.getByLabel("Open navigation").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "How it works" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your lap sheet, made useful." }),
  ).toBeVisible();
});

test("original uploaded timing-exporter workbook imports correctly", async ({
  page,
}) => {
  test.skip(
    !process.env.SAMPLE_XLSX,
    "Set SAMPLE_XLSX to validate an external workbook.",
  );
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(process.env.SAMPLE_XLSX);
  await expect(page.locator(".imported-badge")).toBeVisible();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "1:01.117",
  );
  await expect(page.locator(".metric-value").nth(1)).toHaveText("300");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("uploads multiple workbooks into a persisted combined analysis, preserving originals and lap sources", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles([
      await timingFile("morning.xlsx", "Morning heat", [60]),
      await timingFile("afternoon.xlsx", "Afternoon heat", [90, 90, 90]),
    ]);
  await expect(page.locator(".combined-badge")).toHaveText(
    "2 sessions combined",
  );
  await expect(page.locator(".metric-value").nth(1)).toHaveText("4");
  await expect(page.locator(".average-time")).toHaveText("1:22.500");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
  );
  expect(saved).toHaveLength(4);
  expect(saved[0].sources).toHaveLength(2);
  expect(saved[0].sources.every((s) => !s.isSample)).toBe(true);
  expect(JSON.stringify(saved)).not.toContain("Do not import this name");
  await page.locator(".combined-sources summary").click();
  await expect(page.locator(".source-list")).toContainText("Morning heat");
  await expect(page.locator(".source-list")).toContainText("Afternoon heat");
  await page.locator(".leaderboard .kart-button").click();
  await expect(
    page.getByRole("columnheader", { name: "SESSION", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-table tbody tr")).toHaveCount(4);
  await expect(page.locator(".detail-table tbody tr").first()).toContainText(
    "Morning heat",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".combined-badge")).toHaveText(
    "2 sessions combined",
  );
  await expect(page.locator(".average-time")).toHaveText("1:22.500");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export results" }).click();
  const csv = await readFile(await (await downloadEvent).path(), "utf8");
  expect(csv).toContain("1,2,4,82.500,60.000,90.000");
});

test("combines existing sessions without double counting overlapping groups", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(await timingFile("morning.xlsx", "Morning heat", [60]));
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Morning heat",
  );
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(
      await timingFile("afternoon.xlsx", "Afternoon heat", [90, 90, 90]),
    );
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Afternoon heat",
  );
  await page
    .getByRole("button", { name: "Combine sessions", exact: true })
    .click();
  await expect(
    page.getByLabel("Include A Final", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Include Morning heat").check();
  await page.getByLabel("Analysis name").fill("Race day");
  await page
    .getByRole("button", { name: "Combine 2 selected sessions" })
    .click();
  await expect(page.locator(".average-time")).toHaveText("1:22.500");
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Race day",
  );
  await page
    .getByRole("button", { name: "Combine sessions", exact: true })
    .click();
  await page.getByLabel("Include Morning heat").check();
  await page
    .getByRole("button", { name: "Combine 2 selected sessions" })
    .click();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("4");
  await expect(page.locator(".combined-badge")).toHaveText(
    "2 sessions combined",
  );
});

test("batch failures leave existing sessions intact and do not partially import files", async ({
  page,
}) => {
  await page.goto("/");
  const before = await page.evaluate(() =>
    localStorage.getItem("kartlab.sessions.v1"),
  );
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles([
      await timingFile("valid.xlsx", "Valid heat", [60]),
      {
        name: "broken.xlsx",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a workbook"),
      },
    ]);
  await expect(page.getByRole("alert")).toContainText(
    "No sessions from this upload were added",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kartlab.sessions.v1")),
  ).toEqual(before);
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
});

test("remains dark with a light OS theme, including dialogs and native selects", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("dark");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    ),
  ).toBe("rgb(16, 20, 25)");
  expect(
    await page
      .locator(".panel")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 29, 36)");
  await page
    .getByRole("button", { name: "Combine sessions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 29, 36)");
  expect(
    await page
      .getByRole("button", { name: "Combine 0 selected sessions" })
      .isDisabled(),
  ).toBe(true);
});
