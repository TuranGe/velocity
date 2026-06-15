import { Router } from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../middleware.js';

const router = Router();

router.get('/', optionalAuth, (req, res) => {
  const { period = 'alltime', limit = 15, search, offset = 0 } = req.query;
  const now = Math.floor(Date.now() / 1000);
  let timeFilter = '';
  if (period === 'week') timeFilter = `AND s.completed_at > ${now - 7 * 86400}`;
  if (period === 'month') timeFilter = `AND s.completed_at > ${now - 30 * 86400}`;

  const havingFilter = search ? '' : 'HAVING sessions > 0';
  const searchWhere = search ? 'WHERE u.username LIKE ?' : '';
  const params = search ? [`%${search}%`] : [];

  const rows = query(`
    SELECT u.id, u.username, u.profile_image,
      COUNT(s.id) as sessions,
      COALESCE(SUM(s.duration),0) as total_seconds
    FROM users u
    LEFT JOIN sessions s ON s.user_id=u.id ${timeFilter}
    ${searchWhere}
    GROUP BY u.id
    ${havingFilter}
    ORDER BY sessions DESC
    LIMIT ? OFFSET ?
  `, [...params, parseInt(limit), parseInt(offset)]);

  let contextRows = [];
  if (search && rows.length > 0) {
    const allRanked = query(`
      SELECT u.id, u.username, u.profile_image, COUNT(s.id) as sessions, COALESCE(SUM(s.duration),0) as total_seconds
      FROM users u LEFT JOIN sessions s ON s.user_id=u.id ${timeFilter}
      GROUP BY u.id HAVING sessions > 0 ORDER BY sessions DESC
    `);
    const idx = allRanked.findIndex(r => r.username?.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) {
      const start = Math.max(0, idx - 2);
      contextRows = allRanked.slice(start, Math.min(allRanked.length, idx + 3))
        .map((r, i) => ({ ...r, rank: start + i + 1, isMatch: start + i === idx }));
    }
  }

  const allForRank = query(`
    SELECT u.id, COUNT(s.id) as sessions FROM users u
    LEFT JOIN sessions s ON s.user_id=u.id ${timeFilter}
    GROUP BY u.id HAVING sessions > 0 ORDER BY sessions DESC
  `);
  const rankMap = Object.fromEntries(allForRank.map((r, i) => [r.id, i + 1]));

  res.json({
    leaderboard: rows.map(r => ({ ...r, rank: rankMap[r.id] || null })),
    context: contextRows,
  });
});

export default router;