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
  date: string;
  count: number;
  duration: number;
  updated_at: string;
}

export interface RegisterRequest {
  uuid: string;
}

export interface RegisterResponse {
  nickname: string;
}

export interface ReportRequest {
  date: string;
  count: number;
  duration: number;
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

export interface RankingResponse {
  rankings: RankingEntry[];
  total: number;
  me: UserRanking;
}

export interface SuccessResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: string;
}
