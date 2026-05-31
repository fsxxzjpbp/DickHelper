export type PredictionStatus =
    | "insufficient_samples"
    | "window_predicted"
    | "coarse_range_only"
    | "unstable_pattern";

export type PredictionConfidenceLevel = 0.95 | 0.9 | 0.85;

export type PredictionFallbackReason = "none" | "not_enough_intervals" | "window_too_wide" | "high_dispersion";

export interface IPredictionAnalysis {
    readonly Status: PredictionStatus;
    readonly SampleCount: number;
    readonly IntervalSampleCount: number;
    readonly RecentIntervalCount: number;
    readonly DaysSinceLast: number | null;
    readonly LastRecordAt: Date | null;
    readonly PriorIntervalDays: number;
    readonly PriorStrength: number;
    readonly CenterIntervalDays: number | null;
    readonly MedianIntervalDays: number | null;
    readonly MeanIntervalDays: number | null;
    readonly DispersionDays: number | null;
    readonly ChosenConfidenceLevel: PredictionConfidenceLevel | null;
    readonly HalfWidthDays: number | null;
    readonly PredictedCenterAt: Date | null;
    readonly PredictedWindowStart: Date | null;
    readonly PredictedWindowEnd: Date | null;
    readonly CoarseRangeStart: Date | null;
    readonly CoarseRangeEnd: Date | null;
    readonly FallbackReason: PredictionFallbackReason;
}
