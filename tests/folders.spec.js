import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

async function file(name, title, times) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laptimes");
  const karts = Object.keys(times);
  sheet.addRow([title]);
  sheet.addRow([
    "Lap",
    ...karts.map((number) => `${number} - Ignore this driver`),
  ]);
  const count = Math.max(
    ...Object.values(times).map((values) => values.length),
  );
  for (let i = 0; i < count; i++)
    sheet.addRow([i + 1, ...karts.map((number) => times[number][i])]);
  return {
    name,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  };
}

async function createFolder(page, name) {
  await page.getByLabel("New folder name").fill(name);
  await page
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await expect(
    page.getByLabel(`Folder name for ${name}`, { exact: true }),
  ).toBeVisible();
}

test("folder uploads produce a live, persistent overall kart comparison and accurate deltas", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await createFolder(page, "Race day");
  await page.getByLabel("Open Race day comparison", { exact: true }).click();
  await expect(
    page.getByText("Give this folder some track time."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export results" }),
  ).toBeDisabled();
  await page.getByLabel("Upload Excel lap times").setInputFiles([
    await file("morning.xlsx", "Morning heat", { 2: [60], 13: [64] }),
    await file("afternoon.xlsx", "Afternoon heat", {
      2: [90, 90, 90],
      13: [66, 66, 66],
    }),
  ]);
  await expect(
    page.getByRole("heading", { name: "Overall kart comparison" }),
  ).toBeVisible();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("6");
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "Kart 13",
  );
  await expect(page.locator(".delta-time").first()).toHaveText("0.000s");
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+24.000s");
  await page.getByLabel("Search kart number").fill("2");
  await expect(page.locator(".delta-time")).toHaveText("+24.000s");
  await page.getByLabel("Clear search").click();
  await page.getByLabel("Sort leaderboard").selectOption("best");
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "Kart 13",
  );
  await expect(page.locator(".delta-time").first()).toHaveText("0.000s");
  await page.locator("#session-select").selectOption({ label: "Morning heat" });
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+4.000s");
  await page.locator("#session-select").selectOption({ label: "Race day" });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
  );
  expect(saved).toHaveLength(2);
  expect(saved.every((s) => s.folderIds.length === 1)).toBe(true);
  expect(saved[0].folderIds).toEqual(saved[1].folderIds);
  await page.reload();
  await expect(page.locator("#folder-select option:checked")).toHaveText(
    "Race day",
  );
  await expect(
    page.getByRole("heading", { name: "Overall kart comparison" }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export results" }).click();
  const csv = await readFile(await (await downloadEvent).path(), "utf8");
  expect(csv).toContain("Gap to fastest average (seconds)");
  expect(csv.trim().split("\r\n").at(-1).split(",").at(-1)).toBe("24.000");
  expect(errors).toEqual([]);
});

test("existing sessions can be shared and retain their other folders after a folder is renamed or deleted", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(
      await file("practice.xlsx", "Practice laps", { 2: [60], 13: [64] }),
    );
  await expect(page.locator(".imported-badge")).toBeVisible();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await createFolder(page, "Race day");
  await page.getByLabel("Add Practice laps to Race day").check();
  await page.getByLabel("Open Race day comparison", { exact: true }).click();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("2");
  await page
    .getByRole("button", { name: "Manage folders", exact: true })
    .click();
  await createFolder(page, "Other track");
  await page.getByLabel("Add Practice laps to Other track").check();
  await page.getByLabel("Close dialog").click();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("2");
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Race day",
  );
  await page.getByLabel("View folder").selectOption({ label: "Other track" });
  await expect(page.locator(".metric-value").nth(1)).toHaveText("2");
  await page
    .getByRole("button", { name: "Manage folders", exact: true })
    .click();
  await page.getByLabel("Folder name for Other track").fill("Test day");
  await page.getByLabel("Folder name for Other track").press("Enter");
  await expect(page.getByLabel("Folder name for Test day")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Delete folder Test day").click();
  await page.getByLabel("Close dialog").click();
  await expect(page.locator("#folder-select option:checked")).toHaveText(
    "All sessions",
  );
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await expect(page.getByLabel("Session name for practice.xlsx")).toBeVisible();
  await expect(page.getByLabel("Folders for Practice laps")).toContainText(
    "Race day",
  );
  await page.getByLabel("Folders for Practice laps").click();
  await expect(
    page.getByLabel("Include Practice laps in Race day"),
  ).toBeChecked();
  await expect(
    page.getByLabel("Include Practice laps in Test day"),
  ).toHaveCount(0);
  const sessionCount = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kartlab.sessions.v1")).length,
  );
  expect(sessionCount).toBe(1);
  await page.getByLabel("Open Practice laps", { exact: true }).click();
  await expect(page.locator("#folder-select option:checked")).toHaveText(
    "Race day",
  );
});

test("folders and the delta column are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await createFolder(page, "Mobile practice");
  await page
    .getByLabel("Open Mobile practice comparison", { exact: true })
    .click();
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(await file("laps.xlsx", "Laps", { 2: [60], 13: [64] }));
  await expect(
    page.getByRole("heading", { name: "Overall kart comparison" }),
  ).toBeVisible();
  await page
    .getByRole("columnheader", { name: "Δ TO FASTEST" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("columnheader", { name: "Δ TO FASTEST" }),
  ).toBeInViewport();
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+4.000s");
  await page.getByLabel("Open navigation").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Sessions/ })
    .click();
  await page.getByLabel("Folders for Laps", { exact: true }).click();
  await expect(
    page.getByLabel("Include Laps in Mobile practice"),
  ).toBeChecked();
  await page.getByLabel("Include Laps in Mobile practice").uncheck();
  await expect(
    page.getByLabel("Include Laps in Mobile practice"),
  ).not.toBeChecked();
  await page.getByLabel("Include Laps in Mobile practice").check();
  await page.getByLabel("Close dialog").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".leaderboard .kart-button").nth(1).click();
  await expect(page.locator(".detail-metrics")).toContainText("+4.000s");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Sessions can share one upload across folders, persist the choices and remove each assignment independently", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(
      await file("shared.xlsx", "Shared heat", { 2: [60], 13: [64] }),
    );
  await expect(page.locator(".imported-badge")).toBeVisible();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await createFolder(page, "Race day");
  await createFolder(page, "Other track");
  await page.getByLabel("Close dialog").click();
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await page.getByLabel("Folders for Shared heat", { exact: true }).click();
  await page
    .getByLabel("Include Shared heat in Race day", { exact: true })
    .check();
  await page
    .getByLabel("Include Shared heat in Other track", { exact: true })
    .check();
  await expect(
    page.getByLabel("Include Shared heat in Race day", { exact: true }),
  ).toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await page.getByLabel("Folders for Shared heat", { exact: true }).click();
  await expect(
    page.getByLabel("Include Shared heat in Race day", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Include Shared heat in Other track", { exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kartlab.sessions.v1")).length,
    ),
  ).toBe(1);
  await page.getByLabel("Close dialog").click();
  await page.getByLabel("View folder").selectOption({ label: "Race day" });
  await page.getByLabel("Upload Excel lap times").setInputFiles(
    await file("race.xlsx", "Race heat", {
      2: [90, 90, 90],
      13: [66, 66, 66],
    }),
  );
  await expect(page.locator(".metric-value").nth(1)).toHaveText("6");
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+24.000s");
  await page.getByLabel("View folder").selectOption({ label: "Other track" });
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles(
      await file("other.xlsx", "Other heat", { 2: [58], 13: [70] }),
    );
  await expect(page.locator(".metric-value").nth(1)).toHaveText("4");
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+8.000s");
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await page.getByLabel("Open Shared heat", { exact: true }).click();
  await expect(page.locator("#folder-select option:checked")).toHaveText(
    "Other track",
  );
  await expect(page.locator("#session-select option:checked")).toHaveText(
    "Shared heat",
  );
  await page
    .getByRole("button", { name: "Manage folders", exact: true })
    .click();
  await page.getByLabel("Manage files in Race day", { exact: true }).click();
  await page
    .getByLabel("Add Shared heat to Race day", { exact: true })
    .uncheck();
  await page.getByLabel("Open Race day comparison", { exact: true }).click();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("6");
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+24.000s");
  await page.getByLabel("View folder").selectOption({ label: "Other track" });
  await expect(page.locator(".metric-value").nth(1)).toHaveText("4");
  await expect(page.locator(".delta-time").nth(1)).toHaveText("+8.000s");
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await page.getByLabel("Folders for Shared heat", { exact: true }).click();
  await expect(
    page.getByLabel("Include Shared heat in Race day", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByLabel("Include Shared heat in Other track", { exact: true })
    .uncheck();
  await page.getByLabel("Close dialog").click();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("2");
  await page.reload();
  const sessions = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
  );
  expect(sessions).toHaveLength(3);
  expect(
    sessions.find((session) => session.name === "Shared heat").folderIds,
  ).toEqual([]);
  expect(
    sessions
      .find((session) => session.name === "Shared heat")
      .karts.flatMap((kart) => kart.laps),
  ).toHaveLength(2);
  await page.getByLabel("View folder").selectOption({ label: "All sessions" });
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await expect(page.locator(".saved-session")).toHaveCount(3);
  await page.getByLabel("Open Shared heat", { exact: true }).click();
  await expect(page.locator(".metric-value").nth(1)).toHaveText("2");
});
