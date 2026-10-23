export const PREFERENCES_KEY = "kartlab.preferences.v1";

export const THEMES = [
  {
    id: "kartlab",
    name: "Kartlab",
    description: "Dark with deep blue accents",
  },
  { id: "light", name: "Light", description: "White with sky blue accents" },
  { id: "apex", name: "Apex", description: "Charcoal with electric lime" },
  { id: "violet", name: "Violet", description: "Midnight with soft purple" },
  { id: "ember", name: "Ember", description: "Warm graphite with amber" },
];

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: "kartlab",
  scale: 100,
  density: "comfortable",
  showTrends: true,
  defaultSort: "average",
  reduceMotion: false,
});

export function normalizePreferences(value) {
  const prefs = value && typeof value === "object" ? value : {};
  return {
    theme: THEMES.some((theme) => theme.id === prefs.theme)
      ? prefs.theme
      : DEFAULT_PREFERENCES.theme,
    scale:
      typeof prefs.scale === "number" && Number.isFinite(prefs.scale)
        ? Math.max(80, Math.min(125, Math.round(prefs.scale / 5) * 5))
        : DEFAULT_PREFERENCES.scale,
    density: prefs.density === "compact" ? "compact" : "comfortable",
    showTrends: prefs.showTrends !== false,
    defaultSort: ["average", "best", "number", "laps"].includes(
      prefs.defaultSort,
    )
      ? prefs.defaultSort
      : DEFAULT_PREFERENCES.defaultSort,
    reduceMotion: prefs.reduceMotion === true,
  };
}

export function loadPreferences() {
  try {
    return normalizePreferences(
      JSON.parse(localStorage.getItem(PREFERENCES_KEY)),
    );
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function applyPreferences(prefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.density = prefs.density;
  root.dataset.trends = prefs.showTrends ? "show" : "hide";
  root.dataset.reduceMotion = String(prefs.reduceMotion);
  root.style.setProperty("--ui-scale", prefs.scale / 100);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", prefs.theme === "light" ? "light" : "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      getComputedStyle(root).getPropertyValue("--bg").trim(),
    );
}
