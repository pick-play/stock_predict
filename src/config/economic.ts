/**
 * Display constants for the US release calendar.
 *
 * The indicator list itself lives in scripts/update-economic.mjs and ships
 * inside economic.json, labels included. Keeping it in one place matters here:
 * the collector has to know the indicators to query FRED, and a second copy in
 * the bundle would be free to drift from the data it is describing.
 */

/** How many upcoming releases the compact strip shows. */
export const ECONOMIC_PREVIEW_COUNT = 4;

/** How far ahead 전체보기 reaches. */
export const ECONOMIC_WINDOW_DAYS = 31;

/** Where the committed snapshot lives. Served from the site's own origin. */
export const ECONOMIC_PATH = `${import.meta.env.BASE_URL}data/economic.json`;

/**
 * How often the browser re-reads the file.
 *
 * The collector runs once a day, so this only has to catch a reader who left the
 * tab open across the update.
 */
export const ECONOMIC_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Age past which the snapshot is treated as unmaintained.
 *
 * The collector runs daily, so two days without an update means the workflow is
 * failing. Past this the strip hides rather than showing a calendar nobody is
 * keeping current — a stale "다음 발표" is worse than none.
 */
export const ECONOMIC_STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;
