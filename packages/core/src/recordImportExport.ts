import type {
    IRecordIdStatistics,
    IRecordImportParseResult,
    IMobileExportV1,
    ILegacyRecordImportRow,
    IRecordRaw,
} from "@dickhelper/shared";
import { CANONICAL_EXPORT_VERSION } from "./schema";

interface ICanonicalImportRoot {
    readonly version: number;
    readonly records: unknown[];
}

interface ICanonicalRecordInput {
    readonly Id: unknown;
    readonly StartTime: unknown;
    readonly EndTime: unknown;
    readonly Duration: unknown;
    readonly Notes?: unknown;
}

export function ExportRecordsToJson(records: readonly IRecordRaw[]): string {
    const payload: IMobileExportV1 = {
        version: CANONICAL_EXPORT_VERSION,
        records: records.map((record) => ({
            Id: record.Id,
            StartTime: record.StartTime,
            EndTime: record.EndTime,
            Duration: record.Duration,
            Notes: record.Notes ?? undefined,
        })),
    };

    return JSON.stringify(payload, null, 2);
}

export function ParseImportJson(jsonText: string): IRecordImportParseResult | null {
    let raw: unknown;

    try {
        raw = JSON.parse(jsonText);
    } catch {
        return null;
    }

    if (IsCanonicalImportRoot(raw)) {
        return ParseCanonicalRecords(raw.records);
    }

    if (Array.isArray(raw)) {
        return ParseLegacyRecords(raw);
    }

    return null;
}

export function GetRecordIdStatistics(records: readonly { readonly Id: string }[]): IRecordIdStatistics {
    const seen = new Set<string>();
    let duplicate = 0;

    for (const record of records) {
        if (seen.has(record.Id)) {
            duplicate++;
            continue;
        }

        seen.add(record.Id);
    }

    return {
        Total: records.length,
        Unique: seen.size,
        Duplicate: duplicate,
    };
}

function IsCanonicalImportRoot(value: unknown): value is ICanonicalImportRoot {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    return candidate.version === CANONICAL_EXPORT_VERSION && Array.isArray(candidate.records);
}

function ParseCanonicalRecords(rawRecords: unknown[]): IRecordImportParseResult {
    const records: IRecordRaw[] = [];
    let rejected = 0;
    let duplicateIds = 0;
    const seenIds = new Set<string>();

    for (const rawRecord of rawRecords) {
        const normalized = NormalizeCanonicalRecord(rawRecord);
        if (normalized === null) {
            rejected++;
            continue;
        }

        if (seenIds.has(normalized.Id)) {
            duplicateIds++;
            continue;
        }

        seenIds.add(normalized.Id);
        records.push(normalized);
    }

    return {
        Records: records,
        Rejected: rejected,
        DuplicateIds: duplicateIds,
    };
}

function ParseLegacyRecords(rawRecords: unknown[]): IRecordImportParseResult {
    const records: IRecordRaw[] = [];
    let rejected = 0;
    let duplicateIds = 0;
    const seenIds = new Set<string>();

    for (const rawRecord of rawRecords) {
        const normalized = NormalizeLegacyRecord(rawRecord);
        if (normalized === null) {
            rejected++;
            continue;
        }

        if (seenIds.has(normalized.Id)) {
            duplicateIds++;
            continue;
        }

        seenIds.add(normalized.Id);
        records.push(normalized);
    }

    return {
        Records: records,
        Rejected: rejected,
        DuplicateIds: duplicateIds,
    };
}

function NormalizeCanonicalRecord(rawRecord: unknown): IRecordRaw | null {
    if (typeof rawRecord !== "object" || rawRecord === null) {
        return null;
    }

    const candidate = rawRecord as ICanonicalRecordInput;
    const id = NormalizeId(candidate.Id);
    const startTime = NormalizeDate(candidate.StartTime);
    const endTime = NormalizeDate(candidate.EndTime);
    const duration = NormalizeDuration(candidate.Duration);

    if (id === null || startTime === null || endTime === null || duration === null) {
        return null;
    }

    const notes = NormalizeNotes(candidate.Notes);

    return notes === undefined
        ? {
              Id: id,
              StartTime: startTime.toISOString(),
              EndTime: endTime.toISOString(),
              Duration: duration,
          }
        : {
              Id: id,
              StartTime: startTime.toISOString(),
              EndTime: endTime.toISOString(),
              Duration: duration,
              Notes: notes,
          };
}

function NormalizeLegacyRecord(rawRecord: unknown): IRecordRaw | null {
    if (typeof rawRecord !== "object" || rawRecord === null) {
        return null;
    }

    const candidate = rawRecord as ILegacyRecordImportRow;
    const id = NormalizeId(candidate.id);
    const endTime = NormalizeDate(candidate.startTime);
    const duration = NormalizeDuration(candidate.duration);

    if (id === null || endTime === null || duration === null) {
        return null;
    }

    const startTime = new Date(endTime.getTime() - duration * 60_000);
    const notes = NormalizeNotes(candidate.notes);

    return notes === undefined
        ? {
              Id: id,
              StartTime: startTime.toISOString(),
              EndTime: endTime.toISOString(),
              Duration: duration,
          }
        : {
              Id: id,
              StartTime: startTime.toISOString(),
              EndTime: endTime.toISOString(),
              Duration: duration,
              Notes: notes,
          };
}

function NormalizeId(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    return value.trim().length > 0 ? value : null;
}

function NormalizeDate(value: unknown): Date | null {
    if (typeof value !== "string") {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function NormalizeDuration(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return null;
    }

    return value;
}

function NormalizeNotes(value: unknown): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    return typeof value === "string" ? value : String(value);
}
