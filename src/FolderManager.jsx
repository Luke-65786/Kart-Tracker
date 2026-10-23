import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { summarizeSession } from "./lib/timing.js";

export default function FolderManager({
  folders,
  sessions,
  activeFolderId,
  onCreate,
  onRename,
  onDelete,
  onMove,
  onOpen,
  busy,
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(
    activeFolderId || folders[0]?.id || null,
  );
  const [error, setError] = useState("");
  const editing = folders.find((folder) => folder.id === editingId);
  function create(event) {
    event.preventDefault();
    try {
      const id = onCreate(name);
      setEditingId(id);
      setName("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="folder-manager">
      <p className="modal-description">
        Group your Excel sessions by track, event, or date. Each folder has a
        live overall kart comparison.
      </p>
      <form className="new-folder-form" onSubmit={create}>
        <label className="visually-hidden" htmlFor="new-folder-name">
          New folder name
        </label>
        <input
          id="new-folder-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Rye House race day"
        />
        <button className="button primary" type="submit">
          <Plus size={16} />
          Create folder
        </button>
      </form>
      {error && (
        <p className="combine-error" role="alert">
          {error}
        </p>
      )}
      <div className="folder-list">
        {folders.map((folder) => {
          const members = sessions.filter(
            (session) => session.folderId === folder.id,
          );
          return (
            <div
              className={`folder-card ${editingId === folder.id ? "selected" : ""}`}
              key={folder.id}
            >
              <button
                className="folder-edit-button"
                aria-label={`Manage files in ${folder.name}`}
                onClick={() => {
                  setEditingId(folder.id);
                  setError("");
                }}
              >
                {editingId === folder.id ? (
                  <FolderOpen size={21} />
                ) : (
                  <Folder size={21} />
                )}
              </button>
              <div className="folder-card-info">
                <input
                  aria-label={`Folder name for ${folder.name}`}
                  defaultValue={folder.name}
                  key={folder.name}
                  maxLength={60}
                  onBlur={(e) => {
                    try {
                      onRename(folder.id, e.target.value);
                      setError("");
                    } catch (err) {
                      setError(err.message);
                      e.target.value = folder.name;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                  }}
                />
                <button
                  className="folder-files-button"
                  onClick={() => {
                    setEditingId(folder.id);
                    setError("");
                  }}
                >
                  {members.length} saved{" "}
                  {members.length === 1 ? "session" : "sessions"} · manage files
                </button>
              </div>
              <button
                className="session-open"
                aria-label={`Open ${folder.name} comparison`}
                onClick={() => onOpen(folder.id)}
              >
                <ArrowUpRight size={17} />
              </button>
              <button
                className="icon-button delete-button"
                aria-label={`Delete folder ${folder.name}`}
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete the folder “${folder.name}”? All its sessions will be kept in All sessions.`,
                    )
                  )
                    return;
                  onDelete(folder.id);
                  if (editingId === folder.id) setEditingId(null);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {!folders.length && (
        <div className="no-folders">
          <Folder size={29} />
          <p>Create your first folder, then choose its sessions below.</p>
        </div>
      )}
      {editing && (
        <section className="folder-members">
          <div className="folder-members-heading">
            <h3>Files in {editing.name}</h3>
            <span>Changes save automatically</span>
          </div>
          <p>
            Select a session to move it into this folder. Uncheck it to keep it
            in All sessions.
          </p>
          <div className="folder-member-list">
            {sessions.map((session) => {
              const info = summarizeSession(session);
              const currentFolder = folders.find(
                (folder) => folder.id === session.folderId,
              );
              return (
                <label
                  className={`combine-option ${session.folderId === editing.id ? "checked" : ""}`}
                  key={session.id}
                >
                  <input
                    type="checkbox"
                    aria-label={`Add ${session.name} to ${editing.name}`}
                    checked={session.folderId === editing.id}
                    onChange={(e) =>
                      onMove(session.id, e.target.checked ? editing.id : null)
                    }
                  />
                  <span className="combine-option-info">
                    <strong>{session.name}</strong>
                    <small>
                      {info.karts.length} karts · {info.totalLaps} laps
                      {session.isSample
                        ? " · Sample"
                        : session.isCombined
                          ? " · Combined analysis"
                          : ""}
                    </small>
                    <small>
                      {currentFolder ? `In ${currentFolder.name}` : "Unfiled"} ·{" "}
                      {session.fileName}
                    </small>
                  </span>
                  {session.folderId === editing.id ? (
                    <Check size={17} />
                  ) : (
                    <FileSpreadsheet size={17} />
                  )}
                </label>
              );
            })}
          </div>
          <button
            className="button primary full"
            onClick={() => onOpen(editing.id)}
          >
            <FolderOpen size={16} />
            Open {editing.name} comparison
            <ArrowUpRight size={15} />
          </button>
        </section>
      )}
      <p className="modal-footnote">
        Folders and sessions are saved in this browser. Deleting a folder keeps
        its sessions. Overlapping analyses count each original source session
        once.
      </p>
    </div>
  );
}
