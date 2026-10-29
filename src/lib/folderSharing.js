import { inFolder } from "./folders.js";

export const MAX_FOLDER_BYTES = 2 * 1024 * 1024;
export const MAX_FOLDER_LINK_LENGTH = 32000;
const FORMAT = "kartlab.folder";
const MAX_LAPS = 100000;

function invalid() {
  throw new Error(
    "This folder copy is invalid or incomplete. Your saved folders have not changed.",
  );
}
function text(value, max = 1000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    invalid();
  return value;
}
function count(value, fallback, min = 0) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < min) invalid();
  return value;
}
function uniqueIds(values) {
  if (new Set(values.map((value) => value.id)).size !== values.length)
    invalid();
}

export function validateFolderCopy(value) {
  if (value?.format !== FORMAT || value.version !== 1) invalid();
  const name = text(value.folder?.name, 60).trim();
  if (!Array.isArray(value.sessions) || value.sessions.length > 1000) invalid();
  let lapCount = 0;
  const sessions = value.sessions.map((session) => {
    if (!session || session.isTemporary || session.isFolder || session.isSample)
      invalid();
    const saved = {
      id: text(session.id, 256),
      name: text(session.name),
      fileName: text(session.fileName),
      isSample: false,
      skipped: count(session.skipped, 0),
      sheets: count(session.sheets, 1, 1),
    };
    if (session.importedAt !== undefined)
      saved.importedAt = text(session.importedAt, 100);
    const sources = session.sources;
    if (
      sources !== undefined &&
      (!Array.isArray(sources) || sources.length > 1000)
    )
      invalid();
    if (session.isCombined) {
      if (!sources?.length) invalid();
      saved.isCombined = true;
      saved.sources = sources.map((source) => {
        if (!source || source.isSample || source.isTemporary) invalid();
        return {
          id: text(source.id, 256),
          name: text(source.name),
          fileName: text(source.fileName),
          sheets: count(source.sheets, 1, 1),
          skipped: count(source.skipped, 0),
          lapCount: count(source.lapCount, 0),
          isSample: false,
        };
      });
      uniqueIds(saved.sources);
    } else if (sources?.length) invalid();
    if (
      !Array.isArray(session.karts) ||
      !session.karts.length ||
      session.karts.length > 1000
    )
      invalid();
    const numbers = new Set();
    const sourceIds = new Set(saved.sources?.map((source) => source.id));
    saved.karts = session.karts.map((kart) => {
      if (
        !kart ||
        typeof kart.number !== "string" ||
        !/^\d{1,16}$/.test(kart.number) ||
        !Number.isSafeInteger(Number(kart.number)) ||
        numbers.has(kart.number)
      )
        invalid();
      numbers.add(kart.number);
      if (!Array.isArray(kart.laps) || !kart.laps.length) invalid();
      lapCount += kart.laps.length;
      if (lapCount > MAX_LAPS) invalid();
      return {
        number: kart.number,
        laps: kart.laps.map((lap) => {
          if (
            !lap ||
            !Number.isSafeInteger(lap.lap) ||
            lap.lap < 1 ||
            !Number.isFinite(lap.seconds) ||
            lap.seconds <= 0 ||
            lap.seconds > 1e9
          )
            invalid();
          const savedLap = {
            lap: lap.lap,
            seconds: lap.seconds,
            sheet: text(lap.sheet),
          };
          if (saved.isCombined) {
            if (!sourceIds.has(lap.sourceId)) invalid();
            savedLap.sourceId = lap.sourceId;
            savedLap.sourceName = text(lap.sourceName);
          } else if (lap.sourceId !== undefined) invalid();
          return savedLap;
        }),
      };
    });
    return saved;
  });
  uniqueIds(sessions);
  return { format: FORMAT, version: 1, folder: { name }, sessions };
}

export function createFolderCopy(folder, sessions) {
  return validateFolderCopy({
    format: FORMAT,
    version: 1,
    folder: { name: folder.name },
    sessions: sessions.filter(
      (session) =>
        inFolder(session, folder.id) &&
        !session.isTemporary &&
        !session.isFolder,
    ),
  });
}

export function folderCopyJson(copy) {
  const json = JSON.stringify(validateFolderCopy(copy));
  if (new TextEncoder().encode(json).byteLength > MAX_FOLDER_BYTES) {
    throw new Error(
      "This folder is too large to share as one copy. Split its sessions into smaller folders first.",
    );
  }
  return json;
}

export function readFolderCopyJson(json) {
  if (
    typeof json !== "string" ||
    new TextEncoder().encode(json).byteLength > MAX_FOLDER_BYTES
  ) {
    throw new Error(
      "This folder copy is too large. Your saved folders have not changed.",
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    invalid();
  }
  return validateFolderCopy(parsed);
}

async function boundedBytes(stream, max) {
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new Error(
          "This folder copy is too large. Your saved folders have not changed.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
function base64url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createFolderLink(copy, baseUrl) {
  if (typeof CompressionStream === "undefined") {
    throw new Error(
      "This browser can’t create folder links. Download a folder copy instead.",
    );
  }
  const json = folderCopyJson(copy);
  const bytes = await boundedBytes(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
    MAX_FOLDER_BYTES + 65536,
  );
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = `folder=v1.${base64url(bytes)}`;
  if (url.href.length > MAX_FOLDER_LINK_LENGTH) {
    throw new Error(
      "This folder is too large for a link. Download a folder copy and open that file on your other device instead.",
    );
  }
  return url.href;
}

export function hasFolderLink(url) {
  try {
    return new URLSearchParams(new URL(url).hash.slice(1)).has("folder");
  } catch {
    return false;
  }
}

export async function readFolderLink(link) {
  if (typeof link !== "string" || link.length > MAX_FOLDER_LINK_LENGTH) {
    throw new Error(
      "This folder link is too long. Ask for a downloaded folder copy instead.",
    );
  }
  let token;
  try {
    const values = new URLSearchParams(
      new URL(link.trim()).hash.slice(1),
    ).getAll("folder");
    if (values.length !== 1) invalid();
    token = values[0];
  } catch {
    throw new Error("Paste a complete Kartlab folder link.");
  }
  if (!token.startsWith("v1."))
    throw new Error(
      "This folder link is not supported by this version of Kartlab.",
    );
  const encoded = token.slice(3);
  if (!/^[\w-]+$/.test(encoded) || encoded.length % 4 === 1) invalid();
  if (typeof DecompressionStream === "undefined")
    throw new Error("Use an up-to-date browser to open this folder link.");
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = await boundedBytes(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
      MAX_FOLDER_BYTES,
    );
    return readFolderCopyJson(
      new TextDecoder("utf-8", { fatal: true }).decode(decoded),
    );
  } catch (error) {
    if (error.message.includes("too large")) throw error;
    throw new Error(
      "This folder link is damaged or incomplete. Ask for a new link. Your saved folders have not changed.",
    );
  }
}

export function prepareFolderImport(copy, folders, sessions) {
  const checked = validateFolderCopy(copy);
  const names = new Set(folders.map((folder) => folder.name.toLowerCase()));
  let name = checked.folder.name;
  for (let n = 1; names.has(name.toLowerCase()); n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    name = checked.folder.name.slice(0, 60 - suffix.length).trimEnd() + suffix;
  }
  const folder = { id: crypto.randomUUID(), name };
  // New IDs keep imported copies independent. A shared map retains provenance
  // between originals and older saved combinations so their laps count once.
  const ids = new Map();
  function remap(id) {
    if (!ids.has(id)) ids.set(id, crypto.randomUUID());
    return ids.get(id);
  }
  const imported = checked.sessions.map((session) => ({
    ...session,
    id: remap(session.id),
    folderIds: [folder.id],
    ...(session.sources
      ? {
          sources: session.sources.map((source) => ({
            ...source,
            id: remap(source.id),
          })),
        }
      : {}),
    karts: session.karts.map((kart) => ({
      ...kart,
      laps: kart.laps.map((lap) => ({
        ...lap,
        ...(lap.sourceId ? { sourceId: remap(lap.sourceId) } : {}),
      })),
    })),
  }));
  return {
    folder,
    folders: [...folders, folder],
    sessions: [...imported, ...sessions],
  };
}

export function saveFolderImport(result, storage = localStorage) {
  const keys = ["kartlab.sessions.v1", "kartlab.folders.v1"];
  const before = keys.map((key) => storage.getItem(key));
  try {
    storage.setItem(keys[0], JSON.stringify(result.sessions));
    storage.setItem(keys[1], JSON.stringify(result.folders));
  } catch {
    for (let i = 0; i < keys.length; i++) {
      try {
        if (before[i] === null) storage.removeItem(keys[i]);
        else storage.setItem(keys[i], before[i]);
      } catch {
        /* Retain the original data where storage permits. */
      }
    }
    throw new Error(
      "This browser has no room to save the folder copy. Free up browser storage or try another browser. Your current workspace has not been replaced.",
    );
  }
}
