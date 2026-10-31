import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFolderLink } from "../src/lib/folderSharing.js";

function session(id, name, times, folderIds) {
  return {
    id,
    name,
    fileName: `${id}.xlsx`,
    folderIds,
    sheets: 1,
    skipped: 0,
    karts: Object.entries(times).map(([number, values]) => ({
      number,
      laps: values.map((seconds, i) => ({
        lap: i + 1,
        seconds,
        sheet: "Laps",
      })),
    })),
  };
}
const folders = [
  { id: "race", name: "Race day 🏁" },
  { id: "private", name: "Other private folder" },
];
const morning = session("morning", "Morning heat", { 2: [60], 13: [64] }, [
  "race",
  "private",
]);
const afternoon = session(
  "afternoon",
  "Afternoon heat",
  { 2: [90, 90, 90], 13: [66, 66, 66] },
  ["race"],
);
async function seed(
  page,
  saved = [morning, afternoon],
  savedFolders = folders,
) {
  await page.goto("/");
  await page.evaluate(
    ({ saved, savedFolders }) => {
      localStorage.setItem("kartlab.sessions.v1", JSON.stringify(saved));
      localStorage.setItem("kartlab.folders.v1", JSON.stringify(savedFolders));
      localStorage.setItem("kartlab.activeFolder", savedFolders[0]?.id || "");
      localStorage.setItem(
        "kartlab.active",
        savedFolders[0] ? `folder:${savedFolders[0].id}` : saved[0]?.id || "",
      );
    },
    { saved, savedFolders },
  );
  await page.reload();
}

test("a folder link opens a complete independent copy on a second device without replacing existing data", async ({
  page,
  browser,
  context,
}) => {
  await seed(page, [
    morning,
    afternoon,
    session("private", "Private meeting", { 99: [1] }, ["private"]),
  ]);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share folder", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Take your folder with you." }),
  ).toBeVisible();
  const link = await page
    .getByLabel("Folder link", { exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Copy folder link", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  expect((await readFolderLink(link)).sessions.map((s) => s.name)).toEqual([
    "Morning heat",
    "Afternoon heat",
  ]);
  const device = await browser.newContext({ baseURL: "http://127.0.0.1:5173" });
  try {
    await device.addInitScript(() => {
      window.DecompressionStream = undefined;
    });
    const target = await device.newPage();
    const existing = session(
      "morning",
      "Keep this local session",
      { 99: [7] },
      ["race"],
    );
    await seed(target, [existing], [folders[0]]);
    await target.evaluate(() =>
      localStorage.setItem(
        "kartlab.preferences.v1",
        JSON.stringify({ theme: "light", scale: 100 }),
      ),
    );
    await target.reload();
    await target.goto(link);
    await expect(
      target.getByRole("button", { name: "Open a copy", exact: true }),
    ).toBeVisible();
    await expect(target.locator(".folder-share-summary")).toContainText(
      "2 sessions · 2 karts · 8 laps",
    );
    expect(
      await target.evaluate(
        () => JSON.parse(localStorage.getItem("kartlab.sessions.v1")).length,
      ),
    ).toBe(1);
    await target
      .getByRole("button", { name: "Open a copy", exact: true })
      .click();
    await expect(target.locator("#folder-select option:checked")).toHaveText(
      "Race day 🏁 (copy)",
    );
    await expect(target.locator("#session-select option:checked")).toHaveText(
      "Race day 🏁 (copy)",
    );
    await expect(target.locator(".metric-value").nth(1)).toHaveText("6");
    await expect(target.locator(".delta-time").nth(1)).toHaveText("+24.000s");
    await expect(target.locator("html")).toHaveAttribute("data-theme", "light");
    expect(new URL(target.url()).hash).toBe("");
    const saved = await target.evaluate(() =>
      JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
    );
    expect(saved).toHaveLength(3);
    expect(saved.find((s) => s.id === "morning")).toEqual(existing);
    expect(
      saved
        .filter((s) => s.id !== "morning")
        .every((s) => s.folderIds.length === 1 && s.folderIds[0] !== "race"),
    ).toBe(true);
    await page.getByLabel("Close dialog").click();
    await page
      .getByRole("button", { name: "Manage folders", exact: true })
      .click();
    await page
      .getByLabel("Folder name for Race day 🏁", { exact: true })
      .fill("Changed on first device");
    await page
      .getByLabel("Folder name for Race day 🏁", { exact: true })
      .press("Enter");
    await page.getByLabel("Close dialog").click();
    await target.reload();
    await expect(target.locator("#folder-select option:checked")).toHaveText(
      "Race day 🏁 (copy)",
    );
    await expect(target.locator(".metric-value").nth(1)).toHaveText("6");
    await expect(target.getByRole("dialog")).toHaveCount(0);
  } finally {
    await device.close();
  }
});

test("downloaded copies work when link creation is unavailable, and invalid files leave the workspace intact", async ({
  page,
  browser,
}) => {
  await page.addInitScript(() => {
    window.CompressionStream = undefined;
  });
  await seed(page);
  await page.getByRole("button", { name: "Share folder", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Download a folder copy instead",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download folder copy", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.kartlab\.json$/);
  const data = await readFile(await file.path(), "utf8");
  const device = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
  });
  try {
    const target = await device.newPage();
    await target.goto("/");
    await target
      .getByRole("button", { name: "New folder", exact: true })
      .click();
    await target
      .getByRole("button", { name: "Open folder link or copy", exact: true })
      .click();
    await target.getByLabel("Open downloaded folder copy").setInputFiles({
      name: "broken.kartlab.json",
      mimeType: "application/json",
      buffer: Buffer.from("broken"),
    });
    await expect(target.getByRole("alert")).toContainText(
      "invalid or incomplete",
    );
    expect(
      await target.evaluate(() =>
        JSON.parse(localStorage.getItem("kartlab.sessions.v1")),
      ),
    ).toEqual([]);
    await target.getByLabel("Open downloaded folder copy").setInputFiles({
      name: "race.kartlab.json",
      mimeType: "application/json",
      buffer: Buffer.from(data),
    });
    await expect(target.locator(".folder-share-summary")).toContainText(
      "Race day 🏁",
    );
    await target
      .getByRole("button", { name: "Open a copy", exact: true })
      .click();
    await expect(target.locator("#folder-select option:checked")).toHaveText(
      "Race day 🏁",
    );
    await expect(target.locator(".delta-time").nth(1)).toHaveText("+24.000s");
    expect(
      await target.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await target.getByLabel("Open navigation").click();
    await target
      .getByRole("dialog")
      .getByRole("button", { name: /^Folders/ })
      .click();
    await target.getByLabel("Share Race day 🏁", { exact: true }).click();
    await expect(
      target.getByLabel("Folder link", { exact: true }),
    ).not.toHaveValue("");
  } finally {
    await device.close();
  }
});

test("damaged links can be dismissed without changing saved data or reopening after refresh", async ({
  page,
}) => {
  await seed(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("kartlab.sessions.v1"),
  );
  await page.goto("/#folder=v1.broken");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "saved folders have not changed",
  );
  await expect(
    page.getByRole("button", { name: "Open a copy", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Close dialog").click();
  expect(new URL(page.url()).hash).toBe("");
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("kartlab.sessions.v1")),
  ).toBe(before);
});
