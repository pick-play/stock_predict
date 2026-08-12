/**
 * The service name, in one place.
 *
 * Hangul-first as of 2026-08-12: Naver tokenises queries, and readers type
 * 코스피, not KOSPI. Leading with the Latin form left the site's own name
 * sharing no token with the way people search for it.
 *
 * The Latin form is kept as a secondary label rather than dropped — it matches
 * the domain (kospinow.com) and the people who arrive by typing that.
 */
export const BRAND_NAME = "코스피 NOW";
export const BRAND_NAME_LATIN = "KOSPI NOW";
