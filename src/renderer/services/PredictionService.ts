import type { IRecord } from "@dickhelper/shared";
import { AnalyzePrediction, type IPredictionAnalysis } from "@dickhelper/core";

export class PredictionService {
    public static Analyze(records: readonly IRecord[]): IPredictionAnalysis {
        return AnalyzePrediction(records);
    }
}
