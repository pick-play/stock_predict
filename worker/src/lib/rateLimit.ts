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
