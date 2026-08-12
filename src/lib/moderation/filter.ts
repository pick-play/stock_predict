/**
 * filter.ts
 *
 * Content rules for the anonymous board. Pure functions with no platform
 * dependencies, so the browser can warn while typing and the Worker can make
 * the same call authoritatively — one rule set, no drift between the two.
 *
 * The browser check is a courtesy only. Anything the server accepts is what
 * actually gets stored, so every rule here must hold server-side.
 */

export type RejectReason =
  | "empty"
  | "too-short"
  | "too-long"
  | "profanity"
  | "advertising"
  | "too-many-links"
  | "repetition"
  | "contact-info";

export interface ModerationResult {
  ok: boolean;
  reason?: RejectReason;
  /** Message shown to the writer. Explains the rule, never quotes the match. */
  message?: string;
}

export const BODY_MIN_LENGTH = 2;
export const BODY_MAX_LENGTH = 1000;
const MAX_LINKS = 1;
const MAX_REPEATED_CHARS = 15;

const REASON_MESSAGES: Record<RejectReason, string> = {
  empty: "내용을 입력해주세요.",
  "too-short": `${BODY_MIN_LENGTH}자 이상 입력해주세요.`,
  "too-long": `${BODY_MAX_LENGTH}자 이내로 입력해주세요.`,
  profanity: "욕설이나 비방 표현이 포함되어 등록할 수 없습니다.",
  advertising: "광고나 투자 권유로 보이는 표현이 포함되어 등록할 수 없습니다.",
  "too-many-links": "링크는 하나까지만 넣을 수 있습니다.",
  repetition: "같은 문자를 지나치게 반복했습니다.",
  "contact-info": "연락처나 오픈채팅 안내는 등록할 수 없습니다.",
};

/** Compatibility-jamo block: ㄱ(3131) … ㅣ(3163), consonants and vowels. */
const JAMO_FIRST = 0x3131;
const JAMO_LAST = 0x3163;

function isJamo(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return code >= JAMO_FIRST && code <= JAMO_LAST;
}

/**
 * Runs of jamo that the writer actually typed as jamo, e.g. "ㅅㅂ" out of
 * "아 ㅅㅂ 진짜". Spaces and punctuation inside a run are absorbed, since that
 * is exactly how the padding evasion looks ("ㅅ.ㅂ"); a syllable, letter or
 * digit ends the run.
 *
 * Syllables are deliberately NOT projected onto their initial consonants.
 * Doing that turned the whole message into one consonant string and then
 * substring-matched it, so any two adjacent syllables that happened to start
 * with ㅅ+ㅂ or ㅂ+ㅅ were read as an abbreviated swear: 부산, 밥상, 배송,
 * 복수, 방심, 소방, 상방, 사볼까, 사봤음 were all rejected as 욕설. Ordinary
 * chat lines were unpostable, which is a far worse failure than missing an
 * abbreviation — reports and deletion cover what slips through.
 */
function jamoRuns(text: string): string[] {
  const runs: string[] = [];
  let run = "";
  let open = false; // a run is only extended across padding once it has begun

  for (const ch of text) {
    if (isJamo(ch)) {
      run += ch;
      open = true;
      continue;
    }
    if (open && /[\s.,_\-*~^'"`|/\\]/.test(ch)) continue; // padding
    if (run) runs.push(run);
    run = "";
    open = false;
  }
  if (run) runs.push(run);
  return runs;
}

/**
 * Strip the padding spammers insert between letters (씨1발, 시*발, ㅅ.ㅂ) so a
 * single spelling of each term is enough to catch the common evasions.
 */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/[\s.,_\-*~^'"`|/\\()[\]{}<>+=!?@#$%&:;0-9]/g, "");
}

/**
 * Core profanity stems. Deliberately short and high-precision: a long list
 * catches more but starts rejecting ordinary posts, which is worse on a board
 * this small. Reports cover what slips through.
 */
const PROFANITY = [
  "씨발", "시발", "씨팔", "시팔", "쓰발", "씹할", "좆", "존나", "졸라씨",
  "병신", "븅신", "빙신", "지랄", "니미", "애미", "애비", "새끼", "쌔끼",
  "개새", "썅", "쌍놈", "미친놈", "미친년", "년놈", "닥쳐", "꺼져라",
  "보지", "자지", "따먹", "강간", "창녀", "매춘",
  // Half-jamo spellings. Precise enough to list as stems: no ordinary word
  // reads this way, and the jamo-run rule below cannot see them because they
  // sit against a syllable rather than in a jamo run of their own.
  "시ㅂ", "씨ㅂ", "ㅅ발", "ㅆ발", "병ㅅ", "ㅂ신", "지ㄹ", "ㅈ랄",
  "fuck", "shit", "bitch", "asshole", "bastard",
]
  /*
   * Normalised with the same function the body goes through. NFKC rewrites a
   * compatibility jamo (ㅂ, U+3142) into a conjoining one (U+1107), so a stem
   * written with the letter from a keyboard would never have matched a body
   * that had already been normalised.
   */
  .map(normalize);

/**
 * Abbreviations, matched only inside a run of typed jamo (see jamoRuns).
 * "ㅂㅅ" here means someone typed those two letters — not that a sentence
 * happened to contain 부산.
 */
const PROFANITY_JAMO = ["ㅅㅂ", "ㅄ", "ㅂㅅ", "ㅈㄹ", "ㅆㅂ", "ㄲㅈ"];

/**
 * The ㅗ gesture, blocked only when a run is nothing but ㅗ. Substring matching
 * would take "ㅗㅜㅑ" with it, which is an expression of surprise.
 */
const GESTURE_RUN_RE = /^ㅗ+$/;

/**
 * Advertising signals. Each alone is weak — "수익" appears in ordinary talk on
 * a stock board — so a post is rejected only when two independent signals
 * co-occur, or when one unambiguous solicitation appears.
 */
const AD_STRONG = [
  "리딩방", "무료리딩", "수익보장", "원금보장", "확정수익", "고수익보장",
  "대출문의", "작업대출", "카지노", "토토", "먹튀검증", "성인용품",
  "비트코인선물대여", "코인리딩", "주식리딩",
];

const AD_WEAK = [
  "수익률", "수익인증", "종목추천", "추천주", "급등주", "단타",
  "무료", "이벤트", "가입", "문의", "상담", "선착순", "지금바로",
  "클릭", "입장", "초대", "참여",
];

const CONTACT = [
  "카톡", "카카오톡", "오픈채팅", "오픈톡", "텔레그램", "텔레", "라인아이디",
  "openkakao", "opentalk", "telegram", "@ㅋㅌ",
];

const PHONE_RE = /01[016789][-. ]?\d{3,4}[-. ]?\d{4}/;
const KAKAO_LINK_RE = /open\.kakao\.com|pf\.kakao\.com|t\.me\/|틀|kko\.to/i;
const URL_RE = /(https?:\/\/|www\.)[^\s]+/gi;

function countLinks(text: string): number {
  return (text.match(URL_RE) ?? []).length;
}

function hasLongRepetition(text: string): boolean {
  let run = 1;
  for (let i = 1; i < text.length; i++) {
    run = text[i] === text[i - 1] ? run + 1 : 1;
    if (run > MAX_REPEATED_CHARS) return true;
  }
  return false;
}

function reject(reason: RejectReason): ModerationResult {
  return { ok: false, reason, message: REASON_MESSAGES[reason] };
}

/** Apply every rule to a post body. */
export function moderatePost(rawBody: string): ModerationResult {
  const body = rawBody.trim();

  if (body.length === 0) return reject("empty");
  if (body.length < BODY_MIN_LENGTH) return reject("too-short");
  if (body.length > BODY_MAX_LENGTH) return reject("too-long");

  if (hasLongRepetition(body)) return reject("repetition");

  const flat = normalize(body);
  const runs = jamoRuns(body);

  if (PROFANITY.some((word) => flat.includes(word))) return reject("profanity");
  if (runs.some((run) => PROFANITY_JAMO.some((word) => run.includes(word)))) {
    return reject("profanity");
  }
  if (runs.some((run) => GESTURE_RUN_RE.test(run))) return reject("profanity");

  if (PHONE_RE.test(body) || KAKAO_LINK_RE.test(body)) {
    return reject("contact-info");
  }
  if (CONTACT.some((word) => flat.includes(word))) return reject("contact-info");

  if (AD_STRONG.some((word) => flat.includes(word))) return reject("advertising");

  const weakHits = AD_WEAK.filter((word) => flat.includes(word)).length;
  const links = countLinks(body);
  if (weakHits >= 2 || (weakHits >= 1 && links >= 1)) return reject("advertising");

  if (links > MAX_LINKS) return reject("too-many-links");

  return { ok: true };
}

/**
 * Two posts count as duplicates when their normalized text matches, which
 * catches the same ad pasted with different spacing or punctuation.
 */
export function duplicateKey(body: string): string {
  return normalize(body).slice(0, 200);
}
