# Kartlab

A kart lap-time tracker built with React and Vite. Upload an Excel lap sheet, keep the kart numbers, and compare average times without importing driver names. The included A Final sample uses the 12 karts and 300 laps from the supplied workbook, with driver names removed.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

The development server uses port 5173. `npm run build` creates a production build in `dist/`; `npm run preview` serves that build for local verification. A static hosting provider can serve `dist/` without a backend.

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

Workbook parsing happens entirely in the browser. Parsed sessions are stored in this browser’s `localStorage`; the original workbook and driver names are not stored. There is no account, cloud sync, or server upload. Export results before clearing browser data. The CSV contains summary statistics, not a backup of every raw lap.

## Validation

```sh
npm test
npm run build
```

Browser tests use Playwright. Install its Chromium once with `npx playwright install chromium`, or use an already installed Chromium:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

One additional browser test is enabled by setting `SAMPLE_XLSX` to the original supplied workbook’s path. That workbook is not committed because it contains driver names. Without the variable, five browser tests execute and the external-workbook test is explicitly skipped. A generated workbook regression test covers the namespace-prefixed XML used by the timing exporter.
