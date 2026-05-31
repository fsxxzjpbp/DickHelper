import type { IAiAnalysisData, IAiConfig } from "./ai.types";
import { AnalyzeLocally } from "./analyzeLocally";
import { AnalyzeWithApi } from "./analyzeWithApi";

export async function Analyze(data: IAiAnalysisData, config: IAiConfig): Promise<string> {
    if (config.Provider === "local") {
        return AnalyzeLocally(data);
    }

    return AnalyzeWithApi(data, config);
}
