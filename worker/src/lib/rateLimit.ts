function nowMinus(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

/**
 * Returns true when the IP hash has hit either:
 *  - 1 post in the last 60 s, or
 *  - 5 posts in the last 10 min.
 */
export async function isPostRateLimited(
  db: D1Database,
  ipHash: string
): Promise<boolean> {
  const r60 = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM posts WHERE ip_hash = ? AND created_at >= ?'
    )
    .bind(ipHash, nowMinus(60))
    .first<{ cnt: number }>();

  if ((r60?.cnt ?? 0) >= 1) return true;

  const r600 = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM posts WHERE ip_hash = ? AND created_at >= ?'
    )
    .bind(ipHash, nowMinus(600))
    .first<{ cnt: number }>();

  return (r600?.cnt ?? 0) >= 5;
}

/** Returns true when the same normalized body was posted within the last 24 h. */
export async function isDuplicatePost(
  db: D1Database,
  dupKey: string
): Promise<boolean> {
  const r = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM posts WHERE dup_key = ? AND created_at >= ?'
    )
    .bind(dupKey, nowMinus(86400))
    .first<{ cnt: number }>();

  return (r?.cnt ?? 0) >= 1;
}

/** Returns true when the IP hash has filed more than 10 reports in 10 min. */
export async function isReportRateLimited(
  db: D1Database,
  ipHash: string
): Promise<boolean> {
  const r = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM reports WHERE ip_hash = ? AND created_at >= ?'
    )
    .bind(ipHash, nowMinus(600))
    .first<{ cnt: number }>();

  return (r?.cnt ?? 0) >= 10;
}

/**
 * Returns true when the IP hash has already signed up 3 or more times in 24 h.
 * Checked before the new user row is inserted, so the limit is enforced at 3.
 */
export async function isSignupRateLimited(
  db: D1Database,
  ipHash: string
): Promise<boolean> {
  const r = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM users WHERE ip_hash = ? AND created_at >= ?'
    )
    .bind(ipHash, nowMinus(86400))
    .first<{ cnt: number }>();

  return (r?.cnt ?? 0) >= 3;
}

/**
 * Returns true when the IP hash has logged more than 10 attempts in 10 min.
 * The caller inserts the current attempt before calling this, so >10 means the
 * 11th (or later) attempt is blocked — matching the spec's "10회 초과" wording.
 */
export async function isLoginRateLimited(
  db: D1Database,
  ipHash: string
): Promise<boolean> {
  const r = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM login_attempts WHERE ip_hash = ? AND created_at >= ?'
    )
    .bind(ipHash, nowMinus(600))
    .first<{ cnt: number }>();

  return (r?.cnt ?? 0) > 10;
}

/**
 * Returns true when the member has hit either:
 *  - 1 comment in the last 20 s, or
 *  - 15 comments in the last 10 min.
 */
export async function isCommentRateLimited(
  db: D1Database,
  memberId: number
): Promise<boolean> {
  const r20 = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM comments WHERE member_id = ? AND created_at >= ?'
    )
    .bind(memberId, nowMinus(20))
    .first<{ cnt: number }>();

  if ((r20?.cnt ?? 0) >= 1) return true;

  const r600 = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM comments WHERE member_id = ? AND created_at >= ?'
    )
    .bind(memberId, nowMinus(600))
    .first<{ cnt: number }>();

  return (r600?.cnt ?? 0) >= 15;
}

/** Returns true when the IP hash has filed more than 10 comment reports in 10 min. */
export async function isCommentReportRateLimited(
  db: D1Database,
  ipHash: string
): Promise<boolean> {
  const r = await db
    .prepare(
      'SELECT COUNT(*) AS cnt FROM comment_reports WHERE ip_hash = ? AND created_at >= ?'
    )
    .bind(ipHash, nowMinus(600))
    .first<{ cnt: number }>();

  return (r?.cnt ?? 0) >= 10;
}
