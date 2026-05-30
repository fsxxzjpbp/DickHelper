import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { generateNickname } from './nicknames';
import type {
  Env,
  RegisterRequest,
  BatchReportRequest,
  ReportRecordDetail,
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

// POST /api/v1/reroll-nickname
app.post('/api/v1/reroll-nickname', async (c) => {
  try {
    const auth = await authenticateUser(c);
    if ('error' in auth) {
      return c.json<ErrorResponse>(auth, 401);
    }

    const nickname = generateNickname();
    await c.env.DB.prepare('UPDATE users SET nickname = ? WHERE uuid = ?').bind(nickname, auth.uuid).run();

    return c.json<{ nickname: string }>({ nickname });
  } catch (error) {
    console.error('Reroll nickname error:', error);
    return c.json<ErrorResponse>({ error: 'Internal server error' }, 500);
  }
});

// POST /api/v1/report/batch
app.post('/api/v1/report/batch', async (c) => {
  try {
    const auth = await authenticateUser(c);
    if ('error' in auth) {
      return c.json<ErrorResponse>(auth, 401);
    }

    const body = await c.req.json<BatchReportRequest>();
    const { device_id, stats } = body;

    if (!device_id || typeof device_id !== 'string') {
      return c.json<ErrorResponse>({ error: 'Invalid device_id' }, 400);
    }

    if (!Array.isArray(stats) || stats.length === 0) {
      return c.json<ErrorResponse>({ error: 'Invalid stats array' }, 400);
    }

    // Validate each entry
    for (const entry of stats) {
      if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        return c.json<ErrorResponse>({ error: `Invalid date format: ${entry.date}` }, 400);
      }
      if (typeof entry.count !== 'number' || entry.count < 0) {
        return c.json<ErrorResponse>({ error: `Invalid count for date ${entry.date}` }, 400);
      }
      if (typeof entry.duration !== 'number' || entry.duration < 0) {
        return c.json<ErrorResponse>({ error: `Invalid duration for date ${entry.date}` }, 400);
      }
    }

    // Compute final values for each entry (each device stores its own records)
    const statements = stats.map((entry) => {
      let finalRecordsDetail: string | null = null;

      if (entry.records && entry.records.length > 0) {
        finalRecordsDetail = JSON.stringify(entry.records);
      }

      return c.env.DB.prepare(`
        INSERT INTO daily_stats (uuid, device_id, date, count, duration, records_detail, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (uuid, device_id, date)
        DO UPDATE SET count = ?, duration = ?, records_detail = ?, updated_at = datetime('now')
      `).bind(
        auth.uuid, device_id, entry.date, entry.count, entry.duration, finalRecordsDetail,
        entry.count, entry.duration, finalRecordsDetail
      );
    });

    await c.env.DB.batch(statements);

    return c.json<SuccessResponse>({ success: true });
  } catch (error) {
    console.error('Batch report error:', error);
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

    // Aggregate across all device_ids for each user:
    // - Merge records_detail from all devices, dedup by record id
    // - Use merged count and duration from deduped records
    const aggregatedUsers = await c.env.DB.prepare(`
      SELECT
        ds.uuid,
        u.nickname,
        GROUP_CONCAT(ds.records_detail, '|||') as all_records
      FROM daily_stats ds
      JOIN users u ON ds.uuid = u.uuid
      WHERE ds.date = ?
      GROUP BY ds.uuid
    `).bind(date).all();

    // Process aggregated data: merge records_detail per user
    interface IUserAgg {
      uuid: string;
      nickname: string;
      count: number;
      duration: number;
    }

    const userAggs: IUserAgg[] = [];
    for (const row of aggregatedUsers.results) {
      const uuid = row.uuid as string;
      const nickname = row.nickname as string;
      const allRecordsRaw = row.all_records as string | null;

      const mergedRecords = new Map<string, { id: string; duration: number }>();

      if (allRecordsRaw) {
        const parts = allRecordsRaw.split('|||');
        for (const part of parts) {
          if (!part) continue;
          try {
            const records = JSON.parse(part) as ReportRecordDetail[];
            for (const r of records) {
              mergedRecords.set(r.id, { id: r.id, duration: r.duration });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      if (mergedRecords.size > 0) {
        const mergedArray = Array.from(mergedRecords.values());
        userAggs.push({
          uuid,
          nickname,
          count: mergedArray.length,
          duration: mergedArray.reduce((sum, r) => sum + r.duration, 0),
        });
      } else {
        // Fallback: if no records_detail, use sum of count/duration
        const fallback = await c.env.DB.prepare(`
          SELECT SUM(count) as count, SUM(duration) as duration
          FROM daily_stats WHERE uuid = ? AND date = ?
        `).bind(uuid, date).first();
        userAggs.push({
          uuid,
          nickname,
          count: (fallback?.count as number) ?? 0,
          duration: (fallback?.duration as number) ?? 0,
        });
      }
    }

    // Sort aggregated users
    userAggs.sort((a, b) => {
      if (sort === 'count') {
        if (b.count !== a.count) return b.count - a.count;
        return a.duration - b.duration;
      } else {
        if (b.duration !== a.duration) return b.duration - a.duration;
        return a.count - b.count;
      }
    });

    const total = userAggs.length;

    // Apply pagination
    const paginatedUsers = userAggs.slice(offset, offset + limit);

    // Get server-side stats (average across all users for this date)
    const statsRow = await c.env.DB.prepare(`
      SELECT AVG(count) as avgCount, AVG(duration) as avgDuration
      FROM daily_stats
      WHERE date = ?
    `).bind(date).first();
    const stats: RankingStats = {
      avgCount: statsRow ? Math.round(((statsRow.avgCount as number) || 0) * 100) / 100 : 0,
      avgDuration: statsRow ? Math.round(((statsRow.avgDuration as number) || 0) * 100) / 100 : 0,
    };

    // Get current user's ranking from aggregated data
    const currentUserAgg = userAggs.find(u => u.uuid === auth.uuid);

    // Default: no data → rank 1 if nobody has data, otherwise last place
    let userRanking = { rank: total > 0 ? total + 1 : 1, count: 0, duration: 0, percentile: 0 };

    if (currentUserAgg) {
      const userCount = currentUserAgg.count;
      const userDuration = currentUserAgg.duration;

      // Calculate user's rank (position in sorted list)
      const rankIndex = userAggs.findIndex(u => u.uuid === auth.uuid);
      const rank = rankIndex + 1;

      // Calculate percentile
      const lowerCount = rankIndex;
      const percentile = total > 0 ? Math.round((lowerCount / total) * 100) : 0;

      userRanking = {
        rank,
        count: userCount,
        duration: userDuration,
        percentile,
      };
    }

    // Format rankings
    const formattedRankings = paginatedUsers.map((user, index) => ({
      rank: offset + index + 1,
      nickname: user.nickname,
      count: user.count,
      duration: user.duration,
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

    // Aggregate across all device_ids for each user for the week:
    // - Merge records_detail from all devices across all days, dedup by record id
    // - Use merged count and duration from deduped records
    const aggregatedUsers = await c.env.DB.prepare(`
      SELECT
        ds.uuid,
        u.nickname,
        GROUP_CONCAT(ds.records_detail, '|||') as all_records,
        SUM(ds.count) as raw_count,
        SUM(ds.duration) as raw_duration
      FROM daily_stats ds
      JOIN users u ON ds.uuid = u.uuid
      WHERE ds.date >= ? AND ds.date <= ?
      GROUP BY ds.uuid
    `).bind(monday, sunday).all();

    // Process aggregated data: merge records_detail per user across all days
    interface IUserWeeklyAgg {
      uuid: string;
      nickname: string;
      count: number;
      duration: number;
    }

    const userAggs: IUserWeeklyAgg[] = [];
    for (const row of aggregatedUsers.results) {
      const uuid = row.uuid as string;
      const nickname = row.nickname as string;
      const allRecordsRaw = row.all_records as string | null;
      const rawCount = row.raw_count as number;
      const rawDuration = row.raw_duration as number;

      const mergedRecords = new Map<string, { id: string; duration: number }>();

      if (allRecordsRaw) {
        const parts = allRecordsRaw.split('|||');
        for (const part of parts) {
          if (!part) continue;
          try {
            const records = JSON.parse(part) as ReportRecordDetail[];
            for (const r of records) {
              mergedRecords.set(r.id, { id: r.id, duration: r.duration });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      if (mergedRecords.size > 0) {
        const mergedArray = Array.from(mergedRecords.values());
        userAggs.push({
          uuid,
          nickname,
          count: mergedArray.length,
          duration: mergedArray.reduce((sum, r) => sum + r.duration, 0),
        });
      } else {
        // Fallback: if no records_detail, use sum of count/duration
        userAggs.push({
          uuid,
          nickname,
          count: rawCount ?? 0,
          duration: rawDuration ?? 0,
        });
      }
    }

    // Sort aggregated users
    userAggs.sort((a, b) => {
      if (sort === 'count') {
        if (b.count !== a.count) return b.count - a.count;
        return a.duration - b.duration;
      } else {
        if (b.duration !== a.duration) return b.duration - a.duration;
        return a.count - b.count;
      }
    });

    const total = userAggs.length;

    // Apply pagination
    const paginatedUsers = userAggs.slice(offset, offset + limit);

    // Get server-side stats (average across all users for this week)
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

    // Get current user's ranking from aggregated data
    const currentUserAgg = userAggs.find(u => u.uuid === auth.uuid);

    // Default: no data → rank 1 if nobody has data, otherwise last place
    let userRanking = { rank: total > 0 ? total + 1 : 1, count: 0, duration: 0, percentile: 0 };

    if (currentUserAgg) {
      const userCount = currentUserAgg.count;
      const userDuration = currentUserAgg.duration;

      // Calculate user's rank (position in sorted list)
      const rankIndex = userAggs.findIndex(u => u.uuid === auth.uuid);
      const rank = rankIndex + 1;

      // Calculate percentile
      const lowerCount = rankIndex;
      const percentile = total > 0 ? Math.round((lowerCount / total) * 100) : 0;

      userRanking = {
        rank,
        count: userCount,
        duration: userDuration,
        percentile,
      };
    }

    // Format rankings
    const formattedRankings = paginatedUsers.map((user, index) => ({
      rank: offset + index + 1,
      nickname: user.nickname,
      count: user.count,
      duration: user.duration,
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
