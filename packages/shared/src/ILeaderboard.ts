/** Request body for POST /api/register */
export interface IRegisterRequest {
    readonly uuid: string;
}

/** Response from POST /api/register */
export interface IRegisterResponse {
    readonly nickname: string;
}

/** Request body for POST /api/report */
export interface IReportRequest {
    readonly date: string;
    readonly count: number;
    readonly duration: number;
}

/** Request body for POST /api/report/batch */
export interface IBatchReportRequest {
    readonly stats: readonly IReportRequest[];
}

/** A single entry in the ranking list */
export interface IRankingEntry {
    readonly rank: number;
    readonly nickname: string;
    readonly count: number;
    readonly duration: number;
}

/** Current user's ranking info */
export interface IUserRanking {
    readonly rank: number;
    readonly count: number;
    readonly duration: number;
    readonly percentile: number;
}

/** Server-side aggregate stats across all users */
export interface IRankingStats {
    readonly avgCount: number;
    readonly avgDuration: number;
}

/** Response from GET /api/ranking/daily or GET /api/ranking/weekly */
export interface IRankingResponse {
    readonly rankings: readonly IRankingEntry[];
    readonly total: number;
    readonly me: IUserRanking;
    readonly stats: IRankingStats;
}

/** Response from DELETE /api/account or POST /api/report */
export interface ISuccessResponse {
    readonly success: boolean;
}

/** Error response from the API */
export interface IErrorResponse {
    readonly error: string;
}

/** Local online feature configuration */
export interface IOnlineConfig {
    readonly enabled: boolean;
    readonly uuid: string | null;
    readonly nickname: string | null;
    readonly baseUrl: string;
}
