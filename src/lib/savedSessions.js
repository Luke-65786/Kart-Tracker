import { normalizeSessionFolders } from "./folders.js";

function isLegacySample(session) {
  return session?.isSample === true || session?.id === "sample-a-final";
}

function isSession(session) {
  return (
    session &&
    typeof session.id === "string" &&
    typeof session.name === "string" &&
    typeof session.fileName === "string" &&
    Array.isArray(session.karts) &&
    session.karts.length > 0 &&
    session.karts.every(
      (kart) =>
        kart &&
        typeof kart.number === "string" &&
        Array.isArray(kart.laps) &&
        kart.laps.length > 0 &&
        kart.laps.every(
          (lap) => lap && Number.isFinite(lap.seconds) && lap.seconds > 0,
        ),
    )
  );
}

export function restoreSessions(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.filter(isSession).flatMap((storedSession) => {
    const session = normalizeSessionFolders(storedSession);
    if (isLegacySample(session) || session.isTemporary) return [];
    if (!Array.isArray(session.sources)) return [session];
    const removed = new Set(
      session.sources.filter(isLegacySample).map((source) => source.id),
    );
    if (!removed.size) return [session];
    const sources = session.sources.filter((source) => !removed.has(source.id));
    const karts = session.karts
      .map((kart) => ({
        ...kart,
        laps: kart.laps.filter((lap) => !removed.has(lap.sourceId)),
      }))
      .filter((kart) => kart.laps.length);
    if (!karts.length) return [];
    return [
      {
        ...session,
        karts,
        sources,
        isCombined: sources.length > 0,
        fileName: sources.length
          ? `${sources.length} Excel ${sources.length === 1 ? "session" : "sessions"}`
          : session.fileName,
        skipped: sources.reduce(
          (sum, source) => sum + (source.skipped || 0),
          0,
        ),
        sheets: sources.reduce((sum, source) => sum + (source.sheets || 1), 0),
      },
    ];
  });
}
