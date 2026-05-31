import assert from "node:assert/strict";
import type { IRecord } from "@dickhelper/shared";
import { AnalyzePrediction } from "../src/index";

function RunTest(name: string, fn: () => void): void {
    fn();
    console.log(`✓ ${name}`);
}

const DAY_MS = 86_400_000;
const BASE_END_TIME = new Date("2026-05-01T12:00:00.000Z");
const FIXED_NOW = new Date("2026-06-01T12:00:00.000Z");

RunTest("returns insufficient_samples when fewer than two intervals exist", () => {
    const records = [CreateRecord("record-1", BASE_END_TIME)];

    const result = AnalyzePrediction(records, FIXED_NOW);

    assert.equal(result.Status, "insufficient_samples");
    assert.equal(result.SampleCount, 1);
    assert.equal(result.IntervalSampleCount, 0);
    assert.equal(result.RecentIntervalCount, 0);
    assert.equal(result.LastRecordAt?.toISOString(), BASE_END_TIME.toISOString());
    assert.equal(result.DaysSinceLast, 31);
    assert.equal(result.CenterIntervalDays, null);
    assert.equal(result.MedianIntervalDays, null);
    assert.equal(result.MeanIntervalDays, null);
    assert.equal(result.DispersionDays, null);
    assert.equal(result.ChosenConfidenceLevel, null);
    assert.equal(result.HalfWidthDays, null);
    assert.equal(result.PredictedCenterAt, null);
    assert.equal(result.PredictedWindowStart, null);
    assert.equal(result.PredictedWindowEnd, null);
    assert.equal(result.CoarseRangeStart, null);
    assert.equal(result.CoarseRangeEnd, null);
    assert.equal(result.FallbackReason, "not_enough_intervals");
});

RunTest("predicts a stable window for uniform 3-day intervals", () => {
    const orderedRecords = BuildSequence("stable", BASE_END_TIME, [3, 3, 3]);
    const reversedRecords = [...orderedRecords].reverse();
    const lastRecord = orderedRecords[orderedRecords.length - 1];

    if (lastRecord === undefined) {
        throw new Error("Expected a last record");
    }

    const result = AnalyzePrediction(reversedRecords, FIXED_NOW);

    assert.equal(result.Status, "window_predicted");
    assert.equal(result.SampleCount, 4);
    assert.equal(result.IntervalSampleCount, 3);
    assert.equal(result.RecentIntervalCount, 3);
    assert.equal(result.CenterIntervalDays, 3);
    assert.equal(result.MedianIntervalDays, 3);
    assert.equal(result.MeanIntervalDays, 3);
    assert.ok(result.DispersionDays !== null);
    assert.equal(result.ChosenConfidenceLevel, 0.95);
    assert.ok(result.HalfWidthDays !== null);
    assert.ok(result.HalfWidthDays <= 1.5);
    assert.notEqual(result.PredictedCenterAt, null);
    assert.notEqual(result.PredictedWindowStart, null);
    assert.notEqual(result.PredictedWindowEnd, null);
    assert.equal(result.PredictedCenterAt!.toISOString(), AddDays(lastRecord.EndTime, 3).toISOString());
    assert.ok(result.PredictedWindowStart!.getTime() < result.PredictedCenterAt!.getTime());
    assert.ok(result.PredictedWindowEnd!.getTime() > result.PredictedCenterAt!.getTime());
    assert.notEqual(result.CoarseRangeStart, null);
    assert.notEqual(result.CoarseRangeEnd, null);
    assert.equal(result.FallbackReason, "none");
});

RunTest("predicts a stable window for intervals away from the 3-day prior", () => {
    const records = BuildSequence("prior-away", BASE_END_TIME, [6, 6]);

    const result = AnalyzePrediction(records, FIXED_NOW);

    assert.equal(result.Status, "window_predicted");
    assert.equal(result.SampleCount, 3);
    assert.equal(result.IntervalSampleCount, 2);
    assert.equal(result.RecentIntervalCount, 2);
    assert.equal(result.MedianIntervalDays, 6);
    assert.equal(result.CenterIntervalDays, 5);
    assert.ok(result.DispersionDays !== null);
    assert.equal(result.ChosenConfidenceLevel, 0.95);
    assert.ok(result.HalfWidthDays !== null);
    assert.ok(result.HalfWidthDays <= 1.5);
    assert.notEqual(result.PredictedCenterAt, null);
    assert.notEqual(result.PredictedWindowStart, null);
    assert.notEqual(result.PredictedWindowEnd, null);
    assert.equal(result.FallbackReason, "none");
});

RunTest("downgrades high-dispersion patterns out of precise windows", () => {
    const records = BuildSequence("noisy", BASE_END_TIME, [1, 4, 8, 13, 21]);

    const result = AnalyzePrediction(records, FIXED_NOW);

    assert.ok(result.Status === "coarse_range_only" || result.Status === "unstable_pattern");
    assert.ok(result.DispersionDays !== null);
    assert.ok(result.DispersionDays > 1.5);
    assert.equal(result.ChosenConfidenceLevel, null);
    assert.equal(result.HalfWidthDays, null);
    assert.equal(result.PredictedWindowStart, null);
    assert.equal(result.PredictedWindowEnd, null);
    assert.notEqual(result.PredictedCenterAt, null);

    if (result.Status === "coarse_range_only") {
        assert.notEqual(result.CoarseRangeStart, null);
        assert.notEqual(result.CoarseRangeEnd, null);
        assert.equal(result.FallbackReason, "window_too_wide");
    } else {
        assert.equal(result.CoarseRangeStart, null);
        assert.equal(result.CoarseRangeEnd, null);
        assert.equal(result.FallbackReason, "high_dispersion");
    }
});

RunTest("shrinks prior influence as sample size grows", () => {
    const smallSample = AnalyzePrediction(BuildSequence("small", BASE_END_TIME, [6, 6, 6, 6, 6]), FIXED_NOW);
    const largeSample = AnalyzePrediction(BuildSequence("large", BASE_END_TIME, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6]), FIXED_NOW);

    assert.equal(smallSample.Status, "window_predicted");
    assert.equal(largeSample.Status, "window_predicted");
    assert.ok(smallSample.CenterIntervalDays !== null);
    assert.ok(largeSample.CenterIntervalDays !== null);

    const smallDelta = Math.abs(smallSample.CenterIntervalDays - 6);
    const largeDelta = Math.abs(largeSample.CenterIntervalDays - 6);

    assert.ok(largeDelta < smallDelta);
    assert.ok(smallSample.CenterIntervalDays < largeSample.CenterIntervalDays);
});

RunTest("produces stable results when now is injected", () => {
    const records = BuildSequence("stable-now", BASE_END_TIME, [3, 3, 3]);
    const now = new Date("2026-06-15T08:30:00.000Z");

    const first = AnalyzePrediction(records, now);
    const second = AnalyzePrediction(records, now);

    assert.deepEqual(first, second);
});

console.log("packages/core prediction tests passed");

function CreateRecord(id: string, endTime: Date): IRecord {
    return {
        Id: id,
        StartTime: new Date(endTime.getTime() - 60 * 60 * 1000),
        EndTime: new Date(endTime),
        Duration: 60,
    };
}

function BuildSequence(prefix: string, start: Date, intervals: readonly number[]): IRecord[] {
    const records: IRecord[] = [CreateRecord(`${prefix}-0`, start)];
    let currentEndTime = start;

    for (let index = 0; index < intervals.length; index++) {
        const intervalDays = intervals[index];
        if (intervalDays === undefined) {
            continue;
        }

        currentEndTime = AddDays(currentEndTime, intervalDays);
        records.push(CreateRecord(`${prefix}-${index + 1}`, currentEndTime));
    }

    return records;
}

function AddDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
}
