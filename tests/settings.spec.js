import { test, expect } from "@playwright/test";
import laps from "./fixtures/laptimes.json" with { type: "json" };

async function loadRaceDay(page) {
  await page.goto("/");
  await page.evaluate((fixture) => {
    const session = {
      ...fixture,
      id: "imported-heat",
      name: "Morning heat",
      isSample: false,
      fileName: "morning.xlsx",
      folderId: "race-day",
    };
    localStorage.setItem("kartlab.sessions.v1", JSON.stringify([session]));
    localStorage.setItem(
      "kartlab.folders.v1",
      JSON.stringify([{ id: "race-day", name: "Race day" }]),
    );
    localStorage.setItem("kartlab.activeFolder", "race-day");
    localStorage.setItem("kartlab.active", "folder:race-day");
  }, laps);
  await page.reload();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
}

function contrast(a, b) {
  const luminance = (color) => {
    const values = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map((v) => Number(v) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

test("all five themes style the workspace, dialogs, native controls and charts, and persist", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await loadRaceDay(page);
  const backgrounds = new Set();
  for (const [id, name] of [
    ["kartlab", "Kartlab"],
    ["light", "Light"],
    ["apex", "Apex"],
    ["violet", "Violet"],
    ["ember", "Ember"],
  ]) {
    await page.getByLabel("Open settings", { exact: true }).click();
    await page
      .getByRole("radio", { name: `${name} theme`, exact: true })
      .check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    const colors = await page.evaluate(() => {
      const dialog = getComputedStyle(document.querySelector("dialog"));
      const button = getComputedStyle(
        document.querySelector(".settings-footer .primary"),
      );
      const select = getComputedStyle(document.querySelector("#table-density"));
      return {
        bg: dialog.backgroundColor,
        text: dialog.color,
        muted: getComputedStyle(document.querySelector(".setting-description"))
          .color,
        buttonBg: button.backgroundColor,
        buttonText: button.color,
        scheme: select.colorScheme,
      };
    });
    expect(contrast(colors.bg, colors.text)).toBeGreaterThan(7);
    expect(contrast(colors.bg, colors.muted)).toBeGreaterThan(4.5);
    expect(contrast(colors.buttonBg, colors.buttonText)).toBeGreaterThan(4.5);
    expect(colors.scheme).toBe(id === "light" ? "light" : "dark");
    backgrounds.add(colors.bg);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    expect(
      await page
        .locator(".sidebar")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(colors.bg);
    const chartColors = await page
      .locator(".lap-chart")
      .evaluate((el) => ({
        line: getComputedStyle(el.querySelector("polyline")).stroke,
        bg: getComputedStyle(el.closest(".panel")).backgroundColor,
      }));
    expect(contrast(chartColors.line, chartColors.bg)).toBeGreaterThan(3);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
  }
  expect(backgrounds.size).toBe(4); // Kartlab and Apex share charcoal surfaces.
});

test("display settings affect rankings and spacing, persist, and reset without deleting files or folders", async ({
  page,
}) => {
  await loadRaceDay(page);
  const saved = await page.evaluate(() => [
    localStorage.getItem("kartlab.sessions.v1"),
    localStorage.getItem("kartlab.folders.v1"),
  ]);
  const before = await page
    .locator(".leaderboard tbody tr")
    .first()
    .boundingBox();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Table spacing", { exact: true })
    .selectOption("compact");
  await page.getByRole("switch", { name: "Lap trends", exact: true }).uncheck();
  await page
    .getByLabel("Default leaderboard sort", { exact: true })
    .selectOption("number");
  await page
    .getByRole("switch", { name: "Reduce motion", exact: true })
    .check();
  await page.getByLabel("UI scale", { exact: true }).fill("115");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Sort leaderboard")).toHaveValue("number");
  await expect(page.locator(".leaderboard tbody tr").first()).toContainText(
    "Kart 2",
  );
  await expect(page.locator(".leaderboard th.trend-col")).toBeHidden();
  const after = await page
    .locator(".leaderboard tbody tr")
    .first()
    .boundingBox();
  expect(after.height).toBeLessThan(before.height);
  expect(
    await page
      .locator(".button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.getByLabel("Open settings", { exact: true }).click();
  await expect(page.getByLabel("UI scale", { exact: true })).toHaveValue("115");
  await expect(
    page.getByRole("switch", { name: "Reduce motion", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Reset settings", exact: true })
    .click();
  await expect(page.getByLabel("UI scale", { exact: true })).toHaveValue("100");
  await expect(
    page.getByRole("radio", { name: "Kartlab theme", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Lap trends", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Sort leaderboard")).toHaveValue("average");
  await expect(page.locator(".leaderboard th.trend-col")).toBeVisible();
  expect(
    await page.evaluate(() => [
      localStorage.getItem("kartlab.sessions.v1"),
      localStorage.getItem("kartlab.folders.v1"),
    ]),
  ).toEqual(saved);
  await expect(page.locator("#folder-select option:checked")).toHaveText(
    "Race day",
  );
});

test("UI scale changes the whole interface and keeps desktop, tablet and phone settings usable", async ({
  page,
}) => {
  await loadRaceDay(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const baseHeading = await page.locator("h1").boundingBox();
  await page.getByLabel("Open settings", { exact: true }).click();
  await page.getByLabel("UI scale", { exact: true }).fill("125");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const largeHeading = await page.locator("h1").boundingBox();
  expect(largeHeading.height).toBeGreaterThan(baseHeading.height * 1.2);
  for (const width of [1440, 1024, 820, 768, 481, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel("Open settings", { exact: true }).click();
    for (const scale of [80, 100, 125]) {
      await page.getByLabel("UI scale", { exact: true }).fill(String(scale));
      const bounds = await page.getByRole("dialog").boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "Done", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.reload();
  await page.getByLabel("Open navigation").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("radio", { name: "Light theme", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(12);
  expect(errors).toEqual([]);
});

test("keyboard users can choose themes and device reduced motion remains respected", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Open settings", { exact: true }).click();
  await page.getByRole("radio", { name: "Kartlab theme", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Light theme", exact: true }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page
      .locator(".button.primary")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await expect(
    page.getByRole("heading", { name: "Your next session starts here." }),
  ).toBeVisible();
});
