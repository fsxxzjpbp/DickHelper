import assert from "node:assert/strict";
import {
    CANONICAL_EXPORT_VERSION,
    ExportRecordsToJson,
    GetRecordIdStatistics,
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
} from "../src/index";

function RunTest(name: string, fn: () => void): void {
    fn();
    console.log(`✓ ${name}`);
}

const firstEndTime = new Date("2026-05-26T10:05:00.000Z");
const firstStartTime = new Date("2026-05-26T10:00:00.000Z");
const secondEndTime = new Date("2026-05-26T11:00:00.000Z");
const secondStartTime = new Date("2026-05-26T10:50:00.000Z");

RunTest("exports canonical v1 JSON", () => {
    const json = ExportRecordsToJson([
        {
            Id: "record-1",
            StartTime: firstStartTime.toISOString(),
            EndTime: firstEndTime.toISOString(),
            Duration: 5,
            Notes: "note",
        },
    ]);

    assert.deepEqual(JSON.parse(json), {
        version: 1,
        records: [
            {
                Id: "record-1",
                StartTime: firstStartTime.toISOString(),
                EndTime: firstEndTime.toISOString(),
                Duration: 5,
                Notes: "note",
            },
        ],
    });
});

RunTest("imports canonical v1 JSON", () => {
    const result = ParseImportJson(
        JSON.stringify({
            version: 1,
            records: [
                {
                    Id: "record-1",
                    StartTime: firstStartTime.toISOString(),
                    EndTime: firstEndTime.toISOString(),
                    Duration: 5,
                    Notes: "note",
                },
            ],
        })
    );

    assert.notEqual(result, null);
    assert.equal(result?.Records.length, 1);
    assert.equal(result?.Rejected, 0);
    assert.equal(result?.DuplicateIds, 0);
    assert.deepEqual(result?.Records[0], {
        Id: "record-1",
        StartTime: firstStartTime.toISOString(),
        EndTime: firstEndTime.toISOString(),
        Duration: 5,
        Notes: "note",
    });
});

RunTest("rejects canonical empty ids", () => {
    const result = ParseImportJson(
        JSON.stringify({
            version: 1,
            records: [
                {
                    Id: "",
                    StartTime: firstStartTime.toISOString(),
                    EndTime: firstEndTime.toISOString(),
                    Duration: 5,
                },
            ],
        })
    );

    assert.notEqual(result, null);
    assert.equal(result?.Records.length, 0);
    assert.equal(result?.Rejected, 1);
    assert.equal(result?.DuplicateIds, 0);
});

RunTest("imports legacy array JSON", () => {
    const result = ParseImportJson(
        JSON.stringify([
            {
                id: "legacy-1",
                startTime: firstEndTime.toISOString(),
                duration: 5,
                notes: "old note",
            },
        ])
    );

    assert.notEqual(result, null);
    assert.equal(result?.Records.length, 1);
    assert.equal(result?.Rejected, 0);
    assert.equal(result?.DuplicateIds, 0);
    assert.deepEqual(result?.Records[0], {
        Id: "legacy-1",
        StartTime: firstStartTime.toISOString(),
        EndTime: firstEndTime.toISOString(),
        Duration: 5,
        Notes: "old note",
    });
});

RunTest("rejects legacy whitespace-only ids", () => {
    const result = ParseImportJson(
        JSON.stringify([
            {
                id: "   ",
                startTime: firstEndTime.toISOString(),
                duration: 5,
            },
        ])
    );

    assert.notEqual(result, null);
    assert.equal(result?.Records.length, 0);
    assert.equal(result?.Rejected, 1);
    assert.equal(result?.DuplicateIds, 0);
});

RunTest("maps legacy startTime to endTime and derives startTime", () => {
    const result = ParseImportJson(
        JSON.stringify([
            {
                id: "legacy-2",
                startTime: secondEndTime.toISOString(),
                duration: 10,
            },
        ])
    );

    assert.notEqual(result, null);
    assert.deepEqual(result?.Records[0], {
        Id: "legacy-2",
        StartTime: secondStartTime.toISOString(),
        EndTime: secondEndTime.toISOString(),
        Duration: 10,
    });
});

RunTest("rejects malformed records", () => {
    const result = ParseImportJson(
        JSON.stringify({
            version: 1,
            records: [
                {
                    Id: "bad-1",
                    StartTime: firstStartTime.toISOString(),
                    EndTime: "not-a-date",
                    Duration: 5,
                },
            ],
        })
    );

    assert.notEqual(result, null);
    assert.equal(result?.Records.length, 0);
    assert.equal(result?.Rejected, 1);
});

RunTest("skips duplicate ids", () => {
    const result = ParseImportJson(
        JSON.stringify({
            version: 1,
            records: [
                {
                    Id: "dup-1",
                    StartTime: firstStartTime.toISOString(),
                    EndTime: firstEndTime.toISOString(),
                    Duration: 5,
                },
                {
                    Id: "dup-1",
                    StartTime: secondStartTime.toISOString(),
                    EndTime: secondEndTime.toISOString(),
                    Duration: 10,
                },
            ],
        })
    );

    assert.notEqual(result, null);
    assert.equal(result?.Records.length, 1);
    assert.equal(result?.DuplicateIds, 1);
    assert.deepEqual(result?.Records[0], {
        Id: "dup-1",
        StartTime: firstStartTime.toISOString(),
        EndTime: firstEndTime.toISOString(),
        Duration: 5,
    });
});

RunTest("reports duplicate record id statistics", () => {
    const stats = GetRecordIdStatistics([
        { Id: "a" },
        { Id: "a" },
        { Id: "b" },
    ]);

    assert.deepEqual(stats, {
        Total: 3,
        Unique: 2,
        Duplicate: 1,
    });
});

RunTest("keeps schema constants stable", () => {
    assert.equal(CANONICAL_EXPORT_VERSION, 1);
    assert.equal(RECORDS_TABLE_NAME, "Records");
    assert.equal(SETTINGS_TABLE_NAME, "Settings");
    assert.equal(RECORD_ID_COLUMN_NAME, "Id");
    assert.equal(RECORD_START_TIME_COLUMN_NAME, "StartTime");
    assert.equal(RECORD_END_TIME_COLUMN_NAME, "EndTime");
    assert.equal(RECORD_DURATION_COLUMN_NAME, "Duration");
    assert.equal(RECORD_NOTES_COLUMN_NAME, "Notes");
    assert.equal(SETTINGS_KEY_COLUMN_NAME, "Key");
    assert.equal(SETTINGS_VALUE_COLUMN_NAME, "Value");
});

console.log("packages/core tests passed");
