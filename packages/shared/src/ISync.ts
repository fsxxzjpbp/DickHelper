import type { IImportResult } from "./IRecord";

export interface ISyncResponse {
    readonly result: IImportResult;
    readonly records: string;
}

export interface ISyncStatus {
    readonly Running: boolean;
    readonly Port: number;
    readonly Addresses: readonly string[];
}
