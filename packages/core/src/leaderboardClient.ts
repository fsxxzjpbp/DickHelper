import type {
    IRegisterResponse,
    IRankingResponse,
    IErrorResponse,
} from "@dickhelper/shared";

// Leaderboard API client — all functions throw descriptive errors on failure.

interface IFetchOptions {
    readonly method: string;
    readonly baseUrl: string;
    readonly path: string;
    readonly uuid?: string;
    readonly body?: unknown;
    readonly query?: Record<string, string>;
}

async function apiFetch<T>(options: IFetchOptions): Promise<T> {
    const { method, baseUrl, path, uuid, body, query } = options;

    let url = `${baseUrl}${path}`;
    if (query !== undefined) {
        const params = new URLSearchParams(query);
        url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (uuid !== undefined) {
        headers["Authorization"] = `Bearer ${uuid}`;
    }

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`网络请求失败，请检查网络连接。(${message})`);
    }

    if (!response.ok) {
        let errorMsg: string;
        try {
            const errData: IErrorResponse = await response.json() as IErrorResponse;
            errorMsg = errData.error;
        } catch {
            errorMsg = `HTTP ${response.status}`;
        }
        throw new Error(`服务器错误：${errorMsg}`);
    }

    try {
        return (await response.json()) as T;
    } catch {
        throw new Error("服务器返回了无效的响应格式");
    }
}

// Register a new user — returns the assigned nickname.
export async function registerLeaderboard(
    baseUrl: string,
    uuid: string
): Promise<{ nickname: string }> {
    const data = await apiFetch<IRegisterResponse>({
        method: "POST",
        baseUrl,
        path: "/api/v1/register",
        body: { uuid },
    });
    return { nickname: data.nickname };
}

// Report daily stats to the leaderboard. Throws on failure.
export async function reportDailyStats(
    baseUrl: string,
    uuid: string,
    date: string,
    count: number,
    duration: number
): Promise<void> {
    await apiFetch<{ success: boolean }>({
        method: "POST",
        baseUrl,
        path: "/api/v1/report",
        uuid,
        body: { date, count, duration },
    });
}

// Batch report multiple days of stats in a single request.
export async function batchReportDailyStats(
    baseUrl: string,
    uuid: string,
    stats: Array<{ date: string; count: number; duration: number }>
): Promise<void> {
    await apiFetch<{ success: boolean }>({
        method: "POST",
        baseUrl,
        path: "/api/v1/report/batch",
        uuid,
        body: { stats },
    });
}

// Fetch daily ranking. date: YYYY-MM-DD, limit/offset for pagination.
export async function getDailyRanking(
    baseUrl: string,
    uuid: string,
    date?: string,
    limit?: number,
    offset?: number,
    sort?: "count" | "duration"
): Promise<IRankingResponse> {
    const query: Record<string, string> = {};
    if (date !== undefined) query.date = date;
    if (limit !== undefined) query.limit = String(limit);
    if (offset !== undefined) query.offset = String(offset);
    if (sort !== undefined) query.sort = sort;

    return apiFetch<IRankingResponse>({
        method: "GET",
        baseUrl,
        path: "/api/v1/ranking/daily",
        uuid,
        query,
    });
}

// Fetch weekly ranking. week: YYYY-Www format, limit/offset for pagination.
export async function getWeeklyRanking(
    baseUrl: string,
    uuid: string,
    week?: string,
    limit?: number,
    offset?: number,
    sort?: "count" | "duration"
): Promise<IRankingResponse> {
    const query: Record<string, string> = {};
    if (week !== undefined) query.week = week;
    if (limit !== undefined) query.limit = String(limit);
    if (offset !== undefined) query.offset = String(offset);
    if (sort !== undefined) query.sort = sort;

    return apiFetch<IRankingResponse>({
        method: "GET",
        baseUrl,
        path: "/api/v1/ranking/weekly",
        uuid,
        query,
    });
}

// Delete the user's account from the leaderboard.
export async function deleteAccount(
    baseUrl: string,
    uuid: string
): Promise<void> {
    await apiFetch<{ success: boolean }>({
        method: "DELETE",
        baseUrl,
        path: "/api/v1/account",
        uuid,
    });
}
