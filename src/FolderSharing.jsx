import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileUp,
  FolderOpen,
  Link,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  createFolderCopy,
  createFolderLink,
  folderCopyJson,
  MAX_FOLDER_BYTES,
  readFolderCopyJson,
  readFolderLink,
} from "./lib/folderSharing.js";
import { folderAnalysis } from "./lib/folders.js";
import { summarizeSession } from "./lib/timing.js";

export function ShareFolderPanel({ folder, sessions }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copy, setCopy] = useState(null);
  useEffect(() => {
    let active = true;
    setWorking(true);
    setError("");
    setLink("");
    setCopy(null);
    setCopied(false);
    try {
      const snapshot = createFolderCopy(folder, sessions);
      folderCopyJson(snapshot);
      setCopy(snapshot);
      createFolderLink(snapshot, window.location.href)
        .then((value) => {
          if (active) setLink(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setWorking(false);
        });
    } catch (e) {
      setError(e.message);
      setWorking(false);
    }
    return () => {
      active = false;
    };
  }, [folder, sessions]);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
    } catch {
      setCopied(false);
      setError(
        "Select and copy the folder link below, or download a folder copy.",
      );
    }
  }
  function download() {
    try {
      const url = URL.createObjectURL(
        new Blob([folderCopyJson(copy)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${folder.name.replace(/[^a-z0-9_-]/gi, "_")}.kartlab.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="folder-sharing">
      <p className="modal-description">
        Open <strong>{folder.name}</strong> on another device with the same
        sessions, lap times, and kart comparison. No account needed.
      </p>
      <div className="folder-share-summary">
        <FolderOpen size={24} />
        <div>
          <strong>{folder.name}</strong>
          <span>
            {copy?.sessions.length ?? 0} saved{" "}
            {copy?.sessions.length === 1 ? "session" : "sessions"} included
          </span>
        </div>
      </div>
      <div className="share-explainer">
        <ShieldCheck size={18} />
        <p>
          Anyone with this link can open a copy. Changes on either device won’t
          update the other copy. Share a new link to send updated results.
        </p>
      </div>
      {working && (
        <p className="share-loading" role="status">
          <LoaderCircle size={16} className="spin" />
          Creating your folder link…
        </p>
      )}
      {error && (
        <p className="share-error" role="alert">
          {error}
        </p>
      )}
      {link && (
        <>
          <label className="share-field-label" htmlFor="folder-share-link">
            Folder link
          </label>
          <textarea
            id="folder-share-link"
            value={link}
            readOnly
            rows={3}
            spellCheck={false}
            onFocus={(event) => event.target.select()}
          />
          <button className="button primary full" onClick={copyLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Link copied" : "Copy folder link"}
          </button>
          {copied && (
            <p className="share-success" role="status">
              Paste this link on your other device to open the folder.
            </p>
          )}
        </>
      )}
      <button
        className="button secondary full share-download"
        onClick={download}
        disabled={!copy}
      >
        <Download size={16} />
        Download folder copy
      </button>
      <p className="modal-footnote">
        The link contains this folder’s saved lap data. Other folders, device
        settings, and temporary analyses are left out. For large folders, send
        the downloaded copy and open it from Folders on your other device.
      </p>
    </div>
  );
}

export function OpenFolderPanel({ initialLink = "", onImport }) {
  const [link, setLink] = useState(initialLink);
  const [copy, setCopy] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const fileInput = useRef(null);
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    const serial = ++request.current;
    setLink(initialLink);
    setCopy(null);
    setError("");
    setWorking(Boolean(initialLink));
    if (initialLink)
      readFolderLink(initialLink)
        .then((value) => {
          if (active && request.current === serial) setCopy(value);
        })
        .catch((e) => {
          if (active && request.current === serial) setError(e.message);
        })
        .finally(() => {
          if (active && request.current === serial) setWorking(false);
        });
    return () => {
      active = false;
      request.current++;
    };
  }, [initialLink]);
  async function preview(event) {
    event.preventDefault();
    const serial = ++request.current;
    setCopy(null);
    setError("");
    setWorking(true);
    try {
      const value = await readFolderLink(link);
      if (request.current === serial) setCopy(value);
    } catch (e) {
      if (request.current === serial) setError(e.message);
    } finally {
      if (request.current === serial) setWorking(false);
    }
  }
  async function openFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const serial = ++request.current;
    setCopy(null);
    setError("");
    setWorking(true);
    try {
      if (file.size > MAX_FOLDER_BYTES)
        throw new Error(
          "This folder copy is too large. Ask for a smaller folder copy.",
        );
      const value = readFolderCopyJson(await file.text());
      if (request.current === serial) {
        setCopy(value);
        setLink("");
      }
    } catch (e) {
      if (request.current === serial) setError(e.message);
    } finally {
      if (request.current === serial) setWorking(false);
      event.target.value = "";
    }
  }
  function openCopy() {
    try {
      onImport(copy);
    } catch (e) {
      setError(e.message);
    }
  }
  const previewSessions =
    copy?.sessions.map((session) => ({ ...session, folderIds: ["preview"] })) ||
    [];
  const stats = summarizeSession(
    folderAnalysis({ id: "preview", name: "Shared folder" }, previewSessions),
  );
  return (
    <div className="folder-sharing">
      <p className="modal-description">
        Open a folder link or downloaded folder copy from another device. Your
        existing folders and sessions stay in place.
      </p>
      {!copy && (
        <>
          <form className="open-folder-form" onSubmit={preview}>
            <label className="share-field-label" htmlFor="open-folder-link">
              Folder link
            </label>
            <textarea
              id="open-folder-link"
              value={link}
              rows={3}
              onChange={(event) => setLink(event.target.value)}
              placeholder="Paste a Kartlab folder link…"
              spellCheck={false}
            />
            <button
              className="button primary full"
              disabled={working || !link.trim()}
            >
              <Link size={16} />
              Preview folder
            </button>
          </form>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.kartlab,application/json"
            className="visually-hidden"
            aria-label="Open downloaded folder copy"
            onChange={openFile}
          />
          <button
            className="button secondary full share-download"
            onClick={() => fileInput.current.click()}
            disabled={working}
          >
            <FileUp size={16} />
            Open downloaded copy
          </button>
        </>
      )}
      {working && (
        <p className="share-loading" role="status">
          <LoaderCircle size={16} className="spin" />
          Reading folder copy…
        </p>
      )}
      {error && (
        <p className="share-error" role="alert">
          {error}
        </p>
      )}
      {copy && (
        <>
          <div className="folder-share-summary">
            <FolderOpen size={27} />
            <div>
              <strong>{copy.folder.name}</strong>
              <span>
                {copy.sessions.length}{" "}
                {copy.sessions.length === 1 ? "session" : "sessions"} ·{" "}
                {stats.karts.length}{" "}
                {stats.karts.length === 1 ? "kart" : "karts"} ·{" "}
                {stats.totalLaps} {stats.totalLaps === 1 ? "lap" : "laps"}
              </span>
            </div>
          </div>
          <div className="share-session-preview">
            {copy.sessions.map((session) => (
              <div key={session.id}>
                <strong>{session.name}</strong>
                <span>{session.fileName}</span>
              </div>
            ))}
            {!copy.sessions.length && (
              <p>
                This folder is empty. You can add sessions after opening it.
              </p>
            )}
          </div>
          <p className="modal-description">
            This is a separate copy saved on this device. Future changes won’t
            sync. A folder with the same name will be kept, and this copy will
            get a new name.
          </p>
          <button className="button primary full" onClick={openCopy}>
            <FolderOpen size={16} />
            Open a copy
          </button>
          <button
            className="text-button share-another"
            onClick={() => {
              request.current++;
              setCopy(null);
              setError("");
              setLink("");
            }}
          >
            Use a different link or file
          </button>
        </>
      )}
    </div>
  );
}
