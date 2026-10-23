// A combined session is a snapshot of the original laps, with source IDs retained.
// Flattening those IDs means combining overlapping groups never counts a lap twice.
export function combineSessions(
  sessions,
  name = "Combined analysis",
  options = {},
) {
  const sources = new Map();
  const karts = new Map();

  for (const session of sessions) {
    const sessionSources = session.sources?.length
      ? session.sources
      : [
          {
            id: session.id,
            name: session.name,
            fileName: session.fileName,
            sheets: session.sheets || 1,
            skipped: session.skipped || 0,
            lapCount: session.karts.reduce((sum, k) => sum + k.laps.length, 0),
            isSample: Boolean(session.isSample),
          },
        ];
    const newSources = new Map();
    for (const source of sessionSources) {
      if (!sources.has(source.id)) {
        sources.set(source.id, { ...source });
        newSources.set(source.id, source);
      }
    }
    for (const kart of session.karts) {
      for (const lap of kart.laps) {
        const sourceId = lap.sourceId || session.id;
        const source = newSources.get(sourceId);
        if (!source) continue;
        if (!karts.has(kart.number))
          karts.set(kart.number, { number: kart.number, laps: [] });
        karts.get(kart.number).laps.push({
          ...lap,
          sourceId,
          sourceName: source.name,
        });
      }
    }
  }
  if (sources.size < (options.minimumSources ?? 2))
    throw new Error(
      "Choose at least two different source sessions to combine.",
    );
  const sourceList = [...sources.values()];
  return {
    id: options.id || globalThis.crypto.randomUUID(),
    name: name.trim() || "Combined analysis",
    fileName: `${sources.size} Excel sessions`,
    importedAt: new Date().toISOString(),
    isSample: false,
    isCombined: true,
    sources: sourceList,
    karts: [...karts.values()],
    skipped: sourceList.reduce((sum, source) => sum + source.skipped, 0),
    sheets: sourceList.reduce((sum, source) => sum + source.sheets, 0),
  };
}
