import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import legacySample from "./fixtures/laptimes.json" with { type: "json" };

test("new visitors start with an empty dark workspace that stays empty after reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your next session starts here." }),
  ).toBeVisible();
  await expect(page.locator(".leaderboard")).toHaveCount(0);
  await expect(page.locator(".metric-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export results" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Compare karts", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Combine sessions", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your next session starts here." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
    ),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("deleting the last uploaded session leaves the workspace empty instead of restoring data", async ({
  page,
}) => {
  await page.goto("/");
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Laps");
  sheet.addRow(["Lap", "Kart 2"]);
  sheet.addRow([1, 60]);
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles({
      name: "my-laps.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    });
  await expect(page.locator(".imported-badge")).toBeVisible();
  await page.getByRole("button", { name: /^Sessions/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Delete my laps", { exact: true }).click();
  await expect(
    page.getByText(
      "No sessions yet. Upload an Excel workbook to start your track record.",
    ),
  ).toBeVisible();
  await page.getByLabel("Close dialog").click();
  await expect(
    page.getByRole("heading", { name: "Your next session starts here." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".leaderboard")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("kartlab.active")),
  ).toBeNull();
});

test("existing workspaces lose only the old demo and keep real uploads and folders", async ({
  page,
}) => {
  const uploaded = {
    id: "actual-upload",
    name: "A Final",
    fileName: "A_Final_laptimes.xlsx",
    isSample: false,
    folderId: "track",
    sheets: 1,
    skipped: 0,
    karts: [{ number: "44", laps: [{ lap: 1, seconds: 77, sheet: "Laps" }] }],
  };
  await page.addInitScript(
    ({ sample, uploaded }) => {
      if (localStorage.getItem("test.seeded")) return;
      localStorage.setItem(
        "kartlab.sessions.v1",
        JSON.stringify([sample, uploaded]),
      );
      localStorage.setItem(
        "kartlab.folders.v1",
        JSON.stringify([{ id: "track", name: "Race day" }]),
      );
      localStorage.setItem("kartlab.active", sample.id);
      localStorage.setItem("kartlab.activeFolder", "track");
      localStorage.setItem("test.seeded", "yes");
    },
    { sample: legacySample, uploaded },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overall kart comparison" }),
  ).toBeVisible();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(1);
  await expect(page.locator(".leaderboard tbody tr")).toContainText("Kart 44");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
    ),
  ).toEqual([uploaded]);
  await page.reload();
  await expect(page.locator("#folder-select option:checked")).toHaveText(
    "Race day",
  );
  await expect(page.locator(".average-time")).toHaveText("1:17.000");
});

test("an old sample-only workspace becomes empty and an invalid first upload adds no data", async ({
  page,
}) => {
  await page.addInitScript((sample) => {
    localStorage.setItem("kartlab.sessions.v1", JSON.stringify([sample]));
    localStorage.setItem("kartlab.active", sample.id);
  }, legacySample);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your next session starts here." }),
  ).toBeVisible();
  await page
    .getByLabel("Upload Excel lap times")
    .setInputFiles({
      name: "broken.xlsx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("broken"),
    });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await expect(page.locator(".leaderboard")).toHaveCount(0);
});
