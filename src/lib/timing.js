export function parseLapTime(value, numFmt = "") {
  if (value && typeof value === "object" && "result" in value)
    value = value.result;
  if (value instanceof Date) {
    const seconds = (value.getTime() - Date.UTC(1899, 11, 30)) / 1000;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }
  if (typeof value === "number") {
    const format = numFmt.replace(/"[^"]*"|\\./g, "");
    const seconds = /[hs]|m.*:/i.test(format) ? value * 86400 : value;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return parseLapTime(Number(text));
  if (/^\d+:\d{1,2}(?:\.\d+)?$/.test(text)) {
    const [minutes, seconds] = text.split(":").map(Number);
    return seconds < 60 ? parseLapTime(minutes * 60 + seconds) : null;
  }
  if (/^\d+:\d{1,2}:\d{1,2}(?:\.\d+)?$/.test(text)) {
    const [hours, minutes, seconds] = text.split(":").map(Number);
    return minutes < 60 && seconds < 60
      ? parseLapTime(hours * 3600 + minutes * 60 + seconds)
      : null;
  }
  return null;
}

export function kartNumber(value) {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  if (typeof value !== "string") return null;
  const match = value
    .trim()
    .match(/^(?:kart\s*#?\s*|#\s*)?(\d+)(?:\s*[-–—:]\s*.*)?$/i);
  return match && Number.isSafeInteger(Number(match[1]))
    ? String(Number(match[1]))
    : null;
}

export function summarizeKart(kart) {
  const times = kart.laps.map((lap) => lap.seconds);
  const average = times.reduce((sum, t) => sum + t, 0) / times.length;
  return {
    ...kart,
    count: times.length,
    average,
    best: Math.min(...times),
    worst: Math.max(...times),
    deviation: Math.sqrt(
      times.reduce((sum, t) => sum + (t - average) ** 2, 0) / times.length,
    ),
  };
}

export function summarizeSession(session) {
  const karts = session.karts
    .filter((k) => k.laps.length)
    .map(summarizeKart)
    .sort((a, b) => a.average - b.average);
  const totalLaps = karts.reduce((sum, k) => sum + k.count, 0);
  const average =
    karts.reduce((sum, k) => sum + k.average * k.count, 0) / totalLaps;
  const fastest = karts.reduce(
    (best, k) => (!best || k.best < best.best ? k : best),
    null,
  );
  return { karts, totalLaps, average, fastest };
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const milliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  return `${minutes}:${((milliseconds % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
}

export function resultsCsv(session) {
  const { karts } = summarizeSession(session);
  return [
    "Rank,Kart,Laps,Average (seconds),Best (seconds),Worst (seconds),Standard deviation (seconds)",
    ...karts.map((k, index) =>
      [
        index + 1,
        k.number,
        k.count,
        k.average.toFixed(3),
        k.best.toFixed(3),
        k.worst.toFixed(3),
        k.deviation.toFixed(3),
      ].join(","),
    ),
  ].join("\r\n");
}
