import type { IRecordRaw } from "./IRecord";

export interface IMobileExportV1 {
    readonly version: 1;
    readonly records: IRecordRaw[];
}
