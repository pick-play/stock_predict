/** One scheduled US release, as written by scripts/update-economic.mjs. */
export interface EconomicRelease {
  /** Indicator key, e.g. "cpi". Repeats across months. */
  id: string;
  /** Korean label, shipped with the data so the bundle holds no second copy. */
  label: string;
  /** Publishing agency, shown as attribution. */
  source: string;
  /** Release date in the agency's own calendar (YYYY-MM-DD, US Eastern). */
  date: string;
  /**
   * The publication instant in UTC.
   *
   * Precomputed by the collector from the agency's Eastern publication time, so
   * the browser never has to know that 08:30 in New York is 21:30 in Seoul in
   * summer and 22:30 in winter.
   */
  releaseAtUtc: string;
}

export interface EconomicCalendar {
  schemaVersion: number;
  updatedAt: string;
  windowStart: string;
  windowEnd: string;
  releases: EconomicRelease[];
}
