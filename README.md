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
- Positive lap times are retained as original records. Blank, nonpositive, and invalid times are skipped during import, and the skipped count is shown. Statistics use the IQR filter described below; excluded outliers remain saved.
- The session average is weighted by included lap count. Rankings use each kart’s average; lower is faster.
- Tables from all worksheets are included. Matching kart numbers are combined across worksheets, with their source sheet retained. Charts align by included lap order.
- Sheets are limited to 20,000 rows and 500 columns.

## Features and storage

Search and sort kart rankings, inspect individual laps, compare up to four karts, rename or remove saved sessions, and export summary CSV files. The layout supports phones and desktop browsers.

### IQR lap filtering

Results use the standard **1.5 × interquartile range (IQR)** rule per kart, with no fixed minimum or maximum lap time. Q1 and Q3 are the 25th and 75th percentiles, calculated using inclusive linear interpolation: position `(n − 1) × percentile` in the sorted lap times. IQR is `Q3 − Q1`. Laps below `Q1 − 1.5 × IQR` or above `Q3 + 1.5 × IQR` are excluded; times exactly on either boundary remain included. Fewer than four recorded laps are kept unchanged. If IQR is zero, only times equal to the quartiles remain included.

Averages, rankings, deltas, best/worst times, standard deviation, and charts use included laps consistently. The session/folder average is weighted by the number of included laps. **Laps used** and the IQR notice show included, recorded, and excluded counts. Kart details keep every original lap visible and mark outliers **IQR excluded**; charts align by included lap order. CSV summaries include laps used, recorded laps, and IQR exclusions.

For folders and temporary combinations, raw laps are pooled and overlapping sources deduplicated **before** recalculating IQR for each kart. An excluded lap can become eligible in a different pooled comparison. No stored timings are deleted or changed, including existing uploads and folder copies shared between devices.

### Settings and themes

Open **Settings** in the sidebar, the top bar’s gear button, or the mobile menu. Choose **Kartlab** (dark with deep blue accents), **Light** (white with light blue accents), **Apex** (charcoal and lime), **Violet** (midnight and purple), or **Ember** (warm graphite and amber). Kartlab is the default, independently of the operating system’s theme.

Settings also include UI scale from 80% to 125%, comfortable or compact table spacing, desktop lap trend visibility, a default leaderboard sort order, and reduced motion. Changes apply immediately and persist in this browser under `kartlab.preferences.v1`. The operating system’s reduced motion preference is always respected. **Reset settings** restores display defaults while keeping all sessions and folders.

### Folders and overall kart comparisons

Use **New folder** or **Folders** to create a named folder. Choose its saved sessions using the checkboxes, or open a session’s folder list in **Sessions** and check every folder it belongs to. A session can belong to multiple folders at once. Unchecking it removes it only from that folder. Select a folder in the main folder picker before uploading to put new Excel files directly into it.

Each folder opens an overall comparison that pools the raw laps by kart number and updates as files are added, moved, or removed. The overview’s session picker displays the folder’s name, with a **Folder overview** badge identifying its combined comparison. A folder works with a single file as well as multiple files. Its session picker also lets you inspect individual sessions. Overlapping combined analyses count each original source once. Multi-file uploads inside a folder keep the individual files there; the folder supplies their live combined comparison.

Folders can be renamed or deleted. Deleting a folder keeps all its sessions in **All sessions** and preserves their other folder assignments. Each folder includes a shared session’s laps once, and **All sessions** keeps a single saved copy. Existing single-folder assignments upgrade automatically, with uploaded laps and folder names retained in this browser.

### Open folders on another device

Select a folder and click **Share folder**, or use the share icon on its card in **Folders**. Click **Copy folder link**, send the link to your other device, and open it in Kartlab. Review the folder’s sessions and click **Open a copy**. The copy includes the saved session names, kart numbers, raw lap times, worksheet/source information, and the overall comparison. It stays saved in that device’s browser after refreshing.

No account or online storage service is required. The compressed data travels in the URL fragment, which browsers do not send to the hosting server. Anyone with the complete link can open the copy. Each copy is independent: changes on one device do not sync to another. Create a fresh link to share updated results.

Only the chosen folder’s saved sessions are included. Other folder memberships, unrelated sessions, display settings, and temporary analyses are excluded. Importing creates new IDs and a new folder; a matching folder name receives a “(copy)” suffix. Existing data is preserved, and shared source IDs are remapped consistently so overlapping older analyses still count each lap once.

For a folder too large to fit in a link, use **Download folder copy** and send the `.kartlab.json` file instead. On the other device, open **Folders → Open folder link or copy → Open downloaded copy**. The same screen accepts pasted links. Copies are limited to 2 MiB of JSON and links to 32,000 characters; split very large events into smaller folders. Creating compressed links needs `CompressionStream`. Opening links uses a portable gzip reader, including on phones without `DecompressionStream`. New links include a byte count to detect truncation during copying or messaging. Downloaded copies work without those APIs.

### Delta to the fastest kart

The **Δ TO FASTEST** column shows each kart’s average lap time minus the fastest kart’s average in the current session or folder. The leader shows `0.000s`; a kart averaging half a second slower shows `+0.500s`. Ties show zero. Searching or sorting does not change the benchmark. The same gap is available in kart details, comparison summaries, and the CSV export’s **Gap to fastest average (seconds)** column.

### Combine sessions

Select multiple files using **Upload sessions**, or drag several files onto the upload card. Upload up to 20 files at a time, each up to 10 MB. The app opens a temporary combined analysis and keeps each original session saved separately. If any file cannot be imported, the entire batch is left unimported and existing sessions stay unchanged.

Use **Combine sessions** to pool sessions already saved in your browser. Choose the sessions, name the analysis, and confirm. The combined view stays in memory for this visit and is never added to saved sessions or folders. Refreshing or closing the tab clears it; **Close analysis** dismisses it immediately. You can switch between it and the saved originals in the session picker. Creating another combination replaces the current temporary view. Original sessions, their folder memberships, and existing saved analyses from earlier versions stay saved.

Folder comparisons continue to update automatically from their saved member sessions. Temporary combinations do not change folder membership. You can still export their results to CSV before dismissing them.

Matching kart numbers share one average calculated from all their raw lap times. For example, laps at 60, 70, 80, and 90 seconds all fall within the IQR bounds and produce an average of 75 seconds. This weights one lap from the first session and three from the second by their included lap counts. Combining overlapping groups counts each original source session once. Kart details show the original session and worksheet for every lap, and combined CSV exports use the pooled results.

Workbook parsing happens entirely in the browser. Parsed sessions are stored in this browser’s `localStorage`; the original workbook and driver names are not stored. There is no account, cloud sync, or server upload. Folder links and downloaded copies let you transfer selected folders between devices. Keep a downloaded folder copy before clearing browser data; CSV exports contain summary statistics rather than every raw lap.

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

One additional browser test is enabled by setting `SAMPLE_XLSX` to the original supplied workbook’s path. That workbook is not committed because it contains driver names. Without the variable, the external-workbook test is explicitly skipped. A generated workbook regression test covers the namespace-prefixed XML used by the timing exporter. Session and folder tests cover weighted averages, overlapping combinations, source provenance, batch failures, persistence, folder creation, shared memberships, legacy membership upgrades, safe deletion, cross-device folder links and downloaded copies, damaged/oversized data handling, deltas, exports, empty starts, legacy sample cleanup, theme and display preference persistence, UI scaling on desktop and mobile, and a dark default with a light operating-system theme.
