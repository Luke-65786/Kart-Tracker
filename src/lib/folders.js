import { combineSessions } from "./combineSessions.js";

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
  const members = sessions.filter((session) => session.folderId === folder.id);
  if (!members.length) return null;
  return {
    ...combineSessions(members, folder.name, {
      minimumSources: 1,
      id: `folder:${folder.id}`,
    }),
    isFolder: true,
    folderId: folder.id,
    fileName: `${members.length} saved ${members.length === 1 ? "session" : "sessions"}`,
  };
}

export function unfileFolder(sessions, folderId) {
  return sessions.map((session) =>
    session.folderId === folderId ? { ...session, folderId: null } : session,
  );
}
