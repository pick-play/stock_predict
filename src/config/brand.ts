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

/**
 * The all-Hangul spelling, with no space.
 *
 * Readers type the name three ways — 코스피나우, 코스피 NOW, KOSPI NOW — and a
 * search engine only matches text it can find. This form appears in the footer
 * and in the page metadata so the site answers to all three, without three
 * spellings competing in the header.
 */
export const BRAND_NAME_HANGUL = "코스피나우";

/**
 * The wordmark's two halves.
 *
 * The header sets 코스피 in the text colour and NOW in the brand violet, and
 * that is the only place the name is drawn rather than written — so the split
 * lives here instead of being sliced out of BRAND_NAME at the call site, where
 * the next rename would silently break it.
 */
export const BRAND_NAME_KO = "코스피";
export const BRAND_NAME_NOW = "NOW";
