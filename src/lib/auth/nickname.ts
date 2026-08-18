/**
 * The one nickname rule, shared by the signup form and the Worker.
 *
 * It lives in src/ rather than worker/ for the same reason moderation/filter.ts
 * does: the server is the authority, and the browser has to be able to say the
 * same thing without a round trip — one definition, no drift.
 *
 * No spaces, deliberately. Two reasons, and the second one matters more than it
 * looks:
 *
 *   - " 홍길동"과 "홍길동 " and "홍 길동" would all read as the same person in a
 *     list and are three different rows in a database.
 *   - Every anonymous chat alias is "형용사 명사" — two words with a space. A
 *     nickname that cannot contain a space therefore cannot be identical to an
 *     alias, so a member can never be mistaken for the server's own naming of
 *     somebody else. That is why chat can show a fixed nickname beside an alias
 *     at all.
 */

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

/** 한글·영문·숫자·밑줄만. Space is excluded on purpose — see the header. */
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,16}$/;

export const NICKNAME_RULE_MESSAGE =
  "2~16자, 한글·영문·숫자·밑줄만 사용할 수 있습니다. 띄어쓰기는 쓸 수 없습니다.";

/**
 * Why a nickname is unacceptable, or null when it is fine.
 *
 * The space case gets its own message: "특수문자를 쓰지 마세요" does not tell
 * someone who typed a space what they did wrong.
 */
export function nicknameProblem(nickname: string): string | null {
  if (/\s/.test(nickname)) {
    return "닉네임에는 띄어쓰기를 쓸 수 없습니다.";
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return NICKNAME_RULE_MESSAGE;
  }
  return null;
}
