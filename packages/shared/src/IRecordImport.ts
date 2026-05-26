import type { IRecordRaw } from "./IRecord";

export interface ILegacyRecordImportRow {
    readonly id: string;
    readonly startTime: string;
    readonly duration: number;
    readonly notes?: string | null;
}

export interface IRecordImportParseResult {
    readonly Records: IRecordRaw[];
    readonly Rejected: number;
    readonly DuplicateIds: number;
}

export interface IRecordIdStatistics {
    readonly Total: number;
    readonly Unique: number;
    readonly Duplicate: number;
}
