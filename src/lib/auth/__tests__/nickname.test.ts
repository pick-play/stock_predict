/**
 * No spaces in a nickname.
 *
 * Partly hygiene — "홍 길동" and "홍길동" would read as one person and store as
 * two — and partly load-bearing for the chat room: every anonymous alias is
 * "형용사 명사", two words with a space between them. A nickname that cannot
 * contain a space cannot be identical to one, which is what lets a fixed
 * nickname sit beside an alias without anyone being impersonated.
 */

import { describe, it, expect } from "vitest";
import { nicknameProblem } from "../nickname";
import { HANDLE_ADJECTIVES, HANDLE_NOUNS } from "../../chat/handleWords";

describe("nicknameProblem", () => {
  it("accepts ordinary nicknames", () => {
    for (const ok of ["국장의전설", "kospi_now", "삼전개미2", "ab"]) {
      expect(nicknameProblem(ok)).toBeNull();
    }
  });

  it("rejects a space anywhere, with a message that says so", () => {
    for (const spaced of ["홍 길동", " 홍길동", "홍길동 ", "a b"]) {
      expect(nicknameProblem(spaced)).toContain("띄어쓰기");
    }
  });

  it("rejects tabs and other whitespace too", () => {
    expect(nicknameProblem("홍\t길동")).toContain("띄어쓰기");
  });

  it("rejects lengths outside 2~16", () => {
    expect(nicknameProblem("가")).not.toBeNull();
    expect(nicknameProblem("가".repeat(17))).not.toBeNull();
  });

  it("rejects punctuation and emoji", () => {
    for (const bad of ["hello!", "홍길동.", "개미🐜"]) {
      expect(nicknameProblem(bad)).not.toBeNull();
    }
  });

  /*
   * The property the chat room depends on, checked against the real word lists
   * rather than asserted in prose: no alias the server can generate is a legal
   * nickname.
   */
  it("cannot express any anonymous chat alias", () => {
    for (const adjective of HANDLE_ADJECTIVES) {
      for (const noun of HANDLE_NOUNS) {
        expect(nicknameProblem(`${adjective} ${noun}`)).not.toBeNull();
      }
    }
  });
});
