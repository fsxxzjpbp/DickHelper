export interface Env {
  DB: D1Database;
}

export interface User {
  uuid: string;
  nickname: string;
  created_at: string;
}

export interface DailyStat {
  uuid: string;
  device_id: string;
  date: string;
  count: number;
  duration: number;
  records_detail: string | null;
  updated_at: string;
}

export interface RegisterRequest {
  uuid: string;
}

export interface RegisterResponse {
  nickname: string;
}

export interface ReportRecordDetail {
  id: string;
  duration: number;
}

export interface ReportRequest {
  date: string;
  count: number;
  duration: number;
  records?: ReportRecordDetail[];
}

export interface BatchReportRequest {
  device_id: string;
  stats: ReportRequest[];
}

export interface RankingEntry {
  rank: number;
  nickname: string;
  count: number;
  duration: number;
}

export interface UserRanking {
  rank: number;
  count: number;
  duration: number;
  percentile: number;
}

export interface RankingStats {
  avgCount: number;
  avgDuration: number;
}

export interface RankingResponse {
  rankings: RankingEntry[];
  total: number;
  me: UserRanking;
  stats: RankingStats;
}

export interface SuccessResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: string;
}

export interface TelemetryLaunchRequest {
  uuid: string;
  platform: string;
  app_version: string;
  os: string;
}
