/**
 * Word lists for chat display handles.
 *
 * Kept in their own module so the pools can grow without touching rules.ts,
 * and so the count is easy to see: 40 × 40 = 1,600 possible names.
 *
 * Both lists are deliberately gentle and concrete — nothing about appearance,
 * money, politics or anything that could read as an insult when it lands on a
 * stranger. A name the server assigns has to be one nobody minds being given.
 */

/** Adjectives in 관형형 so they attach directly to the noun. */
export const HANDLE_ADJECTIVES: readonly string[] = [
  "빠른", "느긋한", "조용한", "씩씩한", "다정한",
  "엉뚱한", "슬기로운", "용감한", "성실한", "명랑한",
  "차분한", "부지런한", "야무진", "재빠른", "든든한",
  "상냥한", "활발한", "진지한", "유쾌한", "담담한",
  "소박한", "알뜰한", "깔끔한", "포근한", "넉넉한",
  "신중한", "정직한", "꿋꿋한", "따뜻한", "시원한",
  "반짝이는", "느린", "굳센", "고운", "맑은",
  "밝은", "깊은", "너른", "싱그러운", "홀가분한",
];

/** Animals and natural things — no people, no brands, no places. */
export const HANDLE_NOUNS: readonly string[] = [
  "고양이", "강아지", "다람쥐", "고래", "참새",
  "부엉이", "여우", "사슴", "수달", "펭귄",
  "황새", "거북이", "판다", "알파카", "잠자리",
  "무지개", "소나기", "바람개비", "등대", "조각배",
  "나침반", "별자리", "달빛", "눈사람", "모과",
  "감귤", "도토리", "밤송이", "이슬", "파도",
  "언덕", "시냇물", "반달", "새벽", "노을",
  "첫눈", "봄비", "단풍", "씨앗", "구름",
];
