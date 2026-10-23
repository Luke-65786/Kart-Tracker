import { combineSessions } from "./combineSessions.js";

export function sessionFolderIds(session) {
  // An explicit empty list takes precedence over a legacy single assignment.
  const ids = Array.isArray(session?.folderIds)
    ? session.folderIds
    : [session?.folderId];
  return [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))];
}

export function inFolder(session, folderId) {
  return sessionFolderIds(session).includes(folderId);
}

export function normalizeSessionFolders(session) {
  const { folderId, ...saved } = session;
  return { ...saved, folderIds: sessionFolderIds(session) };
}

export function withFolderMembership(session, folderId, included) {
  const saved = normalizeSessionFolders(session);
  if (typeof folderId !== "string" || !folderId.trim()) return saved;
  return {
    ...saved,
    folderIds: included
      ? [...new Set([...saved.folderIds, folderId])]
      : saved.folderIds.filter((id) => id !== folderId),
  };
}

export function folderName(value, folders, currentId = null) {
  const name = value.trim();
  if (!name) throw new Error("Give your folder a name.");
  if (name.length > 60)
    throw new Error("Use up to 60 characters for a folder name.");
  if (
    folders.some(
      (folder) =>
        folder.id !== currentId &&
        folder.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error(
      "A folder with this name already exists. Choose another name.",
    );
  }
  return name;
}

export function folderAnalysis(folder, sessions) {
  const members = sessions.filter((session) => inFolder(session, folder.id));
  if (!members.length) return null;
  return {
    ...combineSessions(members, folder.name, {
      minimumSources: 1,
      id: `folder:${folder.id}`,
    }),
    isFolder: true,
    folderIds: [folder.id],
    fileName: `${members.length} saved ${members.length === 1 ? "session" : "sessions"}`,
  };
}

export function unfileFolder(sessions, folderId) {
  return sessions.map((session) =>
    inFolder(session, folderId)
      ? withFolderMembership(session, folderId, false)
      : session,
  );
}
