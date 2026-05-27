import type { SQLiteDatabase } from "expo-sqlite";
import type { IImportResult, IRecord, IRecordRaw } from "@dickhelper/shared";
import {
    ExportRecordsToJson,
    ParseImportJson,
    RECORDS_TABLE_NAME,
    RECORD_ID_COLUMN_NAME,
    RECORD_START_TIME_COLUMN_NAME,
    RECORD_END_TIME_COLUMN_NAME,
    RECORD_DURATION_COLUMN_NAME,
    RECORD_NOTES_COLUMN_NAME,
    SETTINGS_TABLE_NAME,
    SETTINGS_KEY_COLUMN_NAME,
    SETTINGS_VALUE_COLUMN_NAME,
} from "@dickhelper/core";
import type { IRecordImportParseResult } from "@dickhelper/shared";

interface IRecordRow {
    readonly Id: string;
    readonly StartTime: string;
    readonly EndTime: string;
    readonly Duration: number;
    readonly Notes: string | null;
}

interface ISettingRow {
    readonly Value: string;
}

const RECORD_SELECT_SQL = `SELECT ${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME} FROM ${RECORDS_TABLE_NAME} ORDER BY ${RECORD_END_TIME_COLUMN_NAME} DESC`;
const RECORD_INSERT_SQL = `INSERT INTO ${RECORDS_TABLE_NAME} (${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}) VALUES (?, ?, ?, ?, ?)`;
const RECORD_INSERT_OR_IGNORE_SQL = `INSERT OR IGNORE INTO ${RECORDS_TABLE_NAME} (${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}) VALUES (?, ?, ?, ?, ?)`;
const RECORD_DELETE_SQL = `DELETE FROM ${RECORDS_TABLE_NAME} WHERE ${RECORD_ID_COLUMN_NAME} = ?`;
const SETTING_SELECT_SQL = `SELECT ${SETTINGS_VALUE_COLUMN_NAME} FROM ${SETTINGS_TABLE_NAME} WHERE ${SETTINGS_KEY_COLUMN_NAME} = ? LIMIT 1`;
const SETTING_UPSERT_SQL = `INSERT OR REPLACE INTO ${SETTINGS_TABLE_NAME} (${SETTINGS_KEY_COLUMN_NAME}, ${SETTINGS_VALUE_COLUMN_NAME}) VALUES (?, ?)`;

export async function InitializeDatabase(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${RECORDS_TABLE_NAME} (
            ${RECORD_ID_COLUMN_NAME} TEXT PRIMARY KEY,
            ${RECORD_START_TIME_COLUMN_NAME} TEXT NOT NULL,
            ${RECORD_END_TIME_COLUMN_NAME} TEXT NOT NULL,
            ${RECORD_DURATION_COLUMN_NAME} REAL NOT NULL,
            ${RECORD_NOTES_COLUMN_NAME} TEXT
        );
        CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE_NAME} (
            ${SETTINGS_KEY_COLUMN_NAME} TEXT PRIMARY KEY,
            ${SETTINGS_VALUE_COLUMN_NAME} TEXT NOT NULL
        );
    `);
}

export class MobileDatabaseService {
    private readonly _db: SQLiteDatabase;

    public constructor(db: SQLiteDatabase) {
        this._db = db;
    }

    public async GetRecords(): Promise<IRecord[]> {
        const rows = await this._db.getAllAsync<IRecordRow>(RECORD_SELECT_SQL);
        return rows.map((row) => this.MapRowToRecord(row));
    }

    public async SaveRecord(startTime: Date, endTime: Date, duration: number, notes?: string): Promise<IRecord> {
        const id = this.CreateRecordId();
        await this._db.runAsync(RECORD_INSERT_SQL, id, startTime.toISOString(), endTime.toISOString(), duration, notes ?? null);
        return {
            Id: id,
            StartTime: startTime,
            EndTime: endTime,
            Duration: duration,
            Notes: notes,
        };
    }

    public async DeleteRecord(id: string): Promise<boolean> {
        const result = await this._db.runAsync(RECORD_DELETE_SQL, id);
        return result.changes > 0;
    }

    public async GetSetting(key: string): Promise<string | null> {
        const rows = await this._db.getAllAsync<ISettingRow>(SETTING_SELECT_SQL, key);
        return rows[0]?.Value ?? null;
    }

    public async SetSetting(key: string, value: string): Promise<void> {
        await this._db.runAsync(SETTING_UPSERT_SQL, key, value);
    }

    public async ImportFromJson(jsonText: string): Promise<IImportResult> {
        const parsed: IRecordImportParseResult | null = ParseImportJson(jsonText);
        if (parsed === null) {
            return {
                Imported: 0,
                Skipped: 0,
                Rejected: 0,
            };
        }

        let imported = 0;
        let skipped = parsed.DuplicateIds;

        for (const record of parsed.Records) {
            const result = await this._db.runAsync(
                RECORD_INSERT_OR_IGNORE_SQL,
                record.Id,
                record.StartTime,
                record.EndTime,
                record.Duration,
                record.Notes ?? null
            );

            if (result.changes > 0) {
                imported++;
            } else {
                skipped++;
            }
        }

        return {
            Imported: imported,
            Skipped: skipped,
            Rejected: parsed.Rejected,
        };
    }

    public async ExportToJson(): Promise<string> {
        const records = await this.GetRecords();
        return ExportRecordsToJson(records.map((record) => this.MapRecordToRaw(record)));
    }

    private MapRowToRecord(row: IRecordRow): IRecord {
        return {
            Id: row.Id,
            StartTime: new Date(row.StartTime),
            EndTime: new Date(row.EndTime),
            Duration: row.Duration,
            Notes: row.Notes ?? undefined,
        };
    }

    private MapRecordToRaw(record: IRecord): IRecordRaw {
        return {
            Id: record.Id,
            StartTime: record.StartTime.toISOString(),
            EndTime: record.EndTime.toISOString(),
            Duration: record.Duration,
            Notes: record.Notes ?? undefined,
        };
    }

    private CreateRecordId(): string {
        if (typeof globalThis.crypto?.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }

        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
}
