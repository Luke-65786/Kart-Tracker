# Kartlab

A kart lap-time tracker built with React and Vite, with five themes and adjustable display settings. Upload Excel lap sheets, keep the kart numbers, and compare average times without importing driver names. New workspaces start empty, with no preloaded sessions or kart data.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

The development server uses port 5173. `npm run build` creates a production build in `dist/`; `npm run preview` serves that build for local verification. A static hosting provider can serve `dist/` without a backend.

## Publish with GitHub Pages

The deployment workflow in `.github/workflows/deploy-pages.yml` builds, tests, and publishes the site after each push to `main`. Relative asset paths let Excel uploads and other features work under the `/Kart-Tracker/` project path.

For the initial deployment, enable **GitHub Actions** as the publishing source in [Settings → Pages](https://github.com/Luke-65786/Kart-Tracker/settings/pages). If the first workflow ran before Pages was enabled, open [the deployment workflow](https://github.com/Luke-65786/Kart-Tracker/actions/workflows/deploy-pages.yml) and select **Run workflow**. Subsequent pushes deploy automatically.

After a successful deployment, the site is available at **https://luke-65786.github.io/Kart-Tracker/**. Deployment status is shown on the workflow page; the presence of this URL in the README does not indicate that a deployment has completed.

## Upload format

Upload an unprotected `.xlsx` workbook up to 10 MB. Each timing table needs a `Lap` column and kart headers such as `2 - Driver name`, `Kart 2`, or `2`. Bold headers in timing exports are supported. Rows beneath them contain the lap number and each kart’s time:

| Lap | 2 - Driver name | 13 - Driver name |
| --- | --------------- | ---------------- |
| 1   | 62.125          | 60.614           |
| 2   | 1:02.000        | 1:00.800         |

- Decimal seconds, `m:ss.mmm`, `h:mm:ss.mmm`, and Excel time-formatted cells are supported. Formula cells need a cached numeric result saved by Excel.
- Kart numbers are read from the headings; driver names are discarded.
- Every valid lap contributes to the kart’s arithmetic mean. First laps and slower laps remain included. Blank, nonpositive, and invalid times are skipped, and the skipped count is shown.
- The session average is weighted by lap count. Rankings use each kart’s average; lower is faster.
- Tables from all worksheets are included. Matching kart numbers are combined across worksheets, with their source sheet retained. Charts align by recorded lap order.
- Sheets are limited to 20,000 rows and 500 columns.

## Features and storage

Search and sort kart rankings, inspect individual laps, compare up to four karts, rename or remove saved sessions, and export summary CSV files. The layout supports phones and desktop browsers.

### Settings and themes

Open **Settings** in the sidebar, the top bar’s gear button, or the mobile menu. Choose **Kartlab** (dark with deep blue accents), **Light** (white with light blue accents), **Apex** (charcoal and lime), **Violet** (midnight and purple), or **Ember** (warm graphite and amber). Kartlab is the default, independently of the operating system’s theme.

Settings also include UI scale from 80% to 125%, comfortable or compact table spacing, desktop lap trend visibility, a default leaderboard sort order, and reduced motion. Changes apply immediately and persist in this browser under `kartlab.preferences.v1`. The operating system’s reduced motion preference is always respected. **Reset settings** restores display defaults while keeping all sessions and folders.

### Folders and overall kart comparisons

Use **New folder** or **Folders** to create a named folder. Choose its saved sessions using the checkboxes, or move an individual session using the folder selector in **Sessions**. A session belongs to one folder at a time. Select a folder in the main folder picker before uploading to put new Excel files directly into it.

Each folder opens an overall comparison that pools the raw laps by kart number and updates as files are added, moved, or removed. The overview’s session picker displays the folder’s name, with a **Folder overview** badge identifying its combined comparison. A folder works with a single file as well as multiple files. Its session picker also lets you inspect individual sessions. Overlapping combined analyses count each original source once. Multi-file uploads inside a folder keep the individual files there; the folder supplies their live combined comparison.

Folders can be renamed or deleted. Deleting a folder keeps all its sessions in **All sessions**. Existing saved sessions remain available after upgrading, and folder membership is retained in this browser.

### Delta to the fastest kart

The **Δ TO FASTEST** column shows each kart’s average lap time minus the fastest kart’s average in the current session or folder. The leader shows `0.000s`; a kart averaging half a second slower shows `+0.500s`. Ties show zero. Searching or sorting does not change the benchmark. The same gap is available in kart details, comparison summaries, and the CSV export’s **Gap to fastest average (seconds)** column.

### Combine sessions

Select multiple files using **Upload sessions**, or drag several files onto the upload card. Upload up to 20 files at a time, each up to 10 MB. The app opens a combined analysis and keeps each original session saved separately. If any file cannot be imported, the entire batch is left unimported and existing sessions stay unchanged.

Use **Combine sessions** to pool sessions already saved in your browser. Choose the sessions, name the analysis, and confirm. Original sessions stay available, and combined analyses keep their own snapshots of the source laps.

Matching kart numbers share one average calculated from all their raw lap times. For example, one lap at 60 seconds and three laps at 90 seconds produce an average of 82.5 seconds. Combining overlapping groups counts each original source session once. Kart details show the original session and worksheet for every lap, and combined CSV exports use the pooled results.

Workbook parsing happens entirely in the browser. Parsed sessions are stored in this browser’s `localStorage`; the original workbook and driver names are not stored. There is no account, cloud sync, or server upload. Export results before clearing browser data. The CSV contains summary statistics, not a backup of every raw lap.

Deleting the last uploaded session returns to an empty workspace. When upgrading an older workspace, the former built-in sample and its contributions to combined analyses are removed; real uploads, their folder memberships, and folder names are retained. Regression lap data is stored only under `tests/fixtures/` and is not included in the application build.

## Validation

```sh
npm test
npm run build
```

Browser tests use Playwright. Install its Chromium once with `npx playwright install chromium`, or use an already installed Chromium:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

One additional browser test is enabled by setting `SAMPLE_XLSX` to the original supplied workbook’s path. That workbook is not committed because it contains driver names. Without the variable, the external-workbook test is explicitly skipped. A generated workbook regression test covers the namespace-prefixed XML used by the timing exporter. Session and folder tests cover weighted averages, overlapping combinations, source provenance, batch failures, persistence, folder creation and movement, safe deletion, deltas, exports, empty starts, legacy sample cleanup, theme and display preference persistence, UI scaling on desktop and mobile, and a dark default with a light operating-system theme.
