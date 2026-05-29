import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { generateNickname } from './nicknames';
import type {
  Env,
  RegisterRequest,
  ReportRequest,
  RankingResponse,
  RankingStats,
  SuccessResponse,
  ErrorResponse,
} from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper: get current date in UTC+8
function getTodayUTC8(): string {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().split('T')[0];
}

// Helper: get current ISO week in UTC+8 (format: '2026-W22')
function getCurrentWeekUTC8(): string {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getFullYear();
  const month = utc8.getMonth();
  const day = utc8.getDate();

  // Calculate ISO week number
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Helper: get Monday and Sunday dates for a given ISO week string
function getWeekDates(weekStr: string): { monday: string; sunday: string } {
  const [yearStr, weekStr2] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr2);

  // Find January 4th (always in week 1)
  const jan4 = new Date(year, 0, 4);
  // Find Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));

  // Calculate Monday of target week
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);

  // Sunday is Monday + 6 days
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { monday: formatDate(monday), sunday: formatDate(sunday) };
}

// Valid sort values for ranking endpoints
type SortField = 'count' | 'duration';

function parseSortParam(sortStr: string | undefined): SortField | null {
  if (!sortStr || sortStr === 'count') return 'count';
  if (sortStr === 'duration') return 'duration';
  return null;
}

// Helper: authenticate user from Authorization header
async function authenticateUser(c: Context<{ Bindings: Env }>): Promise<{ uuid: string } | ErrorResponse> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header' };
  }
  const uuid = authHeader.slice(7);
  if (!uuid) {
    return { error: 'Invalid UUID in Authorization header' };
  }

  // Check if user exists
  const user = await c.env.DB.prepare('SELECT uuid FROM users WHERE uuid = ?').bind(uuid).first();
  if (!user) {
    return { error: 'User not found. Please register first.' };
  }

  return { uuid };
}

// POST /api/v1/register
app.post('/api/v1/register', async (c) => {
  try {
    const body = await c.req.json<RegisterRequest>();
    const { uuid } = body;

    if (!uuid || typeof uuid !== 'string') {
      return c.json<ErrorResponse>({ error: 'Invalid UUID' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare('SELECT nickname FROM users WHERE uuid = ?').bind(uuid).first();

    if (existingUser) {
      // Return existing nickname (idempotent)
      return c.json<{ nickname: string }>({ nickname: existingUser.nickname as string });
    }

    // Generate nickname and create user
    const nickname = generateNickname();

    await c.env.DB.prepare('INSERT INTO users (uuid, nickname) VALUES (?, ?)').bind(uuid, nickname).run();

    return c.json<{ nickname: string }>({ nickname }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return c.json<ErrorResponse>({ error: 'Internal server error' }, 500);
  }
});

// POST /api/v1/report
app.post('/api/v1/report', async (c) => {
  try {
    const auth = await authenticateUser(c);
    if ('error' in auth) {
      return c.json<ErrorResponse>(auth, 401);
    }

    const body = await c.req.json<ReportRequest>();
    const { date, count, duration } = body;

    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json<ErrorResponse>({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
    }

    // Validate count and duration
    if (typeof count !== 'number' || count < 0) {
      return c.json<ErrorResponse>({ error: 'Invalid count' }, 400);
    }
    if (typeof duration !== 'number' || duration < 0) {
      return c.json<ErrorResponse>({ error: 'Invalid duration' }, 400);
    }

    // UPSERT into daily_stats
    await c.env.DB.prepare(`
      INSERT INTO daily_stats (uuid, date, count, duration, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT (uuid, date)
      DO UPDATE SET count = ?, duration = ?, updated_at = datetime('now')
    `).bind(auth.uuid, date, count, duration, count, duration).run();

    return c.json<SuccessResponse>({ success: true });
  } catch (error) {
    console.error('Report error:', error);
    return c.json<ErrorResponse>({ error: 'Internal server error' }, 500);
  }
});

// GET /api/v1/ranking/daily
app.get('/api/v1/ranking/daily', async (c) => {
  try {
    const auth = await authenticateUser(c);
    if ('error' in auth) {
      return c.json<ErrorResponse>(auth, 401);
    }

    const date = c.req.query('date') || getTodayUTC8();
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = parseSortParam(c.req.query('sort'));

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json<ErrorResponse>({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
    }

    // Validate sort parameter
    if (sort === null) {
      return c.json<ErrorResponse>({ error: 'Invalid sort value. Use "count" or "duration"' }, 400);
    }

    // Dynamic ORDER BY — sort is validated to be exactly 'count' or 'duration' (safe from injection)
    const orderClause = sort === 'count'
      ? 'ds.count DESC, ds.duration ASC'
      : 'ds.duration DESC, ds.count ASC';

    // Get total count for this date
    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM daily_stats WHERE date = ?'
    ).bind(date).first();
    const total = (totalResult?.total as number) || 0;

    // Get rankings with nicknames
    const rankings = await c.env.DB.prepare(`
      SELECT u.nickname, ds.count, ds.duration
      FROM daily_stats ds
      JOIN users u ON ds.uuid = u.uuid
      WHERE ds.date = ?
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `).bind(date, limit, offset).all();

    // Get server-side stats (always both, independent of sort)
    const statsRow = await c.env.DB.prepare(`
      SELECT AVG(count) as avgCount, AVG(duration) as avgDuration
      FROM daily_stats
      WHERE date = ?
    `).bind(date).first();
    const stats: RankingStats = {
      avgCount: statsRow ? Math.round(((statsRow.avgCount as number) || 0) * 100) / 100 : 0,
      avgDuration: statsRow ? Math.round(((statsRow.avgDuration as number) || 0) * 100) / 100 : 0,
    };

    // Get current user's ranking
    const userStat = await c.env.DB.prepare(`
      SELECT count, duration
      FROM daily_stats
      WHERE uuid = ? AND date = ?
    `).bind(auth.uuid, date).first();

    let userRanking = { rank: 0, count: 0, duration: 0, percentile: 0 };

    if (userStat) {
      const userCount = userStat.count as number;
      const userDuration = userStat.duration as number;

      // Calculate user's rank using the same sort order
      const rankCondition = sort === 'count'
        ? `(count > ? OR (count = ? AND duration < ?))`
        : `(duration > ? OR (duration = ? AND count < ?))`;
      const rankResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as rank
        FROM daily_stats
        WHERE date = ? AND ${rankCondition}
      `).bind(date,
        sort === 'count' ? userCount : userDuration,
        sort === 'count' ? userCount : userDuration,
        sort === 'count' ? userDuration : userCount,
      ).first();
      const rank = ((rankResult?.rank as number) || 0) + 1;

      // Calculate percentile based on sort field
      const lowerCol = sort === 'count' ? 'count' : 'duration';
      const lowerVal = sort === 'count' ? userCount : userDuration;
      const lowerResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as lower_count
        FROM daily_stats
        WHERE date = ? AND ${lowerCol} < ?
      `).bind(date, lowerVal).first();
      const lowerCount = (lowerResult?.lower_count as number) || 0;
      const percentile = total > 0 ? Math.round((lowerCount / total) * 100) : 0;

      userRanking = {
        rank,
        count: userCount,
        duration: userDuration,
        percentile,
      };
    }

    // Format rankings
    const formattedRankings = rankings.results.map((row: Record<string, unknown>, index: number) => ({
      rank: offset + index + 1,
      nickname: row.nickname as string,
      count: row.count as number,
      duration: row.duration as number,
    }));

    return c.json<RankingResponse>({
      rankings: formattedRankings,
      total,
      me: userRanking,
      stats,
    });
  } catch (error) {
    console.error('Daily ranking error:', error);
    return c.json<ErrorResponse>({ error: 'Internal server error' }, 500);
  }
});

// GET /api/v1/ranking/weekly
app.get('/api/v1/ranking/weekly', async (c) => {
  try {
    const auth = await authenticateUser(c);
    if ('error' in auth) {
      return c.json<ErrorResponse>(auth, 401);
    }

    const week = c.req.query('week') || getCurrentWeekUTC8();
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = parseSortParam(c.req.query('sort'));

    // Validate week format
    if (!/^\d{4}-W\d{2}$/.test(week)) {
      return c.json<ErrorResponse>({ error: 'Invalid week format. Use YYYY-Www' }, 400);
    }

    // Validate sort parameter
    if (sort === null) {
      return c.json<ErrorResponse>({ error: 'Invalid sort value. Use "count" or "duration"' }, 400);
    }

    const { monday, sunday } = getWeekDates(week);

    // Dynamic ORDER BY — sort is validated to be exactly 'count' or 'duration' (safe from injection)
    const orderClause = sort === 'count'
      ? 'count DESC, duration ASC'
      : 'duration DESC, count ASC';

    // Get total users who have stats for this week
    const totalResult = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT uuid) as total
      FROM daily_stats
      WHERE date >= ? AND date <= ?
    `).bind(monday, sunday).first();
    const total = (totalResult?.total as number) || 0;

    // Get weekly rankings (sum of counts and durations)
    const rankings = await c.env.DB.prepare(`
      SELECT u.nickname, SUM(ds.count) as count, SUM(ds.duration) as duration
      FROM daily_stats ds
      JOIN users u ON ds.uuid = u.uuid
      WHERE ds.date >= ? AND ds.date <= ?
      GROUP BY ds.uuid
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `).bind(monday, sunday, limit, offset).all();

    // Get server-side stats (always both, independent of sort)
    const statsRow = await c.env.DB.prepare(`
      SELECT AVG(count) as avgCount, AVG(duration) as avgDuration
      FROM (
        SELECT uuid, SUM(count) as count, SUM(duration) as duration
        FROM daily_stats
        WHERE date >= ? AND date <= ?
        GROUP BY uuid
      )
    `).bind(monday, sunday).first();
    const stats: RankingStats = {
      avgCount: statsRow ? Math.round(((statsRow.avgCount as number) || 0) * 100) / 100 : 0,
      avgDuration: statsRow ? Math.round(((statsRow.avgDuration as number) || 0) * 100) / 100 : 0,
    };

    // Get current user's weekly stats
    const userStat = await c.env.DB.prepare(`
      SELECT SUM(count) as count, SUM(duration) as duration
      FROM daily_stats
      WHERE uuid = ? AND date >= ? AND date <= ?
    `).bind(auth.uuid, monday, sunday).first();

    let userRanking = { rank: 0, count: 0, duration: 0, percentile: 0 };

    if (userStat && userStat.count) {
      const userCount = userStat.count as number;
      const userDuration = userStat.duration as number;

      // Calculate user's rank using the same sort order
      const rankHaving = sort === 'count'
        ? `HAVING total_count > ? OR (total_count = ? AND total_duration < ?)`
        : `HAVING total_duration > ? OR (total_duration = ? AND total_count < ?)`;
      const rankResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as rank
        FROM (
          SELECT uuid, SUM(count) as total_count, SUM(duration) as total_duration
          FROM daily_stats
          WHERE date >= ? AND date <= ?
          GROUP BY uuid
          ${rankHaving}
        )
      `).bind(monday, sunday,
        sort === 'count' ? userCount : userDuration,
        sort === 'count' ? userCount : userDuration,
        sort === 'count' ? userDuration : userCount,
      ).first();
      const rank = ((rankResult?.rank as number) || 0) + 1;

      // Calculate percentile based on sort field
      const lowerSumCol = sort === 'count' ? 'total_count' : 'total_duration';
      const lowerVal = sort === 'count' ? userCount : userDuration;
      const lowerResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as lower_count
        FROM (
          SELECT uuid, SUM(count) as total_count, SUM(duration) as total_duration
          FROM daily_stats
          WHERE date >= ? AND date <= ?
          GROUP BY uuid
          HAVING ${lowerSumCol} < ?
        )
      `).bind(monday, sunday, lowerVal).first();
      const lowerCount = (lowerResult?.lower_count as number) || 0;
      const percentile = total > 0 ? Math.round((lowerCount / total) * 100) : 0;

      userRanking = {
        rank,
        count: userCount,
        duration: userDuration,
        percentile,
      };
    }

    // Format rankings
    const formattedRankings = rankings.results.map((row: Record<string, unknown>, index: number) => ({
      rank: offset + index + 1,
      nickname: row.nickname as string,
      count: row.count as number,
      duration: row.duration as number,
    }));

    return c.json<RankingResponse>({
      rankings: formattedRankings,
      total,
      me: userRanking,
      stats,
    });
  } catch (error) {
    console.error('Weekly ranking error:', error);
    return c.json<ErrorResponse>({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/v1/account
app.delete('/api/v1/account', async (c) => {
  try {
    const auth = await authenticateUser(c);
    if ('error' in auth) {
      return c.json<ErrorResponse>(auth, 401);
    }

    // Delete user and daily stats atomically using D1 batch
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM daily_stats WHERE uuid = ?').bind(auth.uuid),
      c.env.DB.prepare('DELETE FROM users WHERE uuid = ?').bind(auth.uuid),
    ]);

    return c.json<SuccessResponse>({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return c.json<ErrorResponse>({ error: 'Internal server error' }, 500);
  }
});

// Health check
app.get('/', (c) => {
  return c.text('DickHelper Leaderboard API');
});

export default app;
