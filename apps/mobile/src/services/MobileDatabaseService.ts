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
    RECORD_DELETED_COLUMN_NAME,
    RECORD_DELETED_AT_COLUMN_NAME,
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
    readonly Deleted: number;
    readonly DeletedAt: string | null;
}

interface ISettingRow {
    readonly Value: string;
}

const RECORD_SELECT_SQL = `SELECT ${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}, ${RECORD_DELETED_COLUMN_NAME}, ${RECORD_DELETED_AT_COLUMN_NAME} FROM ${RECORDS_TABLE_NAME} WHERE ${RECORD_DELETED_COLUMN_NAME} = 0 ORDER BY ${RECORD_END_TIME_COLUMN_NAME} DESC`;
const RECORD_SELECT_ALL_SQL = `SELECT ${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}, ${RECORD_DELETED_COLUMN_NAME}, ${RECORD_DELETED_AT_COLUMN_NAME} FROM ${RECORDS_TABLE_NAME} ORDER BY ${RECORD_END_TIME_COLUMN_NAME} DESC`;
const RECORD_SELECT_DELETED_SQL = `SELECT ${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}, ${RECORD_DELETED_COLUMN_NAME}, ${RECORD_DELETED_AT_COLUMN_NAME} FROM ${RECORDS_TABLE_NAME} WHERE ${RECORD_DELETED_COLUMN_NAME} = 1 ORDER BY ${RECORD_DELETED_AT_COLUMN_NAME} DESC`;
const RECORD_INSERT_SQL = `INSERT INTO ${RECORDS_TABLE_NAME} (${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}, ${RECORD_DELETED_COLUMN_NAME}) VALUES (?, ?, ?, ?, ?, 0)`;
const RECORD_INSERT_OR_IGNORE_SQL = `INSERT OR IGNORE INTO ${RECORDS_TABLE_NAME} (${RECORD_ID_COLUMN_NAME}, ${RECORD_START_TIME_COLUMN_NAME}, ${RECORD_END_TIME_COLUMN_NAME}, ${RECORD_DURATION_COLUMN_NAME}, ${RECORD_NOTES_COLUMN_NAME}, ${RECORD_DELETED_COLUMN_NAME}) VALUES (?, ?, ?, ?, ?, ?)`;
const RECORD_SOFT_DELETE_SQL = `UPDATE ${RECORDS_TABLE_NAME} SET ${RECORD_DELETED_COLUMN_NAME} = 1, ${RECORD_DELETED_AT_COLUMN_NAME} = ? WHERE ${RECORD_ID_COLUMN_NAME} = ? AND ${RECORD_DELETED_COLUMN_NAME} = 0`;
const RECORD_RESTORE_SQL = `UPDATE ${RECORDS_TABLE_NAME} SET ${RECORD_DELETED_COLUMN_NAME} = 0, ${RECORD_DELETED_AT_COLUMN_NAME} = NULL WHERE ${RECORD_ID_COLUMN_NAME} = ? AND ${RECORD_DELETED_COLUMN_NAME} = 1`;
const RECORD_PURGE_SQL = `DELETE FROM ${RECORDS_TABLE_NAME} WHERE ${RECORD_DELETED_COLUMN_NAME} = 1`;
const RECORD_TOMBSTONE_SQL = `UPDATE ${RECORDS_TABLE_NAME} SET ${RECORD_DELETED_COLUMN_NAME} = 1, ${RECORD_DELETED_AT_COLUMN_NAME} = ? WHERE ${RECORD_ID_COLUMN_NAME} = ? AND ${RECORD_DELETED_COLUMN_NAME} = 0`;
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

    // Migration: add Deleted and DeletedAt columns if missing
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${RECORDS_TABLE_NAME})`);
    const columnNames = new Set(tableInfo.map((row) => row.name));
    if (!columnNames.has(RECORD_DELETED_COLUMN_NAME)) {
        await db.execAsync(`ALTER TABLE ${RECORDS_TABLE_NAME} ADD COLUMN ${RECORD_DELETED_COLUMN_NAME} INTEGER DEFAULT 0`);
    }
    if (!columnNames.has(RECORD_DELETED_AT_COLUMN_NAME)) {
        await db.execAsync(`ALTER TABLE ${RECORDS_TABLE_NAME} ADD COLUMN ${RECORD_DELETED_AT_COLUMN_NAME} TEXT`);
    }
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

    /** Get all records including tombstones (for sync) */
    public async GetAllRecordsWithTombstones(): Promise<IRecord[]> {
        const rows = await this._db.getAllAsync<IRecordRow>(RECORD_SELECT_ALL_SQL);
        return rows.map((row) => this.MapRowToRecord(row));
    }

    /** Get soft-deleted records (recycle bin) */
    public async GetDeletedRecords(): Promise<IRecord[]> {
        const rows = await this._db.getAllAsync<IRecordRow>(RECORD_SELECT_DELETED_SQL);
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
        const now = new Date().toISOString();
        const result = await this._db.runAsync(RECORD_SOFT_DELETE_SQL, now, id);
        return result.changes > 0;
    }

    public async RestoreRecord(id: string): Promise<boolean> {
        const result = await this._db.runAsync(RECORD_RESTORE_SQL, id);
        return result.changes > 0;
    }

    public async PurgeDeleted(): Promise<void> {
        await this._db.runAsync(RECORD_PURGE_SQL);
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
            const incomingDeleted: number = record.Deleted ?? 0;
            const incomingDeletedAt: string | null = record.DeletedAt ?? null;

            // Check if record already exists
            const existing = await this._db.getFirstAsync<{ Deleted: number }>(
                `SELECT ${RECORD_DELETED_COLUMN_NAME} FROM ${RECORDS_TABLE_NAME} WHERE ${RECORD_ID_COLUMN_NAME} = ?`,
                record.Id
            );

            if (existing !== null) {
                // Record exists: if incoming is a tombstone, propagate deletion
                if (incomingDeleted === 1 && existing.Deleted === 0) {
                    await this._db.runAsync(RECORD_TOMBSTONE_SQL, incomingDeletedAt ?? new Date().toISOString(), record.Id);
                }
                skipped++;
                continue;
            }

            // New record: insert
            const result = await this._db.runAsync(
                RECORD_INSERT_OR_IGNORE_SQL,
                record.Id,
                record.StartTime,
                record.EndTime,
                record.Duration,
                record.Notes ?? null,
                incomingDeleted
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
        const records = await this.GetAllRecordsWithTombstones();
        return ExportRecordsToJson(records.map((record) => this.MapRecordToRaw(record)));
    }

    private MapRowToRecord(row: IRecordRow): IRecord {
        return {
            Id: row.Id,
            StartTime: new Date(row.StartTime),
            EndTime: new Date(row.EndTime),
            Duration: row.Duration,
            Notes: row.Notes ?? undefined,
            Deleted: row.Deleted === 1,
            DeletedAt: row.DeletedAt ? new Date(row.DeletedAt) : undefined,
        };
    }

    private MapRecordToRaw(record: IRecord): IRecordRaw {
        return {
            Id: record.Id,
            StartTime: record.StartTime.toISOString(),
            EndTime: record.EndTime.toISOString(),
            Duration: record.Duration,
            Notes: record.Notes ?? undefined,
            Deleted: record.Deleted ? 1 : 0,
            DeletedAt: record.DeletedAt?.toISOString() ?? undefined,
        };
    }

    private CreateRecordId(): string {
        if (typeof globalThis.crypto?.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }

        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
}
