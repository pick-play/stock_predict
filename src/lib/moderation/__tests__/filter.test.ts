/**
 * The filter's job is to stop the obvious cases without making ordinary Korean
 * unpostable. The second half matters more here: a swear that slips through can
 * be deleted afterwards, but a reader whose normal sentence is refused just
 * leaves.
 *
 * Every line in "ordinary chat" below was rejected as 욕설 by the previous
 * version, which projected whole syllables onto their initial consonants and
 * substring-matched the result: 부산 → ㅂㅅ, 사볼까 → ㅅㅂ.
 */

import { describe, it, expect } from "vitest";
import { moderatePost, duplicateKey } from "../filter";

function ok(body: string) {
  return moderatePost(body).ok;
}

function reason(body: string) {
  return moderatePost(body).reason;
}

describe("ordinary chat is postable", () => {
  const LINES = [
    "부산 사람 있나요",
    "밥상 차리고 옴",
    "복수할 기회다",
    "배송 언제 오나",
    "방심하면 안됨",
    "지금 사볼까",
    "소방수 등판",
    "하이닉스 사봤음",
    "오늘 상방 가나요",
    "삼성전자 살 사람?",
    "빠지면 사자",
    "내일 시가 보고 결정",
    "야간선물 보고왔다",
    "반도체 사이클 봄",
    "ㅋㅋㅋ",
    "ㅇㅇ 맞음",
    "ㄷㄷ",
    "ㅗㅜㅑ",
  ];

  for (const line of LINES) {
    it(`accepts "${line}"`, () => {
      expect(ok(line)).toBe(true);
    });
  }
});

describe("spelled-out profanity is still rejected", () => {
  for (const line of ["씨발 뭐야", "이 병신아", "지랄하지마", "개새끼", "fuck this"]) {
    it(`rejects "${line}"`, () => {
      expect(reason(line)).toBe("profanity");
    });
  }

  // Padding between the letters must not buy a pass.
  it("sees through inserted digits and punctuation", () => {
    expect(reason("씨1발")).toBe("profanity");
    expect(reason("시*발")).toBe("profanity");
    expect(reason("병 신")).toBe("profanity");
  });

  it("catches half-jamo spellings against a syllable", () => {
    expect(reason("시ㅂ 진짜")).toBe("profanity");
    expect(reason("ㅅ발")).toBe("profanity");
    expect(reason("ㅂ신아")).toBe("profanity");
  });
});

describe("jamo abbreviations", () => {
  it("rejects them when actually typed as jamo", () => {
    expect(reason("아 ㅅㅂ")).toBe("profanity");
    expect(reason("ㅄ 진짜")).toBe("profanity");
    expect(reason("ㅂㅅ 같은")).toBe("profanity");
    expect(reason("ㅈㄹ 하네")).toBe("profanity");
  });

  it("still rejects padded jamo", () => {
    expect(reason("ㅅ.ㅂ")).toBe("profanity");
    expect(reason("ㅅ ㅂ")).toBe("profanity");
  });

  /*
   * The line that separates the two halves of this file: a jamo pattern applies
   * to jamo the writer typed, never to a projection of syllables. Without this
   * the sentence below reads as ㅅㅂ.
   */
  it("does not read abbreviations out of syllables", () => {
    expect(ok("사볼까 말까")).toBe(true);
    expect(ok("부산에서 봅니다")).toBe(true);
  });

  it("rejects a bare ㅗ but not the ㅗㅜㅑ meme", () => {
    // A single character is refused by the length floor before the content
    // rules ever run, so the gesture is tested at two characters and up.
    expect(ok("ㅗ")).toBe(false);
    expect(reason("ㅗㅗ")).toBe("profanity");
    expect(reason("야 ㅗ")).toBe("profanity");
    expect(ok("ㅗㅜㅑ")).toBe(true);
  });
});

/*
 * The kakao-link pattern once carried a stray `|틀|` alternation — an IME typo
 * remnant of t.me — so every sentence containing the syllable 틀 was rejected
 * as contact-info. A link pattern must match links, never bare syllables.
 */
describe("the syllable 틀 is not a kakao link", () => {
  for (const line of ["이거 틀렸어", "이틀 뒤에 발표", "그 말 틀림없다"]) {
    it(`accepts "${line}"`, () => {
      expect(ok(line)).toBe(true);
    });
  }

  it("still rejects real open-chat links", () => {
    expect(reason("open.kakao.com/o/abc 들어와")).toBe("contact-info");
    expect(reason("pf.kakao.com/_abc 추가")).toBe("contact-info");
    expect(reason("t.me/somechannel 참고")).toBe("contact-info");
    expect(reason("kko.to/abc 여기로")).toBe("contact-info");
  });
});

/*
 * 단타·수익률·문의 were dropped from the weak-ad list: on a stock chat they are
 * core vocabulary, and two of them in one ordinary question crossed the
 * two-signal threshold. False-blocking is the worse failure (§28.5).
 */
describe("stock vocabulary is not advertising", () => {
  for (const line of ["단타로 수익률 어때", "단타 각인가", "수익률 몇 퍼 나왔어?", "혹시 문의해봤어?"]) {
    it(`accepts "${line}"`, () => {
      expect(ok(line)).toBe(true);
    });
  }

  it("still rejects unambiguous solicitation", () => {
    expect(reason("주식리딩 단타 수익 보장")).toBe("advertising");
    expect(reason("무료 입장 이벤트")).toBe("advertising");
  });
});

describe("other rules still hold", () => {
  it("rejects contact handoffs", () => {
    expect(reason("카톡으로 연락주세요")).toBe("contact-info");
    expect(reason("010-1234-5678")).toBe("contact-info");
  });

  it("rejects unambiguous solicitation", () => {
    expect(reason("수익보장 리딩방 들어오세요")).toBe("advertising");
  });

  it("needs two weak signals before calling something an ad", () => {
    expect(ok("종목추천 좀 해주세요")).toBe(true);
    expect(reason("무료 종목추천 이벤트")).toBe("advertising");
  });

  it("rejects long character runs", () => {
    expect(reason("ㅋ".repeat(40))).toBe("repetition");
  });

  it("normalises duplicates to one key", () => {
    expect(duplicateKey("수익 보장!!")).toBe(duplicateKey("수익보장"));
  });
});
