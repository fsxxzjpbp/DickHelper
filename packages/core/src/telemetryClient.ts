import type { ITelemetryLaunchRequest, ITelemetryLaunchResponse } from "@dickhelper/shared";

const TELEMETRY_LAUNCH_PATH = "/api/v1/telemetry/launch";

// 上报一次活跃数据，失败静默忽略
export async function reportTelemetryLaunch(
    baseUrl: string,
    data: ITelemetryLaunchRequest
): Promise<void> {
    const url = `${baseUrl}${TELEMETRY_LAUNCH_PATH}`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch {
        // 网络失败静默忽略
        return;
    }

    if (!response.ok) {
        // 服务端错误静默忽略
        return;
    }

    try {
        await response.json() as ITelemetryLaunchResponse;
    } catch {
        // 响应解析失败静默忽略
    }
}
