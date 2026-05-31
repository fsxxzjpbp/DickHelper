import type { IRecord } from "@dickhelper/shared";
import type {
    IPredictionAnalysis,
    PredictionConfidenceLevel,
    PredictionFallbackReason,
    PredictionStatus,
} from "./prediction.types";

const DAY_MS = 86_400_000;
const PRIOR_INTERVAL_DAYS = 3;
const PRIOR_STRENGTH = 1;
const RECENT_INTERVAL_LIMIT = 10;
const MIN_INTERVAL_SAMPLES = 2;
const MAX_HALF_WINDOW_DAYS = 1.5;
const MIN_DISPERSION_DAYS = 0.25;
const UNSTABLE_DISPERSION_DAYS = 2.5;
const MAD_SCALE = 1.4826;

const CONFIDENCE_CANDIDATES: readonly {
    readonly Confidence: PredictionConfidenceLevel;
    readonly ZScore: number;
}[] = [
    { Confidence: 0.95, ZScore: 1.959963984540054 },
    { Confidence: 0.9, ZScore: 1.6448536269514722 },
    { Confidence: 0.85, ZScore: 1.4395314709384563 },
];

export function AnalyzePrediction(records: readonly IRecord[], now: Date = new Date()): IPredictionAnalysis {
    const ordered = [...records].sort((left, right) => left.EndTime.getTime() - right.EndTime.getTime());
    const sampleCount = ordered.length;
    const lastRecord = sampleCount > 0 ? ordered[sampleCount - 1] ?? null : null;
    const lastRecordAt = lastRecord?.EndTime ?? null;
    const daysSinceLast = lastRecordAt === null ? null : Math.max(0, now.getTime() - lastRecordAt.getTime()) / DAY_MS;
    const intervals = BuildIntervals(ordered);
    const intervalSampleCount = intervals.length;

    if (intervalSampleCount < MIN_INTERVAL_SAMPLES) {
        return {
            Status: "insufficient_samples",
            SampleCount: sampleCount,
            IntervalSampleCount: intervalSampleCount,
            RecentIntervalCount: 0,
            DaysSinceLast: daysSinceLast,
            LastRecordAt: lastRecordAt,
            PriorIntervalDays: PRIOR_INTERVAL_DAYS,
            PriorStrength: PRIOR_STRENGTH,
            CenterIntervalDays: null,
            MedianIntervalDays: null,
            MeanIntervalDays: null,
            DispersionDays: null,
            ChosenConfidenceLevel: null,
            HalfWidthDays: null,
            PredictedCenterAt: null,
            PredictedWindowStart: null,
            PredictedWindowEnd: null,
            CoarseRangeStart: null,
            CoarseRangeEnd: null,
            FallbackReason: "not_enough_intervals",
        };
    }

    const recentIntervals = intervals.slice(-RECENT_INTERVAL_LIMIT);
    const recentIntervalCount = recentIntervals.length;
    const meanIntervalDays = GetMean(recentIntervals);
    const medianIntervalDays = GetMedian(recentIntervals);
    const centerIntervalDays =
        (PRIOR_INTERVAL_DAYS * PRIOR_STRENGTH + Sum(recentIntervals)) / (PRIOR_STRENGTH + recentIntervalCount);
    const dispersionDays = GetMadDispersion(recentIntervals, centerIntervalDays);
    const predictedCenterAt = lastRecordAt === null ? null : new Date(lastRecordAt.getTime() + centerIntervalDays * DAY_MS);
    const coarseRange = predictedCenterAt === null ? null : BuildCoarseRange(predictedCenterAt);
    const selectedWindow = SelectConfidenceWindow(dispersionDays);

    if (selectedWindow !== null && predictedCenterAt !== null) {
        const predictedWindowStart = new Date(predictedCenterAt.getTime() - selectedWindow.HalfWidthDays * DAY_MS);
        const predictedWindowEnd = new Date(predictedCenterAt.getTime() + selectedWindow.HalfWidthDays * DAY_MS);

        return {
            Status: "window_predicted",
            SampleCount: sampleCount,
            IntervalSampleCount: intervalSampleCount,
            RecentIntervalCount: recentIntervalCount,
            DaysSinceLast: daysSinceLast,
            LastRecordAt: lastRecordAt,
            PriorIntervalDays: PRIOR_INTERVAL_DAYS,
            PriorStrength: PRIOR_STRENGTH,
            CenterIntervalDays: centerIntervalDays,
            MedianIntervalDays: medianIntervalDays,
            MeanIntervalDays: meanIntervalDays,
            DispersionDays: dispersionDays,
            ChosenConfidenceLevel: selectedWindow.Confidence,
            HalfWidthDays: selectedWindow.HalfWidthDays,
            PredictedCenterAt: predictedCenterAt,
            PredictedWindowStart: predictedWindowStart,
            PredictedWindowEnd: predictedWindowEnd,
            CoarseRangeStart: coarseRange?.Start ?? null,
            CoarseRangeEnd: coarseRange?.End ?? null,
            FallbackReason: "none",
        };
    }

    const fallbackReason: PredictionFallbackReason =
        dispersionDays > UNSTABLE_DISPERSION_DAYS ? "high_dispersion" : "window_too_wide";
    const status: PredictionStatus = fallbackReason === "high_dispersion" ? "unstable_pattern" : "coarse_range_only";

    return {
        Status: status,
        SampleCount: sampleCount,
        IntervalSampleCount: intervalSampleCount,
        RecentIntervalCount: recentIntervalCount,
        DaysSinceLast: daysSinceLast,
        LastRecordAt: lastRecordAt,
        PriorIntervalDays: PRIOR_INTERVAL_DAYS,
        PriorStrength: PRIOR_STRENGTH,
        CenterIntervalDays: centerIntervalDays,
        MedianIntervalDays: medianIntervalDays,
        MeanIntervalDays: meanIntervalDays,
        DispersionDays: dispersionDays,
        ChosenConfidenceLevel: null,
        HalfWidthDays: null,
        PredictedCenterAt: predictedCenterAt,
        PredictedWindowStart: null,
        PredictedWindowEnd: null,
        CoarseRangeStart: status === "coarse_range_only" ? coarseRange?.Start ?? null : null,
        CoarseRangeEnd: status === "coarse_range_only" ? coarseRange?.End ?? null : null,
        FallbackReason: fallbackReason,
    };
}

function BuildIntervals(records: readonly IRecord[]): number[] {
    const intervals: number[] = [];

    for (let index = 1; index < records.length; index++) {
        const previous = records[index - 1];
        const current = records[index];
        if (previous === undefined || current === undefined) {
            continue;
        }

        intervals.push((current.EndTime.getTime() - previous.EndTime.getTime()) / DAY_MS);
    }

    return intervals;
}

function Sum(values: readonly number[]): number {
    let total = 0;

    for (const value of values) {
        total += value;
    }

    return total;
}

function GetMean(values: readonly number[]): number {
    return Sum(values) / values.length;
}

function GetMedian(values: readonly number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
        return sorted[middle] ?? 0;
    }

    const lower = sorted[middle - 1] ?? 0;
    const upper = sorted[middle] ?? 0;
    return (lower + upper) / 2;
}

function GetMadDispersion(values: readonly number[], center: number): number {
    const deviations = values.map((value) => Math.abs(value - center));
    const mad = GetMedian(deviations);
    return Math.max(MIN_DISPERSION_DAYS, mad * MAD_SCALE);
}

function SelectConfidenceWindow(
    dispersionDays: number
): { readonly Confidence: PredictionConfidenceLevel; readonly HalfWidthDays: number } | null {
    for (const candidate of CONFIDENCE_CANDIDATES) {
        const halfWidthDays = dispersionDays * candidate.ZScore;
        if (halfWidthDays <= MAX_HALF_WINDOW_DAYS) {
            return {
                Confidence: candidate.Confidence,
                HalfWidthDays: halfWidthDays,
            };
        }
    }

    return null;
}

function BuildCoarseRange(center: Date): { readonly Start: Date; readonly End: Date } {
    return {
        Start: new Date(center.getTime() - DAY_MS),
        End: new Date(center.getTime() + DAY_MS),
    };
}
