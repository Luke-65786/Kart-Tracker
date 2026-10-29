import test from "node:test";
import assert from "node:assert/strict";
import {
  createFolderCopy,
  createFolderLink,
  folderCopyJson,
  hasFolderLink,
  MAX_FOLDER_BYTES,
  prepareFolderImport,
  readFolderCopyJson,
  readFolderLink,
  saveFolderImport,
  validateFolderCopy,
} from "../src/lib/folderSharing.js";
import { folderAnalysis } from "../src/lib/folders.js";
import { combineSessions } from "../src/lib/combineSessions.js";
import { resultsCsv, summarizeSession } from "../src/lib/timing.js";

const folder = { id: "race", name: "Race day 🏁" };
function session(id, times, folderIds = [folder.id]) {
  return {
    id,
    name: id,
    fileName: `${id}.xlsx`,
    folderIds,
    importedAt: "2026-10-29T10:00:00.000Z",
    skipped: 0,
    sheets: 1,
    karts: Object.entries(times).map(([number, times]) => ({
      number,
      laps: times.map((seconds, i) => ({ lap: i + 1, seconds, sheet: "Laps" })),
    })),
  };
}
const a = session("Morning", { 2: [60], 13: [64] }, [
  folder.id,
  "private-folder",
]);
const b = session("Afternoon", { 2: [90, 90, 90], 13: [66, 66, 66] });

test("folder links round-trip exact laps, Unicode names and provenance, excluding other folders and temporary analyses", async () => {
  const combined = {
    ...combineSessions([a, b], "Saved analysis"),
    folderIds: [folder.id],
  };
  const temporary = {
    ...combineSessions([a, b], "Temporary", { temporary: true }),
    folderIds: [folder.id],
  };
  const outside = session("Private heat", { 2: [1] }, ["private-folder"]);
  const input = [a, b, combined, temporary, outside];
  const before = JSON.stringify(input);
  const copy = createFolderCopy(folder, input);
  const link = await createFolderLink(
    copy,
    "https://luke-65786.github.io/Kart-Tracker/?tracking=yes#old",
  );
  assert.ok(hasFolderLink(link));
  assert.equal(new URL(link).pathname, "/Kart-Tracker/");
  assert.equal(new URL(link).search, "");
  const restored = await readFolderLink(link);
  assert.deepEqual(restored, copy);
  assert.equal(restored.sessions.length, 3);
  assert.ok(!folderCopyJson(copy).includes("private-folder"));
  assert.ok(!folderCopyJson(copy).includes("Private heat"));
  assert.ok(!folderCopyJson(copy).includes("Temporary"));
  const targetSession = session("Morning", { 2: [7] }, ["existing"]);
  const imported = prepareFolderImport(restored, [folder], [targetSession]);
  assert.equal(imported.folder.name, `${folder.name} (copy)`);
  assert.equal(imported.sessions.at(-1), targetSession);
  assert.ok(
    imported.sessions
      .slice(0, 3)
      .every(
        (s) =>
          s.id !== a.id &&
          s.folderIds.length === 1 &&
          s.folderIds[0] === imported.folder.id,
      ),
  );
  const expected = folderAnalysis(folder, [a, b, combined]);
  const actual = folderAnalysis(imported.folder, imported.sessions);
  assert.equal(resultsCsv(actual), resultsCsv(expected));
  assert.equal(summarizeSession(actual).totalLaps, 8);
  assert.equal(summarizeSession(actual).karts[1].delta, 17);
  assert.equal(actual.sources.length, 2);
  assert.equal(JSON.stringify(input), before);
});

test("empty folders and repeated folder names import without overwriting the current workspace", async () => {
  const copy = createFolderCopy(folder, []);
  assert.deepEqual(
    await readFolderLink(await createFolderLink(copy, "https://example.com/")),
    copy,
  );
  const first = prepareFolderImport(copy, [folder], [a]);
  const second = prepareFolderImport(copy, first.folders, first.sessions);
  assert.equal(second.folder.name, `${folder.name} (copy 2)`);
  assert.deepEqual(second.sessions, [a]);
  assert.equal(folderAnalysis(second.folder, second.sessions), null);
});

test("broken, unsupported and incomplete copies fail rather than partially importing sessions", async () => {
  const copy = createFolderCopy(folder, [a]);
  for (const mutate of [
    (v) => {
      v.version = 99;
    },
    (v) => {
      v.sessions.push(v.sessions[0]);
    },
    (v) => {
      v.sessions[0].karts[0].laps[0].seconds = 0;
    },
    (v) => {
      v.sessions[0].karts[0].laps[0].lap = -1;
    },
    (v) => {
      v.sessions[0].karts[0].number = "2 - Driver name";
    },
    (v) => {
      v.sessions[0].isTemporary = true;
    },
    (v) => {
      v.sessions[0].isCombined = true;
      v.sessions[0].sources = [];
    },
    (v) => {
      v.folder.name = "";
    },
  ]) {
    const invalid = structuredClone(copy);
    mutate(invalid);
    assert.throws(() => validateFolderCopy(invalid));
  }
  assert.throws(() => readFolderCopyJson("not JSON"), /invalid/);
  await assert.rejects(
    readFolderLink("https://example.com/#folder=v1.broken"),
    /damaged|incomplete|invalid/,
  );
  await assert.rejects(
    readFolderLink("https://example.com/#folder=v2.abc"),
    /not supported/,
  );
  await assert.rejects(readFolderLink("not a link"), /complete Kartlab/);
});

test("oversized compressed links stop decompression at the byte limit", async () => {
  const bytes = await new Response(
    new Blob(["x".repeat(MAX_FOLDER_BYTES + 1)])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  const token = Buffer.from(bytes).toString("base64url");
  await assert.rejects(
    readFolderLink(`https://example.com/#folder=v1.${token}`),
    /too large/,
  );
});

test("large folders can use a downloaded copy when they do not fit in a link", async () => {
  const times = Array.from(
    { length: 10000 },
    (_, i) => 50 + ((i * 2654435761) % 1000000000) / 1000000,
  );
  const copy = createFolderCopy(folder, [session("Long event", { 2: times })]);
  await assert.rejects(
    createFolderLink(copy, "https://example.com/"),
    /too large for a link/,
  );
  assert.deepEqual(readFolderCopyJson(folderCopyJson(copy)), copy);
});

test("saving an imported copy rolls back existing data if storage fills up between writes", () => {
  const originals = new Map([
    ["kartlab.sessions.v1", "original sessions"],
    ["kartlab.folders.v1", "original folders"],
  ]);
  const values = new Map(originals);
  let writes = 0;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => {
      if (++writes === 2) throw new Error("QuotaExceededError");
      values.set(key, value);
    },
  };
  assert.throws(
    () =>
      saveFolderImport(
        prepareFolderImport(createFolderCopy(folder, [a]), [], []),
        storage,
      ),
    /no room/,
  );
  assert.deepEqual(values, originals);
});
