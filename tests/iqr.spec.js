import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

async function workbook(name, times) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Laps");
  const numbers = Object.keys(times);
  sheet.addRow([name]);
  sheet.addRow([
    "Lap",
    ...numbers.map((number) => `${number} - Ignore driver`),
  ]);
  for (
    let i = 0;
    i < Math.max(...Object.values(times).map((laps) => laps.length));
    i++
  )
    sheet.addRow([i + 1, ...numbers.map((number) => times[number][i])]);
  return {
    name: `${name}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  };
}

test("IQR filtering drives averages, deltas, charts and CSV while keeping excluded raw laps visible and saved", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(
      await workbook("IQR heat", {
        2: [1, 40, 41, 42, 43, 44, 120],
        13: [2, 44, 45, 46, 47, 48, 150],
      }),
    );
  await expect(page.locator(".iqr-filter-note summary")).toContainText(
    "10 of 14 laps used · 4 excluded",
  );
  await expect(page.locator(".average-time").first()).toHaveText("0:42.000");
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+4.000s");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("10");
  await expect(page.locator(".time-value").last()).toContainText("0:40.000");
  const saved = await page.evaluate(() =>
    localStorage.getItem("kartlab.sessions.v1"),
  );
  expect(JSON.parse(saved)[0].karts.flatMap((kart) => kart.laps)).toHaveLength(
    14,
  );
  expect(
    (await page.locator(".lap-panel polyline").getAttribute("points"))
      .trim()
      .split(/\s+/),
  ).toHaveLength(5);
  await page.locator(".leaderboard .kart-button").first().click();
  await expect(page.locator(".detail-table tbody tr")).toHaveCount(7);
  await expect(page.locator(".outlier-pill")).toHaveCount(2);
  await expect(page.locator(".iqr-excluded-row").first()).toContainText(
    "0:01.000",
  );
  await expect(page.locator(".detail-metrics")).toContainText("5 / 7");
  await page.getByLabel("Close dialog").click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export results", exact: true })
    .click();
  const csv = await readFile(await (await event).path(), "utf8");
  expect(csv).toContain("Recorded laps,IQR excluded");
  expect(csv).toContain("1,2,5,42.000,40.000,44.000,1.414,7,2,0.000");
  await page.reload();
  await expect(page.locator(".iqr-filter-note summary")).toContainText(
    "10 of 14 laps used · 4 excluded",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kartlab.sessions.v1")),
  ).toBe(saved);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Search kart number").fill("13");
  await expect(page.locator(".delta-time")).toHaveText("+4.000s");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".leaderboard .kart-button").click();
  await expect(page.locator(".outlier-pill")).toHaveCount(2);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});

test("combining restores eligible original laps and recalculates the IQR over the complete pooled data", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(await workbook("First", { 2: [40, 40, 40, 40, 60] }));
  await expect(page.locator(".iqr-filter-note summary")).toContainText(
    "4 of 5 laps used · 1 excluded",
  );
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(await workbook("Second", { 2: [58, 59, 60, 61, 62] }));
  await expect(page.locator(".average-time")).toHaveText("1:00.000");
  await page
    .getByRole("button", { name: "Combine sessions", exact: true })
    .click();
  await page.getByLabel("Include First", { exact: true }).check();
  await page
    .getByRole("button", { name: "Combine 2 selected sessions", exact: true })
    .click();
  await expect(page.locator(".iqr-filter-note summary")).toContainText(
    "10 of 10 laps used · 0 excluded",
  );
  await expect(page.locator(".average-time")).toHaveText("0:52.000");
  await expect(page.locator(".temporary-analysis-note")).toBeVisible();
  const raw = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
  );
  expect(raw).toHaveLength(2);
  expect(
    raw.find((session) => session.name === "First").karts[0].laps,
  ).toHaveLength(5);
});
