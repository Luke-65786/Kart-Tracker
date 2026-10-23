import { ChevronDown, Folder, Plus } from "lucide-react";
import { inFolder } from "./lib/folders.js";

export default function SessionFolders({
  session,
  folders,
  onMembershipChange,
  onManageFolders,
}) {
  const assigned = folders.filter((folder) => inFolder(session, folder.id));
  return (
    <details className="session-folders">
      <summary aria-label={`Folders for ${session.name}`}>
        <Folder size={13} />
        <span>
          {assigned.length
            ? assigned.map((folder) => folder.name).join(", ")
            : "Add to folders"}
        </span>
        <ChevronDown size={12} />
      </summary>
      <div className="session-folder-options">
        <p>Choose one or more folders.</p>
        {folders.map((folder) => (
          <label className="session-folder-option" key={folder.id}>
            <input
              type="checkbox"
              aria-label={`Include ${session.name} in ${folder.name}`}
              checked={inFolder(session, folder.id)}
              onChange={(event) =>
                onMembershipChange(session.id, folder.id, event.target.checked)
              }
            />
            <span>{folder.name}</span>
          </label>
        ))}
        {!folders.length && (
          <button className="button secondary" onClick={onManageFolders}>
            <Plus size={13} />
            Create a folder
          </button>
        )}
      </div>
    </details>
  );
}
