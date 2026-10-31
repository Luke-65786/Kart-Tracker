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

// Inclusive linear interpolation (the usual spreadsheet percentile method).
function quartile(sorted, fraction) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return (
    sorted[lower] +
    (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower)
  );
}

export function iqrRange(times) {
  if (times.length < 4) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const q1 = quartile(sorted, 0.25);
  const q3 = quartile(sorted, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export function summarizeKart(kart) {
  const range = iqrRange(kart.laps.map((lap) => lap.seconds));
  // Decimal lap times can put an exact boundary a few floating-point units away.
  const tolerance = range
    ? Number.EPSILON *
      Math.max(1, Math.abs(range.lower), Math.abs(range.upper)) *
      8
    : 0;
  const excludedIndices = [];
  const laps = kart.laps.filter((lap, index) => {
    const included =
      !range ||
      (lap.seconds >= range.lower - tolerance &&
        lap.seconds <= range.upper + tolerance);
    if (!included) excludedIndices.push(index);
    return included;
  });
  const times = laps.map((lap) => lap.seconds);
  const average = times.reduce((sum, t) => sum + t, 0) / times.length;
  return {
    ...kart,
    laps,
    allLaps: kart.laps,
    recordedCount: kart.laps.length,
    excludedCount: excludedIndices.length,
    excludedIndices,
    iqrRange: range,
    count: times.length,
    average,
    best: times.reduce((best, time) => Math.min(best, time), Infinity),
    worst: times.reduce((worst, time) => Math.max(worst, time), -Infinity),
    deviation: Math.sqrt(
      times.reduce((sum, t) => sum + (t - average) ** 2, 0) / times.length,
    ),
  };
}

export function summarizeSession(session) {
  const karts = (session?.karts || [])
    .filter((k) => k.laps.length)
    .map(summarizeKart)
    .sort((a, b) => a.average - b.average);
  const totalLaps = karts.reduce((sum, k) => sum + k.count, 0);
  const average = totalLaps
    ? karts.reduce((sum, k) => sum + k.average * k.count, 0) / totalLaps
    : null;
  const fastest = karts.reduce(
    (best, k) => (!best || k.best < best.best ? k : best),
    null,
  );
  const ranked = karts.map((kart) => ({
    ...kart,
    delta: Math.max(0, kart.average - karts[0].average),
  }));
  const recordedLaps = karts.reduce((sum, kart) => sum + kart.recordedCount, 0);
  const excludedLaps = recordedLaps - totalLaps;
  return {
    karts: ranked,
    totalLaps,
    recordedLaps,
    excludedLaps,
    average,
    fastest,
  };
}

export function formatDelta(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  return `${milliseconds > 0 ? "+" : ""}${(milliseconds / 1000).toFixed(3)}s`;
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
    "Rank,Kart,Laps used,Average (seconds),Best (seconds),Worst (seconds),Standard deviation (seconds),Recorded laps,IQR excluded,Gap to fastest average (seconds)",
    ...karts.map((k, index) =>
      [
        index + 1,
        k.number,
        k.count,
        k.average.toFixed(3),
        k.best.toFixed(3),
        k.worst.toFixed(3),
        k.deviation.toFixed(3),
        k.recordedCount,
        k.excludedCount,
        k.delta.toFixed(3),
      ].join(","),
    ),
  ].join("\r\n");
}
