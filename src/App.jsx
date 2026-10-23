import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Flag,
  Gauge,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Timer,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import {
  formatDelta,
  formatTime,
  resultsCsv,
  summarizeSession,
} from "./lib/timing.js";
import { combineSessions } from "./lib/combineSessions.js";
import {
  folderAnalysis,
  folderName,
  inFolder,
  normalizeSessionFolders,
  unfileFolder,
  withFolderMembership,
} from "./lib/folders.js";
import FolderManager from "./FolderManager.jsx";
import SessionFolders from "./SessionFolders.jsx";
import { restoreSessions } from "./lib/savedSessions.js";
import SettingsPanel from "./SettingsPanel.jsx";
import {
  applyPreferences,
  loadPreferences,
  PREFERENCES_KEY,
} from "./lib/preferences.js";

const STORAGE_KEY = "kartlab.sessions.v1";
const FOLDER_STORAGE_KEY = "kartlab.folders.v1";
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

function loadSessions() {
  try {
    return restoreSessions(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    /* A fresh session also recovers from unavailable or invalid storage. */
  }
  return [];
}

function loadFolders() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOLDER_STORAGE_KEY));
    if (
      Array.isArray(stored) &&
      stored.every(
        (folder) =>
          typeof folder.id === "string" &&
          folder.id &&
          typeof folder.name === "string" &&
          folder.name.trim(),
      ) &&
      new Set(stored.map((folder) => folder.id)).size === stored.length
    )
      return stored;
  } catch {
    /* Existing sessions remain available if folder metadata cannot be read. */
  }
  return [];
}

function Brand({ small = false }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brand-symbol">
        <Flag size={21} strokeWidth={2.6} />
      </span>
      <span>
        kartlab<span className="brand-dot">.</span>
      </span>
    </div>
  );
}

function Modal({ children, title, eyebrow, close, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Sparkline({ laps, winner }) {
  const times = laps.map((l) => l.seconds);
  const min = times.reduce((a, b) => Math.min(a, b), Infinity),
    max = times.reduce((a, b) => Math.max(a, b), -Infinity);
  const points = times
    .map(
      (t, i) =>
        `${(i / Math.max(times.length - 1, 1)) * 86},${22 - ((t - min) / (max - min || 1)) * 18}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox="0 0 88 26"
      role="img"
      aria-label="Lap time trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke={winner ? COLORS[0] : "var(--muted)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LapChart({ karts, compact = false }) {
  const [hovered, setHovered] = useState(null);
  const width = 800,
    height = compact ? 200 : 245,
    pad = { left: 52, right: 20, top: 20, bottom: 35 };
  const times = karts.flatMap((k) => k.laps.map((l) => l.seconds));
  if (!times.length) return null;
  const low =
    Math.floor(times.reduce((a, b) => Math.min(a, b), Infinity) * 2) / 2 - 0.5;
  const high =
    Math.ceil(times.reduce((a, b) => Math.max(a, b), -Infinity) * 2) / 2 + 0.5;
  const maxLength = Math.max(...karts.map((k) => k.laps.length));
  const x = (i) =>
    pad.left +
    (maxLength > 1 ? i / (maxLength - 1) : 0.5) *
      (width - pad.left - pad.right);
  const y = (t) =>
    pad.top + ((high - t) / (high - low)) * (height - pad.top - pad.bottom);
  const ticks = [
    ...new Set([
      0,
      ...Array.from({ length: 5 }, (_, i) =>
        Math.round(((maxLength - 1) * (i + 1)) / 5),
      ),
    ]),
  ];
  return (
    <div className="lap-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Lap time chart for ${karts.map((k) => `kart ${k.number}`).join(", ")}`}
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const i = Math.round(
            ((((e.clientX - box.left) / box.width) * width - pad.left) /
              (width - pad.left - pad.right)) *
              (maxLength - 1),
          );
          setHovered(Math.max(0, Math.min(maxLength - 1, i)));
        }}
      >
        <title>Lap times in seconds. Lower is faster.</title>
        {[0, 1, 2, 3, 4].map((i) => {
          const t = low + ((high - low) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--chart-grid)"
                strokeDasharray="4 5"
              />
              <text x={pad.left - 12} y={y(t) + 4} textAnchor="end">
                {t.toFixed(1)}s
              </text>
            </g>
          );
        })}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={height - 9} textAnchor="middle">
            {i + 1}
          </text>
        ))}
        {karts.map((k, index) => (
          <g key={k.number}>
            {karts.length === 1 && (
              <polygon
                points={`${x(0)},${height - pad.bottom} ${k.laps.map((l, i) => `${x(i)},${y(l.seconds)}`).join(" ")} ${x(k.laps.length - 1)},${height - pad.bottom}`}
                fill="url(#chartFill)"
              />
            )}
            <polyline
              points={k.laps.map((l, i) => `${x(i)},${y(l.seconds)}`).join(" ")}
              fill="none"
              stroke={COLORS[index]}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {k.laps.length === 1 && (
              <circle
                cx={x(0)}
                cy={y(k.laps[0].seconds)}
                r="4"
                fill={COLORS[index]}
              />
            )}
            {hovered !== null && k.laps[hovered] && (
              <circle
                cx={x(hovered)}
                cy={y(k.laps[hovered].seconds)}
                r="5"
                stroke="var(--surface)"
                strokeWidth="2"
                fill={COLORS[index]}
              />
            )}
          </g>
        ))}
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[0]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={COLORS[0]} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {hovered !== null && (
          <line
            x1={x(hovered)}
            x2={x(hovered)}
            y1={pad.top}
            y2={height - pad.bottom}
            stroke="var(--muted)"
            strokeDasharray="3 4"
          />
        )}
      </svg>
      <div className={`chart-reading ${hovered === null ? "muted" : ""}`}>
        {hovered === null ? (
          "Hover over the chart to explore each lap"
        ) : (
          <>
            Recorded lap {hovered + 1}
            <span>·</span>
            {karts.map(
              (k, i) =>
                k.laps[hovered] && (
                  <span key={k.number} style={{ color: COLORS[i] }}>
                    #{k.number} {formatTime(k.laps[hovered].seconds)}
                  </span>
                ),
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UploadCard({ openFile, importFiles, busy, importProgress }) {
  const [dragging, setDragging] = useState(false);
  return (
    <section
      className={`upload-card ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy && e.dataTransfer.files.length)
          importFiles(e.dataTransfer.files);
      }}
    >
      <div className="section-kicker">
        <span className="tiny-dot" /> YOUR NEXT SESSION
      </div>
      <div className="upload-illustration">
        <div className="file-shadow" />
        <div className="file-illustration">
          <FileSpreadsheet size={31} strokeWidth={1.5} />
          <span>.XLSX</span>
        </div>
        <span className="upload-orb">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <h2>Drop. Upload. Discover.</h2>
      <p>
        Your next insight is already
        <br />
        in your spreadsheet.
      </p>
      <button className="button dark full" onClick={openFile} disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Plus size={17} />
        )}
        {busy ? importProgress : "Upload Excel sheets"}
      </button>
      <span className="upload-hint">
        Select several to combine · up to 10 MB each
      </span>
      <div className="upload-privacy">
        <ShieldCheck size={14} />
        <span>Your files stay in your browser.</span>
      </div>
    </section>
  );
}

export default function App() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [sessions, setSessions] = useState(loadSessions);
  const [temporaryAnalysis, setTemporaryAnalysis] = useState(null);
  const [folders, setFolders] = useState(loadFolders);
  const [activeFolderId, setActiveFolderId] = useState(() => {
    try {
      return localStorage.getItem("kartlab.activeFolder") || null;
    } catch {
      return null;
    }
  });
  const [activeId, setActiveId] = useState(() => {
    try {
      return (
        localStorage.getItem("kartlab.active") || loadSessions()[0]?.id || null
      );
    } catch {
      return null;
    }
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(preferences.defaultSort);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [detailNumber, setDetailNumber] = useState(null);
  const [chartNumber, setChartNumber] = useState(null);
  const [compareNumbers, setCompareNumbers] = useState([]);
  const [combineIds, setCombineIds] = useState([]);
  const [combineName, setCombineName] = useState("Combined analysis");
  const [combineError, setCombineError] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const fileInput = useRef(null);
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const folderMembers = useMemo(
    () =>
      activeFolder ? sessions.filter((s) => inFolder(s, activeFolder.id)) : [],
    [sessions, activeFolder],
  );
  const overall = useMemo(
    () => (activeFolder ? folderAnalysis(activeFolder, sessions) : null),
    [activeFolder, sessions],
  );
  const isFolderOverview = Boolean(
    activeFolder &&
      (activeId === `folder:${activeFolder.id}` ||
        !folderMembers.some((s) => s.id === activeId)),
  );
  const availableSessions = temporaryAnalysis
    ? [temporaryAnalysis, ...sessions]
    : sessions;
  const isTemporaryActive = !activeFolder && temporaryAnalysis?.id === activeId;
  const hasData = activeFolder
    ? folderMembers.length > 0
    : sessions.length > 0 || isTemporaryActive;
  const session =
    (isTemporaryActive && temporaryAnalysis) ||
    (isFolderOverview && overall) ||
    (activeFolder
      ? folderMembers.find((s) => s.id === activeId)
      : sessions.find((s) => s.id === activeId)) ||
    sessions[0];
  const visibleSessions = activeFolder ? folderMembers : availableSessions;
  const persistedActiveId = session?.isTemporary
    ? sessions[0]?.id
    : session?.id;
  const stats = useMemo(() => summarizeSession(session), [session]);
  const chartKart =
    stats.karts.find((k) => k.number === chartNumber) || stats.karts[0];
  const detailKart = stats.karts.find((k) => k.number === detailNumber);
  const filtered = useMemo(() => {
    const list = stats.karts.filter((k) =>
      k.number.includes(query.trim().replace(/^#/, "")),
    );
    return [...list].sort((a, b) =>
      sort === "number"
        ? Number(a.number) - Number(b.number)
        : sort === "laps"
          ? b.count - a.count || a.average - b.average
          : a[sort] - b[sort],
    );
  }, [stats, query, sort]);

  useEffect(() => {
    applyPreferences(preferences);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      /* Display settings still apply for this visit. */
    }
  }, [preferences]);
  useEffect(() => {
    setSort(preferences.defaultSort);
  }, [preferences.defaultSort]);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(sessions.filter((s) => !s.isTemporary)),
      );
    } catch {
      setError(
        "Browser storage is full or unavailable. This session works now, but may not be saved when you leave. Export your results to keep them.",
      );
    }
  }, [sessions]);
  useEffect(() => {
    try {
      localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(folders));
    } catch {
      setError(
        "Browser storage is unavailable. Folder changes may not be kept when you leave.",
      );
    }
  }, [folders]);
  useEffect(() => {
    try {
      localStorage.setItem("kartlab.activeFolder", activeFolder?.id || "");
    } catch {
      /* The current folder still works in memory. */
    }
  }, [activeFolder?.id]);
  useEffect(() => {
    try {
      if (persistedActiveId)
        localStorage.setItem("kartlab.active", persistedActiveId);
      else localStorage.removeItem("kartlab.active");
    } catch {
      /* Session is still usable in memory. */
    }
  }, [persistedActiveId]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timeout);
  }, [notice]);

  function activate(id) {
    setActiveId(id);
    setQuery("");
    setChartNumber(null);
    setDetailNumber(null);
  }
  function chooseFolder(id) {
    setActiveFolderId(id || null);
    activate(
      id
        ? `folder:${id}`
        : availableSessions.some((s) => s.id === activeId)
          ? activeId
          : availableSessions[0]?.id || null,
    );
    setModal(null);
  }
  function openSession(id) {
    const selected = sessions.find((s) => s.id === id);
    setActiveFolderId(
      activeFolder && inFolder(selected, activeFolder.id)
        ? activeFolder.id
        : folders.find((folder) => inFolder(selected, folder.id))?.id || null,
    );
    activate(id);
    setModal(null);
  }
  function createFolder(value) {
    const name = folderName(value, folders);
    const id = globalThis.crypto.randomUUID();
    setFolders((current) => [...current, { id, name }]);
    return id;
  }
  function renameFolder(id, value) {
    const name = folderName(value, folders, id);
    setFolders((current) =>
      current.map((folder) =>
        folder.id === id ? { ...folder, name } : folder,
      ),
    );
  }
  function deleteFolder(id) {
    setFolders((current) => current.filter((folder) => folder.id !== id));
    setSessions((current) => unfileFolder(current, id));
    if (activeFolderId === id) {
      setActiveFolderId(null);
      activate(sessions[0]?.id || null);
    }
    setNotice("Folder removed. All sessions have been kept.");
  }
  function setSessionMembership(id, folderId, included) {
    setSessions((current) =>
      current.map((s) =>
        s.id === id ? withFolderMembership(s, folderId, included) : s,
      ),
    );
  }
  function openFile() {
    if (!busy) fileInput.current.click();
  }
  async function importFiles(fileList) {
    if (busy) return;
    const files = Array.from(fileList);
    if (!files.length) return;
    const destination = activeFolder;
    setBusy(true);
    setError("");
    try {
      if (files.length > 20)
        throw new Error("Please upload up to 20 Excel sheets at a time.");
      for (const file of files) {
        if (!/\.xlsx$/i.test(file.name))
          throw new Error(
            "Please choose an Excel .xlsx file. Other file types are not supported.",
          );
        if (file.size > 10 * 1024 * 1024)
          throw new Error(
            `${file.name} is larger than 10 MB. Please upload a smaller workbook.`,
          );
      }
      const { importWorkbook } = await import("./lib/importWorkbook.js");
      const imported = [];
      for (const [index, file] of files.entries()) {
        setImportProgress(`Reading ${index + 1} of ${files.length}…`);
        try {
          imported.push(
            await importWorkbook(await file.arrayBuffer(), file.name),
          );
        } catch (e) {
          throw new Error(
            `${file.name}: ${e.message} No sessions from this upload were added.`,
          );
        }
      }
      const active =
        imported.length > 1 && !destination
          ? combineSessions(imported, `${imported.length} sessions combined`, {
              temporary: true,
            })
          : imported[0];
      const added = destination
        ? imported.map((s) => withFolderMembership(s, destination.id, true))
        : imported;
      setSessions((current) => [
        ...added.map(normalizeSessionFolders),
        ...current,
      ]);
      if (active.isTemporary) setTemporaryAnalysis(active);
      activate(destination ? `folder:${destination.id}` : active.id);
      setNotice(
        destination
          ? `${imported.length} ${imported.length === 1 ? "session" : "sessions"} added to ${destination.name}. Folder comparison updated.`
          : imported.length > 1
            ? `${imported.length} sessions combined temporarily. Original sessions are saved.`
            : `${active.karts.length} karts imported. Your lap analysis is ready.`,
      );
      setModal(null);
    } catch (e) {
      setError(
        e.message ||
          "Something went wrong reading your workbook. Please try again.",
      );
      setModal(null);
    } finally {
      setBusy(false);
      setImportProgress("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function exportResults() {
    const blob = new Blob(["\uFEFF", resultsCsv(session)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${session.name.replace(/[^a-z0-9_-]/gi, "_")}_kart_results.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Results exported. Every kart, down to the millisecond.");
  }
  function openCompare() {
    setCompareNumbers(stats.karts.slice(0, 3).map((k) => k.number));
    setModal("compare");
  }
  function openCombine() {
    setCombineIds(
      isFolderOverview
        ? folderMembers.map((s) => s.id)
        : session
          ? [session.id]
          : [],
    );
    setCombineName("Combined analysis");
    setCombineError("");
    setModal("combine");
  }
  function previewCombined() {
    try {
      const combined = combineSessions(
        availableSessions.filter((s) => combineIds.includes(s.id)),
        combineName,
        { temporary: true },
      );
      setTemporaryAnalysis(combined);
      setActiveFolderId(null);
      activate(combined.id);
      setModal(null);
      setNotice(
        `${combined.sources.length} source sessions combined temporarily. Clears on refresh.`,
      );
    } catch (e) {
      setCombineError(e.message);
    }
  }
  function closeTemporaryAnalysis() {
    setTemporaryAnalysis(null);
    activate(sessions[0]?.id || null);
  }
  function removeSession(id) {
    if (
      !window.confirm(
        "Remove this session from this browser and all its folders? Export your results first if you want to keep them.",
      )
    )
      return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (id === session?.id) activate(remaining[0]?.id || null);
  }
  const fastestAverage = stats.karts[0];
  const gap =
    stats.karts.length > 1
      ? stats.karts[1].average - fastestAverage.average
      : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={
              !modal || modal === "details" ? "nav-link active" : "nav-link"
            }
            onClick={() =>
              activeFolder ? chooseFolder(activeFolder.id) : setModal(null)
            }
          >
            <LayoutDashboard size={18} />
            Overview
            <span className="active-dot" />
          </button>
          <button
            className={`nav-link ${modal === "folders" ? "active" : ""}`}
            onClick={() => setModal("folders")}
          >
            <Folder size={18} />
            Folders<span className="nav-count">{folders.length}</span>
          </button>
          <button
            className={`nav-link ${modal === "sessions" ? "active" : ""}`}
            onClick={() => setModal("sessions")}
          >
            <Layers3 size={18} />
            Sessions<span className="nav-count">{sessions.length}</span>
          </button>
          <button
            className={`nav-link ${modal === "compare" ? "active" : ""}`}
            onClick={openCompare}
            disabled={!hasData}
          >
            <BarChart3 size={18} />
            Compare karts
            <ArrowUpRight className="nav-arrow" size={14} />
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="note-flag">
            <Flag size={20} />
          </span>
          <h3>
            Less guesswork.
            <br />
            More track time.
          </h3>
          <p>
            Let the lap times
            <br />
            do the talking.
          </p>
          <span className="note-track" />
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-link ${modal === "settings" ? "active" : ""}`}
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <button className="nav-link" onClick={() => setModal("help")}>
            <CircleHelp size={18} />
            How it works
            <ArrowUpRight className="nav-arrow" size={14} />
          </button>
          <div className="local-status">
            <span className="status-dot" />
            <span>Local workspace</span>
            <ShieldCheck size={14} />
          </div>
          <div className="sidebar-version">
            KARTLAB <span>V 1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <Brand small />
            </span>
            <span className="desktop-breadcrumb">Workspace</span>
            <ChevronRight size={13} />
            <span>Overview</span>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <ShieldCheck size={13} />
              PRIVATE BY DESIGN
            </span>
            <button
              className="icon-button"
              aria-label="Open settings"
              title="Settings"
              onClick={() => setModal("settings")}
            >
              <Settings size={18} />
            </button>
            <span className="avatar">
              K<span className="avatar-dot" />
            </span>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setModal("navigation")}
            >
              <Menu size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> THE LAP ANALYSIS WORKSPACE
              </div>
              <h1>
                {activeFolder ? activeFolder.name : "Know your karts"}
                <span>.</span>
              </h1>
              <p>
                {activeFolder
                  ? "Your folder’s sessions, one overall kart comparison."
                  : "Every lap, a little more clarity. Let’s find your fastest."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={exportResults}
                disabled={!hasData}
              >
                <ArrowDownToLine size={16} />
                Export results
              </button>
              <button
                className="button secondary"
                onClick={openCombine}
                disabled={availableSessions.length < 2}
              >
                <Layers3 size={16} />
                Combine sessions
              </button>
              <button
                className="button primary"
                onClick={openFile}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Plus size={18} />
                )}
                Upload sessions
              </button>
            </div>
          </div>
          <input
            ref={fileInput}
            id="excel-upload"
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="visually-hidden"
            aria-label="Upload Excel lap times"
            onChange={(e) => {
              if (e.target.files.length) importFiles(e.target.files);
            }}
          />
          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <div className="folder-toolbar">
            <div className="folder-scope">
              <FolderOpen size={17} />
              <label className="visually-hidden" htmlFor="folder-select">
                View folder
              </label>
              <div className="select-shell">
                <select
                  id="folder-select"
                  value={activeFolder?.id || ""}
                  onChange={(e) => chooseFolder(e.target.value)}
                >
                  <option value="">All sessions</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
              <span className="folder-scope-note">
                {activeFolder
                  ? `${folderMembers.length} ${folderMembers.length === 1 ? "session" : "sessions"} · uploads go into this folder`
                  : "Organise sessions. Compare every kart."}
              </span>
            </div>
            <button
              className="text-button folder-manage-button"
              onClick={() => setModal("folders")}
            >
              <Plus size={15} />
              {folders.length ? "Manage folders" : "New folder"}
            </button>
          </div>
          {!hasData ? (
            <section className="empty-folder panel">
              <span className="empty-folder-icon">
                {activeFolder ? (
                  <FolderOpen size={35} />
                ) : (
                  <FileSpreadsheet size={35} />
                )}
              </span>
              <h2>
                {activeFolder
                  ? "Give this folder some track time."
                  : "Your next session starts here."}
              </h2>
              <p>
                {activeFolder
                  ? `Add saved sessions or upload Excel files to ${activeFolder.name}. Its overall kart comparison will appear here and update automatically.`
                  : "Upload your Excel lap times to compare karts, calculate averages, and see who sets the pace. You can create a folder first to keep your sessions organised."}
              </p>
              <div>
                <button
                  className="button secondary"
                  onClick={() => setModal("folders")}
                >
                  <Folder size={16} />
                  {activeFolder ? "Choose saved sessions" : "Create a folder"}
                </button>
                <button
                  className="button primary"
                  onClick={openFile}
                  disabled={busy}
                >
                  <Plus size={17} />
                  {activeFolder ? "Upload to folder" : "Upload Excel sheets"}
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="session-strip">
                <div className="session-identity">
                  <span className="session-icon">
                    <Flag size={17} />
                  </span>
                  <div className="session-select-wrap">
                    <label htmlFor="session-select">SESSION</label>
                    <div className="select-shell">
                      <select
                        id="session-select"
                        value={session.id}
                        onChange={(e) => activate(e.target.value)}
                      >
                        {activeFolder && (
                          <option value={`folder:${activeFolder.id}`}>
                            {activeFolder.name}
                          </option>
                        )}
                        {visibleSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.isTemporary ? " (temporary)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  <span
                    className={`badge ${session.isCombined ? "combined-badge" : "imported-badge"}`}
                  >
                    {session.isFolder
                      ? "Folder overview"
                      : session.isCombined
                        ? `${session.sources.length} sessions combined`
                        : "Imported session"}
                  </span>
                </div>
                <div className="session-source">
                  <FileSpreadsheet size={15} />
                  <span>{session.fileName}</span>
                  <span className="divider-dot">·</span>
                  <CheckCheck size={15} />
                  <span>All valid laps included</span>
                </div>
              </div>
              {session.isTemporary && (
                <div className="temporary-analysis-note" role="status">
                  <span>
                    <Clock3 size={15} />
                    Temporary analysis · clears on refresh. Original sessions
                    stay saved.
                  </span>
                  <button
                    className="text-button"
                    onClick={closeTemporaryAnalysis}
                  >
                    Close analysis
                  </button>
                </div>
              )}
              {session.isCombined && (
                <details className="combined-sources">
                  <summary>
                    <Layers3 size={14} />
                    {session.sources.length} source{" "}
                    {session.sources.length === 1 ? "session" : "sessions"} ·
                    one leaderboard
                    <ChevronDown size={13} />
                  </summary>
                  <div className="source-list">
                    {session.sources.map((source) => (
                      <div key={source.id}>
                        <FileSpreadsheet size={15} />
                        <span>
                          <strong>{source.name}</strong>
                          <small>{source.fileName}</small>
                        </span>
                        <span>{source.lapCount} laps</span>
                      </div>
                    ))}
                  </div>
                  <p>
                    All valid laps are pooled by kart number. Each source
                    session counts once.
                  </p>
                </details>
              )}
              {(session.skipped > 0 ||
                (session.sheets > 1 && !session.isCombined)) && (
                <div className="import-note">
                  <CircleHelp size={13} />
                  {session.skipped > 0 && (
                    <span>
                      {session.skipped} blank or invalid lap entries skipped.
                    </span>
                  )}
                  {session.sheets > 1 && !session.isCombined && (
                    <span>
                      Matching kart numbers combined across {session.sheets}{" "}
                      worksheets.
                    </span>
                  )}
                </div>
              )}
              <div className="metrics-grid">
                <Metric
                  label="Karts on track"
                  icon={<Gauge size={18} />}
                  value={String(stats.karts.length).padStart(2, "0")}
                  footer="Just kart numbers. No driver names."
                />
                <Metric
                  label="Laps recorded"
                  icon={<Flag size={18} />}
                  value={stats.totalLaps.toLocaleString()}
                  footer={`${Math.min(...stats.karts.map((k) => k.count)) === Math.max(...stats.karts.map((k) => k.count)) ? `${stats.karts[0].count} laps per kart` : "Across all imported karts"}`}
                />
                <Metric
                  label={
                    session.isFolder
                      ? "Folder average"
                      : session.isCombined
                        ? "Combined average"
                        : "Session average"
                  }
                  icon={<Clock3 size={18} />}
                  value={formatTime(stats.average)}
                  footer="Average of every valid recorded lap"
                  time
                />
                <Metric
                  label="Fastest lap"
                  icon={<Timer size={18} />}
                  value={formatTime(stats.fastest.best)}
                  footer={
                    <>
                      <span className="mini-kart">#{stats.fastest.number}</span>{" "}
                      The
                      {session.isFolder ? "folder’s" : "session’s"} quickest lap
                    </>
                  }
                  time
                  highlight
                />
              </div>
              <div className="content-grid">
                <section className="leaderboard panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-title">
                        <h2>
                          {session.isFolder
                            ? "Overall kart comparison"
                            : "Kart leaderboard"}
                        </h2>
                        <span className="count-pill">
                          {stats.karts.length} karts
                        </span>
                      </div>
                      <p>
                        {session.isFolder
                          ? "All folder laps, ranked by average. Delta is the gap to the fastest average."
                          : "Ranked by average lap time. Delta is the gap to the fastest average."}
                      </p>
                    </div>
                    <span className="heading-icon">
                      <Trophy size={19} />
                    </span>
                  </div>
                  <div className="table-toolbar">
                    <div className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="Search kart number"
                        placeholder="Search kart number…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          aria-label="Clear search"
                          className="clear-search"
                          onClick={() => setQuery("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="sort-control">
                      <span>Sort by</span>
                      <select
                        aria-label="Sort leaderboard"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="average">Average time</option>
                        <option value="best">Best lap</option>
                        <option value="number">Kart number</option>
                        <option value="laps">Lap count</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th className="rank-cell">POS</th>
                          <th>KART</th>
                          <th className="numeric avg-heading">
                            AVG. LAP <ArrowDown size={12} />
                          </th>
                          <th
                            className="numeric delta-heading"
                            title="Average lap time minus the fastest kart’s average"
                          >
                            Δ TO FASTEST
                          </th>
                          <th className="numeric best-lap-col">BEST LAP</th>
                          <th className="numeric laps-col">LAPS</th>
                          <th className="trend-col">LAP TREND</th>
                          <th className="arrow-cell">
                            <span className="visually-hidden">Details</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((k) => {
                          const rank =
                            stats.karts.findIndex(
                              (s) => s.number === k.number,
                            ) + 1;
                          return (
                            <tr
                              key={k.number}
                              className={rank === 1 ? "winner-row" : ""}
                              onClick={() => {
                                setDetailNumber(k.number);
                                setModal("details");
                              }}
                            >
                              <td className="rank-cell">
                                <span
                                  className={`rank ${rank === 1 ? "first" : ""}`}
                                >
                                  {rank === 1 ? (
                                    <Trophy size={13} />
                                  ) : (
                                    String(rank).padStart(2, "0")
                                  )}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="kart-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailNumber(k.number);
                                    setModal("details");
                                  }}
                                >
                                  <span className="kart-number">
                                    {k.number.padStart(2, "0")}
                                  </span>
                                  <span className="kart-label">
                                    Kart {k.number}
                                  </span>
                                </button>
                              </td>
                              <td className="numeric average-time">
                                {formatTime(k.average)}
                              </td>
                              <td
                                className={`numeric delta-time ${k.delta === 0 ? "fastest-delta" : ""}`}
                              >
                                {formatDelta(k.delta)}
                              </td>
                              <td className="numeric best-time best-lap-col">
                                {formatTime(k.best)}
                              </td>
                              <td className="numeric laps-col lap-count">
                                {k.count}
                              </td>
                              <td className="trend-col">
                                <Sparkline laps={k.laps} winner={rank === 1} />
                              </td>
                              <td className="arrow-cell">
                                <ChevronRight size={15} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!filtered.length && (
                      <div className="empty-search">
                        <Search size={25} />
                        <h3>No karts found</h3>
                        <p>Try another kart number.</p>
                        <button
                          className="text-button"
                          onClick={() => setQuery("")}
                        >
                          Clear search
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      <span className="status-dot" />
                      {filtered.length} of {stats.karts.length} karts shown
                    </span>
                    <span>
                      Times in min:sec.ms <span className="footer-dot">·</span>{" "}
                      Lower is faster
                    </span>
                  </div>
                </section>
                <aside className="insights-column">
                  <UploadCard
                    openFile={openFile}
                    importFiles={importFiles}
                    busy={busy}
                    importProgress={importProgress}
                  />
                  <section className="pace-card panel">
                    <div className="section-title">
                      <span className="pace-icon">
                        <Activity size={16} />
                      </span>
                      <h2>Setting the pace</h2>
                      <span className="live-dot" />
                    </div>
                    <p>Top 5 by average lap time</p>
                    <div className="pace-bars">
                      {stats.karts.slice(0, 5).map((k, i) => (
                        <button
                          key={k.number}
                          className="pace-row"
                          onClick={() => {
                            setDetailNumber(k.number);
                            setModal("details");
                          }}
                        >
                          <span className="pace-label">#{k.number}</span>
                          <span className="pace-track">
                            <span
                              style={{
                                width: `${94 - ((k.average - fastestAverage.average) / (stats.karts[Math.min(4, stats.karts.length - 1)].average - fastestAverage.average || 1)) * 40}%`,
                              }}
                              className={
                                i === 0 ? "pace-fill leader" : "pace-fill"
                              }
                            />
                          </span>
                          <span className="pace-time">
                            {formatTime(k.average)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="pace-insight">
                      <Trophy size={16} />
                      <p>
                        <strong>Kart {fastestAverage.number}</strong>
                        {stats.karts.length > 1 ? (
                          <>
                            {" "}
                            leads by <strong>{gap.toFixed(3)}s</strong>
                            <br />
                            on average. That’s the benchmark.
                          </>
                        ) : (
                          <> sets the session benchmark.</>
                        )}
                      </p>
                    </div>
                  </section>
                </aside>
              </div>
              <section className="lap-panel panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-title">
                      <h2>The lap-by-lap picture</h2>
                      <span className="subtle-label">CONSISTENCY IS KEY</span>
                    </div>
                    <p>Find the rhythm behind the result.</p>
                  </div>
                  <div className="chart-controls">
                    <span className="chart-legend">
                      <i />
                      Kart {chartKart.number}
                    </span>
                    <div className="small-select">
                      <select
                        aria-label="Kart for lap chart"
                        value={chartKart.number}
                        onChange={(e) => setChartNumber(e.target.value)}
                      >
                        {stats.karts.map((k) => (
                          <option key={k.number} value={k.number}>
                            Kart {k.number}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} />
                    </div>
                    <button className="compare-button" onClick={openCompare}>
                      Compare
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                <LapChart karts={[chartKart]} compact />
                <div className="chart-footer">
                  <span>
                    <span className="axis-label">X</span> Recorded lap
                  </span>
                  <span>
                    <span className="axis-label">Y</span> Lap time in seconds
                  </span>
                  <span className="chart-footer-right">
                    <Check size={13} /> All {chartKart.count} laps included
                  </span>
                </div>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Flag size={13} />
              Built for the moments between races.
            </span>
            <span>Made for the numbers. Focused on the karts.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>
            <Check size={17} />
          </span>
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "navigation" && (
        <Modal
          title="Your workspace."
          eyebrow="KARTLAB"
          close={() => setModal(null)}
        >
          <nav className="mobile-navigation" aria-label="Mobile navigation">
            <button
              className="nav-link"
              onClick={() =>
                activeFolder ? chooseFolder(activeFolder.id) : setModal(null)
              }
            >
              <LayoutDashboard size={18} />
              Overview
              <ChevronRight size={15} />
            </button>
            <button className="nav-link" onClick={() => setModal("folders")}>
              <Folder size={18} />
              Folders<span className="nav-count">{folders.length}</span>
            </button>
            <button className="nav-link" onClick={() => setModal("sessions")}>
              <Layers3 size={18} />
              Sessions<span className="nav-count">{sessions.length}</span>
            </button>
            <button
              className="nav-link"
              onClick={openCompare}
              disabled={!hasData}
            >
              <BarChart3 size={18} />
              Compare karts
              <ChevronRight size={15} />
            </button>
            <button className="nav-link" onClick={() => setModal("settings")}>
              <Settings size={18} />
              Settings
              <ChevronRight size={15} />
            </button>
            <button className="nav-link" onClick={() => setModal("help")}>
              <CircleHelp size={18} />
              How it works
              <ChevronRight size={15} />
            </button>
          </nav>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          title="Your workspace, your way."
          eyebrow="SETTINGS"
          close={() => setModal(null)}
          wide
        >
          <SettingsPanel
            preferences={preferences}
            onChange={setPreferences}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === "folders" && (
        <Modal
          title="A home for every session."
          eyebrow="FOLDERS"
          close={() => setModal(null)}
          wide
        >
          <FolderManager
            folders={folders}
            sessions={sessions}
            activeFolderId={activeFolder?.id}
            onCreate={createFolder}
            onRename={renameFolder}
            onDelete={deleteFolder}
            onMembershipChange={setSessionMembership}
            onOpen={chooseFolder}
            busy={busy}
          />
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Your lap sheet, made useful."
          eyebrow="HOW KARTLAB WORKS"
          close={() => setModal(null)}
        >
          <div className="help-steps">
            <HelpStep n="01" title="Bring your Excel sheets">
              Upload one or more .xlsx files with a “Lap” column and kart
              headings, like “2 - Driver name”. Decimal seconds, Excel time
              cells and m:ss.mmm times are supported. Select several files to
              combine them into a temporary analysis while keeping each original
              session saved. The combined view clears when you refresh.
            </HelpStep>
            <HelpStep n="02" title="Keep the kart. Skip the name.">
              We read the number at the start of each kart heading. Driver names
              are discarded and never saved in your sessions.
            </HelpStep>
            <HelpStep n="03" title="See the whole picture">
              Every valid lap counts toward the average, including the first lap
              and slower laps. Blank, zero and invalid times are skipped.
              Rankings use average time; lower is faster. Delta is the gap to
              the fastest average in the current session or folder.
            </HelpStep>
            <HelpStep n="04" title="Give your sessions a folder">
              Create a folder, then choose saved sessions or upload files into
              it. Open its overall comparison to see every kart across those
              sessions. Averages update automatically, and shared source
              sessions count once.
            </HelpStep>
          </div>
          <div className="help-example">
            <div>
              <span>IN YOUR SHEET</span>
              <code>13 - Driver name</code>
            </div>
            <ArrowRight size={18} />
            <div>
              <span>IN KARTLAB</span>
              <code>Kart 13</code>
            </div>
            <Check size={18} />
          </div>
          <div className="help-privacy">
            <ShieldCheck size={19} />
            <p>
              <strong>A little privacy goes a long way.</strong>
              <br />
              Files are processed in this browser, with no server upload. Saved
              sessions are local to this browser. Export a CSV before clearing
              browser data.
            </p>
          </div>
          <button
            className="button primary full"
            onClick={() => {
              setModal(null);
              openFile();
            }}
          >
            <Upload size={16} />
            Upload your first sheet
          </button>
        </Modal>
      )}
      {modal === "sessions" && (
        <Modal
          title="Your track record."
          eyebrow="SAVED SESSIONS"
          close={() => setModal(null)}
        >
          <p className="modal-description">
            Saved in this browser. Pick a session to explore, or give it a new
            name. Add a session to multiple folders, or combine sessions to
            analyse their laps together.
          </p>
          <div className="session-list">
            {!sessions.length && (
              <p className="modal-description">
                No sessions yet. Upload an Excel workbook to start your track
                record.
              </p>
            )}
            {sessions.map((s) => {
              const info = summarizeSession(s);
              return (
                <div
                  className={`saved-session ${s.id === session.id ? "selected" : ""}`}
                  key={s.id}
                >
                  <span className="saved-session-icon">
                    <FileSpreadsheet size={21} />
                  </span>
                  <div className="saved-session-info">
                    <input
                      aria-label={`Session name for ${s.fileName}`}
                      defaultValue={s.name}
                      key={`${s.id}-${s.name}`}
                      maxLength={80}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name)
                          setSessions((current) =>
                            current.map((x) =>
                              x.id === s.id ? { ...x, name } : x,
                            ),
                          );
                        else e.target.value = s.name;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                      }}
                    />
                    <p>
                      {info.karts.length} karts<span>·</span>
                      {info.totalLaps} laps
                      {s.isCombined && (
                        <span className="sample-text">
                          {s.sources.length} combined
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    className="session-open"
                    aria-label={`Open ${s.name}`}
                    onClick={() => {
                      openSession(s.id);
                    }}
                  >
                    {s.id === session.id ? (
                      <Check size={17} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => removeSession(s.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                  <SessionFolders
                    session={s}
                    folders={folders}
                    onMembershipChange={setSessionMembership}
                    onManageFolders={() => setModal("folders")}
                  />
                </div>
              );
            })}
          </div>
          <button
            className="button secondary full session-combine-button"
            onClick={openCombine}
            disabled={availableSessions.length < 2}
          >
            <Layers3 size={17} />
            Combine saved sessions
          </button>
          <button
            className="button primary full"
            onClick={openFile}
            disabled={busy}
          >
            <Plus size={17} />
            {busy ? importProgress : "Upload more sessions"}
          </button>
          <p className="modal-footnote">
            Sessions are saved in this browser. Deleting a session removes it
            from every folder. Uncheck a folder to remove only that assignment.
            Removing your last session leaves an empty workspace.
          </p>
        </Modal>
      )}
      {modal === "combine" && (
        <Modal
          title="Stronger together."
          eyebrow="COMBINE SESSIONS"
          close={() => setModal(null)}
        >
          <p className="modal-description">
            Choose sessions to pool their laps by kart number. Averages use
            every valid lap, so longer sessions carry their fair share. The
            combined analysis is temporary and clears on refresh.
          </p>
          <label className="combine-name-label" htmlFor="combine-name">
            Analysis name
          </label>
          <input
            id="combine-name"
            className="combine-name-input"
            maxLength={80}
            value={combineName}
            onChange={(e) => setCombineName(e.target.value)}
          />
          <div className="combine-options">
            {availableSessions.map((s) => {
              const info = summarizeSession(s);
              return (
                <label
                  className={`combine-option ${combineIds.includes(s.id) ? "checked" : ""}`}
                  key={s.id}
                >
                  <input
                    type="checkbox"
                    aria-label={`Include ${s.name}`}
                    checked={combineIds.includes(s.id)}
                    onChange={(e) => {
                      setCombineError("");
                      setCombineIds((current) =>
                        e.target.checked
                          ? [...current, s.id]
                          : current.filter((id) => id !== s.id),
                      );
                    }}
                  />
                  <span className="combine-option-info">
                    <strong>{s.name}</strong>
                    <small>
                      {info.karts.length} karts · {info.totalLaps} laps
                      {s.isCombined
                        ? ` · ${s.sources.length} sessions combined`
                        : ""}
                      {s.isTemporary ? " · Temporary" : ""}
                    </small>
                  </span>
                  {s.isCombined ? (
                    <Layers3 size={17} />
                  ) : (
                    <FileSpreadsheet size={17} />
                  )}
                </label>
              );
            })}
          </div>
          {combineError && (
            <p className="combine-error" role="alert">
              {combineError}
            </p>
          )}
          <button
            className="button primary full"
            onClick={previewCombined}
            disabled={combineIds.length < 2}
          >
            <Layers3 size={17} />
            Combine {combineIds.length} selected sessions
          </button>
          <button
            className="text-button combine-upload-button"
            onClick={openFile}
            disabled={busy}
          >
            <Plus size={15} />
            Upload more Excel sheets
          </button>
          <p className="modal-footnote">
            This analysis won’t be saved. Original sessions stay saved. If
            groups overlap, each source session counts only once.
          </p>
        </Modal>
      )}
      {modal === "details" && detailKart && (
        <Modal
          title={`Kart ${detailKart.number}`}
          eyebrow={`${session.name} / KART DETAILS`}
          close={() => setModal(null)}
          wide
        >
          <div className="detail-metrics">
            <div>
              <span>Average lap</span>
              <strong>{formatTime(detailKart.average)}</strong>
            </div>
            <div>
              <span>Best lap</span>
              <strong className="green-text">
                {formatTime(detailKart.best)}
              </strong>
            </div>
            <div>
              <span>Recorded laps</span>
              <strong>{detailKart.count}</strong>
            </div>
            <div>
              <span>Consistency (SD)</span>
              <strong>
                ±{detailKart.deviation.toFixed(3)}
                <small>s</small>
              </strong>
            </div>
            <div>
              <span>Gap to fastest average</span>
              <strong className={detailKart.delta === 0 ? "green-text" : ""}>
                {formatDelta(detailKart.delta)}
              </strong>
            </div>
          </div>
          <LapChart karts={[detailKart]} />
          <div className="detail-table-wrap">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>LAP</th>
                  <th>TIME</th>
                  <th>VS. AVERAGE</th>
                  {session.isCombined && <th>SESSION</th>}
                  {session.sheets > 1 && <th>SHEET</th>}
                </tr>
              </thead>
              <tbody>
                {detailKart.laps.map((l, i) => (
                  <tr key={i}>
                    <td>{l.lap}</td>
                    <td
                      className={
                        l.seconds === detailKart.best ? "green-text" : ""
                      }
                    >
                      {formatTime(l.seconds)}
                      {l.seconds === detailKart.best && (
                        <span className="best-pill">BEST</span>
                      )}
                    </td>
                    <td
                      className={
                        l.seconds < detailKart.average ? "green-text" : "muted"
                      }
                    >
                      {l.seconds >= detailKart.average ? "+" : "−"}
                      {Math.abs(l.seconds - detailKart.average).toFixed(3)}s
                    </td>
                    {session.isCombined && <td>{l.sourceName}</td>}
                    {session.sheets > 1 && <td>{l.sheet}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="modal-footnote">
            All valid laps are included. SD is the standard deviation: a smaller
            number means more consistent laps.
          </p>
        </Modal>
      )}
      {modal === "compare" && (
        <Modal
          title="A little friendly competition."
          eyebrow="COMPARE KARTS"
          close={() => setModal(null)}
          wide
        >
          <p className="modal-description">
            Choose up to four karts from {session.name} to compare their pace.
          </p>
          <div className="compare-picker">
            {[...stats.karts]
              .sort((a, b) => Number(a.number) - Number(b.number))
              .map((k) => {
                const index = compareNumbers.indexOf(k.number);
                return (
                  <button
                    className={`compare-chip ${index !== -1 ? "chosen" : ""}`}
                    key={k.number}
                    style={
                      index !== -1 ? { "--chip-color": COLORS[index] } : {}
                    }
                    disabled={index === -1 && compareNumbers.length >= 4}
                    onClick={() =>
                      setCompareNumbers((current) =>
                        current.includes(k.number)
                          ? current.filter((n) => n !== k.number)
                          : [...current, k.number],
                      )
                    }
                  >
                    {index !== -1 && <Check size={13} />}Kart {k.number}
                  </button>
                );
              })}
          </div>
          {compareNumbers.length ? (
            <>
              <LapChart
                karts={compareNumbers.map((n) =>
                  stats.karts.find((k) => k.number === n),
                )}
              />
              <div className="comparison-summary">
                {compareNumbers.map((n, i) => {
                  const k = stats.karts.find((k) => k.number === n);
                  return (
                    <div key={n}>
                      <span>
                        <i style={{ background: COLORS[i] }} />
                        Kart {n}
                      </span>
                      <strong>{formatTime(k.average)}</strong>
                      <small>Average · {k.count} laps</small>
                      <small className="comparison-delta">
                        Δ {formatDelta(k.delta)} to fastest average
                      </small>
                    </div>
                  );
                })}
              </div>
              <p className="modal-footnote">
                Aligned by recorded lap order. All valid laps from{" "}
                {session.isCombined
                  ? `all ${session.sources.length} source sessions`
                  : "the uploaded session"}{" "}
                are included.
              </p>
            </>
          ) : (
            <div className="empty-compare">
              <BarChart3 size={32} />
              <p>Select a kart above to start comparing.</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Metric({ label, icon, value, footer, time, highlight }) {
  return (
    <section className={`metric-card ${highlight ? "highlight" : ""}`}>
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className={`metric-value ${time ? "time-value" : ""}`}>
        {value}
        {highlight && (
          <span className="fastest-tag">
            <ArrowUpRight size={13} />
            BEST
          </span>
        )}
      </div>
      <div className="metric-footer">{footer}</div>
    </section>
  );
}

function HelpStep({ n, title, children }) {
  return (
    <div className="help-step">
      <span>{n}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
