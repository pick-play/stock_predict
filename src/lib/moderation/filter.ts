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

/**
 * Hangul syllables decompose to their initial consonant so that ㅅㅂ-style
 * abbreviations and fully spelled words collapse to the same signature.
 */
const CHO = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

function toInitials(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHO[Math.floor((code - 0xac00) / 588)];
    } else if (ch >= "ㄱ" && ch <= "ㅎ") {
      out += ch;
    }
  }
  return out;
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
  "fuck", "shit", "bitch", "asshole", "bastard",
];

/** Initial-consonant forms, matched only against the initials projection. */
const PROFANITY_INITIALS = ["ㅅㅂ", "ㅄ", "ㅂㅅ", "ㅈㄹ", "ㅆㅂ", "ㄲㅈ", "ㅗ"];

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
  const initials = toInitials(body);

  if (PROFANITY.some((word) => flat.includes(word))) return reject("profanity");
  if (PROFANITY_INITIALS.some((word) => initials.includes(word))) {
    return reject("profanity");
  }

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
